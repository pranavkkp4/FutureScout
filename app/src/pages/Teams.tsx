import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { Link } from "react-router";
import { useArtifacts } from "../context";
import { number, percent } from "../format";
import { SectionHead, EmptyState, Tag } from "../components/Ui";

function TeamScatter({ rows }: { rows: { posteam: string; actual_go: number; rec_go: number }[] }) {
  const points = rows.map((row) => ({ ...row, x: 30 + row.rec_go * 400, y: 190 - row.actual_go * 150 }));
  return <svg className="scatter" viewBox="0 0 460 230" role="img" aria-label="Actual versus recommended go rates by team"><line className="axis" x1="30" y1="190" x2="430" y2="190" /><line className="axis" x1="30" y1="20" x2="30" y2="190" /><line className="diagonal" x1="30" y1="190" x2="430" y2="40" /><text x="230" y="220">model recommendation</text><text x="12" y="115" transform="rotate(-90 12 115)">observed behavior</text>{points.map((point) => <g key={point.posteam}><circle className="scatter-point" cx={point.x} cy={point.y} r="5" /><text className="point-label" x={point.x + 7} y={point.y + 3}>{point.posteam}</text></g>)}</svg>;
}

export default function Teams() {
  const { teamAgg } = useArtifacts();
  const seasons = [...new Set(teamAgg.map((row) => row.season))].sort((a, b) => a - b);
  const [season, setSeason] = useState(seasons.at(-1) ?? 2024);
  const [selectedTeam, setSelectedTeam] = useState("");
  const rows = teamAgg.filter((row) => row.season === season).sort((a, b) => b.go_gap - a.go_gap);
  const selected = rows.find((row) => row.posteam === selectedTeam);
  return <div className="content-stack"><section className="page-header"><div className="page-header-copy"><Tag tone="blue">Team behavior / season audit</Tag><h1>Who trusted the model?</h1><p>Rank team-seasons by the distance between the action recorded and the action with the highest modeled win probability. Choose a season, then select a team row for a compact readout.</p></div><div className="page-header-actions"><select className="season-select" aria-label="Season" value={season} onChange={(event) => { setSeason(Number(event.target.value)); setSelectedTeam(""); }}>{seasons.map((item) => <option key={item} value={item}>{item} season</option>)}</select><Link className="button button-primary" to="/decisions">Audit decisions <ArrowRight size={14} /></Link></div></section><section className="panel"><SectionHead eyebrow={`${season} season / ${rows.length} teams`} title="Observed behavior versus recommendation"><Tag tone="neutral">Below diagonal = more conservative</Tag></SectionHead><TeamScatter rows={rows} />{selected && <div className="selected-team"><span><strong>{selected.posteam}</strong> selected for {season}</span><span className="mono">{percent(selected.actual_go)} observed / {percent(selected.rec_go)} modeled</span></div>}</section><section className="panel table-panel"><SectionHead eyebrow="Ranked table" title="Fourth-down behavior"><span className="table-note">{rows.length} team-seasons / select a row</span></SectionHead>{rows.length ? <div className="table-scroll"><table><thead><tr><th>#</th><th>Team</th><th>4th downs</th><th>Observed GO</th><th>Recommended GO</th><th>Gap</th><th>WP left</th></tr></thead><tbody>{rows.map((row, index) => <tr key={`${row.season}-${row.posteam}`}><td className="muted">{index + 1}</td><td><button className="row-button" onClick={() => setSelectedTeam(row.posteam)}>{row.posteam}</button></td><td>{number(row.n_fourth, 0)}</td><td>{percent(row.actual_go)}</td><td>{percent(row.rec_go)}</td><td className={row.go_gap >= 0 ? "positive" : "negative"}>{row.go_gap >= 0 ? "+" : ""}{percent(row.go_gap)}</td><td className="orange-text">{number(row.wp_lost * 100, 1)} pts</td></tr>)}</tbody></table></div> : <EmptyState title="No team behavior rows for this season" detail="Choose another season or regenerate the published team aggressiveness artifact." />}</section><p className="small-print">WP left sums the difference between the best modeled option and the action recorded in the data. It describes counterfactual distance and does not identify causal wins.</p></div>;
}
