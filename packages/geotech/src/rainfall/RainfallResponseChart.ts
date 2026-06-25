import type { ChartPoint, TimeSeriesChartAdapter, TimeSeriesChartSpec } from "@catmap/charts";
import { BaseTimeSeriesChart } from "../shared/BaseTimeSeriesChart";
import type { PiezometerReading } from "../piezometer/types";
import type { RainfallReading, RainfallResponseChartOptions } from "./types";

export class RainfallResponseChart extends BaseTimeSeriesChart<
  RainfallResponseChartOptions,
  { rainfall: RainfallReading[]; readings: PiezometerReading[] }
> {
  constructor(
    container: HTMLElement,
    options: RainfallResponseChartOptions,
    adapter?: TimeSeriesChartAdapter
  ) {
    super(container, options, toRainfallResponseSpec(options), adapter);
  }

  updateData(data: { rainfall: RainfallReading[]; readings: PiezometerReading[] }): void {
    this.updateOptions(data);
  }

  protected toSpec(options: RainfallResponseChartOptions): TimeSeriesChartSpec {
    return toRainfallResponseSpec(options);
  }
}

function toRainfallResponseSpec(options: RainfallResponseChartOptions): TimeSeriesChartSpec {
  const responseAxis = options.responseAxis ?? "waterLevel";

  return {
    title: options.title ?? "Rainfall response",
    yLabel: responseAxis === "waterLevel" ? "Water level" : "Pore pressure",
    height: options.height,
    maxPoints: options.maxPoints,
    showThresholds: options.showThresholds,
    thresholds: options.thresholds,
    series: [
      {
        id: "rainfall",
        label: "Rainfall",
        color: "#0891b2",
        kind: "bar",
        scale: "rainfall",
        data: rainfallPoints(options.rainfall)
      },
      {
        id: responseAxis,
        label: responseAxis === "waterLevel" ? "Water level" : "Pore pressure",
        color: "#2563eb",
        data: responsePoints(options.readings, responseAxis)
      }
    ]
  };
}

function rainfallPoints(readings: readonly RainfallReading[]): ChartPoint[] {
  return readings.map((reading) => ({
    timestamp: reading.timestamp,
    value: reading.rainfall ?? null
  }));
}

function responsePoints(
  readings: readonly PiezometerReading[],
  axis: NonNullable<RainfallResponseChartOptions["responseAxis"]>
): ChartPoint[] {
  return readings.map((reading) => ({
    timestamp: reading.timestamp,
    value: reading.quality === "missing" ? null : (reading[axis] ?? null)
  }));
}
