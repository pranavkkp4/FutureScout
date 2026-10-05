import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { Link } from "react-router";
import { useArtifacts } from "../context";
import { number, percent } from "../format";
import { SectionHead, Tag, EmptyState } from "../components/Ui";

type ScatterRow = { team: string; qb_salary_share: number; qb_epa_db: number; playoff: number };

function QbScatter({ rows }: { rows: ScatterRow[] }) {
  const minY = Math.min(-0.2, ...rows.map((row) => row.qb_epa_db));
  const maxY = Math.max(0.25, ...rows.map((row) => row.qb_epa_db));
  const range = Math.max(maxY - minY, 0.01);
  const points = rows.map((row) => ({
    ...row,
    x: 34 + row.qb_salary_share * 670,
    y: 190 - ((row.qb_epa_db - minY) / range) * 160,
  }));
  return <svg className="scatter qb-scatter" viewBox="0 0 740 230" role="img" aria-label="Quarterback salary share against EPA per dropback"><line className="axis" x1="34" y1="190" x2="710" y2="190" /><line className="axis" x1="34" y1="20" x2="34" y2="190" /><text x="310" y="220">QB salary share of active cap charges</text><text x="12" y="130" transform="rotate(-90 12 130)">EPA / dropback</text>{points.map((point) => <g key={point.team}><circle className={point.playoff ? "qb-point playoff" : "qb-point"} cx={point.x} cy={point.y} r={point.playoff ? 5 : 4} /><text className="point-label" x={point.x + 7} y={point.y + 3}>{point.team}</text></g>)}</svg>;
}

function MetricMini({ label, value, detail, accent = false }: { label: string; value: string; detail: string; accent?: boolean }) {
  return <div className={accent ? "metric-card accent" : "metric-card"}><span className="metric-label">{label}</span><strong>{value}</strong><span className="metric-detail">{detail}</span></div>;
}

export default function Quarterbacks() {
  const { qbValue, report } = useArtifacts();
  const seasons = [...new Set(qbValue.map((row) => row.season))].sort((a, b) => a - b);
  const [season, setSeason] = useState(seasons.at(-1) ?? 2022);
  const [selectedTeam, setSelectedTeam] = useState("");
  const rows = qbValue.filter((row) => row.season === season).sort((a, b) => b.qb_value_per_salary_share - a.qb_value_per_salary_share);
  const selected = rows.find((row) => row.team === selectedTeam);
  const topValue = rows[0];

  if (!rows.length) return <EmptyState title="Quarterback module unavailable" detail="No complete contract-backed team-seasons were exported for this release." />;

  return <div className="content-stack"><section className="page-header"><div className="page-header-copy"><Tag tone="orange">Roster economics / value per salary share</Tag><h1>Efficiency has a price.</h1><p>Rank team-seasons by EPA per dropback residual per quarterback salary share. This is a team-level EPA measure, not QBR or a player-only grade.</p></div><div className="page-header-actions"><select className="season-select" aria-label="Season" value={season} onChange={(event) => { setSeason(Number(event.target.value)); setSelectedTeam(""); }}>{seasons.map((item) => <option key={item} value={item}>{item} season</option>)}</select><Link className="button button-primary" to="/methods">Read classifier <ArrowRight size={14} /></Link></div></section><section className="kpi-grid"><MetricMini label="Top value season" value={topValue?.team ?? "--"} detail={topValue ? `${number(topValue.qb_value_per_salary_share, 3)} EPA residual / share` : "No row"} /><MetricMini label="Median QB share" value={percent(report.quarterback.h5?.league_median_qb_share)} detail="Complete team-season sample" /><MetricMini label="Playoff test AUC" value={number(report.quarterback.h4?.auc_epa_only, 3)} detail="EPA-only classifier" /><MetricMini label="Rows in view" value={number(rows.length, 0)} detail={`${season} complete rows`} accent /></section><section className="panel"><SectionHead eyebrow={`${season} frontier`} title="Salary share versus efficiency"><div className="legend"><span><i className="accent-key circle-key" />Playoff team</span><span><i className="circle-key" />Other team</span></div></SectionHead><QbScatter rows={rows} />{selected && <div className="selected-team"><span><strong>{selected.team}</strong> selected for {season}</span><span className="mono">{number(selected.qb_epa_db, 3)} EPA / {percent(selected.qb_salary_share)} share</span></div>}</section><section className="panel table-panel"><SectionHead eyebrow="Ranked table" title="QB value by team-season"><span className="table-note">Ranked by residual per salary share</span></SectionHead><div className="table-scroll"><table><thead><tr><th>#</th><th>Team</th><th>EPA / dropback</th><th>QB share</th><th>Value / share</th><th>Playoff</th></tr></thead><tbody>{rows.map((row, index) => <tr key={`${row.season}-${row.team}`}><td className="muted">{index + 1}</td><td><button className="row-button" onClick={() => setSelectedTeam(row.team)}>{row.team}</button></td><td>{number(row.qb_epa_db, 3)}</td><td>{percent(row.qb_salary_share)}</td><td className={row.qb_value_per_salary_share >= 0 ? "positive" : "negative"}>{number(row.qb_value_per_salary_share, 3)}</td><td>{row.playoff ? "Yes" : "No"}</td></tr>)}</tbody></table></div></section></div>;
}
