import type { TimeSeriesPoint } from "../timeseries/types";

export function bucketAggregation(
  points: readonly TimeSeriesPoint[],
  bucketMs: number
): TimeSeriesPoint[] {
  if (bucketMs <= 0) throw new Error("bucketMs must be greater than zero");
  if (points.length === 0) return [];

  const buckets = new Map<number, { sum: number; count: number }>();

  for (const point of points) {
    const timestamp = Math.floor(point.timestamp / bucketMs) * bucketMs;
    const bucket = buckets.get(timestamp) ?? { sum: 0, count: 0 };
    bucket.sum += point.value;
    bucket.count += 1;
    buckets.set(timestamp, bucket);
  }

  return [...buckets.entries()]
    .sort(([a], [b]) => a - b)
    .map(([timestamp, bucket]) => ({
      timestamp,
      value: bucket.sum / bucket.count
    }));
}
