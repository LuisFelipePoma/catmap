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
  points?: boolean | undefined;
}

export interface ChartMarker {
  id: string;
  label: string;
  timestamp: number;
  value: number;
  color?: string | undefined;
}

export interface ChartXRange {
  min: number;
  max: number;
}

export interface ChartInspectEvent {
  index: number;
  x: number;
  series: Array<{
    id: string;
    label: string;
    color: string;
    value: ChartValue;
    scale?: string | undefined;
  }>;
}

export interface ChartToolsOptions {
  inspect?: boolean | undefined;
  zoom?: boolean | undefined;
  pan?: boolean | undefined;
  reset?: boolean | undefined;
  onInspect?: ((event: ChartInspectEvent | null) => void) | undefined;
  onViewportChange?: ((range: ChartXRange | null) => void) | undefined;
}

export interface TimeSeriesChartSpec {
  title?: string | undefined;
  height?: number | undefined;
  xLabel?: string | undefined;
  yLabel?: string | undefined;
  xTime?: boolean | undefined;
  invertY?: boolean | undefined;
  maxPoints?: number | undefined;
  showThresholds?: boolean | undefined;
  thresholds?: readonly ChartThreshold[] | undefined;
  markers?: readonly ChartMarker[] | undefined;
  tools?: ChartToolsOptions | undefined;
  series: readonly TimeSeriesChartSeries[];
}

export type UPlotData = [number[], ...ChartValue[][]];

export interface TimeSeriesChartAdapter extends RendererAdapter {
  update(spec: TimeSeriesChartSpec): void;
  resize(width?: number, height?: number): void;
  resetViewport(): void;
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
  private suppressNextXScaleEvent = false;

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
    this.options = toUPlotOptions(this.spec, widthOf(container), {
      setCursor: this.handleSetCursor,
      setScale: this.handleSetScale
    });
    this.data = toUPlotData(this.spec, defaultMaxPoints(this.spec, widthOf(container)));
    this.chart = new uPlot(this.options, this.data, container);
    this.bindToolEvents();
    this.applyScales();
    this.settleLayout();

    if (typeof ResizeObserver !== "undefined") {
      this.resizeObserver = new ResizeObserver(() => this.resize());
      this.resizeObserver.observe(container);
    }
  }

  update(spec: TimeSeriesChartSpec): void {
    this.spec = spec;
    const width = widthOf(this.container);
    this.data = toUPlotData(spec, defaultMaxPoints(spec, width));
    this.options = toUPlotOptions(spec, width, {
      setCursor: this.handleSetCursor,
      setScale: this.handleSetScale
    });

    if (!this.chart) return;
    this.chart.setData(this.data);
    this.chart.setSize({ width, height: heightOf(this.container, spec) });
    this.applyScales();
    this.settleLayout();
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

  resetViewport(): void {
    const full = this.fullXRange();
    if (this.chart && full) {
      this.suppressNextXScaleEvent = true;
      this.chart.setScale("x", full);
      this.suppressNextXScaleEvent = false;
    }
    this.spec.tools?.onViewportChange?.(null);
  }

  private bindToolEvents(): void {
    this.chart?.over.addEventListener("wheel", this.handleWheel, { passive: false });
    this.chart?.over.addEventListener("dblclick", this.handleDoubleClick);
  }

  private readonly handleSetCursor = (chart: uPlot): void => {
    const tools = this.spec.tools;
    if (!toolEnabled(tools, "inspect") || !tools?.onInspect) return;

    const index = chart.cursor.idx;
    const x = typeof index === "number" ? chart.data[0]?.[index] : undefined;
    if (index === null || index === undefined || typeof x !== "number" || !Number.isFinite(x)) {
      tools.onInspect(null);
      return;
    }

    tools.onInspect({
      index,
      x: fromUPlotX(x, this.spec),
      series: this.spec.series.map((series, seriesIndex) => ({
        id: series.id,
        label: series.label,
        color: series.color,
        value: normalizeChartValue(chart.data[seriesIndex + 1]?.[index]),
        ...(series.scale ? { scale: series.scale } : {})
      }))
    });
  };

  private readonly handleSetScale = (_chart: uPlot, scaleKey: string): void => {
    if (scaleKey !== "x") return;
    if (this.suppressNextXScaleEvent) {
      this.suppressNextXScaleEvent = false;
      return;
    }
    this.emitViewportChange();
  };

  private readonly handleWheel = (event: WheelEvent): void => {
    const chart = this.chart;
    const tools = this.spec.tools;
    if (!chart) return;

    const canPan = toolEnabled(tools, "pan");
    const canZoom = toolEnabled(tools, "zoom");
    if (!canPan && !canZoom) return;

    const full = this.fullXRange();
    const current = this.currentXRange();
    if (!full || !current) return;

    const pan = canPan && (event.shiftKey || Math.abs(event.deltaX) > Math.abs(event.deltaY));
    if (!pan && !canZoom) return;

    event.preventDefault();
    const span = current.max - current.min || full.max - full.min || 1;
    if (pan) {
      const delta = event.deltaX || event.deltaY;
      const offset = (delta / Math.max(chart.width, 1)) * span;
      this.setXRange({ min: current.min + offset, max: current.max + offset });
      return;
    }

    const rect = chart.over.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const center = Number.isFinite(x) ? chart.posToVal(x, "x") : current.min + span / 2;
    const nextSpan = clamp(span * (event.deltaY < 0 ? 0.8 : 1.25), (full.max - full.min || 1) / 120, full.max - full.min || 1);
    if (nextSpan >= (full.max - full.min || 1) * 0.995) {
      this.resetViewport();
      return;
    }

    const ratio = clamp((center - current.min) / span, 0, 1);
    this.setXRange({
      min: center - nextSpan * ratio,
      max: center + nextSpan * (1 - ratio)
    });
  };

  private readonly handleDoubleClick = (): void => {
    if (toolEnabled(this.spec.tools, "reset")) this.resetViewport();
  };

  private setXRange(rangeValue: ChartXRange): void {
    const chart = this.chart;
    const full = this.fullXRange();
    if (!chart || !full) return;

    const next = normalizeXRange(rangeValue, full);
    if (!next) {
      this.resetViewport();
      return;
    }
    chart.setScale("x", next);
  }

  private currentXRange(): ChartXRange | null {
    const scale = this.chart?.scales.x;
    const min = scale?.min;
    const max = scale?.max;
    if (Number.isFinite(min) && Number.isFinite(max)) {
      return { min: min!, max: max! };
    }
    return this.fullXRange();
  }

  private fullXRange(): ChartXRange | null {
    return dataRange(this.data[0]);
  }

  private emitViewportChange(): void {
    const callback = this.spec.tools?.onViewportChange;
    if (!callback) return;

    const full = this.fullXRange();
    const current = this.currentXRange();
    if (!full || !current || isFullRange(current, full)) {
      callback(null);
      return;
    }

    callback({
      min: fromUPlotX(current.min, this.spec),
      max: fromUPlotX(current.max, this.spec)
    });
  }

  private settleLayout(): void {
    const redraw = () => this.resize();

    redraw();
    if (typeof requestAnimationFrame === "undefined") return;
    requestAnimationFrame(() => requestAnimationFrame(redraw));
  }

  private applyScales(): void {
    if (!this.chart) return;

    const series = chartSeries(this.spec);
    const valuesByScale = new Map<string, number[]>();
    series.forEach((series, index) => {
      const scale = series.scale ?? "y";
      const values = valuesByScale.get(scale) ?? [];
      for (const value of this.data[index + 1] ?? []) {
        if (typeof value === "number" && Number.isFinite(value)) values.push(value);
      }
      valuesByScale.set(scale, values);
    });

    for (const [scale, values] of valuesByScale) {
      const range = dataRange(values);
      if (!range) continue;
      const includeZero = series.some((series) => (series.scale ?? "y") === scale && series.kind === "bar");
      this.chart.setScale(scale, paddedMinMax(range.min, range.max, includeZero));
    }
  }

  destroy(): void {
    this.resizeObserver?.disconnect();
    this.chart?.over.removeEventListener("wheel", this.handleWheel);
    this.chart?.over.removeEventListener("dblclick", this.handleDoubleClick);
    this.chart?.destroy();
    this.resizeObserver = undefined;
    this.chart = undefined;
    this.container = undefined;
  }
}

function dataRange(values: readonly number[]): { min: number; max: number } | null {
  let min = Infinity;
  let max = -Infinity;
  for (const value of values) {
    if (!Number.isFinite(value)) continue;
    if (value < min) min = value;
    if (value > max) max = value;
  }
  return min === Infinity ? null : { min, max };
}

function toolEnabled(tools: ChartToolsOptions | undefined, key: keyof Pick<ChartToolsOptions, "inspect" | "zoom" | "pan" | "reset">): boolean {
  return tools?.[key] !== false;
}

function normalizeChartValue(value: unknown): ChartValue {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function fromUPlotX(value: number, spec: TimeSeriesChartSpec): number {
  return spec.xTime === false ? value : value * 1000;
}

function normalizeXRange(rangeValue: ChartXRange, full: ChartXRange): ChartXRange | null {
  const fullSpan = full.max - full.min || 1;
  const span = clamp(rangeValue.max - rangeValue.min || fullSpan, fullSpan / 120, fullSpan);
  if (span >= fullSpan * 0.995) return null;

  let min = clamp(rangeValue.min, full.min, full.max - span);
  let max = min + span;
  if (max > full.max) {
    max = full.max;
    min = max - span;
  }
  return { min, max };
}

function isFullRange(rangeValue: ChartXRange, full: ChartXRange): boolean {
  const span = full.max - full.min || 1;
  return Math.abs(rangeValue.min - full.min) <= span * 1e-9 && Math.abs(rangeValue.max - full.max) <= span * 1e-9;
}

function clamp(value: number, min: number, max: number): number {
  if (max < min) return min;
  return Math.max(min, Math.min(max, value));
}

function paddedMinMax(min: number, max: number, includeZero: boolean): { min: number; max: number } {
  const rangeMin = includeZero ? Math.min(0, min) : min;
  const rangeMax = includeZero ? Math.max(0, max) : max;
  const span = rangeMax - rangeMin || Math.max(Math.abs(rangeMax), 1);
  const pad = span * 0.08;
  return { min: rangeMin - pad, max: rangeMax + pad };
}

export function toUPlotData(spec: TimeSeriesChartSpec, maxPoints: number): UPlotData {
  const series = chartSeries(spec);
  const timestamps = sortedTimestamps(series);
  const decimatedTimestamps = decimateTimestamps(timestamps, maxPoints, series[0]?.data ?? []);

  return [
    decimatedTimestamps.map((timestamp) => (spec.xTime === false ? timestamp : timestamp / 1000)),
    ...series.map((series) => {
      const values = new Map(series.data.map((point) => [point.timestamp, point.value]));
      return decimatedTimestamps.map((timestamp) => values.get(timestamp) ?? null);
    })
  ];
}

interface UPlotToolHooks {
  setCursor: (chart: uPlot) => void;
  setScale: (chart: uPlot, scaleKey: string) => void;
}

function toUPlotOptions(spec: TimeSeriesChartSpec, width: number, toolHooks?: UPlotToolHooks): uPlot.Options {
  const series = chartSeries(spec);
  const yNeedsZero = series.some((series) => (series.scale ?? "y") === "y" && series.kind === "bar");
  const scales: Record<string, uPlot.Scale> = {
    x: { time: spec.xTime !== false },
    y: { range: paddedRange(yNeedsZero), ...(spec.invertY ? { dir: -1 } : {}) }
  };
  const axes: uPlot.Axis[] = [
    { ...(spec.xLabel ? { label: spec.xLabel } : {}) },
    { ...(spec.yLabel ? { label: spec.yLabel } : {}), scale: "y" }
  ];

  if (series.some((series) => series.scale === "rainfall")) {
    scales.rainfall = { dir: -1, range: paddedRange(true) };
    axes.push({ label: "Rainfall", scale: "rainfall", side: 1 });
  }
  const inspect = toolEnabled(spec.tools, "inspect");
  const zoom = toolEnabled(spec.tools, "zoom");

  return {
    ...(spec.title ? { title: spec.title } : {}),
    width,
    height: spec.height ?? 300,
    scales,
    axes,
    legend: { show: inspect, live: inspect },
    cursor: {
      show: inspect,
      x: inspect,
      y: inspect,
      drag: { x: zoom, y: false, setScale: zoom, dist: 5 }
    },
    series: [
      { label: "Time" },
      ...series.map((series) => {
        const isBar = series.kind === "bar";
        const barPaths = isBar ? uPlot.paths.bars?.({ size: [0.65, 40, 2] }) : undefined;
        const showPoints = series.points === true;
        return {
          label: series.label,
          scale: series.scale ?? "y",
          stroke: series.color,
          width: series.width ?? (isBar ? 1 : 2),
          ...(isBar ? { fill: withAlpha(series.color, 0.35) } : {}),
          ...(barPaths ? { paths: barPaths } : {}),
          ...(showPoints
            ? {
                points: {
                  show: true,
                  size: 7,
                  fill: series.color,
                  stroke: "#ffffff",
                  width: 1
                }
              }
            : {})
        };
      })
    ],
    hooks: {
      ...(toolHooks
        ? {
            setCursor: [toolHooks.setCursor],
            setScale: [toolHooks.setScale]
          }
        : {}),
      draw: [
        (chart) => {
          if (spec.showThresholds === false) return;
          drawThresholds(chart, spec.thresholds ?? []);
        }
      ]
    }
  };
}

function paddedRange(includeZero: boolean): uPlot.Scale.Range {
  return (_chart, initMin, initMax) => {
    let min = includeZero ? Math.min(0, initMin) : initMin;
    let max = includeZero ? Math.max(0, initMax) : initMax;
    const span = max - min || Math.max(Math.abs(max), 1);
    const pad = span * 0.08;
    min -= pad;
    max += pad;
    return [min, max];
  };
}

function chartSeries(spec: TimeSeriesChartSpec): TimeSeriesChartSeries[] {
  return [
    ...spec.series,
    ...(spec.markers ?? []).map((marker) => ({
      id: marker.id,
      label: marker.label,
      color: marker.color ?? "#dc2626",
      data: [{ timestamp: marker.timestamp, value: marker.value }],
      width: 0,
      points: true
    }))
  ];
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
