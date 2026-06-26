import type { ReadingQuality, TimeSeriesPoint } from "../timeseries/types";

export interface ArrowVectorLike<T = unknown> {
  length?: number;
  get(index: number): T | null | undefined;
}

export interface ArrowTableLike {
  numRows?: number;
  length?: number;
  getChild(name: string): ArrowVectorLike | null | undefined;
}

export interface ArrowTimeSeriesOptions {
  timestampColumn?: string;
  valueColumn?: string;
  qualityColumn?: string;
  timestampUnit?: "ms" | "s" | "us" | "ns";
}

export function timeSeriesFromArrow(table: ArrowTableLike, options: ArrowTimeSeriesOptions = {}): TimeSeriesPoint[] {
  const timestamps = requireColumn(table, options.timestampColumn ?? "timestamp");
  const values = requireColumn(table, options.valueColumn ?? "value");
  const quality = options.qualityColumn ? table.getChild(options.qualityColumn) : undefined;
  const length = table.numRows ?? table.length ?? timestamps.length ?? values.length ?? 0;
  const points: TimeSeriesPoint[] = [];

  for (let index = 0; index < length; index += 1) {
    const timestamp = toTimestamp(timestamps.get(index), options.timestampUnit ?? "ms");
    const value = toNumber(values.get(index));
    if (timestamp === null || value === null) continue;
    const point = { timestamp, value };
    const readingQuality = toQuality(quality?.get(index));
    points.push(readingQuality ? { ...point, quality: readingQuality } : point);
  }

  return points;
}

function requireColumn(table: ArrowTableLike, name: string): ArrowVectorLike {
  const column = table.getChild(name);
  if (!column) throw new Error(`Missing Arrow column: ${name}`);
  return column;
}

function toTimestamp(value: unknown, unit: NonNullable<ArrowTimeSeriesOptions["timestampUnit"]>): number | null {
  if (value instanceof Date) return value.getTime();
  const numeric = toNumber(value);
  if (numeric === null) return null;
  if (unit === "s") return numeric * 1000;
  if (unit === "us") return numeric / 1000;
  if (unit === "ns") return numeric / 1_000_000;
  return numeric;
}

function toNumber(value: unknown): number | null {
  const numeric = typeof value === "bigint" ? Number(value) : typeof value === "number" ? value : null;
  return numeric !== null && Number.isFinite(numeric) ? numeric : null;
}

function toQuality(value: unknown): ReadingQuality | undefined {
  return value === "valid" || value === "warning" || value === "critical" || value === "missing" ? value : undefined;
}
