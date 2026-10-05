import type { DecisionResult, GameState, ModelArtifact, ModelBundle } from "./types";

function logistic(model: ModelArtifact, values: number[]): number {
  const z = model.intercept + model.coef.reduce((total, coefficient, index) => total + coefficient * ((values[index] - model.mean[index]) / model.scale[index]), 0);
  return 1 / (1 + Math.exp(-Math.max(-35, Math.min(35, z))));
}

function wpValues(state: { scoreDiff: number; secondsRemaining: number; qtr: number; down: number; ydstogo: number; yardline100: number; toDiff: number; goalToGo?: number }): number[] {
  const seconds = Math.max(0, Math.min(3600, state.secondsRemaining));
  const logYtg = Math.log1p(Math.max(1, state.ydstogo));
  const q4 = state.qtr === 4 ? 1 : 0;
  const yardline = Math.max(1, Math.min(99, state.yardline100));
  return [state.scoreDiff, seconds / 3600, state.scoreDiff * Math.sqrt(Math.max(seconds, 1) / 3600), state.scoreDiff ** 2, Math.sqrt(seconds / 3600), state.qtr, q4, state.scoreDiff * q4, yardline, yardline ** 2 / 100, logYtg, state.down === 1 ? 1 : 0, state.down === 2 ? 1 : 0, state.down === 3 ? 1 : 0, state.down === 4 ? 1 : 0, state.down * logYtg, state.toDiff, state.goalToGo ?? (yardline <= state.ydstogo ? 1 : 0)];
}

function winProbability(models: ModelBundle, state: { scoreDiff: number; secondsRemaining: number; qtr: number; down: number; ydstogo: number; yardline100: number; toDiff: number; goalToGo?: number }): number {
  return logistic(models.wp_lr, wpValues(state));
}

function conversionProbability(models: ModelBundle, state: GameState): number {
  const values = (isPass: number) => [Math.log1p(Math.max(1, state.ydstogo)), state.ydstogo, state.yardline100, state.scoreDiff, state.secondsRemaining / 3600, state.qtr, state.qtr === 4 ? 1 : 0, state.toDiff ?? 0, state.yardline100 <= state.ydstogo ? 1 : 0, isPass];
  return models.go_pass_rate * logistic(models.conv_lr, values(1)) + (1 - models.go_pass_rate) * logistic(models.conv_lr, values(0));
}

export function evaluateDecision(state: GameState, models: ModelBundle): DecisionResult {
  const toDiff = state.toDiff ?? 0;
  const seconds = Math.max(0, state.secondsRemaining - 6);
  const newYardline = Math.max(1, state.yardline100 - state.ydstogo);
  const pConvert = conversionProbability(models, state);
  const pTouchdown = Math.min(pConvert, models.go_pass_rate * logistic(models.td_lr, [Math.log1p(Math.max(1, state.ydstogo)), state.ydstogo, state.yardline100, state.scoreDiff, state.secondsRemaining / 3600, state.qtr, state.qtr === 4 ? 1 : 0, toDiff, state.yardline100 <= state.ydstogo ? 1 : 0, 1]) + (1 - models.go_pass_rate) * logistic(models.td_lr, [Math.log1p(Math.max(1, state.ydstogo)), state.ydstogo, state.yardline100, state.scoreDiff, state.secondsRemaining / 3600, state.qtr, state.qtr === 4 ? 1 : 0, toDiff, state.yardline100 <= state.ydstogo ? 1 : 0, 0]));
  const wpConvert = winProbability(models, { scoreDiff: state.scoreDiff, secondsRemaining: seconds, qtr: state.qtr, down: 1, ydstogo: Math.min(10, newYardline), yardline100: newYardline, toDiff });
  const turnoverYardline = 100 - state.yardline100;
  const wpFail = 1 - winProbability(models, { scoreDiff: -state.scoreDiff, secondsRemaining: seconds, qtr: state.qtr, down: 1, ydstogo: Math.min(10, turnoverYardline), yardline100: turnoverYardline, toDiff: -toDiff });
  const wpTouchdown = 1 - winProbability(models, { scoreDiff: -(state.scoreDiff + 6), secondsRemaining: seconds, qtr: state.qtr, down: 1, ydstogo: 10, yardline100: 75, toDiff: -toDiff, goalToGo: 0 });
  const wpGo = pTouchdown * wpTouchdown + (pConvert - pTouchdown) * wpConvert + (1 - pConvert) * wpFail;

  const kickDistance = state.yardline100 + 17;
  const pFg = kickDistance <= 65 ? logistic(models.fg_lr, [kickDistance, kickDistance ** 2 / 100]) : 0;
  const wpMade = 1 - winProbability(models, { scoreDiff: -(state.scoreDiff + 3), secondsRemaining: seconds, qtr: state.qtr, down: 1, ydstogo: 10, yardline100: 75, toDiff: -toDiff });
  const missYardline = Math.max(20, state.yardline100 + 7);
  const wpMiss = 1 - winProbability(models, { scoreDiff: -state.scoreDiff, secondsRemaining: seconds, qtr: state.qtr, down: 1, ydstogo: Math.min(10, 100 - missYardline), yardline100: 100 - missYardline, toDiff: -toDiff, goalToGo: 0 });
  const wpFg = pFg ? pFg * wpMade + (1 - pFg) * wpMiss : 0;

  const puntYardline = Math.max(50, Math.min(99, models.punt_linear.intercept + models.punt_linear.coef[0] * state.yardline100 + models.punt_linear.coef[1] * state.yardline100 ** 2 / 100));
  const wpPunt = 1 - winProbability(models, { scoreDiff: -state.scoreDiff, secondsRemaining: seconds, qtr: state.qtr, down: 1, ydstogo: Math.min(10, puntYardline), yardline100: puntYardline, toDiff: -toDiff });
  const values: Record<"GO" | "FG" | "PUNT", number> = { GO: wpGo, FG: wpFg, PUNT: wpPunt };
  const recommendation = (Object.keys(values) as Array<keyof typeof values>).reduce((best, action) => values[action] > values[best] ? action : best, "GO");
  return { wpGo, wpFg, wpPunt, recommendation, pConvert, pFg, oppStartAfterPunt: puntYardline };
}
