import type { ChartMarker, ChartPoint, TimeSeriesChartAdapter, TimeSeriesChartSpec } from "@catmap/charts";
import { BaseTimeSeriesChart } from "../shared/BaseTimeSeriesChart";
import { missingMarkers } from "../shared/markers";
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
    tools: options.tools,
    showThresholds: options.showThresholds,
    thresholds: options.thresholds,
    markers: options.series.flatMap(markersForSeries),
    series: options.series.map((series, index) => ({
      id: series.id,
      label: series.label,
      color: series.color ?? colors[index % colors.length]!,
      data: toPoints(series)
    }))
  };
}

function markersForSeries(series: GeotechSeries): ChartMarker[] {
  return missingMarkers(series.readings, {
    id: `missing-${series.id}`,
    label: `${series.label} missing`,
    timestamp: (reading) => reading.timestamp,
    value: (reading) => reading.value,
    missing: (reading) => reading.value === undefined || reading.quality === "missing"
  });
}

function toPoints(series: GeotechSeries): ChartPoint[] {
  return series.readings.map((reading) => ({
    timestamp: reading.timestamp,
    value: reading.quality === "missing" ? null : (reading.value ?? null)
  }));
}
