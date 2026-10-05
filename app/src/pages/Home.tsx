import { ArrowRight, BarChart3, Calculator, CircleDollarSign, FileCheck2 } from "lucide-react";
import { Link } from "react-router";
import { useArtifacts } from "../context";
import { compact, number, percent } from "../format";
import { Metric, SectionHead, Tag } from "../components/Ui";

function TrendChart({ seasons }: { seasons: { season: number; actual_go: number; rec_go: number }[] }) {
  const width = 720;
  const height = 220;
  const x = (index: number) => 24 + index * ((width - 48) / Math.max(seasons.length - 1, 1));
  const y = (value: number) => height - 28 - value * 160;
  const line = (key: "actual_go" | "rec_go") => seasons.map((item, index) => `${x(index)},${y(item[key])}`).join(" ");
  return <div className="chart-wrap"><svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Observed and model recommended fourth-down go rate by season"><line className="chart-grid" x1="24" y1="32" x2="696" y2="32" /><line className="chart-grid" x1="24" y1="112" x2="696" y2="112" /><line className="chart-grid" x1="24" y1="192" x2="696" y2="192" /><polyline className="line-recommended" points={line("rec_go")} /><polyline className="line-actual" points={line("actual_go")} />{seasons.map((item, index) => <g key={item.season}><circle className="point-actual" cx={x(index)} cy={y(item.actual_go)} r="3" /><circle className="point-recommended" cx={x(index)} cy={y(item.rec_go)} r="3" /><text className="chart-label" x={x(index)} y="214" textAnchor="middle">{item.season}</text></g>)}</svg><div className="chart-key"><span><i className="key-dot actual" />Observed behavior</span><span><i className="key-dot recommended" />Model recommendation</span></div></div>;
}

export default function Home() {
  const { report, seasonSummary } = useArtifacts();
  const { dataset, hypotheses, models } = report;
  const best = hypotheses.h1.share_go_best;
  const yearRange = `${dataset.seasons[0]}-${dataset.seasons.at(-1)}`;
  return <div className="content-stack">
    <section className="page-header">
      <div className="page-header-copy"><Tag tone="green">Research release / 01</Tag><h1>A working view of decision value.</h1><p>FutureScout compares fourth-down choices in expected win probability and places quarterback efficiency beside the cap share that bought it. This dashboard is the release control room.</p></div>
      <div className="page-header-actions"><Link className="button button-primary" to="/calculator">Open decision calculator <ArrowRight size={15} /></Link><Link className="button button-quiet" to="/methods">Inspect methods</Link></div>
    </section>
    <section className="kpi-grid">
      <Metric label="Analysis window" value={yearRange} detail={`${dataset.games.toLocaleString()} regular-season games`} />
      <Metric label="Fourth-down rows" value={compact(dataset.fourth_downs)} detail={`${percent(hypotheses.h2.all_actual_go)} observed GO rate`} accent />
      <Metric label="Held-out WP AUC" value={number(models.win_probability.logistic.auc, 3)} detail={`${number(models.win_probability.logistic.log_loss, 3)} log loss / logistic`} />
      <Metric label="Modeled gap" value={percent(hypotheses.h2.all_rec_go - hypotheses.h2.all_actual_go, 1)} detail="Recommendation minus observed GO" />
    </section>
    <section className="dashboard-grid">
      <div className="panel"><SectionHead eyebrow="Behavior signal" title="Teams and the decision engine diverge"><Tag tone="neutral">Observed vs modeled</Tag></SectionHead><p className="panel-intro">Across the release window, the recorded fourth-down action sits below the engine's highest-value action. The gap is descriptive, not a causal wins estimate.</p><TrendChart seasons={seasonSummary} /><div className="trend-callout"><strong>{percent(hypotheses.h2.all_actual_go)}</strong><span>observed GO</span><strong className="secondary-value">{percent(hypotheses.h2.all_rec_go)}</strong><span>recommended GO</span></div></div>
      <aside className="panel panel-quiet"><SectionHead eyebrow="Release readout" title="Three signals to carry forward" /><div className="finding-list"><div className="finding"><span className="finding-index">01</span><div><h3>Short yardage is the cleanest edge</h3><p>GO is highest value in {percent(best, 0)} of {number(hypotheses.h1.n, 0)} tested midfield, fourth-and-two-or-less states.</p></div></div><div className="finding"><span className="finding-index">02</span><div><h3>Late-game context changes the line</h3><p>The engine recommends GO on {percent(hypotheses.h3.q4_trailing, 0)} of trailing Q4 rows versus {percent(hypotheses.h3.q4_leading, 0)} when leading.</p></div></div><div className="finding"><span className="finding-index">03</span><div><h3>Efficiency outpaces salary as signal</h3><p>{report.quarterback.h4 ? `EPA-only playoff AUC is ${number(report.quarterback.h4.auc_epa_only, 3)}; adding salary changes log loss by ${number(report.quarterback.h4.logloss_improvement_pct, 2)}%.` : "The contract-enabled classifier is not available in this release."}</p></div></div></div></aside>
    </section>
    <section className="dashboard-grid bottom">
      <Link to="/calculator" className="module-card"><Calculator size={18} /><div><span className="eyebrow">Decision engine</span><h3>Price a live state</h3><p>Change score, clock, position, distance, and timeouts. Get GO, FG, and PUNT on one scale.</p></div><ArrowRight size={15} /></Link>
      <Link to="/map" className="module-card"><BarChart3 size={18} /><div><span className="eyebrow">State space</span><h3>Find the boundary</h3><p>Scan 300 field-position and distance combinations across three game contexts.</p></div><ArrowRight size={15} /></Link>
      <Link to="/quarterbacks" className="module-card"><CircleDollarSign size={18} /><div><span className="eyebrow">Roster economics</span><h3>Find efficient seasons</h3><p>Rank team-seasons by EPA per dropback above the within-season salary baseline.</p></div><ArrowRight size={15} /></Link>
    </section>
    <section className="panel release-strip"><div><span className="eyebrow">Data integrity</span><strong><FileCheck2 size={15} /> Generated artifacts are loaded locally</strong><p>{compact(dataset.clean_plays)} cleaned plays, {compact(dataset.raw_plays)} downloaded rows, and source fingerprints available in Methods.</p></div><Link className="button button-quiet button-small" to="/methods">View source ledger <ArrowRight size={13} /></Link></section>
  </div>;
}
