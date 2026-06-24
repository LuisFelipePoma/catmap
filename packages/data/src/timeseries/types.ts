export type Timestamp = number;
export type ReadingQuality = "valid" | "warning" | "critical" | "missing";

export interface TimeSeriesPoint {
  timestamp: Timestamp;
  value: number;
  quality?: ReadingQuality;
}

export interface TimeSeriesQuery {
  from: Timestamp;
  to: Timestamp;
  maxPoints?: number;
}
