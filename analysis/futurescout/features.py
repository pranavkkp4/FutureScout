from __future__ import annotations

import ast
from typing import Any

import numpy as np
import pandas as pd

from .config import TEAM_ALIASES, TEAM_NAMES

WP_FEATURES = [
    "score_diff", "time", "sd_x_time", "sd_sq", "sqrt_time", "qtr", "is_q4",
    "sd_x_q4", "yardline", "yardline_sq", "log_ytg", "down_1", "down_2", "down_3",
    "down_4", "down_x_ytg", "to_diff", "goal_to_go",
]
CONV_FEATURES = [
    "log_ytg", "ydstogo", "yardline", "score_diff", "time", "qtr", "is_q4", "to_diff",
    "goal_to_go", "is_pass",
]
FG_FEATURES = ["distance", "distance_sq"]


def clean_pbp(frame: pd.DataFrame) -> pd.DataFrame:
    regular = frame.loc[frame["season_type"].eq("REG")].copy()
    regular = regular.loc[regular["posteam"].notna() & regular["defteam"].notna()]
    regular = regular.loc[regular["down"].between(1, 4)]
    regular = regular.loc[regular["two_point_attempt"].fillna(0).eq(0)]
    regular = regular.loc[regular["qb_kneel"].fillna(0).eq(0)]
    regular = regular.loc[regular["qb_spike"].fillna(0).eq(0)]
    regular = regular.loc[regular["aborted_play"].fillna(0).eq(0)]
    regular["posteam"] = regular["posteam"].replace(TEAM_ALIASES)
    regular["defteam"] = regular["defteam"].replace(TEAM_ALIASES)
    required = [
        "game_seconds_remaining", "posteam_score", "defteam_score", "ydstogo", "yardline_100"
    ]
    regular = regular.dropna(subset=required).copy()
    # Rebuild the score from the possession team's score columns instead of
    # trusting a precomputed orientation field from the source release.
    regular["score_diff"] = (
        regular["posteam_score"].astype(float) - regular["defteam_score"].astype(float)
    )
    regular["time"] = regular["game_seconds_remaining"].clip(lower=0, upper=3600) / 3600
    regular["to_diff"] = (
        regular["posteam_timeouts_remaining"].fillna(0)
        - regular["defteam_timeouts_remaining"].fillna(0)
    )
    regular["is_q4"] = regular["qtr"].eq(4).astype(int)
    regular["goal_to_go"] = regular["yardline_100"].le(regular["ydstogo"]).astype(int)
    return regular


def wp_features(frame: pd.DataFrame) -> pd.DataFrame:
    data = pd.DataFrame(index=frame.index)
    seconds = frame["game_seconds_remaining"].clip(lower=0, upper=3600).astype(float)
    score = frame["score_diff"].astype(float)
    ytg = frame["ydstogo"].clip(lower=1).astype(float)
    yardline = frame["yardline_100"].clip(lower=1, upper=99).astype(float)
    data["score_diff"] = score
    data["time"] = seconds / 3600
    data["sd_x_time"] = score * np.sqrt(np.maximum(seconds, 1) / 3600)
    data["sd_sq"] = score * score
    data["sqrt_time"] = np.sqrt(seconds / 3600)
    data["qtr"] = frame["qtr"].astype(float)
    data["is_q4"] = frame["qtr"].eq(4).astype(int)
    data["sd_x_q4"] = score * data["is_q4"]
    data["yardline"] = yardline
    data["yardline_sq"] = yardline * yardline / 100
    data["log_ytg"] = np.log1p(ytg)
    for down in range(1, 5):
        data[f"down_{down}"] = frame["down"].eq(down).astype(int)
    data["down_x_ytg"] = frame["down"].astype(float) * data["log_ytg"]
    data["to_diff"] = frame["to_diff"].astype(float)
    data["goal_to_go"] = frame["goal_to_go"].astype(int)
    return data[WP_FEATURES]


def conversion_features(frame: pd.DataFrame, is_pass: int) -> pd.DataFrame:
    data = pd.DataFrame(index=frame.index)
    ytg = frame["ydstogo"].clip(lower=1).astype(float)
    data["log_ytg"] = np.log1p(ytg)
    data["ydstogo"] = ytg
    data["yardline"] = frame["yardline_100"].astype(float)
    data["score_diff"] = frame["score_diff"].astype(float)
    data["time"] = frame["game_seconds_remaining"].clip(lower=0, upper=3600) / 3600
    data["qtr"] = frame["qtr"].astype(float)
    data["is_q4"] = frame["qtr"].eq(4).astype(int)
    data["to_diff"] = frame["to_diff"].astype(float)
    data["goal_to_go"] = frame["goal_to_go"].astype(int)
    data["is_pass"] = is_pass
    return data[CONV_FEATURES]


def fourth_downs(frame: pd.DataFrame) -> pd.DataFrame:
    fourth = frame.loc[frame["down"].eq(4)].copy()
    is_fg = fourth["field_goal_attempt"].fillna(0).eq(1)
    is_punt = fourth["punt_attempt"].fillna(0).eq(1)
    is_go = fourth["fourth_down_converted"].fillna(0).eq(1) | fourth["fourth_down_failed"].fillna(0).eq(1)
    fourth["actual"] = np.select([is_fg, is_punt, is_go], ["FG", "PUNT", "GO"], default="OTHER")
    return fourth.loc[fourth["actual"].ne("OTHER")].copy()


def game_outcomes(games: pd.DataFrame, seasons: list[int]) -> tuple[pd.DataFrame, pd.DataFrame]:
    valid = games.loc[
        games["season"].isin(seasons)
        & games["home_score"].notna()
        & games["away_score"].notna()
    ].copy()
    valid["home_team"] = valid["home_team"].replace(TEAM_ALIASES)
    valid["away_team"] = valid["away_team"].replace(TEAM_ALIASES)
    regular = valid.loc[valid["game_type"].eq("REG")]
    winners = pd.concat(
        [
            regular[["season", "home_team"]].rename(columns={"home_team": "team"}).assign(
                wins=(regular["home_score"] > regular["away_score"]).astype(int)
            ),
            regular[["season", "away_team"]].rename(columns={"away_team": "team"}).assign(
                wins=(regular["away_score"] > regular["home_score"]).astype(int)
            ),
        ],
        ignore_index=True,
    )
    standings = winners.groupby(["season", "team"], as_index=False)["wins"].sum()
    playoff_games = valid.loc[valid["game_type"].isin(["WC", "DIV", "CON", "SB"])]
    playoff = pd.concat([playoff_games[["season", "home_team"]], playoff_games[["season", "away_team"]].rename(columns={"away_team": "home_team"})])
    playoff = playoff.rename(columns={"home_team": "team"}).drop_duplicates()
    playoff["playoff"] = 1
    return standings, playoff


def normalize_team(value: Any) -> list[str]:
    if value is None or (isinstance(value, float) and np.isnan(value)):
        return []
    tokens = [str(item).strip() for item in str(value).split("/")]
    result: list[str] = []
    for token in tokens:
        if len(token) <= 3 and token.isupper():
            result.append(TEAM_ALIASES.get(token, token))
        elif token in TEAM_NAMES:
            result.append(TEAM_NAMES[token])
    return result


def parse_history(value: Any) -> list[dict[str, Any]]:
    if isinstance(value, (list, np.ndarray)):
        return [item for item in value if isinstance(item, dict)]
    if not isinstance(value, str):
        return []
    try:
        parsed = ast.literal_eval(value)
    except (ValueError, SyntaxError):
        return []
    return [item for item in parsed if isinstance(item, dict)] if isinstance(parsed, list) else []


def expand_contracts(contracts: pd.DataFrame, seasons: list[int]) -> pd.DataFrame:
    rows: list[dict[str, object]] = []
    for record in contracts.to_dict("records"):
        history = parse_history(record.get("season_history"))
        for year_record in history:
            year = pd.to_numeric(year_record.get("year"), errors="coerce")
            if pd.isna(year) or int(year) not in seasons or year_record.get("team") == "Total":
                continue
            cap_charge = pd.to_numeric(year_record.get("cap_number"), errors="coerce")
            if pd.isna(cap_charge):
                continue
            teams = normalize_team(year_record.get("team"))
            for team in teams:
                rows.append({
                    "player": record.get("player"), "season": int(year), "team": team, "position": record.get("position"), "cap_m": float(cap_charge)
                })
    expanded = pd.DataFrame(rows)
    if expanded.empty:
        return expanded
    player_seasons = expanded.groupby(["player", "season", "team", "position"], as_index=False)["cap_m"].max()
    return player_seasons.groupby(["season", "team", "position"], as_index=False)["cap_m"].sum()


def build_team_seasons(pbp: pd.DataFrame, contracts: pd.DataFrame, games: pd.DataFrame, seasons: list[int]) -> pd.DataFrame:
    dropbacks = pbp.loc[pbp["qb_dropback"].fillna(0).eq(1) & pbp["qb_epa"].notna()]
    qb = dropbacks.groupby(["season", "posteam"], as_index=False).agg(
        qb_epa_db=("qb_epa", "mean"), qb_dropbacks=("qb_epa", "size"), qb_success=("success", "mean")
    ).rename(columns={"posteam": "team"})
    rush = pbp.loc[pbp["rush_attempt"].fillna(0).eq(1) & pbp["epa"].notna()]
    rushing = rush.groupby(["season", "posteam"], as_index=False).agg(
        rush_epa=("epa", "mean"), rush_success=("success", "mean")
    ).rename(columns={"posteam": "team"})
    standings, playoff = game_outcomes(games, seasons)
    salary = expand_contracts(contracts, seasons)
    totals = salary.groupby(["season", "team"], as_index=False)["cap_m"].sum().rename(columns={"cap_m": "total_cap_m"})
    position = salary.loc[salary["position"].isin(["QB", "RB"])].pivot_table(
        index=["season", "team"], columns="position", values="cap_m", aggfunc="sum", fill_value=0
    ).reset_index()
    position.columns.name = None
    position = position.rename(columns={"QB": "qb_cap_m", "RB": "rb_cap_m"})
    merged = qb.merge(rushing, on=["season", "team"], how="left").merge(standings, on=["season", "team"], how="left")
    merged = merged.merge(playoff, on=["season", "team"], how="left").merge(totals, on=["season", "team"], how="left").merge(position, on=["season", "team"], how="left")
    merged["playoff"] = merged["playoff"].fillna(0).astype(int)
    merged["wins"] = merged["wins"].fillna(0).astype(int)
    for column in ["qb_cap_m", "rb_cap_m"]:
        merged[column] = merged[column].fillna(0)
    for column in ["rush_epa", "rush_success"]:
        merged[column] = merged[column].fillna(0)
    merged["qb_salary_share"] = merged["qb_cap_m"] / merged["total_cap_m"]
    merged["rb_salary_share"] = merged["rb_cap_m"] / merged["total_cap_m"]
    return merged.replace([np.inf, -np.inf], np.nan).dropna(subset=["qb_salary_share", "rb_salary_share"])
