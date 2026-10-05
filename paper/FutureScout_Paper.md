# FutureScout: Fourth-Down Decision Value and Quarterback Salary Efficiency in the NFL

Pranav Kaliaperumal<br>
Department of Computer Science and Engineering<br>
University of Colorado Denver, Denver, Colorado, USA<br>
pranavkumar.kaliaperumal@ucdenver.edu

## Abstract

NFL teams allocate resources through repeated game decisions and long-term roster commitments. FutureScout studies both settings with transparent probabilistic models. The project uses 483,605 downloaded play-by-play rows from 2,743 games, including 462,462 regular-season rows from 2,623 games, across 2015 to 2024, plus the nflverse historical contracts release and game schedule data. A logistic win-probability model reaches 0.478 log loss, 0.162 Brier score, and 0.842 AUC on the 2023 to 2024 holdout. A gradient boosting benchmark reaches 0.478 log loss, 0.161 Brier score, and 0.842 AUC. On 37,637 fourth-down decisions, the decision engine recommends going for it on 63.4% of rows while teams go on 16.6%. In the short-yardage midfield region, going for it produces the highest modeled win probability in 100.0% of 1,218 rows and exceeds punt value by 5.8 percentage points on average. The engine estimates 14.5 percentage points of aggregate win probability left on the table per test-period game, but that quantity represents modeled decision distance rather than causal wins. For quarterback value, EPA per dropback alone reaches 0.909 AUC for same-season playoff classification on the 2021 to 2022 holdout. Adding salary share lowers AUC to 0.907 and worsens log loss by 0.50%. The best expanding-season playoff cross-validation mean AUC is 0.847. Playoff team-seasons carry a higher median quarterback salary share than non-playoff team-seasons in this sample. The release does not claim QBR, a composite running-back rating, or the proposal's 2015-2025 excluding-2021 salary window because those fields are not present in the downloaded public sources. These results support the registered short-yardage and late-game directional claims, but they do not establish a universal go recommendation or causal wins from changing decisions.

**Keywords:** decision analysis, expected points added, National Football League, salary cap, win probability, sports analytics

## 1. Introduction

NFL coaches make fourth-down choices under a visible score, a running clock, field position, and incomplete information. Front offices make quarterback spending choices under a salary cap and an uncertain production forecast. Both decisions require a team to compare an uncertain reward with the cost of a bad outcome.

FutureScout gives those decisions a common unit: expected win probability. The fourth-down module compares going for it, attempting a field goal, and punting. The quarterback module compares team passing efficiency with the salary share that the team commits to quarterbacks. The system publishes the model inputs, the holdout scores, and the source fingerprints alongside the interactive outputs.

This paper makes three contributions. First, it builds a portable logistic win-probability model that a browser can evaluate from exported coefficients. Second, it audits fourth-down behavior across ten regular seasons and records the distance between observed and modeled actions. Third, it defines quarterback value as a within-season residual and tests whether salary share adds predictive information after efficiency enters a playoff classifier.

## 2. Related Work

Carter and Machol valued field position with expected points in early football operations research [1]. Romer documented conservative fourth-down behavior and showed how expected-value analysis can challenge conventional choices [2]. Yam and Lopez estimated the effects of conservative fourth-down decisions and connected those choices to team success [3]. The nflverse project supplies the public play-by-play data that supports this study [4]. The present work uses win probability rather than expected points for the decision engine because score and time directly determine the target outcome.

Public quarterback salary analysis often correlates spending with production. FutureScout instead models an efficiency residual within each season. This choice does not establish causality. It gives the site a clear definition of value and exposes the assumptions behind that definition.

## 3. Data

### 3.1 Play-by-play

The pipeline downloaded one Parquet release for each season from the nflverse data repository. The files cover 2015 through 2024 and contain 483,605 rows from 2,743 games, including 462,462 regular-season rows from 2,623 games and 21,143 postseason rows from 120 games. The pipeline kept regular-season rows with a defined possession team, defensive team, down, distance, field position, score differential, and game clock. It removed two-point attempts, quarterback kneels, quarterback spikes, aborted plays, and rows without the required state variables. The cleaned frame contains 383,574 plays.

The pipeline canonicalized historical team aliases, including STL and LA to LAR, OAK to LV, and SD to LAC, before joining plays to the completed regular-season game schedule. It removed tied games from win-probability training and labeled the target from the possession team's perspective. The pipeline did not use the score displayed at the time of a play as the final outcome label.

### 3.2 Contracts and team outcomes

The salary module downloaded the historical contracts Parquet release from nflverse. That release attributes its contract data to OverTheCap and contains 52,801 rows in the recorded source file. The pipeline expanded the source season history, selected quarterback and running back position groups, and used each season's reported contract cap charge. It divided each position group's charge by the active contract charge total for the same team-season. The resulting share approximates a team spending share; it does not reproduce official cap accounting.

The pipeline used the nflverse game schedule file [6] for regular-season wins and postseason participation. The quarterback table contains 320 team-seasons with passing, rushing, and contract values. The playoff classifier uses 192 team-seasons from 2015 to 2020 for training and 64 team-seasons from 2021 to 2022 for testing after complete-case filtering. The classifier uses full-season features to classify postseason participation after the season, so it does not represent a preseason forecast.

## 4. Research hypotheses

The project registered five directional hypotheses before interpreting the generated results:

- **H1:** GO produces a higher expected win probability than both FG and PUNT for most fourth-and-two-or-less rows between midfield and the opponent's 35-yard line.
- **H2:** Teams choose GO less often than the decision engine recommends, with the largest gap in the short-yardage midfield region.
- **H3:** The engine recommends GO more often for trailing teams late in the game than for leading teams and more often than during the first half.
- **H4:** EPA per dropback classifies same-season playoff qualification, while adding quarterback salary share changes held-out log loss by less than 5%.
- **H5:** Playoff team-seasons carry a lower median quarterback salary share than non-playoff team-seasons.

The analysis treats these as descriptive tests of the stated sample and model. It does not attach statistical significance claims because the release does not compute confidence intervals or formal hypothesis tests.

## 5. Methods

### 5.1 Win probability

The deployed model uses logistic regression. It takes eighteen engineered features: score differential, normalized game time, score and time interactions, score squared, square-root time, quarter, a fourth-quarter indicator, a score and fourth-quarter interaction, field position, field position squared, log yards to go, down indicators, a down and distance interaction, timeout differential, and a goal-to-go indicator.

The time split trains on 2015 through 2022 and tests on 2023 through 2024. The split prevents rows from a future season from entering the training set. A histogram gradient boosting classifier uses the same feature columns as a nonlinear benchmark. The evaluation reports log loss, Brier score, and AUC. The pipeline also computes permutation importance and decile calibration for each probabilistic submodel on the holdout.

### 5.2 Fourth-down decision engine

The fourth-down frame maps field goal attempts to `FG`, punt attempts to `PUNT`, and fourth-down conversions or failures to `GO`. The conversion model learns from observed go attempts and includes the observed pass/run indicator; the engine mixes pass and run predictions using the 64.3% pass rate observed in the training-period go attempts. A separate touchdown model identifies the touchdown branch among those attempts. The field-goal model predicts a make from kick distance and its square. The punt model predicts the opponent's starting field position from the punt spot with linear regression fit only on the training seasons; its 2023-2024 holdout RMSE is 13.54 yards. The engine treats kicks longer than 65 yards as unavailable.

For each candidate action, the engine evaluates the next state with the win-probability model. For a go attempt, it combines the conversion and turnover-on-downs branches:

`WP_go = p_td * WP_after_touchdown + (p_convert - p_td) * WP_after_conversion + (1 - p_convert) * WP_after_turnover`

For a field goal, it combines the made and missed-kick branches. For a punt, it uses the predicted opponent field position. The engine recommends the action with the highest expected win probability. It assigns decision cost as the difference between that best value and the value of the observed action. This cost describes the model's counterfactual comparison and does not prove that a different action would have won the game.

### 5.3 Quarterback value and playoff qualification

The pipeline measures quarterback efficiency as team EPA per quarterback dropback. The downloaded public sources do not contain QBR, so the release does not substitute EPA for QBR silently: it records EPA as the implemented metric in its coverage ledger. For each season, it fits a linear regression of EPA per dropback on quarterback salary share. It defines quarterback value as the residual and also reports that residual per salary share:

`QBValue_it = EPA_it - (a_t + b_t * QBShare_it)`

`QBValuePerShare_it = QBValue_it / QBShare_it`

Positive residuals indicate that a team-season produced more EPA per dropback than its salary share predicted within that season. The residual does not measure player skill alone because the team aggregates quarterbacks, play design, supporting talent, and game context.

The playoff analysis compares logistic regression, random forest, and histogram gradient boosting. Each full model uses quarterback EPA per dropback, quarterback salary share, rushing EPA, running back salary share, and season. A separate logistic comparison uses EPA per dropback alone and EPA per dropback plus quarterback salary share. The train window covers 2015 to 2020 and the test window covers 2021 to 2022. In addition to this fixed holdout, expanding season folds produce a cross-validated AUC summary; the best mean AUC is 0.847 for logistic regression.

## 6. Results

### 6.1 Model evaluation

Table 1 reports the held-out scores. The logistic win-probability model falls slightly behind gradient boosting on log loss and Brier score, while both models produce nearly identical AUC. The conversion and touchdown models perform better with logistic regression than with gradient boosting. The field-goal models perform almost identically.

**Table 1. Held-out performance on 2023 to 2024**

| Task | Model | Log loss | Brier | AUC |
| --- | --- | ---: | ---: | ---: |
| Win probability | Logistic | 0.4782 | 0.1616 | 0.8420 |
| Win probability | Gradient boosting | 0.4776 | 0.1614 | 0.8424 |
| Conversion | Logistic | 0.6184 | 0.2148 | 0.7061 |
| Conversion | Gradient boosting | 0.6350 | 0.2223 | 0.6844 |
| Touchdown | Logistic | 0.1820 | 0.0531 | 0.9032 |
| Touchdown | Gradient boosting | 0.1981 | 0.0569 | 0.8773 |
| Field goal | Logistic | 0.3655 | 0.1143 | 0.7638 |
| Field goal | Gradient boosting | 0.3650 | 0.1136 | 0.7635 |

The holdout contains 78,497 win-probability rows, 1,545 conversion and touchdown rows, and 2,175 field-goal attempts. The deployed logistic model favors coefficient transparency and portable inference over the small gradient boosting improvement in log loss. The win-probability model's largest test decile calibration gap is 3.43 percentage points, so the proposal's three-point calibration target is not met and the generated report is marked `review_required`. The site shows calibration deciles for every probabilistic submodel and permutation importance for the win-probability and conversion models so readers can inspect that choice.

### 6.2 Fourth-down behavior

Across 37,637 fourth-down decisions, teams went for it on 16.6% of rows. The decision engine recommended GO on 63.4%. On the holdout, teams went on 19.7% of 2023 to 2024 rows, while the engine recommended GO on 63.9%, a 44.3 percentage point difference.

The short-yardage midfield test contains 1,218 rows with two or fewer yards to go and field position between the 35-yard line and midfield. GO produced the highest modeled win probability in 100.0% of those rows and exceeded the punt value by an average of 5.8 percentage points. The result supports H1's majority claim within the tested state region.

The Romer-region comparison shows a smaller observed go rate than the engine recommendation. Teams went on 76.4% of those short-yardage midfield rows, while the engine recommended GO on 100.0%. The overall behavior gap supports H2's underselection direction, but the proposed location-specific version does not because the observed regional gap runs in the opposite direction from the overall pattern.

The engine recommended GO on 76.0% of fourth downs for trailing teams in the fourth quarter and 47.0% for leading teams. It recommended GO on 61.0% during the first half. Trailing teams received more aggressive recommendations than leading teams and more than during the first half. The first-half versus fourth-quarter team recommendation-rate Spearman correlation is 0.270 across 32 teams, documenting substantial rank movement without imposing an unsupported threshold for what counts as a meaningful reorder. These values support H3's directional claim. Overtime rows were excluded from this fourth-quarter comparison. Model recommendations depend on the complete state and vary with field position, distance, score, and clock.

On the 2023 to 2024 holdout, the average game accumulated 14.5 percentage points of modeled decision cost, with 79.0 total probability points across the test games. The measure sums state-level differences between the selected action and the best modeled action. Selection bias, unmeasured context, and model error prevent a causal interpretation.

### 6.3 Quarterback value

The highest residual team-seasons include Kansas City 2018 at +0.329 EPA per dropback, San Francisco 2023 at +0.282, Baltimore 2024 at +0.265, and Baltimore 2019 at +0.261. These rankings combine team-level passing performance with an approximate spending share, so readers should not interpret them as player-only rankings.

Table 2 reports the playoff classifier comparison. EPA per dropback alone reaches 0.909 AUC on the test set. Adding quarterback salary share lowers AUC to 0.907 and changes log loss from 0.4540 to 0.4563, a 0.50% deterioration. H4's magnitude threshold holds, but salary moves the direct comparison in the wrong direction. Across expanding season folds, logistic regression has the best mean AUC at 0.847, while random forest averages 0.817 and gradient boosting averages 0.797. The full gradient boosting classifier produces the strongest fixed-holdout AUC among the three full classifiers, while logistic regression produces the lowest fixed-holdout log loss.

**Table 2. Playoff qualification performance on 2021 to 2022**

| Model | Log loss | AUC |
| --- | ---: | ---: |
| Logistic | 0.4739 | 0.8671 |
| Random forest | 0.4887 | 0.8442 |
| Gradient boosting | 0.4877 | 0.8720 |

Playoff team-seasons carry a median quarterback salary share of 10.1%, compared with 8.9% for non-playoff team-seasons. The league median equals 9.2%, and 46.9% of playoff team-seasons fall below it. The descriptive result does not support H5 in this sample. Individual efficient seasons can coexist with a positive association between quarterback salary share and playoff qualification.

## 7. Limitations

The conversion model learns from teams that chose to go for it. That selection makes the model a description of observed attempts rather than an unbiased estimate of every team's conversion chance. Its pass/run mixture is the observed training-period mix, not a randomized policy estimate. The engine also uses a fixed 65-yard availability rule for field goals, fixed six-second and kickoff/failed-conversion/field-goal-miss transitions, and a punt field-position regression, so it simplifies special-teams context.

The salary module uses reported contract cap charges from each season history and divides position-group charges by the active contract charge total. The result approximates spending share but does not reproduce official cap accounting, restructures, dead money, incentives, or weekly availability. The source's season history and current contract records also determine which team-seasons meet the complete-case filter.

The win-probability model omits personnel, injuries, weather, play-calling tendencies, and betting-market information. It also cannot identify causal effects from observational behavior. The project treats its outputs as transparent decision estimates, not prescriptions or guarantees.

## 8. Conclusion

FutureScout links fourth-down decisions and quarterback spending through an auditable expected-value workflow. The corrected team-label mapping shows a large gap between observed fourth-down aggression and the engine's recommendations, supports GO in the registered short-yardage region, and supports more aggressive recommendations for trailing teams late in games. These modeled recommendations do not establish a universal go rule or causal wins. EPA per dropback classifies playoff participation strongly in the tested team-season sample, while quarterback salary share adds little predictive value and worsens log loss in the direct comparison. The release does not claim that it implemented the proposal's QBR, composite running-back rating, or 2015-2025 excluding-2021 salary table because those public source fields were unavailable. The site makes these results inspectable through a calculator, a decision map, team rankings, quarterback residual-per-share values, and a source ledger.

The next extension should address the conversion model's choice bias with propensity weighting. Later releases can add current contract coverage, player-level decomposition, personnel context, and uncertainty intervals around every counterfactual recommendation.

## References

[1] V. Carter and R. E. Machol, "Operations research on football," *Operations Research*, vol. 19, no. 2, pp. 541-544, 1971.

[2] D. Romer, "Do firms maximize? Evidence from professional football," *Journal of Political Economy*, vol. 114, no. 2, pp. 340-365, 2006.

[3] D. R. Yam and M. J. Lopez, "Quantifying the causal effects of conservative fourth down decision making in the National Football League," *Journal of Quantitative Analysis in Sports*, vol. 15, no. 3, pp. 171-186, 2019.

[4] S. Carl, B. Baldwin, T. Ho, L. Sharpe, and J. Edwards, "nflfastR: An R package for NFL play-by-play data," nflverse, 2020. [Online]. Available: https://www.nflfastr.com

[5] OverTheCap, "Historical NFL contract data," nflverse contracts release. [Online]. Available: https://github.com/nflverse/nflverse-data/releases/tag/contracts

[6] nflverse, "NFL game schedule data," nfldata repository. [Online]. Available: https://github.com/nflverse/nfldata/blob/05cf6a914fd78bd6fd09d997aa87e529e802b588/data/games.csv
