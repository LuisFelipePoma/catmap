import type { ChartPoint, TimeSeriesChartAdapter, TimeSeriesChartSpec } from "@catmap/charts";
import { BaseTimeSeriesChart } from "../shared/BaseTimeSeriesChart";
import type { GeotechSeries, MultiInstrumentChartOptions } from "./types";

const colors = ["#2563eb", "#16a34a", "#dc2626", "#7c3aed", "#f59e0b"];

export class MultiInstrumentChart extends BaseTimeSeriesChart<
  MultiInstrumentChartOptions,
  GeotechSeries[]
> {
  constructor(
    container: HTMLElement,
    options: MultiInstrumentChartOptions,
    adapter?: TimeSeriesChartAdapter
  ) {
    super(container, options, toMultiInstrumentSpec(options), adapter);
  }

  updateData(series: GeotechSeries[]): void {
    this.updateOptions({ series });
  }

  protected toSpec(options: MultiInstrumentChartOptions): TimeSeriesChartSpec {
    return toMultiInstrumentSpec(options);
  }
}

function toMultiInstrumentSpec(options: MultiInstrumentChartOptions): TimeSeriesChartSpec {
  return {
    title: options.title ?? "Multi-instrument comparison",
    yLabel: options.yLabel ?? options.series[0]?.unit,
    height: options.height,
    maxPoints: options.maxPoints,
    showThresholds: options.showThresholds,
    thresholds: options.thresholds,
    series: options.series.map((series, index) => ({
      id: series.id,
      label: series.label,
      color: series.color ?? colors[index % colors.length]!,
      data: toPoints(series)
    }))
  };
}

function toPoints(series: GeotechSeries): ChartPoint[] {
  return series.readings.map((reading) => ({
    timestamp: reading.timestamp,
    value: reading.quality === "missing" ? null : (reading.value ?? null)
  }));
}
