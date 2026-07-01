import type { ChartToolsOptions } from "@catmap/charts";
import type { ReadingQuality, TriggerLevel } from "../piezometer/types";

export interface InclinometerReading {
  depth: number;
  displacementX?: number;
  displacementY?: number;
  quality?: ReadingQuality;
}

export interface InclinometerCampaign {
  id: string;
  label: string;
  timestamp: number;
  readings: InclinometerReading[];
}

export interface InclinometerInstrument {
  id: string;
  name?: string;
}

export interface InclinometerProfileOptions {
  instrument?: InclinometerInstrument;
  campaigns: InclinometerCampaign[];
  axis?: "displacementX" | "displacementY";
  thresholds?: TriggerLevel[];
  showMissingData?: boolean;
  height?: number;
  maxPoints?: number;
  tools?: ChartToolsOptions;
}
