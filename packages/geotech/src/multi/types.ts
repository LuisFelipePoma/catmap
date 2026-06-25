import type { ReadingQuality, TriggerLevel } from "../piezometer/types";

export interface GeotechSeriesPoint {
  timestamp: number;
  value?: number;
  quality?: ReadingQuality;
}

export interface GeotechSeries {
  id: string;
  label: string;
  unit?: string;
  color?: string;
  readings: GeotechSeriesPoint[];
}

export interface MultiInstrumentChartOptions {
  title?: string;
  yLabel?: string;
  series: GeotechSeries[];
  thresholds?: TriggerLevel[];
  showThresholds?: boolean;
  maxPoints?: number;
  height?: number;
}
