# FutureScout

FutureScout studies two NFL resource decisions with one transparent modeling stack:

1. Which fourth-down option gives the offense the highest expected win probability?
2. How much quarterback efficiency does a team receive for its share of the salary budget?

The repository separates source data, analysis code, exported artifacts, and the portfolio site. The site does not connect to a hosted database. The Python pipeline downloads the public releases, records their SHA-256 hashes, fits the models, validates the holdout metrics, and exports the files that the site reads.

## Project layout

```text
analysis/                 Reproducible Python pipeline and tests
app/                      React and Vite portfolio site
data/raw/                 Downloaded source files, ignored by Git
data/processed/           Intermediate parquet files, ignored by Git
app/public/data/          Published analysis artifacts for the site
paper/                    Final paper source and citation notes
```

## Reproduce the analysis

Use Python 3.11 or newer. The current environment also works with Python 3.14.

```bash
python -m venv .venv
# Windows PowerShell
.\.venv\Scripts\Activate.ps1
pip install -e ".[dev]"
python -m analysis.run
pytest
```

The default run covers regular seasons 2015 through 2024, trains on 2015 through 2022, and evaluates on 2023 through 2024. It writes raw downloads to `data/raw/`, cleaned and modeled parquet files to `data/processed/`, and browser-ready results to `app/public/data/`. The report status is `review_required` when a proposal success criterion is not met; it is not a claim that every target passed.

Use a smaller run while developing:

```bash
python -m analysis.run --start-season 2021 --end-season 2024 --skip-contracts
```

That development run cannot produce the quarterback salary analysis. The published run should include the contracts file.

## Run the site

```bash
cd app
npm install
npm run dev
```

The site reads `app/public/data/*.json`. Run the Python pipeline first when those files do not exist. The calculator uses the exported logistic coefficients in the browser and applies the same option-value equations used during analysis.

## Proposal coverage

The public release maps the project proposal to a working research workspace:

- **Decision calculator** evaluates GO, field goal, and punt from score, clock, field position, distance, and timeout differential.
- **Decision map** scans neutral, trailing, and leading game states across field position and distance, with impossible states disabled.
- **Team behavior** ranks 2015-2024 team-seasons by observed versus recommended GO rate and modeled decision cost.
- **QB value** ranks complete team-seasons by EPA per dropback residual per quarterback salary share. This is not QBR: the downloaded public releases do not contain QBR.
- **Decision explorer** filters and pages the row-level fourth-down audit trail.
- **Methods** publishes model scores, calibration gaps, feature importance, registered hypothesis readouts, source hashes, and limitations.

The final generated paper and site artifact release use EPA per quarterback dropback for the quarterback module. The proposal's QBR, composite running-back rating, and 2015-2025 excluding-2021 salary-table requirements are not implemented because the checked-in public sources do not provide those fields. They are recorded as unmet coverage in `report.json` rather than represented by fabricated values.

See [`DATA_REQUIREMENTS.md`](DATA_REQUIREMENTS.md) for the exact real data fields, provenance, join rules, and acceptance tests needed to implement those remaining proposal requirements.

## Evidence policy

The repository does not check in raw NFL data. Each pipeline run records the source URL, cache status, observation timestamp, file size, SHA-256 hash, row count, and season window in `app/public/data/metadata.json`. The paper reports only values present in the generated artifacts. If a run fails, the site shows a data status message rather than filling the page with sample values.

## Sources

- nflverse play-by-play releases: https://github.com/nflverse/nflverse-data/releases/tag/pbp
- nflverse historical contracts release, sourced from OverTheCap: https://github.com/nflverse/nflverse-data/releases/tag/contracts
- nflverse game schedule data: https://raw.githubusercontent.com/nflverse/nfldata/05cf6a914fd78bd6fd09d997aa87e529e802b588/data/games.csv
- nflfastR documentation: https://www.nflfastr.com
