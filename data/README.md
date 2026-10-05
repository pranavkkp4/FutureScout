# Data

The pipeline keeps downloaded source files in `data/raw/` and cleaned/modeling parquet files in `data/processed/`. Both directories stay out of Git because the source releases are large and remain available from nflverse. The generated files are `clean_pbp.parquet`, `fourth_down_decisions.parquet`, and, when contracts are included, `team_seasons.parquet`.

The site consumes the small, derived JSON release in `app/public/data/`. That release includes `metadata.json`, which records the source URLs and hashes used to produce it.
