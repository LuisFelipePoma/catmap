import type { ChartPoint, TimeSeriesChartAdapter, TimeSeriesChartSpec } from "@catmap/charts";
import { BaseTimeSeriesChart } from "../shared/BaseTimeSeriesChart";
import { missingMarkers } from "../shared/markers";
import type { PiezometerChartOptions, PiezometerReading } from "./types";

export class PiezometerChart extends BaseTimeSeriesChart<PiezometerChartOptions, PiezometerReading[]> {
  constructor(
    container: HTMLElement,
    options: PiezometerChartOptions,
    adapter?: TimeSeriesChartAdapter
  ) {
    super(container, options, toPiezometerSpec(options), adapter);
  }

  updateData(readings: PiezometerReading[]): void {
    this.updateOptions({ readings });
  }

  protected toSpec(options: PiezometerChartOptions): TimeSeriesChartSpec {
    return toPiezometerSpec(options);
  }
}

function toPiezometerSpec(options: PiezometerChartOptions): TimeSeriesChartSpec {
  const yAxis = options.yAxis ?? "waterLevel";

  return {
    title: options.instrument.name ?? options.instrument.id,
    yLabel: labelForAxis(yAxis),
    height: options.height,
    maxPoints: options.maxPoints,
    showThresholds: options.showThresholds,
    thresholds: options.thresholds,
    markers:
      options.showMissingData === false
        ? []
        : missingMarkers(options.readings, {
            id: "missing-piezometer",
            label: "Missing data",
            timestamp: (reading) => reading.timestamp,
            value: (reading) => reading[yAxis],
            missing: (reading) => reading[yAxis] === undefined || reading.quality === "missing"
          }),
    series: [
      {
        id: yAxis,
        label: labelForAxis(yAxis),
        color: "#2563eb",
        data: toPoints(options.readings, yAxis, options.showMissingData)
      }
    ]
  };
}

function toPoints(
  readings: readonly PiezometerReading[],
  yAxis: NonNullable<PiezometerChartOptions["yAxis"]>,
  showMissingData = true
): ChartPoint[] {
  return readings.flatMap((reading) => {
    const value = reading[yAxis];
    const missing = value === undefined || reading.quality === "missing";
    if (missing && !showMissingData) return [];
    return [{ timestamp: reading.timestamp, value: missing ? null : value }];
  });
}

function labelForAxis(axis: NonNullable<PiezometerChartOptions["yAxis"]>): string {
  return {
    waterLevel: "Water level",
    porePressure: "Pore pressure",
    elevation: "Elevation"
  }[axis];
}
