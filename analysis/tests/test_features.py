import pandas as pd

from analysis.futurescout.features import conversion_features, fourth_downs, wp_features


def sample_state() -> pd.DataFrame:
    return pd.DataFrame({
        "game_seconds_remaining": [1800], "score_diff": [0], "qtr": [2], "down": [4],
        "ydstogo": [2], "yardline_100": [48], "to_diff": [0], "goal_to_go": [0],
    })


def test_wp_features_have_stable_schema():
    result = wp_features(sample_state())
    assert result.shape == (1, 18)
    assert result.loc[0, "down_4"] == 1
    assert result.loc[0, "down_1"] == 0


def test_overtime_is_not_marked_as_fourth_quarter():
    result = wp_features(sample_state().assign(qtr=5))
    assert result.loc[0, "is_q4"] == 0


def test_conversion_features_keep_action_indicator():
    result = conversion_features(sample_state(), 1)
    assert result.loc[0, "is_pass"] == 1
    assert result.loc[0, "log_ytg"] > 0


def test_fourth_down_action_mapping():
    frame = sample_state().assign(
        season_type="REG", posteam="KC", defteam="BUF", two_point_attempt=0,
        qb_kneel=0, qb_spike=0, aborted_play=0, field_goal_attempt=0, punt_attempt=0,
        fourth_down_converted=1, fourth_down_failed=0,
    )
    assert fourth_downs(frame).iloc[0]["actual"] == "GO"
