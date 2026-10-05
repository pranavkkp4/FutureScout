import type {
  Artifacts,
  CalibrationRow,
  DecisionRow,
  ImportanceRow,
  Metadata,
  ModelBundle,
  QbValue,
  Report,
  SeasonSummary,
  TeamAgg,
  WpCurveRow,
} from "./types";

async function readJson<T>(name: string): Promise<T> {
  const response = await fetch(`${import.meta.env.BASE_URL}data/${name}.json`);
  if (!response.ok) throw new Error(`Missing analysis artifact: ${name}.json`);
  return response.json() as Promise<T>;
}

export async function loadArtifacts(): Promise<Artifacts> {
  const [report, models, metadata, seasonSummary, teamAgg, qbValue, decisions, calibration, featureImportance, wpCurve] = await Promise.all([
    readJson<Report>("report"),
    readJson<ModelBundle>("models"),
    readJson<Metadata>("metadata"),
    readJson<SeasonSummary[]>("season_summary"),
    readJson<TeamAgg[]>("team_aggressiveness"),
    readJson<QbValue[]>("qb_value"),
    readJson<DecisionRow[]>("decisions"),
    readJson<CalibrationRow[]>("calibration"),
    readJson<ImportanceRow[]>("feature_importance"),
    readJson<WpCurveRow[]>("wp_curve"),
  ]);
  return { report, models, metadata, seasonSummary, teamAgg, qbValue, decisions, calibration, featureImportance, wpCurve };
}
