export interface SensorHealthReading {
  instrumentId: string;
  label: string;
  uptime: number;
  warning: number;
  critical: number;
}

export interface SensorHealthChartOptions {
  title?: string;
  readings: SensorHealthReading[];
  height?: number;
}
