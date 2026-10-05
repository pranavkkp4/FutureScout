from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import numpy as np
import pandas as pd
from sklearn.ensemble import HistGradientBoostingClassifier, RandomForestClassifier
from sklearn.inspection import permutation_importance
from sklearn.linear_model import LinearRegression, LogisticRegression
from sklearn.metrics import brier_score_loss, log_loss, mean_squared_error, roc_auc_score
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

from .config import TEAM_ALIASES
from .features import CONV_FEATURES, FG_FEATURES, WP_FEATURES, conversion_features, wp_features


def classification_metrics(model: Any, x: pd.DataFrame, y: pd.Series) -> dict[str, float]:
    probabilities = model.predict_proba(x)[:, 1]
    return {
        "log_loss": float(log_loss(y, probabilities, labels=[0, 1])),
        "brier": float(brier_score_loss(y, probabilities)),
        "auc": float(roc_auc_score(y, probabilities)),
    }


def fit_classifier_pair(x_train: pd.DataFrame, y_train: pd.Series) -> tuple[Pipeline, HistGradientBoostingClassifier]:
    logistic = Pipeline([
        ("scale", StandardScaler()),
        ("model", LogisticRegression(max_iter=1000, random_state=42)),
    ])
    boosting = HistGradientBoostingClassifier(max_iter=150, learning_rate=0.05, max_leaf_nodes=31, random_state=42)
    logistic.fit(x_train, y_train)
    boosting.fit(x_train, y_train)
    return logistic, boosting


def model_payload(model: Pipeline, features: list[str]) -> dict[str, object]:
    scaler = model.named_steps["scale"]
    estimator = model.named_steps["model"]
    return {
        "intercept": float(estimator.intercept_[0]),
        "coef": [float(value) for value in estimator.coef_[0]],
        "mean": [float(value) for value in scaler.mean_],
        "scale": [float(value) for value in scaler.scale_],
        "features": features,
    }


def calibration_rows(model: Any, x: pd.DataFrame, y: pd.Series, model_name: str) -> list[dict[str, object]]:
    probabilities = model.predict_proba(x)[:, 1]
    order = np.argsort(probabilities)
    bins = np.array_split(order, 10)
    return [
        {
            "model": model_name,
            "bin": index + 1,
            "mean_pred": float(probabilities[group].mean()),
            "frac_pos": float(y.iloc[group].mean()),
            "n": int(len(group)),
        }
        for index, group in enumerate(bins)
        if len(group)
    ]


@dataclass
class DecisionEngine:
    wp: Pipeline
    conversion: Pipeline
    touchdown: Pipeline
    field_goal: Pipeline
    punt: LinearRegression
    go_pass_rate: float

    def evaluate(self, states: pd.DataFrame) -> pd.DataFrame:
        data = states.copy()
        convert_pass = self.conversion.predict_proba(conversion_features(data, 1))[:, 1]
        convert_run = self.conversion.predict_proba(conversion_features(data, 0))[:, 1]
        pass_rate = self.go_pass_rate
        p_convert = pass_rate * convert_pass + (1 - pass_rate) * convert_run
        touchdown_pass = self.touchdown.predict_proba(conversion_features(data, 1))[:, 1]
        touchdown_run = self.touchdown.predict_proba(conversion_features(data, 0))[:, 1]
        p_touchdown = np.minimum(
            p_convert, pass_rate * touchdown_pass + (1 - pass_rate) * touchdown_run
        )
        t2 = data["game_seconds_remaining"].clip(lower=6) - 6
        new_yardline = np.maximum(data["yardline_100"] - data["ydstogo"], 1)
        conv_state = pd.DataFrame({
            "game_seconds_remaining": t2, "score_diff": data["score_diff"], "qtr": data["qtr"],
            "down": 1, "ydstogo": np.minimum(10, new_yardline), "yardline_100": new_yardline,
            "to_diff": data["to_diff"], "goal_to_go": (new_yardline <= np.minimum(10, new_yardline)).astype(int),
        })
        fail_yardline = 100 - data["yardline_100"]
        fail_state = pd.DataFrame({
            "game_seconds_remaining": t2, "score_diff": -data["score_diff"], "qtr": data["qtr"],
            "down": 1, "ydstogo": np.minimum(10, fail_yardline), "yardline_100": fail_yardline,
            "to_diff": -data["to_diff"], "goal_to_go": (fail_yardline <= np.minimum(10, fail_yardline)).astype(int),
        })
        wp_conv = self.wp.predict_proba(wp_features(conv_state))[:, 1]
        wp_fail = 1 - self.wp.predict_proba(wp_features(fail_state))[:, 1]
        touchdown_state = pd.DataFrame({
            "game_seconds_remaining": t2, "score_diff": -(data["score_diff"] + 6), "qtr": data["qtr"],
            "down": 1, "ydstogo": 10, "yardline_100": 75, "to_diff": -data["to_diff"], "goal_to_go": 0,
        })
        wp_touchdown = 1 - self.wp.predict_proba(wp_features(touchdown_state))[:, 1]
        wp_go = p_touchdown * wp_touchdown + (p_convert - p_touchdown) * wp_conv + (1 - p_convert) * wp_fail

        kick_distance = data["yardline_100"] + 17
        p_fg = np.where(kick_distance <= 65, self.field_goal.predict_proba(pd.DataFrame({"distance": kick_distance, "distance_sq": kick_distance * kick_distance / 100}))[:, 1], 0)
        made_state = pd.DataFrame({
            "game_seconds_remaining": t2, "score_diff": -(data["score_diff"] + 3), "qtr": data["qtr"],
            "down": 1, "ydstogo": 10, "yardline_100": 75, "to_diff": -data["to_diff"], "goal_to_go": 0,
        })
        miss_yardline = np.maximum(data["yardline_100"] + 7, 20)
        miss_state = pd.DataFrame({
            "game_seconds_remaining": t2, "score_diff": -data["score_diff"], "qtr": data["qtr"],
            "down": 1, "ydstogo": np.minimum(10, 100 - miss_yardline), "yardline_100": 100 - miss_yardline,
            "to_diff": -data["to_diff"], "goal_to_go": 0,
        })
        wp_made = 1 - self.wp.predict_proba(wp_features(made_state))[:, 1]
        wp_miss = 1 - self.wp.predict_proba(wp_features(miss_state))[:, 1]
        wp_fg = np.where(kick_distance <= 65, p_fg * wp_made + (1 - p_fg) * wp_miss, 0)

        punt_yardline = self.punt.predict(pd.DataFrame({"yardline_100": data["yardline_100"], "yardline_sq": data["yardline_100"] ** 2 / 100}))
        punt_yardline = np.clip(punt_yardline, 50, 99)
        punt_state = pd.DataFrame({
            "game_seconds_remaining": t2, "score_diff": -data["score_diff"], "qtr": data["qtr"],
            "down": 1, "ydstogo": np.minimum(10, punt_yardline), "yardline_100": punt_yardline,
            "to_diff": -data["to_diff"], "goal_to_go": 0,
        })
        wp_punt = 1 - self.wp.predict_proba(wp_features(punt_state))[:, 1]
        values = pd.DataFrame({"wp_go": wp_go, "wp_fg": wp_fg, "wp_punt": wp_punt, "p_convert": p_convert, "p_fg": p_fg, "opp_start_after_punt": punt_yardline})
        values["recommended"] = values[["wp_go", "wp_fg", "wp_punt"]].idxmax(axis=1).map({"wp_go": "GO", "wp_fg": "FG", "wp_punt": "PUNT"})
        values["wp_best"] = values[["wp_go", "wp_fg", "wp_punt"]].max(axis=1)
        return pd.concat([data.reset_index(drop=True), values.reset_index(drop=True)], axis=1)


def fit_models(clean: pd.DataFrame, games: pd.DataFrame, train_end: int) -> tuple[dict[str, object], DecisionEngine, dict[str, object]]:
    model_frame = clean.loc[clean["season"].between(clean["season"].min(), clean["season"].max())].copy()
    game_scores = games.loc[
        games["game_type"].eq("REG")
        & games["home_score"].notna()
        & games["away_score"].notna(),
        ["game_id", "home_team", "away_team", "home_score", "away_score"],
    ].drop_duplicates("game_id").copy()
    game_scores["home_team"] = game_scores["home_team"].replace(TEAM_ALIASES)
    game_scores["away_team"] = game_scores["away_team"].replace(TEAM_ALIASES)
    model_frame = model_frame.merge(game_scores, on="game_id", how="inner")
    tied = model_frame["home_score"].eq(model_frame["away_score"])
    model_frame = model_frame.loc[~tied].copy()
    model_frame["win"] = (
        ((model_frame["posteam"] == model_frame["home_team"]) & model_frame["home_score"].gt(model_frame["away_score"]))
        | ((model_frame["posteam"] == model_frame["away_team"]) & model_frame["away_score"].gt(model_frame["home_score"]))
    ).astype(int)
    train = model_frame.loc[model_frame["season"].le(train_end)]
    test = model_frame.loc[model_frame["season"].gt(train_end)]
    wp_lr, wp_hgb = fit_classifier_pair(wp_features(train), train["win"])
    metrics: dict[str, object] = {
        "win_probability": {
            "train_rows": int(len(train)), "test_rows": int(len(test)),
            "logistic": classification_metrics(wp_lr, wp_features(test), test["win"]),
            "gradient_boosting": classification_metrics(wp_hgb, wp_features(test), test["win"]),
        }
    }
    fourth = clean.loc[clean["down"].eq(4)].copy()
    go = fourth.loc[fourth["fourth_down_converted"].fillna(0).eq(1) | fourth["fourth_down_failed"].fillna(0).eq(1)].copy()
    go["converted"] = go["fourth_down_converted"].fillna(0).astype(int)
    go["touchdown"] = (
        go["touchdown"].fillna(0).eq(1) & go["td_team"].eq(go["posteam"])
    ).astype(int)
    kicks = clean.loc[clean["field_goal_attempt"].fillna(0).eq(1) & clean["kick_distance"].notna()].copy()
    kicks["made"] = kicks["field_goal_result"].eq("made").astype(int)
    kicks["distance"] = kicks["kick_distance"].astype(float)
    kicks["distance_sq"] = kicks["distance"] ** 2 / 100
    fg_train, fg_test = kicks.loc[kicks["season"].le(train_end)], kicks.loc[kicks["season"].gt(train_end)]
    fg_lr, fg_hgb = fit_classifier_pair(fg_train[FG_FEATURES], fg_train["made"])
    metrics["field_goal"] = {
        "train_rows": int(len(fg_train)), "test_rows": int(len(fg_test)),
        "logistic": classification_metrics(fg_lr, fg_test[FG_FEATURES], fg_test["made"]),
        "gradient_boosting": classification_metrics(fg_hgb, fg_test[FG_FEATURES], fg_test["made"]),
    }
    punts = clean.loc[clean["punt_attempt"].fillna(0).eq(1)].copy()
    if "play_id" in punts:
        punts = punts.sort_values(["game_id", "play_id"])
    punts["next_posteam"] = punts.groupby("game_id")["posteam"].shift(-1)
    punts["next_yardline"] = punts.groupby("game_id")["yardline_100"].shift(-1)
    punts = punts.loc[punts["next_posteam"].eq(punts["defteam"]) & punts["next_yardline"].notna()]
    punts["yardline_sq"] = punts["yardline_100"] ** 2 / 100
    punt_train = punts.loc[punts["season"].le(train_end)]
    punt_test = punts.loc[punts["season"].gt(train_end)]
    punt_model = LinearRegression().fit(
        punt_train[["yardline_100", "yardline_sq"]], punt_train["next_yardline"]
    )
    punt_prediction = punt_model.predict(punt_test[["yardline_100", "yardline_sq"]])
    punt_error = mean_squared_error(punt_test["next_yardline"], punt_prediction)
    metrics["punt"] = {
        "train_rows": int(len(punt_train)),
        "test_rows": int(len(punt_test)),
        "rmse": float(np.sqrt(punt_error)),
    }
    go_action = go.loc[
        go["pass_attempt"].fillna(0).eq(1) | go["rush_attempt"].fillna(0).eq(1)
    ].copy()
    go_action["is_pass"] = go_action["pass_attempt"].fillna(0).eq(1).astype(int)
    conv_train, conv_test = go_action.loc[go_action["season"].le(train_end)], go_action.loc[go_action["season"].gt(train_end)]
    conv_lr, conv_hgb = fit_classifier_pair(
        conversion_features(conv_train, conv_train["is_pass"]), conv_train["converted"]
    )
    metrics["conversion"] = {
        "train_rows": int(len(conv_train)),
        "test_rows": int(len(conv_test)),
        "logistic": classification_metrics(
            conv_lr, conversion_features(conv_test, conv_test["is_pass"]), conv_test["converted"]
        ),
        "gradient_boosting": classification_metrics(
            conv_hgb, conversion_features(conv_test, conv_test["is_pass"]), conv_test["converted"]
        ),
    }
    td_lr, td_hgb = fit_classifier_pair(
        conversion_features(conv_train, conv_train["is_pass"]), conv_train["touchdown"]
    )
    metrics["touchdown"] = {
        "train_rows": int(len(conv_train)),
        "test_rows": int(len(conv_test)),
        "logistic": classification_metrics(
            td_lr, conversion_features(conv_test, conv_test["is_pass"]), conv_test["touchdown"]
        ),
        "gradient_boosting": classification_metrics(
            td_hgb, conversion_features(conv_test, conv_test["is_pass"]), conv_test["touchdown"]
        ),
    }
    go_pass_rate = float(conv_train["is_pass"].mean())
    engine = DecisionEngine(wp_lr, conv_lr, td_lr, fg_lr, punt_model, go_pass_rate)
    sample = test.sample(min(len(test), 10000), random_state=42)
    importance = permutation_importance(wp_lr, wp_features(sample), sample["win"], n_repeats=3, random_state=42, scoring="neg_log_loss")
    features = [{"model": "win_probability", "feature": name, "importance": float(value)} for name, value in zip(WP_FEATURES, importance.importances_mean)]
    conversion_importance = permutation_importance(
        conv_lr,
        conversion_features(conv_test, conv_test["is_pass"]),
        conv_test["converted"],
        n_repeats=3,
        random_state=42,
        scoring="neg_log_loss",
    )
    features.extend({"model": "conversion", "feature": name, "importance": float(value)} for name, value in zip(CONV_FEATURES, conversion_importance.importances_mean))
    calibration = calibration_rows(wp_lr, wp_features(test), test["win"], "wp_logistic")
    calibration.extend(calibration_rows(conv_lr, conversion_features(conv_test, conv_test["is_pass"]), conv_test["converted"], "conversion_logistic"))
    calibration.extend(calibration_rows(td_lr, conversion_features(conv_test, conv_test["is_pass"]), conv_test["touchdown"], "touchdown_logistic"))
    calibration.extend(calibration_rows(fg_lr, fg_test[FG_FEATURES], fg_test["made"], "field_goal_logistic"))
    payload = {
        "wp_lr": model_payload(wp_lr, WP_FEATURES),
        "conv_lr": model_payload(conv_lr, CONV_FEATURES),
        "td_lr": model_payload(td_lr, CONV_FEATURES),
        "fg_lr": model_payload(fg_lr, FG_FEATURES),
        "go_pass_rate": go_pass_rate,
        "punt_linear": {"intercept": float(punt_model.intercept_), "coef": [float(value) for value in punt_model.coef_], "features": ["yardline_100", "yardline_sq"]},
    }
    return {"metrics": metrics, "feature_importance": features, "calibration": calibration}, engine, payload
