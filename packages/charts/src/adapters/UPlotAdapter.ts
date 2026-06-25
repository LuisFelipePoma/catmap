import type { RendererAdapter } from "@catmap/core";
import uPlot from "uplot";

export type ChartValue = number | null;
export type ChartKind = "line" | "bar";
export type ChartThresholdSeverity = "info" | "warning" | "critical";

export interface ChartPoint {
  timestamp: number;
  value: ChartValue;
}

export interface ChartThreshold {
  value: number;
  label: string;
  severity: ChartThresholdSeverity;
  scale?: string | undefined;
}

export interface TimeSeriesChartSeries {
  id: string;
  label: string;
  color: string;
  data: readonly ChartPoint[];
  kind?: ChartKind | undefined;
  scale?: string | undefined;
  width?: number | undefined;
}

export interface TimeSeriesChartSpec {
  title?: string | undefined;
  height?: number | undefined;
  yLabel?: string | undefined;
  maxPoints?: number | undefined;
  showThresholds?: boolean | undefined;
  thresholds?: readonly ChartThreshold[] | undefined;
  series: readonly TimeSeriesChartSeries[];
}

export type UPlotData = [number[], ...ChartValue[][]];

export interface TimeSeriesChartAdapter extends RendererAdapter {
  update(spec: TimeSeriesChartSpec): void;
  resize(width?: number, height?: number): void;
  readonly dataLength: number;
  readonly seriesKinds: ChartKind[];
}

export class UPlotAdapter implements TimeSeriesChartAdapter {
  private chart: uPlot | undefined;
  private container: HTMLElement | undefined;
  private resizeObserver: ResizeObserver | undefined;
  private spec: TimeSeriesChartSpec;
  private data: UPlotData;
  private options: uPlot.Options;

  constructor(spec: TimeSeriesChartSpec) {
    this.spec = spec;
    this.data = toUPlotData(spec, defaultMaxPoints(spec, 320));
    this.options = toUPlotOptions(spec, 320);
  }

  get dataLength(): number {
    return this.data[0].length;
  }

  get seriesKinds(): ChartKind[] {
    return this.spec.series.map((series) => series.kind ?? "line");
  }

  init(container: HTMLElement): void {
    this.container = container;
    this.options = toUPlotOptions(this.spec, widthOf(container));
    this.data = toUPlotData(this.spec, defaultMaxPoints(this.spec, widthOf(container)));
    this.chart = new uPlot(this.options, this.data, container);

    if (typeof ResizeObserver !== "undefined") {
      this.resizeObserver = new ResizeObserver(() => this.resize());
      this.resizeObserver.observe(container);
    }
  }

  update(spec: TimeSeriesChartSpec): void {
    this.spec = spec;
    const width = widthOf(this.container);
    this.data = toUPlotData(spec, defaultMaxPoints(spec, width));
    this.options = toUPlotOptions(spec, width);

    if (!this.chart) return;
    this.chart.setData(this.data);
    this.chart.setSize({ width, height: heightOf(this.container, spec) });
    this.chart.redraw();
  }

  setData(data: UPlotData): void {
    this.data = data;
    this.chart?.setData(data);
  }

  render(): void {
    this.chart?.redraw();
  }

  resize(width = widthOf(this.container), height = heightOf(this.container, this.spec)): void {
    this.chart?.setSize({ width, height });
  }

  destroy(): void {
    this.resizeObserver?.disconnect();
    this.chart?.destroy();
    this.resizeObserver = undefined;
    this.chart = undefined;
    this.container = undefined;
  }
}

export function toUPlotData(spec: TimeSeriesChartSpec, maxPoints: number): UPlotData {
  const timestamps = sortedTimestamps(spec.series);
  const decimatedTimestamps = decimateTimestamps(timestamps, maxPoints, spec.series[0]?.data ?? []);

  return [
    decimatedTimestamps.map((timestamp) => timestamp / 1000),
    ...spec.series.map((series) => {
      const values = new Map(series.data.map((point) => [point.timestamp, point.value]));
      return decimatedTimestamps.map((timestamp) => values.get(timestamp) ?? null);
    })
  ];
}

function toUPlotOptions(spec: TimeSeriesChartSpec, width: number): uPlot.Options {
  const scales: Record<string, uPlot.Scale> = { x: { time: true }, y: {} };
  const axes: uPlot.Axis[] = [{}, { ...(spec.yLabel ? { label: spec.yLabel } : {}), scale: "y" }];

  if (spec.series.some((series) => series.scale === "rainfall")) {
    scales.rainfall = { dir: -1 };
    axes.push({ label: "Rainfall", scale: "rainfall", side: 1 });
  }

  return {
    ...(spec.title ? { title: spec.title } : {}),
    width,
    height: spec.height ?? 300,
    scales,
    axes,
    series: [
      { label: "Time" },
      ...spec.series.map((series) => {
        const isBar = series.kind === "bar";
        const barPaths = isBar ? uPlot.paths.bars?.({ size: [0.65, 40, 2] }) : undefined;
        return {
          label: series.label,
          scale: series.scale ?? "y",
          stroke: series.color,
          width: series.width ?? (isBar ? 0 : 2),
          ...(isBar ? { fill: withAlpha(series.color, 0.35) } : {}),
          ...(barPaths ? { paths: barPaths } : {}),
          points: { show: false }
        };
      })
    ],
    hooks: {
      draw: [
        (chart) => {
          if (spec.showThresholds === false) return;
          drawThresholds(chart, spec.thresholds ?? []);
        }
      ]
    }
  };
}

function sortedTimestamps(series: readonly TimeSeriesChartSeries[]): number[] {
  return [...new Set(series.flatMap((item) => item.data.map((point) => point.timestamp)))].sort(
    (a, b) => a - b
  );
}

function decimateTimestamps(
  timestamps: readonly number[],
  maxPoints: number,
  primary: readonly ChartPoint[]
): number[] {
  if (maxPoints <= 0) return [];
  if (timestamps.length <= maxPoints) return [...timestamps];
  if (maxPoints === 1) return [timestamps[0]!];

  const values = new Map(primary.map((point) => [point.timestamp, point.value]));
  const bucketCount = Math.max(1, Math.floor(maxPoints / 2));
  const bucketSize = Math.ceil(timestamps.length / bucketCount);
  const output: number[] = [];

  for (let start = 0; start < timestamps.length && output.length < maxPoints; start += bucketSize) {
    const bucket = timestamps.slice(start, start + bucketSize);
    const numeric = bucket
      .map((timestamp) => ({ timestamp, value: values.get(timestamp) }))
      .filter((point): point is { timestamp: number; value: number } => typeof point.value === "number");

    if (numeric.length === 0) {
      output.push(bucket[0]!);
      continue;
    }

    let min = numeric[0]!;
    let max = numeric[0]!;
    for (const point of numeric) {
      if (point.value < min.value) min = point;
      if (point.value > max.value) max = point;
    }

    const pair = min.timestamp <= max.timestamp ? [min.timestamp, max.timestamp] : [max.timestamp, min.timestamp];
    for (const timestamp of pair) {
      if (output.at(-1) !== timestamp && output.length < maxPoints) output.push(timestamp);
    }
  }

  return output.sort((a, b) => a - b);
}

function defaultMaxPoints(spec: TimeSeriesChartSpec, width: number): number {
  return spec.maxPoints ?? Math.max(100, Math.floor(width * 2));
}

function widthOf(container: HTMLElement | undefined): number {
  return Math.max(container?.clientWidth ?? 320, 320);
}

function heightOf(_container: HTMLElement | undefined, spec: TimeSeriesChartSpec): number {
  return spec.height ?? 300;
}

function drawThresholds(chart: uPlot, thresholds: readonly ChartThreshold[]): void {
  const ctx = chart.ctx;
  const left = chart.bbox.left / devicePixelRatio;
  const top = chart.bbox.top / devicePixelRatio;
  const width = chart.bbox.width / devicePixelRatio;

  for (const threshold of thresholds) {
    const scale = threshold.scale ?? "y";
    const y = chart.valToPos(threshold.value, scale, true);
    ctx.save();
    ctx.strokeStyle = colorForThreshold(threshold.severity);
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(left, top + y);
    ctx.lineTo(left + width, top + y);
    ctx.stroke();
    ctx.restore();
  }
}

function colorForThreshold(severity: ChartThresholdSeverity): string {
  return {
    info: "#2563eb",
    warning: "#f59e0b",
    critical: "#dc2626"
  }[severity];
}

function withAlpha(hex: string, alpha: number): string {
  if (!hex.startsWith("#") || hex.length !== 7) return hex;
  const value = Math.round(alpha * 255)
    .toString(16)
    .padStart(2, "0");
  return `${hex}${value}`;
}
