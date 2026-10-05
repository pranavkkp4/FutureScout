from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
RAW_DIR = ROOT / "data" / "raw"
PROCESSED_DIR = ROOT / "data" / "processed"
PUBLIC_DATA_DIR = ROOT / "app" / "public" / "data"

PBP_URL = "https://github.com/nflverse/nflverse-data/releases/download/pbp/play_by_play_{season}.parquet"
CONTRACTS_URL = "https://github.com/nflverse/nflverse-data/releases/download/contracts/historical_contracts.parquet"
GAMES_URL = "https://raw.githubusercontent.com/nflverse/nfldata/05cf6a914fd78bd6fd09d997aa87e529e802b588/data/games.csv"

DEFAULT_START_SEASON = 2015
DEFAULT_END_SEASON = 2024
WP_TRAIN_END = 2022
PLAYOFF_TRAIN_END = 2020
PLAYOFF_TEST_START = 2021
PLAYOFF_TEST_END = 2022

PBP_COLUMNS = [
    "game_id", "play_id", "season", "season_type", "week", "posteam", "defteam", "posteam_type",
    "qtr", "down", "ydstogo", "yardline_100", "game_seconds_remaining",
    "score_differential", "posteam_score", "defteam_score", "posteam_timeouts_remaining",
    "defteam_timeouts_remaining", "play_type", "play_type_nfl", "qb_dropback", "qb_kneel",
    "qb_spike", "aborted_play", "two_point_attempt", "fourth_down_converted",
    "fourth_down_failed", "field_goal_attempt", "field_goal_result", "kick_distance", "touchdown", "td_team",
    "punt_attempt", "epa", "qb_epa", "success", "rush_attempt", "pass_attempt",
]

TEAM_NAMES = {
    "Arizona Cardinals": "ARI", "Cardinals": "ARI", "Atlanta Falcons": "ATL", "Falcons": "ATL",
    "Baltimore Ravens": "BAL", "Ravens": "BAL", "Buffalo Bills": "BUF", "Bills": "BUF",
    "Carolina Panthers": "CAR", "Panthers": "CAR", "Chicago Bears": "CHI", "Bears": "CHI",
    "Cincinnati Bengals": "CIN", "Bengals": "CIN", "Cleveland Browns": "CLE", "Browns": "CLE",
    "Dallas Cowboys": "DAL", "Cowboys": "DAL", "Denver Broncos": "DEN", "Broncos": "DEN",
    "Detroit Lions": "DET", "Lions": "DET", "Green Bay Packers": "GB", "Packers": "GB",
    "Houston Texans": "HOU", "Texans": "HOU", "Indianapolis Colts": "IND", "Colts": "IND",
    "Jacksonville Jaguars": "JAX", "Jaguars": "JAX", "Kansas City Chiefs": "KC", "Chiefs": "KC",
    "Las Vegas Raiders": "LV", "Raiders": "LV", "Los Angeles Chargers": "LAC", "Chargers": "LAC",
    "Los Angeles Rams": "LAR", "Rams": "LAR", "Miami Dolphins": "MIA", "Dolphins": "MIA",
    "Minnesota Vikings": "MIN", "Vikings": "MIN", "New England Patriots": "NE", "Patriots": "NE",
    "New Orleans Saints": "NO", "Saints": "NO", "New York Giants": "NYG", "Giants": "NYG",
    "New York Jets": "NYJ", "Jets": "NYJ", "Philadelphia Eagles": "PHI", "Eagles": "PHI",
    "Pittsburgh Steelers": "PIT", "Steelers": "PIT", "San Francisco 49ers": "SF", "49ers": "SF",
    "Seattle Seahawks": "SEA", "Seahawks": "SEA", "Tampa Bay Buccaneers": "TB", "Buccaneers": "TB",
    "Tennessee Titans": "TEN", "Titans": "TEN", "Washington Commanders": "WAS", "Commanders": "WAS",
    "Washington": "WAS", "Redskins": "WAS", "Washington Football Team": "WAS", "Washington Redskins": "WAS",
}

TEAM_ALIASES = {"LA": "LAR", "STL": "LAR", "OAK": "LV", "SD": "LAC", "WSH": "WAS"}
