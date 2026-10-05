# Data Requirements For Full Proposal Coverage

The current release is honest about what it can and cannot implement. It uses real nflverse play-by-play, contract-history, and schedule files, but it does not have the QBR or composite running-back table described in the proposal. The following data package is required before those claims can be implemented.

## 1. Quarterback QBR

Required grain: one row per quarterback-team-season.

Required fields:

- `season`
- `team`
- Stable player identifier and player name
- Regular-season QBR value, with the provider's scale and definition
- Passing attempts used as the weighting denominator
- A documented treatment for players traded during a season
- A source URL, retrieval timestamp, license/usage terms, and file hash

The team-season value must be calculated as a passing-attempt-weighted average of the quarterbacks who played for that team. The source must be an actual QBR provider export or licensed dataset. Pro Football Reference and the checked-in nflverse play-by-play files do not provide an ESPN QBR field, so passer rating, EPA, or a fabricated proxy must not be labeled QBR.

## 2. Composite running-back rating

Required grain: one row per running-back-team-season, or a play-level table from which it can be calculated.

Required fields:

- `season`, `team`, stable player identifier, and position
- Rushing attempts
- Rushing yards
- Rushing touchdowns or scoring contribution
- Success-rate numerator and denominator, or the play-level fields needed to calculate them
- A source definition for scoring and success rate

The proposal must specify the composite formula and weights before model fitting. A reproducible implementation could calculate team rating as an attempt-weighted combination of success rate, rushing yards per attempt, and scoring. The weights, missing-value rules, team changes, and minimum-attempt threshold must be recorded in the run metadata.

The existing nflverse play-by-play can supply much of this, but the loader must request the relevant fields such as `rushing_yards`, `yards_gained`, `rush_touchdown`, `rush_attempt`, and `success`, then test the derived totals against an independent season table.

## 3. Salary window and denominator

Required seasons: 2015-2020 and 2022-2025, excluding 2021, if the proposal's 320 team-season window is retained.

Required grain: one row per player-team-season contract charge.

Required fields:

- `season`, team abbreviation, stable player identifier, and position group
- Season cap charge in millions, with a precise definition
- Trade/release/restructure/dead-money treatment
- A complete denominator for team salary share, preferably an authoritative team cap-accounting total
- Source URL, retrieval timestamp, license/usage terms, and file hash

The current nflverse historical contracts release is a real source and includes 2025 history, but its records are sourced from OverTheCap and do not by themselves establish official team cap accounting. Every team-season must be checked for missing QB/RB records and denominator coverage. Missing data must be excluded or explicitly treated as missing, never silently converted to zero.

## 4. Outcomes and joins

To evaluate 2025 team-seasons, the schedule source must include completed 2025 regular-season results and postseason participation. Every source must join through normalized team abbreviations and season keys. The join audit must report:

- Team-seasons present in each source
- Unmatched teams and players
- Duplicate player-team-season records
- Missing QBR, RB, salary, wins, and playoff labels
- Counts before and after every exclusion

## 5. Acceptance tests before using the data

- All source hashes and row counts are recorded in `metadata.json`.
- No synthetic, manually typed, or unlabeled proxy values are used.
- The 2021 exclusion is visible in the configured season list and output rows.
- QBR and EPA are separate named columns with separate provenance.
- The RB formula and weights are stored with the artifact release.
- Salary shares sum against the documented denominator and are checked for impossible values.
- The time-based or season-based evaluation split is defined before fitting models.
- The paper and site report the actual source, sample size, exclusions, and failed success criteria.

Until these requirements are met, the current EPA-based quarterback module should remain labeled as an EPA analysis rather than being presented as the proposal's QBR analysis.
