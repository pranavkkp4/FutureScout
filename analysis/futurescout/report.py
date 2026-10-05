from __future__ import annotations

import numpy as np
import pandas as pd
from sklearn.ensemble import HistGradientBoostingClassifier, RandomForestClassifier
from sklearn.linear_model import LinearRegression, LogisticRegression
from sklearn.metrics import log_loss, roc_auc_score
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler


def decision_outputs(engine, fourth: pd.DataFrame) -> pd.DataFrame:
    values = engine.evaluate(fourth)
    values["actual"] = fourth["actual"].to_numpy()
    values["wp_loss"] = (values["wp_best"] - values.apply(lambda row: {"GO": row.wp_go, "FG": row.wp_fg, "PUNT": row.wp_punt}[row.actual], axis=1)).clip(lower=0)
    return values


def decision_summary(decisions: pd.DataFrame) -> tuple[pd.DataFrame, pd.DataFrame]:
    data = decisions.copy()
    data["actual_go"] = data["actual"].eq("GO").astype(int)
    data["rec_go"] = data["recommended"].eq("GO").astype(int)
    season = data.groupby("season", as_index=False).agg(
        n=("game_id", "size"), actual_go=("actual_go", "mean"), rec_go=("rec_go", "mean"), wp_lost=("wp_loss", "sum")
    )
    teams = data.groupby(["season", "posteam"], as_index=False).agg(
        n_fourth=("game_id", "size"), actual_go=("actual_go", "mean"), rec_go=("rec_go", "mean"), wp_lost=("wp_loss", "sum")
    )
    teams["go_gap"] = teams["actual_go"] - teams["rec_go"]
    return season, teams


def hypothesis_report(decisions: pd.DataFrame, train_end: int) -> dict[str, object]:
    data = decisions.copy()
    romer = data.loc[data["ydstogo"].le(2) & data["yardline_100"].between(35, 50)]
    h1_wins = romer["wp_go"].gt(romer[["wp_fg", "wp_punt"]].max(axis=1))
    test = data.loc[data["season"].gt(train_end)]
    q4 = data.loc[data["qtr"].eq(4)]
    first_half = data.loc[data["qtr"].le(2)]
    game_cost = test.groupby("game_id", as_index=False)["wp_loss"].sum()["wp_loss"]
    regions = {
        "short_midfield": data["ydstogo"].le(2) & data["yardline_100"].between(35, 50),
        "short_other": data["ydstogo"].le(2) & ~data["yardline_100"].between(35, 50),
        "long_midfield": data["ydstogo"].gt(2) & data["yardline_100"].between(35, 50),
        "long_other": data["ydstogo"].gt(2) & ~data["yardline_100"].between(35, 50),
    }
    region_gaps = {
        name: float(
            data.loc[mask, "recommended"].eq("GO").mean()
            - data.loc[mask, "actual"].eq("GO").mean()
        )
        for name, mask in regions.items()
        if mask.any()
    }
    h3_data = data.loc[data["qtr"].between(1, 4)].copy()
    h3_data["period"] = np.select(
        [h3_data["qtr"].le(2), h3_data["qtr"].eq(4)],
        ["first_half", "fourth_quarter"],
        default="third_quarter",
    )
    ranking = h3_data.pivot_table(
        index="posteam",
        columns="period",
        values="recommended",
        aggfunc=lambda values: values.eq("GO").mean(),
    ).dropna(subset=["first_half", "fourth_quarter"])
    rank_correlation = ranking["first_half"].corr(ranking["fourth_quarter"], method="spearman")
    return {
        "h1": {"n": int(len(romer)), "share_go_best": float(h1_wins.mean()) if len(romer) else None, "mean_go_minus_punt": float((romer["wp_go"] - romer["wp_punt"]).mean()) if len(romer) else None},
        "h2": {"test_actual_go": float(test["actual"].eq("GO").mean()), "test_rec_go": float(test["recommended"].eq("GO").mean()), "all_actual_go": float(data["actual"].eq("GO").mean()), "all_rec_go": float(data["recommended"].eq("GO").mean())},
        "h2_region": {
            "n": int(len(romer)),
            "actual_go": float(romer["actual"].eq("GO").mean()) if len(romer) else None,
            "rec_go": float(romer["recommended"].eq("GO").mean()) if len(romer) else None,
            "gap": region_gaps.get("short_midfield"),
            "region_gaps": region_gaps,
            "is_largest_gap": bool(region_gaps) and region_gaps.get("short_midfield") == max(region_gaps.values()),
        },
        "h3": {
            "q4_trailing": float(q4.loc[q4["score_diff"] < 0, "recommended"].eq("GO").mean()),
            "q4_leading": float(q4.loc[q4["score_diff"] > 0, "recommended"].eq("GO").mean()),
            "first_half": float(first_half["recommended"].eq("GO").mean()),
            "ranking_teams": int(len(ranking)),
            "ranking_spearman_first_half_q4": float(rank_correlation) if pd.notna(rank_correlation) else None,
        },
        "wp_left": {"test_mean_per_game": float(game_cost.mean()) if len(game_cost) else None, "test_total": float(game_cost.sum()) if len(game_cost) else None},
    }


def quarterback_value(team_seasons: pd.DataFrame) -> pd.DataFrame:
    rows: list[pd.DataFrame] = []
    for _, group in team_seasons.groupby("season"):
        if len(group) < 3:
            continue
        model = LinearRegression().fit(group[["qb_salary_share"]], group["qb_epa_db"])
        output = group.copy()
        output["qb_epa_expected"] = model.predict(output[["qb_salary_share"]])
        output["qb_value"] = output["qb_epa_db"] - output["qb_epa_expected"]
        output["qb_value_per_salary_share"] = output["qb_value"] / output["qb_salary_share"].replace(0, np.nan)
        output["qb_value_per_cap_m"] = output["qb_value"] / output["qb_cap_m"].replace(0, np.nan)
        rows.append(output)
    return (
        pd.concat(rows, ignore_index=True)
        if rows
        else team_seasons.assign(
            qb_epa_expected=np.nan,
            qb_value=np.nan,
            qb_value_per_salary_share=np.nan,
            qb_value_per_cap_m=np.nan,
        )
    )


def _playoff_estimators() -> dict[str, object]:
    return {
        "logistic": LogisticRegression(max_iter=1000, random_state=42),
        "random_forest": RandomForestClassifier(n_estimators=300, min_samples_leaf=4, random_state=42),
        "gradient_boosting": HistGradientBoostingClassifier(
            max_iter=100, learning_rate=0.05, max_leaf_nodes=15, random_state=42
        ),
    }


def playoff_models(team_seasons: pd.DataFrame, train_end: int, test_start: int, test_end: int) -> dict[str, object]:
    features = ["qb_epa_db", "qb_salary_share", "rush_epa", "rb_salary_share", "season"]
    data = team_seasons.dropna(subset=features + ["playoff"]).copy()
    train = data.loc[data["season"].le(train_end)]
    test = data.loc[data["season"].between(test_start, test_end)]
    specs = _playoff_estimators()
    results: dict[str, object] = {"train_rows": int(len(train)), "test_rows": int(len(test)), "models": {}}
    x_train, x_test = train[features], test[features]
    for name, estimator in specs.items():
        model = Pipeline([("scale", StandardScaler()), ("model", estimator)]) if name == "logistic" else estimator
        model.fit(x_train, train["playoff"])
        probabilities = model.predict_proba(x_test)[:, 1]
        results["models"][name] = {"log_loss": float(log_loss(test["playoff"], probabilities, labels=[0, 1])), "auc": float(roc_auc_score(test["playoff"], probabilities))}
    cv_scores: dict[str, list[float]] = {name: [] for name in specs}
    for test_season in sorted(data["season"].unique()):
        fold_train = data.loc[data["season"].lt(test_season)]
        fold_test = data.loc[data["season"].eq(test_season)]
        if len(fold_train) == 0 or fold_test["playoff"].nunique() < 2:
            continue
        for name, estimator in _playoff_estimators().items():
            model = Pipeline([("scale", StandardScaler()), ("model", estimator)]) if name == "logistic" else estimator
            model.fit(fold_train[features], fold_train["playoff"])
            probabilities = model.predict_proba(fold_test[features])[:, 1]
            cv_scores[name].append(float(roc_auc_score(fold_test["playoff"], probabilities)))
    results["cross_validation"] = {
        name: {
            "folds": len(scores),
            "mean_auc": float(np.mean(scores)) if scores else None,
            "min_auc": float(np.min(scores)) if scores else None,
            "max_auc": float(np.max(scores)) if scores else None,
        }
        for name, scores in cv_scores.items()
    }
    epa_only = Pipeline([("scale", StandardScaler()), ("model", LogisticRegression(max_iter=1000, random_state=42))])
    epa_plus = Pipeline([("scale", StandardScaler()), ("model", LogisticRegression(max_iter=1000, random_state=42))])
    epa_only.fit(x_train[["qb_epa_db"]], train["playoff"])
    epa_plus.fit(x_train[["qb_epa_db", "qb_salary_share"]], train["playoff"])
    epa_prob = epa_only.predict_proba(x_test[["qb_epa_db"]])[:, 1]
    plus_prob = epa_plus.predict_proba(x_test[["qb_epa_db", "qb_salary_share"]])[:, 1]
    ll_epa = log_loss(test["playoff"], epa_prob, labels=[0, 1])
    ll_plus = log_loss(test["playoff"], plus_prob, labels=[0, 1])
    grouped = data.groupby("playoff")["qb_salary_share"].median()
    league_median = float(data["qb_salary_share"].median())
    results["h4"] = {"auc_epa_only": float(roc_auc_score(test["playoff"], epa_prob)), "auc_epa_plus_salary": float(roc_auc_score(test["playoff"], plus_prob)), "logloss_epa_only": float(ll_epa), "logloss_epa_plus_salary": float(ll_plus), "logloss_improvement_pct": float((ll_epa - ll_plus) / ll_epa * 100)}
    results["h5"] = {"playoff_median_qb_share": float(grouped.get(1, np.nan)), "nonplayoff_median_qb_share": float(grouped.get(0, np.nan)), "league_median_qb_share": league_median, "share_playoff_below_median": float((data.loc[data["playoff"].eq(1), "qb_salary_share"] < league_median).mean())}
    return results
