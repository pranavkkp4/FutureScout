export function percent(value: number | null | undefined, digits = 1): string {
  return value == null || Number.isNaN(value) ? "Not available" : `${(value * 100).toFixed(digits)}%`;
}

export function number(value: number | null | undefined, digits = 1): string {
  return value == null || Number.isNaN(value) ? "Not available" : value.toLocaleString(undefined, { maximumFractionDigits: digits, minimumFractionDigits: digits });
}

export function compact(value: number): string {
  return value.toLocaleString(undefined, { notation: "compact", maximumFractionDigits: 1 });
}

export function clock(seconds: number): string {
  const remainder = seconds % 900;
  const quarterSeconds = remainder === 0 && seconds > 0 ? 900 : Math.max(0, remainder);
  return `${Math.floor(quarterSeconds / 60)}:${String(Math.floor(quarterSeconds % 60)).padStart(2, "0")}`;
}

export function fieldLabel(yardline: number): string {
  return yardline <= 50 ? `OPP ${Math.round(yardline)}` : `OWN ${Math.round(100 - yardline)}`;
}
