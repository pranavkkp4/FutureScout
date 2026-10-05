import { ArrowRight } from "lucide-react";
import { Link } from "react-router";
import type { CalibrationRow, ImportanceRow, Metadata, Report, ReportMetric, WpCurveRow } from "../types";
import { useArtifacts } from "../context";
import { number, percent } from "../format";
import { SectionHead, Tag } from "../components/Ui";

type EvaluationRow = { task: string; name: string; metrics: ReportMetric };

function CurveChart({ rows }: { rows: WpCurveRow[] }) {
  const width = 720;
  const height = 220;
  const x = (index: number) => 24 + index * ((width - 48) / Math.max(rows.length - 1, 1));
  const y = (value: number) => height - 28 - value * 160;
  const points = (key: "wp_go" | "wp_fg" | "wp_punt") => rows.map((row, index) => `${x(index)},${y(row[key])}`).join(" ");
  const ticks = rows.filter((_, index) => index % 4 === 0);
  return <div className="chart-wrap"><svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Fourth-down option win probability by score differential"><line className="chart-grid" x1="24" y1="32" x2="696" y2="32" /><line className="chart-grid" x1="24" y1="112" x2="696" y2="112" /><line className="chart-grid" x1="24" y1="192" x2="696" y2="192" /><polyline className="curve-go" points={points("wp_go")} /><polyline className="curve-fg" points={points("wp_fg")} /><polyline className="curve-punt" points={points("wp_punt")} />{ticks.map((row) => { const index = rows.findIndex((item) => item.score_diff === row.score_diff); return <text className="chart-label" key={row.score_diff} x={x(index)} y="214" textAnchor="middle">{row.score_diff > 0 ? `+${row.score_diff}` : row.score_diff}</text>; })}</svg><div className="chart-key"><span><i className="key-dot actual" />GO</span><span><i className="key-dot recommended" />Field goal</span><span><i className="key-dot punt" />Punt</span></div></div>;
}

function ScoreBar({ value, max, label }: { value: number; max: number; label: string }) {
  return <div className="score-bar"><span>{label}</span><div><i style={{ width: `${Math.min(100, Math.abs(value) / max * 100)}%` }} /></div><strong>{value < 0 ? "-" : ""}{number(Math.abs(value), 3)}</strong></div>;
}

function DatasetPanel({ report }: { report: Report }) {
  const [firstSeason] = report.dataset.seasons;
  const lastSeason = report.dataset.seasons.at(-1);
  const [firstTrainSeason] = report.split.train_seasons;
  const lastTrainSeason = report.split.train_seasons.at(-1);
  const [firstTestSeason] = report.split.test_seasons;
  const lastTestSeason = report.split.test_seasons.at(-1);
  return <div className="panel"><SectionHead eyebrow="Dataset" title="What went into the run" /><dl className="detail-list"><div><dt>Seasons</dt><dd>{firstSeason} to {lastSeason} regular</dd></div><div><dt>Downloaded games</dt><dd>{report.dataset.raw_games.toLocaleString()}</dd></div><div><dt>Regular-season games</dt><dd>{report.dataset.games.toLocaleString()}</dd></div><div><dt>Downloaded rows</dt><dd>{report.dataset.raw_plays.toLocaleString()}</dd></div><div><dt>Regular-season rows</dt><dd>{report.dataset.regular_plays.toLocaleString()}</dd></div><div><dt>Clean plays</dt><dd>{report.dataset.clean_plays.toLocaleString()}</dd></div><div><dt>Fourth downs</dt><dd>{report.dataset.fourth_downs.toLocaleString()}</dd></div><div><dt>WP split</dt><dd>{firstTrainSeason} to {lastTrainSeason} train / {firstTestSeason} to {lastTestSeason} test</dd></div></dl></div>;
}

function ModelDesignPanel() {
  return <div className="panel"><SectionHead eyebrow="Model design" title="Transparent by construction" /><div className="method-copy"><p><strong>Win probability</strong> uses logistic regression with score differential, time, field position, down, distance, quarter, and timeout differential. Histogram gradient boosting is retained as a nonlinear benchmark.</p><p><strong>Fourth down</strong> combines conversion, touchdown, field-goal, and punt submodels with the next-state win probability.</p><p><strong>QB value</strong> uses a within-season residual of EPA per dropback on quarterback salary share, then reports residual per share. QBR is not present in the downloaded public source files. The browser only consumes the exported coefficients and tables.</p></div></div>;
}

function EvaluationPanel({ report }: { report: Report }) {
  const rows: EvaluationRow[] = [
    { task: "Win probability", name: "Logistic", metrics: report.models.win_probability.logistic },
    { task: "Win probability", name: "Gradient boosting", metrics: report.models.win_probability.gradient_boosting },
    { task: "Conversion", name: "Logistic", metrics: report.models.conversion.logistic },
    { task: "Conversion", name: "Gradient boosting", metrics: report.models.conversion.gradient_boosting },
    { task: "Touchdown", name: "Logistic", metrics: report.models.touchdown.logistic },
    { task: "Touchdown", name: "Gradient boosting", metrics: report.models.touchdown.gradient_boosting },
    { task: "Field goal", name: "Logistic", metrics: report.models.field_goal.logistic },
    { task: "Field goal", name: "Gradient boosting", metrics: report.models.field_goal.gradient_boosting },
  ];
  return <section className="panel table-panel"><SectionHead eyebrow="Held-out evaluation" title="Test-set scores"><span className="table-note">Train {report.split.train_seasons[0]}-{report.split.train_seasons.at(-1)} / test {report.split.test_seasons[0]}-{report.split.test_seasons.at(-1)}</span></SectionHead><div className="table-scroll"><table><thead><tr><th>Task</th><th>Model</th><th>Log loss</th><th>Brier</th><th>AUC</th></tr></thead><tbody>{rows.map((item) => <tr key={`${item.task}-${item.name}`}><td>{item.task}</td><td className="muted">{item.name}</td><td>{number(item.metrics.log_loss, 4)}</td><td>{number(item.metrics.brier, 4)}</td><td className="positive">{number(item.metrics.auc, 4)}</td></tr>)}</tbody></table></div></section>;
}

function PlayoffPanel({ report }: { report: Report }) {
  const crossValidation = report.quarterback.cross_validation;
  return <section className="panel table-panel"><SectionHead eyebrow="Playoff classifier" title="Same-season classification test"><span className="table-note">{report.quarterback.test_rows ? `${report.quarterback.test_rows} held-out rows` : "Unavailable"}</span></SectionHead>{report.quarterback.models ? <><div className="table-scroll"><table><thead><tr><th>Model</th><th>Log loss</th><th>Holdout AUC</th><th>CV mean AUC</th></tr></thead><tbody>{Object.entries(report.quarterback.models).map(([name, metrics]) => <tr key={name}><td>{name.replaceAll("_", " ")}</td><td>{number(metrics.log_loss, 4)}</td><td className="positive">{number(metrics.auc, 4)}</td><td>{crossValidation?.[name]?.mean_auc == null ? "--" : number(crossValidation[name].mean_auc, 4)}</td></tr>)}</tbody></table></div><p className="panel-intro">The CV column uses expanding season folds; the fixed 2021-2022 holdout remains the primary comparison.</p></> : <p className="panel-intro">The contract-enabled playoff classifier did not run in this artifact release.</p>}</section>;
}

function ImportanceGroup({ title, rows, max }: { title: string; rows: ImportanceRow[]; max: number }) {
  return <div><strong>{title}</strong><div className="score-bars">{rows.map((item) => <ScoreBar key={item.feature} label={item.feature.replaceAll("_", " ")} value={item.importance} max={max} />)}</div></div>;
}

function ImportancePanel({ rows }: { rows: ImportanceRow[] }) {
  const importance = [...rows].sort((a, b) => Math.abs(b.importance) - Math.abs(a.importance));
  const max = Math.max(...importance.map((item) => Math.abs(item.importance)), 0.001);
  return <div className="panel"><SectionHead eyebrow="Feature signal" title="Permutation importance" /><div className="importance-group"><ImportanceGroup title="Win probability" rows={importance.filter((item) => item.model === "win_probability")} max={max} /><ImportanceGroup title="Conversion" rows={importance.filter((item) => item.model === "conversion")} max={max} /></div></div>;
}

function CalibrationPanel({ rows }: { rows: CalibrationRow[] }) {
  const models = ["wp_logistic", "conversion_logistic", "touchdown_logistic", "field_goal_logistic"];
  return <div className="panel"><SectionHead eyebrow="Calibration / three-point target" title="Predicted versus observed" />{models.map((modelName) => { const modelRows = rows.filter((item) => item.model === modelName); const gap = modelRows.length ? Math.max(...modelRows.map((item) => Math.abs(item.mean_pred - item.frac_pos))) : 0; return <div key={modelName} className="calibration-set"><span>{modelName.replaceAll("_", " ")}</span><div className="calibration-chart"><svg className="calibration-reference" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><line x1="0" y1="100" x2="100" y2="0" /></svg><div className="calibration-line" />{modelRows.map((item) => <div key={item.bin} className="calibration-point" style={{ left: `${item.mean_pred * 100}%`, bottom: `${item.frac_pos * 100}%` }} title={`Predicted ${percent(item.mean_pred)}; observed ${percent(item.frac_pos)}`} />)}</div><div className="calibration-status"><span>Max decile gap {number(gap * 100, 1)} pts</span><strong className={gap <= .03 ? "positive" : "negative"}>{gap <= .03 ? "within target" : "above target"}</strong></div></div>; })}</div>;
}

function ResearchQuestions({ report }: { report: Report }) {
  const rows = [
    ["H1", `GO is best in ${percent(report.hypotheses.h1.share_go_best, 0)} of short-yardage midfield states.`, "supported"],
    ["H2", `Observed GO is ${percent(report.hypotheses.h2.all_actual_go)} vs ${percent(report.hypotheses.h2.all_rec_go)} recommended; in the Romer region it is ${percent(report.hypotheses.h2_region.actual_go)} vs ${percent(report.hypotheses.h2_region.rec_go)}.`, report.hypotheses.h2_region.is_largest_gap ? "supported" : "not supported"],
    ["H3", `Trailing Q4 recommendation is ${percent(report.hypotheses.h3.q4_trailing, 0)} vs ${percent(report.hypotheses.h3.q4_leading, 0)} leading; first half is ${percent(report.hypotheses.h3.first_half, 0)}. Team rank correlation with Q4 is ${number(report.hypotheses.h3.ranking_spearman_first_half_q4, 2)}.`, "direction tested"],
    ["H4", report.quarterback.h4 ? `EPA-only AUC ${number(report.quarterback.h4.auc_epa_only, 3)}; salary delta ${number(report.quarterback.h4.logloss_improvement_pct, 2)}%. QBR was not available in the public source files.` : "Contract classifier unavailable.", report.quarterback.h4 ? "EPA scope" : "unavailable"],
    ["H5", report.quarterback.h5 ? `Playoff median ${percent(report.quarterback.h5.playoff_median_qb_share)} vs ${percent(report.quarterback.h5.nonplayoff_median_qb_share)} non-playoff.` : "Contract classifier unavailable.", "not supported"],
  ];
  return <section className="panel table-panel"><SectionHead eyebrow="Registered hypotheses" title="What the release actually tests"><span className="table-note">Descriptive, not causal</span></SectionHead><div className="table-scroll"><table><thead><tr><th>Test</th><th>Observed release result</th><th>Readout</th></tr></thead><tbody>{rows.map(([name, result, status]) => <tr key={name}><td><strong>{name}</strong></td><td>{result}</td><td className={status === "not supported" ? "negative" : "positive"}>{status}</td></tr>)}</tbody></table></div></section>;
}

function QuarterbackPanel({ report }: { report: Report }) {
  return <section className="panel"><SectionHead eyebrow="Quarterback classifier" title="Salary adds context, not a guarantee" />{report.quarterback.h4 ? <div className="qb-result-grid"><div><span className="metric-label">EPA-only AUC</span><strong>{number(report.quarterback.h4.auc_epa_only, 3)}</strong></div><div><span className="metric-label">EPA + salary AUC</span><strong>{number(report.quarterback.h4.auc_epa_plus_salary, 3)}</strong></div><div><span className="metric-label">Log-loss change</span><strong>{number(report.quarterback.h4.logloss_improvement_pct, 2)}%</strong></div><div><span className="metric-label">Playoff test rows</span><strong>{number(report.quarterback.test_rows, 0)}</strong></div></div> : <p className="panel-intro">The contract-enabled playoff classifier did not run in this artifact release.</p>}</section>;
}

function SourcesPanel({ metadata }: { metadata: Metadata }) {
  return <section className="panel sources-panel"><SectionHead eyebrow="Source ledger" title="Download fingerprints" /><p className="panel-intro">Generated {new Date(metadata.generated_at_utc).toLocaleString()} by <code>{metadata.pipeline}</code>. Hashes make the browser release auditable without checking raw source files into Git.</p>{metadata.sources.map((source) => <div className="source-row" key={source.url}><div><strong>{source.url.includes("contracts") ? "Historical contracts" : source.url.includes("games.csv") ? "Game schedules" : "Play-by-play release"}</strong><span>{source.rows.toLocaleString()} rows / {(source.bytes / 1024 / 1024).toFixed(1)} MB</span></div><a href={source.url} target="_blank" rel="noreferrer"><code>{source.sha256.slice(0, 16)}... ↗</code></a></div>)}</section>;
}

function CoveragePanel({ coverage }: { coverage: Record<string, string> }) {
  return <section className="panel table-panel"><SectionHead eyebrow="Proposal coverage" title="Implemented versus unavailable"><span className="table-note">No substitute fields are fabricated</span></SectionHead><div className="table-scroll"><table><thead><tr><th>Requirement</th><th>Release status</th></tr></thead><tbody>{Object.entries(coverage).map(([name, status]) => <tr key={name}><td>{name.replaceAll("_", " ")}</td><td className={status.includes("not_implemented") || status.includes("not represented") ? "negative" : "positive"}>{status}</td></tr>)}</tbody></table></div></section>;
}

export default function Methods() {
  const { report, metadata, featureImportance, calibration, wpCurve } = useArtifacts();
  return <div className="content-stack"><section className="page-header"><div className="page-header-copy"><Tag tone={report.status === "verified" ? "green" : "orange"}>Evidence ledger / {report.status.replaceAll("_", " ")}</Tag><h1>Nothing hidden behind the chart.</h1><p>FutureScout separates observed outcomes from modeled counterfactuals. This page records the data release, feature definitions, evaluation split, calibration target, hypothesis readout, and source hashes used by the public site.</p></div><div className="page-header-actions"><Link className="button button-primary" to="/calculator">Test the deployed engine <ArrowRight size={14} /></Link></div></section><section className="method-grid"><DatasetPanel report={report} /><ModelDesignPanel /></section><section className="panel"><SectionHead eyebrow="Option curve" title="How the state changes value"><Tag tone="orange">4th &amp; 2 / OPP 48 / 5:00 Q4</Tag></SectionHead><p className="panel-intro">Each line shows expected win probability as the score moves from fourteen points behind to fourteen points ahead.</p><CurveChart rows={wpCurve} /></section><EvaluationPanel report={report} /><PlayoffPanel report={report} /><ResearchQuestions report={report} /><section className="method-grid"><ImportancePanel rows={featureImportance} /><CalibrationPanel rows={calibration} /></section><QuarterbackPanel report={report} /><CoveragePanel coverage={report.proposal_coverage} /><SourcesPanel metadata={metadata} /><section className="panel caveat-panel"><SectionHead eyebrow="Limits" title="Read the result in context" />{report.limitations.map((item) => <p key={item}>{item}</p>)}</section></div>;
}
