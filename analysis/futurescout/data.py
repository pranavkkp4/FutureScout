from __future__ import annotations

import hashlib
import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable

import pandas as pd
import requests

from .config import CONTRACTS_URL, GAMES_URL, PBP_COLUMNS, PBP_URL, RAW_DIR, ROOT


def download_file(url: str, destination: Path, refresh: bool = False) -> dict[str, object]:
    """Download one source file and return reproducibility metadata."""
    destination.parent.mkdir(parents=True, exist_ok=True)
    downloaded = refresh or not destination.exists()
    if downloaded:
        partial = destination.with_suffix(destination.suffix + ".part")
        with requests.get(url, stream=True, timeout=120) as response:
            response.raise_for_status()
            with partial.open("wb") as output:
                for chunk in response.iter_content(chunk_size=1024 * 1024):
                    if chunk:
                        output.write(chunk)
        os.replace(partial, destination)
    digest = hashlib.sha256(destination.read_bytes()).hexdigest()
    recorded = datetime.now(timezone.utc).isoformat()
    return {
        "url": url,
        "path": destination.relative_to(ROOT).as_posix(),
        "recorded_at_utc": recorded,
        "cached": not downloaded,
        "bytes": destination.stat().st_size,
        "sha256": digest,
    }


def load_pbp(seasons: Iterable[int], refresh: bool = False) -> tuple[pd.DataFrame, list[dict[str, object]]]:
    frames: list[pd.DataFrame] = []
    manifest: list[dict[str, object]] = []
    for season in seasons:
        url = PBP_URL.format(season=season)
        path = RAW_DIR / f"play_by_play_{season}.parquet"
        manifest_item = download_file(url, path, refresh)
        frame = pd.read_parquet(path, columns=PBP_COLUMNS)
        manifest_item["rows"] = len(frame)
        frames.append(frame)
        manifest.append(manifest_item)
    return pd.concat(frames, ignore_index=True), manifest


def load_contracts(refresh: bool = False) -> tuple[pd.DataFrame, dict[str, object]]:
    path = RAW_DIR / "historical_contracts.parquet"
    metadata = download_file(CONTRACTS_URL, path, refresh)
    frame = pd.read_parquet(path)
    metadata["rows"] = len(frame)
    return frame, metadata


def load_games(refresh: bool = False) -> tuple[pd.DataFrame, dict[str, object]]:
    path = RAW_DIR / "games.csv"
    metadata = download_file(GAMES_URL, path, refresh)
    frame = pd.read_csv(path)
    metadata["rows"] = len(frame)
    return frame, metadata


def write_json(path: Path, payload: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    partial = path.with_suffix(path.suffix + ".tmp")
    partial.write_text(json.dumps(payload, indent=2, allow_nan=False), encoding="utf-8")
    os.replace(partial, path)
