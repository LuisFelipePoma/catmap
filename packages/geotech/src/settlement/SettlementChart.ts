import type { ChartPoint, TimeSeriesChartAdapter, TimeSeriesChartSpec } from "@catmap/charts";
import { BaseTimeSeriesChart } from "../shared/BaseTimeSeriesChart";
import { missingMarkers } from "../shared/markers";
import type { SettlementChartOptions, SettlementReading } from "./types";

export class SettlementChart extends BaseTimeSeriesChart<SettlementChartOptions, SettlementReading[]> {
  constructor(
    container: HTMLElement,
    options: SettlementChartOptions,
    adapter?: TimeSeriesChartAdapter
  ) {
    super(container, options, toSettlementSpec(options), adapter);
  }

  updateData(readings: SettlementReading[]): void {
    this.updateOptions({ readings });
  }

  protected toSpec(options: SettlementChartOptions): TimeSeriesChartSpec {
    return toSettlementSpec(options);
  }
}

function toSettlementSpec(options: SettlementChartOptions): TimeSeriesChartSpec {
  return {
    title: options.instrument?.name ?? options.instrument?.id ?? "Settlement monitoring",
    yLabel: "Settlement",
    height: options.height,
    maxPoints: options.maxPoints,
    tools: options.tools,
    showThresholds: options.showThresholds,
    thresholds: options.thresholds,
    markers:
      options.showMissingData === false
        ? []
        : missingMarkers(options.readings, {
            id: "missing-settlement",
            label: "Missing data",
            timestamp: (reading) => reading.timestamp,
            value: (reading) => reading.settlement,
            missing: (reading) => reading.settlement === undefined || reading.quality === "missing"
          }),
    series: [
      {
        id: "settlement",
        label: "Settlement",
        color: "#7c3aed",
        data: toPoints(options.readings, options.showMissingData)
      }
    ]
  };
}

function toPoints(readings: readonly SettlementReading[], showMissingData = true): ChartPoint[] {
  return readings.flatMap((reading) => {
    const missing = reading.settlement === undefined || reading.quality === "missing";
    if (missing && !showMissingData) return [];
    return [{ timestamp: reading.timestamp, value: missing ? null : reading.settlement! }];
  });
}
