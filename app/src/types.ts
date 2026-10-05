export type Action = "GO" | "FG" | "PUNT";

export interface ModelArtifact {
  intercept: number;
  coef: number[];
  mean: number[];
  scale: number[];
  features: string[];
}

export interface ModelBundle {
  wp_lr: ModelArtifact;
  conv_lr: ModelArtifact;
  td_lr: ModelArtifact;
  fg_lr: ModelArtifact;
  go_pass_rate: number;
  punt_linear: { intercept: number; coef: number[]; features: string[] };
}

export interface GameState {
  yardline100: number;
  ydstogo: number;
  scoreDiff: number;
  secondsRemaining: number;
  qtr: number;
  toDiff?: number;
}

export interface DecisionResult {
  wpGo: number;
  wpFg: number;
  wpPunt: number;
  recommendation: Action;
  pConvert: number;
  pFg: number;
  oppStartAfterPunt: number;
}

export interface ReportMetric {
  log_loss: number;
  brier: number;
  auc: number;
}

export interface ModelReport {
  train_rows: number;
  test_rows: number;
  logistic: ReportMetric;
  gradient_boosting: ReportMetric;
}

export interface Report {
  status: string;
  generated_at_utc: string;
  dataset: { seasons: number[]; games: number; raw_games: number; raw_plays: number; regular_plays: number; clean_plays: number; fourth_downs: number };
  split: { train_seasons: number[]; test_seasons: number[] };
  models: { win_probability: ModelReport; conversion: ModelReport; touchdown: ModelReport; field_goal: ModelReport; punt: { train_rows: number; test_rows: number; rmse: number } };
  validation: {
    win_probability: { calibration_target: number; max_decile_gap: number; calibrated_within_target: boolean; gradient_boosting_beats_logistic_log_loss: boolean; gradient_boosting_beats_logistic_brier: boolean };
    playoff: { auc_target: number; best_cross_validated_mean_auc: number | null; cross_validated_target_met: boolean };
    proposal_scope_complete: boolean;
  };
  proposal_coverage: Record<string, string>;
  hypotheses: {
    h1: { n: number; share_go_best: number | null; mean_go_minus_punt: number | null };
    h2: { test_actual_go: number; test_rec_go: number; all_actual_go: number; all_rec_go: number };
     h2_region: { n: number; actual_go: number | null; rec_go: number | null; gap: number | null; region_gaps: Record<string, number>; is_largest_gap: boolean };
     h3: { q4_trailing: number; q4_leading: number; first_half: number; ranking_teams: number; ranking_spearman_first_half_q4: number | null };
    wp_left: { test_mean_per_game: number | null; test_total: number | null };
  };
  quarterback: {
    status?: string;
    train_rows?: number;
    test_rows?: number;
    models?: Record<string, { log_loss: number; auc: number }>;
    cross_validation?: Record<string, { folds: number; mean_auc: number | null; min_auc: number | null; max_auc: number | null }>;
    h4?: Record<string, number>;
    h5?: Record<string, number>;
  };
  limitations: string[];
}

export interface SeasonSummary {
  season: number;
  n: number;
  actual_go: number;
  rec_go: number;
  wp_lost: number;
}

export interface TeamAgg {
  season: number;
  posteam: string;
  n_fourth: number;
  actual_go: number;
  rec_go: number;
  wp_lost: number;
  go_gap: number;
}

export interface QbValue {
  season: number;
  team: string;
  qb_epa_db: number;
  qb_dropbacks: number;
  qb_success: number;
  rush_epa: number;
  rush_success: number;
  wins: number;
  qb_salary_share: number;
  rb_salary_share: number;
  qb_cap_m: number;
  total_cap_m: number;
  rb_cap_m: number;
  playoff: number;
  qb_epa_expected: number;
  qb_value: number;
  qb_value_per_salary_share: number;
  qb_value_per_cap_m: number;
}

export interface DecisionRow {
  game_id: string;
  play_id: number;
  season: number;
  week: number;
  posteam: string;
  defteam: string;
  qtr: number;
  game_seconds_remaining: number;
  score_diff: number;
  yardline_100: number;
  ydstogo: number;
  actual: Action;
  recommended: Action;
  wp_go: number;
  wp_fg: number;
  wp_punt: number;
  wp_loss: number;
}

export interface CalibrationRow {
  model: string;
  bin: number;
  mean_pred: number;
  frac_pos: number;
  n: number;
}

export interface ImportanceRow {
  model: string;
  feature: string;
  importance: number;
}

export interface WpCurveRow {
  score_diff: number;
  wp_go: number;
  wp_fg: number;
  wp_punt: number;
}

export interface MetadataSource {
  url: string;
  path: string;
  recorded_at_utc: string;
  bytes: number;
  sha256: string;
  rows: number;
}

export interface Metadata {
  generated_at_utc: string;
  pipeline: string;
  configuration: { start_season: number; end_season: number; wp_train_end: number; contracts_included: boolean };
  environment: Record<string, string>;
  sources: MetadataSource[];
}

export interface Artifacts {
  report: Report;
  models: ModelBundle;
  metadata: Metadata;
  seasonSummary: SeasonSummary[];
  teamAgg: TeamAgg[];
  qbValue: QbValue[];
  decisions: DecisionRow[];
  calibration: CalibrationRow[];
  featureImportance: ImportanceRow[];
  wpCurve: WpCurveRow[];
}
