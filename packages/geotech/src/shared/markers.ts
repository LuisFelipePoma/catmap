import type { ChartMarker } from "@catmap/charts";

export function missingMarkers<T>(
  readings: readonly T[],
  options: {
    id: string;
    label: string;
    color?: string;
    timestamp: (reading: T) => number;
    value: (reading: T) => number | undefined;
    missing: (reading: T) => boolean;
  }
): ChartMarker[] {
  return readings.flatMap((reading, index) => {
    if (!options.missing(reading)) return [];
    const value = nearestValue(readings, index, options.value);
    if (value === undefined) return [];
    return [
      {
        id: `${options.id}-${options.timestamp(reading)}`,
        label: options.label,
        timestamp: options.timestamp(reading),
        value,
        color: options.color ?? "#dc2626"
      }
    ];
  });
}

function nearestValue<T>(
  readings: readonly T[],
  index: number,
  value: (reading: T) => number | undefined
): number | undefined {
  for (let left = index - 1; left >= 0; left -= 1) {
    const candidate = value(readings[left]!);
    if (candidate !== undefined) return candidate;
  }
  for (let right = index + 1; right < readings.length; right += 1) {
    const candidate = value(readings[right]!);
    if (candidate !== undefined) return candidate;
  }
  return undefined;
}
