import hashlib
import json
from pathlib import Path

import pandas as pd

from analysis.futurescout.features import clean_pbp


ROOT = Path(__file__).resolve().parents[2]
PUBLIC_DATA = ROOT / "app" / "public" / "data"


def read_json(name: str):
    return json.loads((PUBLIC_DATA / name).read_text(encoding="utf-8"))


def test_published_release_has_reconciled_real_rows():
    report = read_json("report.json")
    decisions = read_json("decisions.json")
    models = read_json("models.json")

    assert len(decisions) == report["dataset"]["fourth_downs"]
    assert report["split"]["train_seasons"][-1] < report["split"]["test_seasons"][0]
    assert 0 < models["go_pass_rate"] < 1
    assert models["conv_lr"]["coef"][-1] != 0
    assert report["validation"]["win_probability"]["max_decile_gap"] >= 0
    assert report["status"] in {"verified", "review_required"}


def test_metadata_hashes_match_cached_sources_when_present():
    metadata = read_json("metadata.json")
    for source in metadata["sources"]:
        path = ROOT / source["path"]
        if not path.exists():
            continue
        digest = hashlib.sha256(path.read_bytes()).hexdigest()
        assert digest == source["sha256"]


def test_clean_pbp_rebuilds_score_from_possession_scores():
    frame = pd.DataFrame(
        [
            {
                "season_type": "REG",
                "posteam": "KC",
                "defteam": "BUF",
                "down": 1,
                "two_point_attempt": 0,
                "qb_kneel": 0,
                "qb_spike": 0,
                "aborted_play": 0,
                "game_seconds_remaining": 1800,
                "posteam_score": 17,
                "defteam_score": 10,
                "ydstogo": 10,
                "yardline_100": 75,
                "qtr": 2,
                "posteam_timeouts_remaining": 3,
                "defteam_timeouts_remaining": 2,
            }
        ]
    )

    result = clean_pbp(frame)

    assert result.iloc[0]["score_diff"] == 7
