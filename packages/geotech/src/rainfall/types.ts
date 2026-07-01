import type { ChartToolsOptions } from "@catmap/charts";
import type { PiezometerReading, TriggerLevel } from "../piezometer/types";

export interface RainfallReading {
  timestamp: number;
  rainfall?: number;
}

export interface RainfallResponseChartOptions {
  title?: string;
  rainfall: RainfallReading[];
  readings: PiezometerReading[];
  responseAxis?: "waterLevel" | "porePressure";
  thresholds?: TriggerLevel[];
  showThresholds?: boolean;
  maxPoints?: number;
  height?: number;
  tools?: ChartToolsOptions;
}
