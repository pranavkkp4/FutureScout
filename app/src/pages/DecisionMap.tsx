import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { Link } from "react-router";
import { useArtifacts } from "../context";
import { evaluateDecision } from "../model";
import { fieldLabel, percent } from "../format";
import type { DecisionResult, GameState } from "../types";
import { SectionHead, Tag } from "../components/Ui";

const presets = { neutral: { label: "Tied / start Q2", scoreDiff: 0, secondsRemaining: 2700, qtr: 2 }, trailing: { label: "Down 4 / 5:00 Q4", scoreDiff: -4, secondsRemaining: 300, qtr: 4 }, leading: { label: "Up 4 / 5:00 Q4", scoreDiff: 4, secondsRemaining: 300, qtr: 4 } };
const positions = Array.from({ length: 25 }, (_, index) => 3 + index * 4);
const distances = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 15];

type MapCell = { yardline: number; ydstogo: number; result: DecisionResult | null };

function Inspector({ cell, preset }: { cell: MapCell | undefined; preset: typeof presets.neutral }) {
  if (!cell || !cell.result) return <div className="panel map-inspector"><SectionHead eyebrow="State inspector" title="Select a valid state" /><p className="panel-intro">Distances longer than the available field are excluded from the model surface.</p></div>;
  const { result } = cell;
  const minutes = Math.floor((preset.secondsRemaining - (4 - preset.qtr) * 900) / 60);
  const calculatorHref = `/calculator?yardline=${cell.yardline}&ydstogo=${cell.ydstogo}&scoreDiff=${preset.scoreDiff}&qtr=${preset.qtr}&minutes=${minutes}`;
  return <div className="panel map-inspector" aria-live="polite"><SectionHead eyebrow="State inspector" title="Selected state" /><div className="inspector-state"><strong>{fieldLabel(cell.yardline)} / 4th &amp; {cell.ydstogo}</strong><span>{preset.label} context</span></div><div className="value-list"><div className={result.recommendation === "GO" ? "value-list-row recommended" : "value-list-row"}><span>Go for it</span><strong>{percent(result.wpGo)}</strong></div><div className={result.recommendation === "FG" ? "value-list-row recommended" : "value-list-row"}><span>Field goal</span><strong>{percent(result.wpFg)}</strong></div><div className={result.recommendation === "PUNT" ? "value-list-row recommended" : "value-list-row"}><span>Punt</span><strong>{percent(result.wpPunt)}</strong></div></div><div className="result-callout">The highest modeled value is <strong>{result.recommendation}</strong>. Open the calculator to vary score, clock, and timeouts around this state.</div><Link className="button button-primary" to={calculatorHref}>Open live calculator <ArrowRight size={14} /></Link></div>;
}

export default function DecisionMap() {
  const { models } = useArtifacts();
  const [mode, setMode] = useState<keyof typeof presets>("neutral");
  const [selectedKey, setSelectedKey] = useState("47-1");
  const preset = presets[mode];
  const cells: MapCell[] = positions.flatMap((yardline) => distances.map((ydstogo) => {
    if (ydstogo > yardline) return { yardline, ydstogo, result: null };
    const state: GameState = { yardline100: yardline, ydstogo, scoreDiff: preset.scoreDiff, secondsRemaining: preset.secondsRemaining, qtr: preset.qtr };
    return { yardline, ydstogo, result: evaluateDecision(state, models) };
  }));
  const validCells = cells.filter((cell) => cell.result);
  const goShare = validCells.length ? validCells.filter((cell) => cell.result?.recommendation === "GO").length / validCells.length : 0;
  const selected = cells.find((cell) => `${cell.yardline}-${cell.ydstogo}` === selectedKey);
  return <div className="content-stack"><section className="page-header"><div className="page-header-copy"><Tag tone="orange">Decision surface / 300 states</Tag><h1>Where the model changes its mind.</h1><p>Scan the fourth-down state space by field position and distance. Select a cell to inspect the three option values, then move the live calculator to test the edge conditions.</p></div><div className="page-header-actions"><Link className="button button-primary" to="/calculator">Inspect a state <ArrowRight size={15} /></Link></div></section><section className="panel map-toolbar"><SectionHead eyebrow="Game context" title={preset.label}><div className="segmented-control" role="group" aria-label="Game state preset">{Object.entries(presets).map(([key, value]) => <button key={key} className={mode === key ? "selected" : ""} aria-pressed={mode === key} onClick={() => setMode(key as keyof typeof presets)}>{value.label}</button>)}</div></SectionHead><p className="panel-intro">Color marks the recommended action. Intensity tracks the best option's modeled win probability. Invalid field-distance combinations are intentionally disabled.</p></section><section className="map-layout"><div className="panel map-panel"><SectionHead eyebrow="Recommendation grid" title="Position × distance"><Tag tone="green">GO on {percent(goShare, 0)} of valid states</Tag></SectionHead><div className="heatmap" aria-label={`${preset.label} fourth-down recommendation grid`}><div className="heatmap-corner">FIELD POSITION ↓<br />DISTANCE →</div>{distances.map((distance) => <span className="heatmap-axis" key={distance}>{distance}</span>)}{positions.map((yardline) => <div className="heatmap-row" key={yardline}><span className="heatmap-label">{fieldLabel(yardline)}</span>{distances.map((ydstogo) => { const cell = cells.find((item) => item.yardline === yardline && item.ydstogo === ydstogo); const action = cell?.result?.recommendation; const value = cell?.result ? Math.max(cell.result.wpGo, cell.result.wpFg, cell.result.wpPunt) : 0; return <button className={`heatmap-cell ${action ? `action-${action.toLowerCase()}` : "unavailable"} ${selectedKey === `${yardline}-${ydstogo}` ? "selected" : ""}`} key={ydstogo} disabled={!action} onClick={() => setSelectedKey(`${yardline}-${ydstogo}`)} aria-pressed={selectedKey === `${yardline}-${ydstogo}`} aria-label={action ? `${fieldLabel(yardline)}, fourth and ${ydstogo}, recommendation ${action}` : `${fieldLabel(yardline)}, fourth and ${ydstogo}, unavailable`} title={action ? `${fieldLabel(yardline)}, 4th & ${ydstogo}: ${action}` : "Unavailable: more yards than field remaining"} style={action ? { opacity: 0.55 + value * 0.45 } : undefined}>{action ? action[0] : "-"}</button>; })}</div>)}</div><div className="legend"><span><i className="accent-key" />GO</span><span><i />FG / PUNT neutral</span><small>Disabled cells are impossible states.</small></div></div><Inspector cell={selected} preset={preset} /></section></div>;
}
