import { useState } from "react";
import { ArrowRight, Info, RotateCcw } from "lucide-react";
import { useLocation } from "react-router";
import { useArtifacts } from "../context";
import { evaluateDecision } from "../model";
import { fieldLabel, percent } from "../format";
import type { Action, DecisionResult, GameState } from "../types";
import { SectionHead, Tag } from "../components/Ui";

const neutralState = { yardline: 48, yardsToGo: 2, scoreDiff: 0, quarter: 4, minutesLeft: 5, secondsLeft: 0, toDiff: 0 };
const optionCopy: Record<Action, { label: string; tone: string; note: (result: DecisionResult, state: GameState) => string }> = {
  GO: { label: "Go for it", tone: "green", note: (result) => `${percent(result.pConvert)} modeled conversion probability` },
  FG: { label: "Field goal", tone: "orange", note: (result, state) => result.pFg ? `${percent(result.pFg)} make probability from ${state.yardline100 + 17} yards` : "Outside the 65-yard kick rule" },
  PUNT: { label: "Punt", tone: "blue", note: (result) => `Opponent start at ${Math.round(result.oppStartAfterPunt)} yards from its end zone` },
};

function queryNumber(search: string, key: string, fallback: number, min: number, max: number) {
  const parsed = Number(new URLSearchParams(search).get(key));
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
}

function SliderField({ label, value, min, max, suffix = "", onChange }: { label: string; value: number; min: number; max: number; suffix?: string; onChange: (value: number) => void }) {
  return <label className="slider-field"><span><b>{label}</b><strong>{value > 0 && label === "Score differential" ? `+${value}` : value}{suffix}</strong></span><input aria-label={label} type="range" value={value} min={min} max={max} step="1" onChange={(event) => onChange(Number(event.target.value))} /></label>;
}

function OptionRow({ action, result, state }: { action: Action; result: DecisionResult; state: GameState }) {
  const copy = optionCopy[action];
  const value = action === "GO" ? result.wpGo : action === "FG" ? result.wpFg : result.wpPunt;
  return <div className={result.recommendation === action ? "option-row selected" : "option-row"}><div className="option-heading"><span><i className={`option-dot ${copy.tone}`} />{copy.label}</span><strong>{percent(value)}</strong></div><div className="value-track"><span className={copy.tone} style={{ width: `${Math.max(0, Math.min(100, value * 100))}%` }} /></div><p>{copy.note(result, state)}</p>{result.recommendation === action && <span className="tag tag-green">highest modeled value</span>}</div>;
}

export default function Calculator() {
  const { models } = useArtifacts();
  const location = useLocation();
  const [yardline, setYardline] = useState(() => queryNumber(location.search, "yardline", neutralState.yardline, 1, 99));
  const [yardsToGo, setYardsToGo] = useState(() => queryNumber(location.search, "ydstogo", neutralState.yardsToGo, 1, 20));
  const [scoreDiff, setScoreDiff] = useState(() => queryNumber(location.search, "scoreDiff", neutralState.scoreDiff, -28, 28));
  const [quarter, setQuarter] = useState(() => queryNumber(location.search, "qtr", neutralState.quarter, 1, 4));
  const [minutesLeft, setMinutesLeft] = useState(() => queryNumber(location.search, "minutes", neutralState.minutesLeft, 0, 15));
  const [secondsLeft, setSecondsLeft] = useState(neutralState.secondsLeft);
  const [toDiff, setToDiff] = useState(neutralState.toDiff);
  const effectiveYardsToGo = Math.min(yardsToGo, yardline);
  const effectiveSeconds = minutesLeft === 15 ? 0 : secondsLeft;
  const reset = () => { setYardline(neutralState.yardline); setYardsToGo(neutralState.yardsToGo); setScoreDiff(neutralState.scoreDiff); setQuarter(neutralState.quarter); setMinutesLeft(neutralState.minutesLeft); setSecondsLeft(neutralState.secondsLeft); setToDiff(neutralState.toDiff); };
  const state: GameState = { yardline100: yardline, ydstogo: effectiveYardsToGo, scoreDiff, qtr: quarter, secondsRemaining: (4 - quarter) * 900 + minutesLeft * 60 + effectiveSeconds, toDiff };
  const result = evaluateDecision(state, models);
  const clockLabel = `${minutesLeft}:${String(effectiveSeconds).padStart(2, "0")}`;
  return <div className="content-stack">
     <section className="page-header"><div className="page-header-copy"><Tag tone="green">Decision engine / live inference</Tag><h1>Price this fourth down.</h1><p>Set the game state and compare GO, field goal, and punt on the same expected win-probability scale. The browser uses the exported coefficients from the reproducible Python run.</p></div><div className="page-header-status" role="status" aria-live="polite"><span>State evaluated</span><strong>{result.recommendation} / {percent(Math.max(result.wpGo, result.wpFg, result.wpPunt))}</strong></div></section>
    <section className="calculator-layout"><div className="panel controls-panel"><div className="control-header"><SectionHead eyebrow="Game state" title="Set the moment" /><button className="button button-primary button-small" onClick={reset}><RotateCcw size={13} />Reset</button></div><div className="field-readout"><span>Field position</span><strong>{fieldLabel(yardline)}</strong></div><SliderField label="Yards from opponent end zone" value={yardline} min={1} max={99} onChange={(value) => { setYardline(value); setYardsToGo(Math.min(yardsToGo, value)); }} /><SliderField label="Yards to go" value={effectiveYardsToGo} min={1} max={Math.min(20, yardline)} onChange={setYardsToGo} /><SliderField label="Score differential" value={scoreDiff} min={-28} max={28} suffix=" pts" onChange={setScoreDiff} /><div className="control-pair"><label><span>Quarter</span><select value={quarter} onChange={(event) => setQuarter(Number(event.target.value))}>{[1, 2, 3, 4].map((item) => <option key={item} value={item}>Q{item}</option>)}</select></label><SliderField label="Minutes left" value={minutesLeft} min={0} max={15} suffix=":00" onChange={(value) => { setMinutesLeft(value); if (value === 15) setSecondsLeft(0); }} /></div><SliderField label="Seconds left" value={effectiveSeconds} min={0} max={minutesLeft === 15 ? 0 : 59} suffix=" sec" onChange={setSecondsLeft} /><SliderField label="Timeout differential" value={toDiff} min={-3} max={3} suffix=" TO" onChange={setToDiff} /><div className="state-note"><Info size={15} /><span>Positive score and timeout values use the possession team's perspective. Distance is constrained to the available field.</span></div><div className="control-actions"><small>Live update / no server call</small><Tag tone="neutral">18 features</Tag></div></div>
      <div className="panel result-panel" aria-live="polite"><div className="result-top"><SectionHead eyebrow="Expected win probability" title="Recommendation" /><span className="recommendation" role="status">{result.recommendation}<ArrowRight size={15} /></span></div><div className="state-summary"><span>Q{quarter}</span><span>{clockLabel} left</span><span>{scoreDiff >= 0 ? "+" : ""}{scoreDiff} score</span><span>4th &amp; {effectiveYardsToGo}</span><span>{fieldLabel(yardline)}</span><span>{toDiff >= 0 ? "+" : ""}{toDiff} TO</span></div><div className="options">{(["GO", "FG", "PUNT"] as Action[]).map((action) => <OptionRow key={action} action={action} result={result} state={state} />)}</div><div className="result-callout">The engine combines conversion, touchdown, field-goal, punt, and next-state win-probability models. This is a modeled counterfactual comparison, not a guarantee of outcome.</div><div className="result-foot"><span>FIELD GOAL MAKE <strong>{result.pFg ? percent(result.pFg) : "Unavailable"}</strong></span><span>PUNT OPPONENT START <strong>{Math.round(result.oppStartAfterPunt)} yd line</strong></span><span>RECOMMENDATION <strong>{result.recommendation}</strong></span></div></div>
    </section>
  </div>;
}
