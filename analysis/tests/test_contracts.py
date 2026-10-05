import pandas as pd

from analysis.futurescout.features import expand_contracts, game_outcomes, normalize_team


def test_contract_history_deduplicates_player_season_charges():
    history = [{"year": "2020", "team": "Los Angeles Rams", "cap_number": 12.5}]
    contracts = pd.DataFrame([
        {"player": "Quarterback One", "position": "QB", "season_history": history},
        {"player": "Quarterback One", "position": "QB", "season_history": history},
    ])
    result = expand_contracts(contracts, [2020])
    assert result.iloc[0]["cap_m"] == 12.5
    assert result.iloc[0]["team"] == "LAR"


def test_team_normalization_supports_name_and_abbreviation():
    assert normalize_team("Chiefs") == ["KC"]
    assert normalize_team("LA") == ["LAR"]
    assert normalize_team("STL/OAK/SD") == ["LAR", "LV", "LAC"]
    assert normalize_team("Washington") == ["WAS"]
    assert normalize_team("Redskins") == ["WAS"]


def test_game_outcomes_normalize_historical_aliases():
    games = pd.DataFrame([
        {"season": 2015, "home_team": "OAK", "away_team": "SD", "home_score": 24, "away_score": 17, "game_type": "REG"},
    ])
    standings, _ = game_outcomes(games, [2015])
    assert set(standings["team"]) == {"LV", "LAC"}
    assert standings.loc[standings["team"].eq("LV"), "wins"].item() == 1
