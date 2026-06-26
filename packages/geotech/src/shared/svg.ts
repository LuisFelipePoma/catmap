export function escapeSvgText(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function paddedRange(values: readonly number[]): { min: number; max: number } | null {
  const finite = values.filter(Number.isFinite);
  if (finite.length === 0) return null;
  const min = Math.min(...finite);
  const max = Math.max(...finite);
  if (min !== max) {
    const pad = (max - min) * 0.08;
    return { min: min - pad, max: max + pad };
  }
  const pad = Math.max(Math.abs(min) * 0.08, 1);
  return { min: min - pad, max: max + pad };
}

export function numberLabel(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}
