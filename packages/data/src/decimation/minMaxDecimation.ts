import type { TimeSeriesPoint } from "../timeseries/types";

export function minMaxDecimation(
  points: readonly TimeSeriesPoint[],
  maxPoints: number
): TimeSeriesPoint[] {
  if (maxPoints <= 0) return [];
  if (points.length <= maxPoints) return [...points];
  if (maxPoints === 1) return [points[0]!];

  const bucketCount = Math.max(1, Math.floor(maxPoints / 2));
  const bucketSize = Math.ceil(points.length / bucketCount);
  const output: TimeSeriesPoint[] = [];

  for (let start = 0; start < points.length && output.length < maxPoints; start += bucketSize) {
    const bucket = points.slice(start, start + bucketSize);
    let min = bucket[0]!;
    let max = bucket[0]!;

    for (const point of bucket) {
      if (point.value < min.value) min = point;
      if (point.value > max.value) max = point;
    }

    const pair = min.timestamp <= max.timestamp ? [min, max] : [max, min];
    for (const point of pair) {
      if (output.at(-1) !== point && output.length < maxPoints) output.push(point);
    }
  }

  return output.sort((a, b) => a.timestamp - b.timestamp);
}
