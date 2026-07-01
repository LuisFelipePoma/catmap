import type { ChartPoint, TimeSeriesChartAdapter, TimeSeriesChartSpec } from "@catmap/charts";
import { BaseTimeSeriesChart } from "../shared/BaseTimeSeriesChart";
import type { SensorHealthChartOptions, SensorHealthReading } from "./types";

export class SensorHealthChart extends BaseTimeSeriesChart<
  SensorHealthChartOptions,
  SensorHealthReading[]
> {
  constructor(
    container: HTMLElement,
    options: SensorHealthChartOptions,
    adapter?: TimeSeriesChartAdapter
  ) {
    super(container, options, toSensorHealthSpec(options), adapter);
  }

  updateData(readings: SensorHealthReading[]): void {
    this.updateOptions({ readings });
  }

  protected toSpec(options: SensorHealthChartOptions): TimeSeriesChartSpec {
    return toSensorHealthSpec(options);
  }
}

function toSensorHealthSpec(options: SensorHealthChartOptions): TimeSeriesChartSpec {
  return {
    title: options.title ?? "Sensor health",
    xLabel: "Instrument index",
    yLabel: "Percent",
    xTime: false,
    height: options.height ?? 280,
    tools: options.tools,
    series: [
      { id: "uptime", label: "Uptime", color: "#16a34a", points: true, data: toPoints(options.readings, "uptime") },
      { id: "warning", label: "Warning", color: "#f59e0b", points: true, data: toPoints(options.readings, "warning") },
      { id: "critical", label: "Critical", color: "#dc2626", points: true, data: toPoints(options.readings, "critical") }
    ]
  };
}

function toPoints(
  readings: readonly SensorHealthReading[],
  key: "uptime" | "warning" | "critical"
): ChartPoint[] {
  return readings.map((reading, index) => ({
    timestamp: index + 1,
    value: reading[key]
  }));
}
