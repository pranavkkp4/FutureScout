from __future__ import annotations

import argparse
from datetime import datetime, timezone
from importlib.metadata import version
from platform import python_version

import pandas as pd

from .futurescout.config import (
    DEFAULT_END_SEASON, DEFAULT_START_SEASON, PLAYOFF_TEST_END, PLAYOFF_TEST_START,
    PLAYOFF_TRAIN_END, PROCESSED_DIR, PUBLIC_DATA_DIR, WP_TRAIN_END,
)
from .futurescout.data import load_contracts, load_games, load_pbp, write_json
from .futurescout.features import build_team_seasons, clean_pbp, fourth_downs
from .futurescout.models import fit_models
from .futurescout.report import decision_outputs, decision_summary, hypothesis_report, playoff_models, quarterback_value


def arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Download, model, validate, and export FutureScout artifacts")
    parser.add_argument("--start-season", type=int, default=DEFAULT_START_SEASON)
    parser.add_argument("--end-season", type=int, default=DEFAULT_END_SEASON)
    parser.add_argument("--refresh", action="store_true")
    parser.add_argument("--skip-contracts", action="store_true")
    return parser.parse_args()


def main() -> None:
    args = arguments()
    seasons = list(range(args.start_season, args.end_season + 1))
    train_end = min(WP_TRAIN_END, args.end_season - 1)
    if args.start_season > train_end:
        raise ValueError("The selected seasons need at least one training season before the holdout")
    games, games_manifest = load_games(args.refresh)
    raw_pbp, pbp_manifest = load_pbp(seasons, args.refresh)
    clean = clean_pbp(raw_pbp)
    model_report, engine, model_payload = fit_models(clean, games, train_end)
    fourth = fourth_downs(clean)
    decisions = decision_outputs(engine, fourth)
    season_summary, team_summary = decision_summary(decisions)
    contracts_manifest = None
    if args.skip_contracts:
        team_values = pd.DataFrame()
        playoff_report = {"status": "skipped", "reason": "Contract download skipped"}
        qb_values = pd.DataFrame()
    else:
        contracts, contracts_manifest = load_contracts(args.refresh)
        team_values = build_team_seasons(clean, contracts, games, seasons)
        qb_values = quarterback_value(team_values)
        if args.end_season < PLAYOFF_TEST_START:
            playoff_report = {"status": "skipped", "reason": "Selected seasons end before the playoff test window"}
        else:
            playoff_report = playoff_models(team_values, PLAYOFF_TRAIN_END, PLAYOFF_TEST_START, min(PLAYOFF_TEST_END, args.end_season))
    game_count = clean[["game_id"]].drop_duplicates().shape[0]
    raw_game_count = raw_pbp[["game_id"]].drop_duplicates().shape[0]
    wp_calibration = [row for row in model_report["calibration"] if row["model"] == "wp_logistic"]
    wp_calibration_gap = max(
        (abs(row["mean_pred"] - row["frac_pos"]) for row in wp_calibration),
        default=float("nan"),
    )
    playoff_cv = playoff_report.get("cross_validation", {})
    playoff_cv_auc = [
        values["mean_auc"]
        for values in playoff_cv.values()
        if values.get("mean_auc") is not None
    ]
    validation = {
        "win_probability": {
            "calibration_target": 0.03,
            "max_decile_gap": float(wp_calibration_gap),
            "calibrated_within_target": bool(wp_calibration_gap <= 0.03),
            "gradient_boosting_beats_logistic_log_loss": model_report["metrics"]["win_probability"]["gradient_boosting"]["log_loss"] < model_report["metrics"]["win_probability"]["logistic"]["log_loss"],
            "gradient_boosting_beats_logistic_brier": model_report["metrics"]["win_probability"]["gradient_boosting"]["brier"] < model_report["metrics"]["win_probability"]["logistic"]["brier"],
        },
        "playoff": {
            "auc_target": 0.80,
            "best_cross_validated_mean_auc": max(playoff_cv_auc, default=None),
            "cross_validated_target_met": bool(playoff_cv_auc) and max(playoff_cv_auc) > 0.80,
        },
        "proposal_scope_complete": False,
    }
    status = "verified" if validation["win_probability"]["calibrated_within_target"] and validation["proposal_scope_complete"] else "review_required"
    report = {
        "status": status,
        "generated_at_utc": datetime.now(timezone.utc).isoformat(),
        "dataset": {"seasons": seasons, "games": int(game_count), "raw_games": int(raw_game_count), "raw_plays": int(len(raw_pbp)), "regular_plays": int(raw_pbp["season_type"].eq("REG").sum()), "clean_plays": int(len(clean)), "fourth_downs": int(len(decisions))},
        "split": {"train_seasons": [s for s in seasons if s <= train_end], "test_seasons": [s for s in seasons if s > train_end]},
        "models": model_report["metrics"],
        "hypotheses": hypothesis_report(decisions, train_end),
        "quarterback": playoff_report,
        "validation": validation,
        "proposal_coverage": {
            "fourth_down_pbp": "implemented from nflverse play-by-play",
            "qbr": "not_implemented: the downloaded public sources do not contain QBR; EPA per quarterback dropback is used instead",
            "rb_composite_rating": "not_implemented: no source field or documented weighting was supplied",
            "salary_window": "implemented for downloaded 2015-2024 contract history; proposal's 2015-2025 excluding-2021 window is not represented",
            "playoff_cross_validation": "implemented as expanding season folds in addition to the 2021-2022 holdout",
        },
        "limitations": [
            "The conversion model learns from observed go attempts and does not remove selection bias.",
            "The GO pass/run mixture is the training-period observed rate; it is not a randomized policy estimate.",
            "Reported contract cap charges approximate team spending and omit official cap-accounting details.",
            "Counterfactual transitions use fixed six-second, kickoff, failed-conversion, field-goal-miss, and punt-state assumptions rather than observed outcomes for an action that was not chosen.",
            "The win probability model omits personnel, injuries, weather, and betting-market information.",
        ],
    }
    metadata = {
        "generated_at_utc": report["generated_at_utc"], "pipeline": "analysis.run",
        "configuration": {"start_season": args.start_season, "end_season": args.end_season, "wp_train_end": train_end, "contracts_included": not args.skip_contracts},
        "environment": {"python": python_version(), "pandas": version("pandas"), "scikit_learn": version("scikit-learn")},
        "sources": pbp_manifest + [games_manifest] + ([contracts_manifest] if contracts_manifest else []),
    }
    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
    PUBLIC_DATA_DIR.mkdir(parents=True, exist_ok=True)
    write_json(PUBLIC_DATA_DIR / "report.json", report)
    write_json(PUBLIC_DATA_DIR / "models.json", model_payload)
    write_json(PUBLIC_DATA_DIR / "metadata.json", metadata)
    write_json(PUBLIC_DATA_DIR / "season_summary.json", season_summary.to_dict("records"))
    write_json(PUBLIC_DATA_DIR / "team_aggressiveness.json", team_summary.to_dict("records"))
    clean.to_parquet(PROCESSED_DIR / "clean_pbp.parquet", index=False)
    write_json(PUBLIC_DATA_DIR / "decisions.json", decisions[["game_id", "play_id", "season", "week", "posteam", "defteam", "qtr", "game_seconds_remaining", "score_diff", "yardline_100", "ydstogo", "actual", "recommended", "wp_go", "wp_fg", "wp_punt", "wp_loss"]].round(6).to_dict("records"))
    write_json(PUBLIC_DATA_DIR / "calibration.json", model_report["calibration"])
    write_json(PUBLIC_DATA_DIR / "feature_importance.json", model_report["feature_importance"])
    curve_states = pd.DataFrame({
        "score_diff": list(range(-14, 15)), "game_seconds_remaining": 300, "qtr": 4,
        "down": 4, "ydstogo": 2, "yardline_100": 48, "to_diff": 0, "goal_to_go": 0,
    })
    curve = engine.evaluate(curve_states)
    write_json(PUBLIC_DATA_DIR / "wp_curve.json", curve[["score_diff", "wp_go", "wp_fg", "wp_punt"]].round(6).to_dict("records"))
    write_json(PUBLIC_DATA_DIR / "qb_value.json", qb_values.round(6).to_dict("records"))
    decisions.to_parquet(PROCESSED_DIR / "fourth_down_decisions.parquet", index=False)
    if not team_values.empty:
        team_values.to_parquet(PROCESSED_DIR / "team_seasons.parquet", index=False)
    print(f"Exported {len(decisions):,} fourth-down decisions and {len(qb_values):,} quarterback team-seasons.")


if __name__ == "__main__":
    main()
