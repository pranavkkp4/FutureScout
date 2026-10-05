import { useMemo, useState } from "react";
import { RotateCcw } from "lucide-react";
import { useArtifacts } from "../context";
import { clock, fieldLabel, percent } from "../format";
import type { Action } from "../types";
import { SectionHead, Tag, EmptyState } from "../components/Ui";

const actions: Array<"all" | Action> = ["all", "GO", "FG", "PUNT"];
const pageSize = 18;

export default function Decisions() {
  const { decisions } = useArtifacts();
  const [season, setSeason] = useState("all");
  const [team, setTeam] = useState("all");
  const [action, setAction] = useState<"all" | Action>("all");
  const [disagreements, setDisagreements] = useState(true);
  const [page, setPage] = useState(1);
  const seasons = [...new Set(decisions.map((row) => row.season))].sort((a, b) => a - b);
  const teams = [...new Set(decisions.map((row) => row.posteam))].sort();
  const filtered = useMemo(() => decisions.filter((row) => (season === "all" || row.season === Number(season)) && (team === "all" || row.posteam === team) && (action === "all" || row.actual === action) && (!disagreements || row.actual !== row.recommended)).sort((a, b) => b.wp_loss - a.wp_loss), [decisions, season, team, action, disagreements]);
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const rows = filtered.slice((page - 1) * pageSize, page * pageSize);
  const reset = () => { setSeason("all"); setTeam("all"); setAction("all"); setDisagreements(true); setPage(1); };
  const update = (setter: (value: string) => void, value: string) => { setter(value); setPage(1); };
  return <div className="content-stack"><section className="page-header"><div className="page-header-copy"><Tag tone="blue">Decision explorer / audit trail</Tag><h1>Show me the disagreements.</h1><p>Filter every modeled fourth-down decision, sorted by the win-probability gap between the recorded action and the best modeled option. Start with the most expensive disagreements.</p></div><div className="page-header-actions"><button className="button button-primary" onClick={reset}><RotateCcw size={14} />Reset filters</button></div></section><section className="filter-bar"><label>Season<select value={season} onChange={(event) => update(setSeason, event.target.value)}><option value="all">All seasons</option>{seasons.map((item) => <option key={item} value={item}>{item}</option>)}</select></label><label>Team<select value={team} onChange={(event) => update(setTeam, event.target.value)}><option value="all">All teams</option>{teams.map((item) => <option key={item} value={item}>{item}</option>)}</select></label><label>Recorded action<select value={action} onChange={(event) => { setAction(event.target.value as "all" | Action); setPage(1); }}>{actions.map((item) => <option key={item} value={item}>{item === "all" ? "All actions" : item}</option>)}</select></label><label className="check-label"><input type="checkbox" checked={disagreements} onChange={(event) => { setDisagreements(event.target.checked); setPage(1); }} /> disagreements only</label></section><section className="panel table-panel"><SectionHead eyebrow={`${filtered.length.toLocaleString()} matches`} title="Highest-value disagreements"><div className="pager"><button disabled={page === 1} onClick={() => setPage(page - 1)}>Prev</button><span>{page} / {pages}</span><button disabled={page === pages} onClick={() => setPage(page + 1)}>Next</button></div></SectionHead>{rows.length ? <div className="table-scroll"><table><thead><tr><th>Game</th><th>Team</th><th>Clock</th><th>Score</th><th>Down &amp; distance</th><th>At</th><th>Did</th><th>Model</th><th>WP gap</th></tr></thead><tbody>{rows.map((row) => <tr key={`${row.game_id}-${row.season}-${row.qtr}-${row.game_seconds_remaining}`}><td className="muted">{row.season} W{row.week}<br />{row.game_id}</td><td><strong>{row.posteam}</strong><br /><span className="muted">vs {row.defteam}</span></td><td>Q{row.qtr} {clock(row.game_seconds_remaining)}</td><td>{row.score_diff >= 0 ? "+" : ""}{row.score_diff}</td><td>4th &amp; {row.ydstogo}</td><td>{fieldLabel(row.yardline_100)}</td><td className={`action-text ${row.actual.toLowerCase()}`}>{row.actual}</td><td className={`action-text ${row.recommended.toLowerCase()}`}>{row.recommended}</td><td className="positive">{percent(row.wp_loss, 1)}</td></tr>)}</tbody></table></div> : <EmptyState title="No decisions match this view" detail="Clear one or more filters to widen the audit trail, or switch off disagreements only to inspect every fourth down." />}</section><p className="small-print">WP gap is the difference between the highest modeled option and the action recorded in the play-by-play. It is a state-level model comparison, not a causal estimate.</p></div>;
}
