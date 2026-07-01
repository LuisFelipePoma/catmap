import type { ChartToolsOptions } from "@catmap/charts";
import type { ReadingQuality, TriggerLevel } from "../piezometer/types";

export interface SettlementReading {
  timestamp: number;
  settlement?: number;
  quality?: ReadingQuality;
}

export interface SettlementInstrument {
  id: string;
  name?: string;
  location?: {
    latitude: number;
    longitude: number;
  };
}

export interface SettlementChartOptions {
  instrument?: SettlementInstrument;
  readings: SettlementReading[];
  thresholds?: TriggerLevel[];
  showThresholds?: boolean;
  showMissingData?: boolean;
  maxPoints?: number;
  height?: number;
  tools?: ChartToolsOptions;
}
