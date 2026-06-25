export type ReadingQuality = "valid" | "warning" | "critical" | "missing";

export interface PiezometerReading {
  timestamp: number;
  waterLevel?: number;
  porePressure?: number;
  elevation?: number;
  quality?: ReadingQuality;
}

export interface PiezometerInstrument {
  id: string;
  name?: string;
  groundElevation?: number;
  tipElevation?: number;
  location?: {
    latitude: number;
    longitude: number;
  };
}

export interface TriggerLevel {
  value: number;
  label: string;
  severity: "info" | "warning" | "critical";
}

export interface PiezometerChartOptions {
  instrument: PiezometerInstrument;
  readings: PiezometerReading[];
  thresholds?: TriggerLevel[];
  yAxis?: "waterLevel" | "porePressure" | "elevation";
  showMissingData?: boolean;
  showThresholds?: boolean;
  maxPoints?: number;
  height?: number;
}
