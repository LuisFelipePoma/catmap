export interface WaterfallSpectrum {
  id: string;
  label?: string;
  values: ArrayLike<number>;
  color?: string;
}

export interface WaterfallRange {
  min: number;
  max: number;
}

export interface WaterfallPointSelection {
  spectrumIndex: number;
  pointIndex: number;
  spectrumId: string;
  x: number;
  value: number;
  label?: string;
}

export interface SpectralWaterfallChartOptions {
  spectra: readonly WaterfallSpectrum[];
  x?: ArrayLike<number>;
  title?: string;
  width?: number;
  height?: number;
  background?: string;
  lineColor?: string;
  selectedColor?: string;
  sliceColor?: string;
  initialSelection?: {
    spectrumIndex?: number;
    pointIndex?: number;
  };
  initialSliceIndex?: number;
  initialXRange?: WaterfallRange;
  onSelectionChange?: (selection: WaterfallPointSelection | null) => void;
  onSliceChange?: (pointIndex: number) => void;
  onViewportChange?: (range: WaterfallRange | null) => void;
}

export interface WaterfallPlotArea {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface NormalizedWaterfallPoint {
  spectrumIndex: number;
  pointIndex: number;
  spectrumId: string;
  xValue: number;
  value: number;
}

export interface ProjectedWaterfallPoint extends NormalizedWaterfallPoint {
  x: number;
  y: number;
}

export interface WaterfallProjection {
  points: ProjectedWaterfallPoint[];
  xRange: WaterfallRange | null;
  valueRange: WaterfallRange | null;
}

export interface WaterfallSeriesPoint {
  xValue: number;
  value: number;
  pointIndex?: number;
  spectrumIndex?: number;
}

export interface WaterfallComparisonSeries {
  id: string;
  label: string;
  color: string;
  kind: "selected" | "hover";
  points: WaterfallSeriesPoint[];
}

interface ChartLayout {
  waterfall: WaterfallPlotArea;
  spectrum: WaterfallPlotArea;
  slice: WaterfallPlotArea;
}

interface ViewportPan {
  startX: number;
  startRange: WaterfallRange;
  moved: boolean;
}

const baseLineColor = "#55c7f7";
const hoverLineColor = "#f8fafc";
const selectedLineColor = "#ff7a1a";
const sliceLineColor = "#78d7ff";

// ponytail: Canvas 2D is enough for demo-scale spectra; move this path to WebGL when benchmarks require it.
export class SpectralWaterfallChart {
  private readonly canvas: HTMLCanvasElement;
  private readonly context: CanvasRenderingContext2D | null;
  private readonly resizeObserver: ResizeObserver | undefined;
  private options: SpectralWaterfallChartOptions;
  private selectedSpectrumIndex: number | null;
  private hoverSpectrumIndex: number | null = null;
  private slicePointIndex: number;
  private viewportRange: WaterfallRange | null;
  private draggingSlice = false;
  private panningViewport: ViewportPan | null = null;
  private suppressClick = false;
  private width = 0;
  private height = 0;

  constructor(
    private readonly container: HTMLElement,
    options: SpectralWaterfallChartOptions
  ) {
    this.options = options;
    this.selectedSpectrumIndex = this.initialSpectrumIndex();
    this.slicePointIndex = this.initialSliceIndex();
    this.viewportRange = normalizeViewportRange(options.initialXRange ?? null, fullXRange(options));
    this.canvas = document.createElement("canvas");
    this.canvas.style.display = "block";
    this.canvas.style.width = "100%";
    this.canvas.style.height = `${options.height ?? 560}px`;
    this.canvas.style.touchAction = "none";
    this.context = this.canvas.getContext("2d");

    this.canvas.addEventListener("pointermove", this.handlePointerMove);
    this.canvas.addEventListener("pointerdown", this.handlePointerDown);
    this.canvas.addEventListener("pointerup", this.handlePointerUp);
    this.canvas.addEventListener("pointerleave", this.handlePointerLeave);
    this.canvas.addEventListener("click", this.handleClick);
    this.canvas.addEventListener("wheel", this.handleWheel, { passive: false });
    this.canvas.addEventListener("dblclick", this.handleDoubleClick);
    this.container.appendChild(this.canvas);

    if (typeof ResizeObserver !== "undefined") {
      this.resizeObserver = new ResizeObserver(() => this.resize());
      this.resizeObserver.observe(container);
    }

    this.resize();
  }

  get selection(): WaterfallPointSelection | null {
    return this.selectedSpectrumIndex === null
      ? null
      : this.selectionAt(this.selectedSpectrumIndex, this.slicePointIndex);
  }

  get hoverSelection(): WaterfallPointSelection | null {
    return this.hoverSpectrumIndex === null ? null : this.selectionAt(this.hoverSpectrumIndex, this.slicePointIndex);
  }

  get sliceIndex(): number {
    return this.slicePointIndex;
  }

  get viewport(): WaterfallRange | null {
    return this.viewportRange ? { ...this.viewportRange } : null;
  }

  updateOptions(options: Partial<SpectralWaterfallChartOptions>): void {
    this.options = { ...this.options, ...options };
    this.selectedSpectrumIndex = this.validSpectrumIndex(this.selectedSpectrumIndex) ?? this.initialSpectrumIndex();
    this.hoverSpectrumIndex = this.validSpectrumIndex(this.hoverSpectrumIndex);
    this.slicePointIndex = clamp(this.slicePointIndex, 0, this.maxPointIndex());
    this.viewportRange = normalizeViewportRange(this.viewportRange, fullXRange(this.options));
    this.render();
  }

  updateData(spectra: readonly WaterfallSpectrum[]): void {
    this.options = { ...this.options, spectra };
    this.selectedSpectrumIndex = this.validSpectrumIndex(this.selectedSpectrumIndex) ?? this.initialSpectrumIndex();
    this.hoverSpectrumIndex = this.validSpectrumIndex(this.hoverSpectrumIndex);
    this.slicePointIndex = clamp(this.slicePointIndex, 0, this.maxPointIndex());
    this.viewportRange = normalizeViewportRange(this.viewportRange, fullXRange(this.options));
    this.render();
  }

  resize(): void {
    const width = this.options.width ?? Math.max(this.container.clientWidth || 720, 320);
    const height = this.options.height ?? 560;
    const pixelRatio = typeof window === "undefined" ? 1 : window.devicePixelRatio || 1;

    this.width = width;
    this.height = height;
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
    this.canvas.width = Math.round(width * pixelRatio);
    this.canvas.height = Math.round(height * pixelRatio);
    this.context?.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    this.render();
  }

  destroy(): void {
    this.resizeObserver?.disconnect();
    this.canvas.removeEventListener("pointermove", this.handlePointerMove);
    this.canvas.removeEventListener("pointerdown", this.handlePointerDown);
    this.canvas.removeEventListener("pointerup", this.handlePointerUp);
    this.canvas.removeEventListener("pointerleave", this.handlePointerLeave);
    this.canvas.removeEventListener("click", this.handleClick);
    this.canvas.removeEventListener("wheel", this.handleWheel);
    this.canvas.removeEventListener("dblclick", this.handleDoubleClick);
    this.canvas.remove();
  }

  private readonly handlePointerMove = (event: PointerEvent): void => {
    const layout = chartLayout(this.width, this.height);
    const position = pointerPosition(this.canvas, event);

    if (this.draggingSlice) {
      this.updateSliceFromPosition(position.x, layout.waterfall);
      return;
    }

    if (this.panningViewport) {
      this.panViewport(position.x, layout.waterfall);
      return;
    }

    const point = this.pickPoint(position.x, position.y, layout.waterfall);
    this.hoverSpectrumIndex = point?.spectrumIndex ?? null;
    this.canvas.style.cursor = point ? "crosshair" : isInArea(position, layout.waterfall) ? "grab" : "default";
    this.render();
  };

  private readonly handlePointerDown = (event: PointerEvent): void => {
    const layout = chartLayout(this.width, this.height);
    const position = pointerPosition(this.canvas, event);
    if (!isInArea(position, layout.waterfall)) return;

    this.canvas.setPointerCapture?.(event.pointerId);
    if (this.isNearSliceHandle(position, layout.waterfall)) {
      this.draggingSlice = true;
      this.canvas.style.cursor = "ew-resize";
      this.updateSliceFromPosition(position.x, layout.waterfall);
      return;
    }

    this.panningViewport = {
      startX: position.x,
      startRange: this.currentXRange(),
      moved: false
    };
    this.canvas.style.cursor = "grabbing";
  };

  private readonly handlePointerUp = (event: PointerEvent): void => {
    if (this.draggingSlice || this.panningViewport?.moved) this.suppressClick = true;
    this.draggingSlice = false;
    this.panningViewport = null;
    this.canvas.releasePointerCapture?.(event.pointerId);
  };

  private readonly handlePointerLeave = (): void => {
    if (this.draggingSlice || this.panningViewport) return;
    this.hoverSpectrumIndex = null;
    this.canvas.style.cursor = "default";
    this.render();
  };

  private readonly handleClick = (event: MouseEvent): void => {
    if (this.suppressClick) {
      this.suppressClick = false;
      return;
    }

    const layout = chartLayout(this.width, this.height);
    const position = pointerPosition(this.canvas, event);
    const point = this.pickPoint(position.x, position.y, layout.waterfall);
    if (point) this.setSelectedSpectrum(point.spectrumIndex);
  };

  private readonly handleWheel = (event: WheelEvent): void => {
    const layout = chartLayout(this.width, this.height);
    const position = pointerPosition(this.canvas, event);
    if (!isInArea(position, layout.waterfall)) return;

    event.preventDefault();
    this.zoomViewport(position.x, event.deltaY, layout.waterfall);
  };

  private readonly handleDoubleClick = (): void => {
    if (!this.viewportRange) return;
    this.viewportRange = null;
    this.options.onViewportChange?.(null);
    this.render();
  };

  private pickPoint(x: number, y: number, area: WaterfallPlotArea): ProjectedWaterfallPoint | null {
    const projection = projectWaterfallSpectra(this.options, area, this.viewportRange);
    return findNearestWaterfallPoint(projection.points, x, y, 20);
  }

  private setSelectedSpectrum(spectrumIndex: number): void {
    const valid = this.validSpectrumIndex(spectrumIndex);
    if (valid === null || valid === this.selectedSpectrumIndex) return;
    this.selectedSpectrumIndex = valid;
    this.options.onSelectionChange?.(this.selection);
    this.render();
  }

  private updateSliceFromPosition(x: number, area: WaterfallPlotArea): void {
    const next = nearestPointIndex(this.options, xValueAtPosition(x, area, this.currentXRange()));
    if (next === this.slicePointIndex) return;
    this.slicePointIndex = next;
    this.options.onSliceChange?.(next);
    this.render();
  }

  private panViewport(x: number, area: WaterfallPlotArea): void {
    if (!this.panningViewport) return;
    const delta = x - this.panningViewport.startX;
    if (Math.abs(delta) < 3 && !this.panningViewport.moved) return;
    this.panningViewport.moved = true;

    const span = this.panningViewport.startRange.max - this.panningViewport.startRange.min;
    const offset = (delta / Math.max(area.width, 1)) * span;
    this.setViewportRange({
      min: this.panningViewport.startRange.min - offset,
      max: this.panningViewport.startRange.max - offset
    });
  }

  private zoomViewport(x: number, deltaY: number, area: WaterfallPlotArea): void {
    const full = fullXRange(this.options);
    if (!full) return;

    const current = this.currentXRange();
    const fullSpan = full.max - full.min || 1;
    const span = current.max - current.min || fullSpan;
    const factor = deltaY < 0 ? 0.8 : 1.25;
    const nextSpan = clamp(span * factor, fullSpan / 120, fullSpan);
    if (nextSpan >= fullSpan * 0.995) {
      this.setViewportRange(null);
      return;
    }

    const center = xValueAtPosition(x, area, current);
    const leftRatio = (center - current.min) / span;
    const next = {
      min: center - nextSpan * leftRatio,
      max: center + nextSpan * (1 - leftRatio)
    };
    this.setViewportRange(next);
  }

  private setViewportRange(rangeValue: WaterfallRange | null): void {
    const next = normalizeViewportRange(rangeValue, fullXRange(this.options));
    if (sameRange(next, this.viewportRange)) return;
    this.viewportRange = next;
    this.options.onViewportChange?.(next ? { ...next } : null);
    this.render();
  }

  private isNearSliceHandle(position: { x: number; y: number }, area: WaterfallPlotArea): boolean {
    const handle = this.sliceHandlePoint(area);
    if (!handle) return false;
    return (handle.x - position.x) ** 2 + (handle.y - position.y) ** 2 <= 26 ** 2;
  }

  private sliceHandlePoint(area: WaterfallPlotArea): ProjectedWaterfallPoint | null {
    const projection = projectWaterfallSpectra(this.options, area, this.viewportRange);
    const selected =
      this.selection && pointForSelection(projection.points, this.selection);
    if (selected) return selected;

    const slicePoints = projection.points.filter((point) => point.pointIndex === this.slicePointIndex);
    return slicePoints[Math.floor(slicePoints.length / 2)] ?? null;
  }

  private render(): void {
    if (!this.context) return;
    const layout = chartLayout(this.width, this.height);
    const selected = this.selection;
    const hover = this.hoverSelection;

    this.context.clearRect(0, 0, this.width, this.height);
    this.context.fillStyle = this.options.background ?? "#16243f";
    this.context.fillRect(0, 0, this.width, this.height);

    drawTitle(this.context, this.options.title ?? "Spectral waterfall", layout.waterfall.left, 20);
    drawWaterfall(this.context, this.options, layout.waterfall, selected, hover, this.slicePointIndex, this.viewportRange);
    drawSelectedSpectrum(this.context, this.options, layout.spectrum, selected, hover, this.viewportRange);
    drawSlice(this.context, this.options, layout.slice, this.slicePointIndex, selected, hover);
  }

  private initialSpectrumIndex(): number | null {
    return this.validSpectrumIndex(this.options.initialSelection?.spectrumIndex ?? 0);
  }

  private initialSliceIndex(): number {
    const maxIndex = this.maxPointIndex();
    return clamp(
      this.options.initialSliceIndex ??
        this.options.initialSelection?.pointIndex ??
        Math.floor(Math.max(maxIndex, 0) / 2),
      0,
      maxIndex
    );
  }

  private validSpectrumIndex(index: number | null | undefined): number | null {
    if (index === null || index === undefined) return null;
    return index >= 0 && index < this.options.spectra.length ? index : null;
  }

  private maxPointIndex(): number {
    return Math.max(0, ...this.options.spectra.map((spectrum) => spectrum.values.length - 1));
  }

  private currentXRange(): WaterfallRange {
    return this.viewportRange ?? fullXRange(this.options) ?? { min: 0, max: Math.max(this.maxPointIndex(), 1) };
  }

  private selectionAt(spectrumIndex: number, pointIndex: number): WaterfallPointSelection | null {
    const spectrum = this.options.spectra[spectrumIndex];
    if (!spectrum) return null;
    const value = spectrum.values[pointIndex];
    const x = xValue(this.options.x, pointIndex);
    if (!isFiniteNumber(value) || !isFiniteNumber(x)) return null;

    return {
      spectrumIndex,
      pointIndex,
      spectrumId: spectrum.id,
      x,
      value,
      ...(spectrum.label ? { label: spectrum.label } : {})
    };
  }
}

export function normalizeWaterfallSpectra(
  spectra: readonly WaterfallSpectrum[],
  x?: ArrayLike<number>
): NormalizedWaterfallPoint[] {
  const points: NormalizedWaterfallPoint[] = [];

  spectra.forEach((spectrum, spectrumIndex) => {
    for (let pointIndex = 0; pointIndex < spectrum.values.length; pointIndex += 1) {
      const value = spectrum.values[pointIndex];
      const xRaw = xValue(x, pointIndex);
      if (!isFiniteNumber(value) || !isFiniteNumber(xRaw)) continue;
      points.push({
        spectrumIndex,
        pointIndex,
        spectrumId: spectrum.id,
        xValue: xRaw,
        value
      });
    }
  });

  return points;
}

export function projectWaterfallSpectra(
  options: Pick<SpectralWaterfallChartOptions, "spectra" | "x">,
  area: WaterfallPlotArea,
  viewport?: WaterfallRange | null
): WaterfallProjection {
  const normalized = normalizeWaterfallSpectra(options.spectra, options.x);
  const fullRange = range(normalized.map((point) => point.xValue));
  const xRange = normalizeViewportRange(viewport ?? null, fullRange) ?? fullRange;
  const valueRange = paddedRange(normalized.map((point) => point.value), 0.22);
  if (!xRange || !valueRange) return { points: [], xRange, valueRange };

  const visible = normalized.filter((point) => point.xValue >= xRange.min && point.xValue <= xRange.max);
  const depthX = area.width * 0.11;
  const depthY = area.height * 0.16;
  const xPad = area.width * 0.04;
  const yPad = area.height * 0.12;
  const plotWidth = Math.max(1, area.width - depthX - xPad * 2);
  const plotHeight = Math.max(1, area.height - depthY - yPad * 2);
  const spectrumSpan = Math.max(options.spectra.length - 1, 1);
  const xSpan = xRange.max - xRange.min || 1;
  const valueSpan = valueRange.max - valueRange.min || 1;

  return {
    xRange,
    valueRange,
    points: visible.map((point) => {
      const depth = point.spectrumIndex / spectrumSpan;
      return {
        ...point,
        x: area.left + xPad + ((point.xValue - xRange.min) / xSpan) * plotWidth + depth * depthX,
        y: area.top + yPad + depthY + ((valueRange.max - point.value) / valueSpan) * plotHeight - depth * depthY
      };
    })
  };
}

export function findNearestWaterfallPoint(
  points: readonly ProjectedWaterfallPoint[],
  x: number,
  y: number,
  maxDistance = 18
): ProjectedWaterfallPoint | null {
  let nearest: ProjectedWaterfallPoint | null = null;
  let nearestDistance = maxDistance * maxDistance;

  for (const point of points) {
    const distance = (point.x - x) ** 2 + (point.y - y) ** 2;
    if (distance <= nearestDistance) {
      nearest = point;
      nearestDistance = distance;
    }
  }

  return nearest;
}

export function toWaterfallSelection(
  point: NormalizedWaterfallPoint,
  spectra: readonly WaterfallSpectrum[]
): WaterfallPointSelection | null {
  const spectrum = spectra[point.spectrumIndex];
  if (!spectrum) return null;
  return {
    spectrumIndex: point.spectrumIndex,
    pointIndex: point.pointIndex,
    spectrumId: spectrum.id,
    x: point.xValue,
    value: point.value,
    ...(spectrum.label ? { label: spectrum.label } : {})
  };
}

export function waterfallComparisonSeries(
  options: Pick<SpectralWaterfallChartOptions, "spectra" | "x" | "selectedColor" | "sliceColor">,
  selected: WaterfallPointSelection | null,
  hover: WaterfallPointSelection | null,
  viewport?: WaterfallRange | null
): WaterfallComparisonSeries[] {
  const series: WaterfallComparisonSeries[] = [];
  if (selected) {
    const spectrum = options.spectra[selected.spectrumIndex];
    if (spectrum) {
      series.push({
        id: spectrum.id,
        label: spectrum.label ?? spectrum.id,
        color: options.selectedColor ?? selectedLineColor,
        kind: "selected",
        points: pointsForSpectrum(spectrum, options.x, selected.spectrumIndex, viewport)
      });
    }
  }

  if (hover && hover.spectrumIndex !== selected?.spectrumIndex) {
    const spectrum = options.spectra[hover.spectrumIndex];
    if (spectrum) {
      series.push({
        id: spectrum.id,
        label: spectrum.label ?? spectrum.id,
        color: options.sliceColor ?? sliceLineColor,
        kind: "hover",
        points: pointsForSpectrum(spectrum, options.x, hover.spectrumIndex, viewport)
      });
    }
  }

  return series;
}

function drawWaterfall(
  context: CanvasRenderingContext2D,
  options: SpectralWaterfallChartOptions,
  area: WaterfallPlotArea,
  selected: WaterfallPointSelection | null,
  hover: WaterfallPointSelection | null,
  sliceIndex: number,
  viewport: WaterfallRange | null
): void {
  drawGrid(context, area, "Spectrum", "Amplitude");
  const projection = projectWaterfallSpectra(options, area, viewport);
  drawSliceBand(context, projection.points, sliceIndex);

  for (let spectrumIndex = options.spectra.length - 1; spectrumIndex >= 0; spectrumIndex -= 1) {
    const points = projection.points.filter((point) => point.spectrumIndex === spectrumIndex);
    if (points.length < 2) continue;
    const isSelected = selected?.spectrumIndex === spectrumIndex;
    const isHover = hover?.spectrumIndex === spectrumIndex && !isSelected;
    context.beginPath();
    points.forEach((point, index) => {
      if (index === 0) context.moveTo(point.x, point.y);
      else context.lineTo(point.x, point.y);
    });
    context.strokeStyle = isSelected
      ? (options.selectedColor ?? selectedLineColor)
      : isHover
        ? hoverLineColor
        : (options.lineColor ?? baseLineColor);
    context.lineWidth = isSelected ? 2.2 : isHover ? 1.9 : 0.9;
    context.stroke();
  }

  const selectedPoint = selected && pointForSelection(projection.points, selected);
  const hoverPoint = hover && pointForSelection(projection.points, hover);
  if (selectedPoint) drawMarker(context, selectedPoint.x, selectedPoint.y, options.selectedColor ?? selectedLineColor, 5);
  if (hoverPoint && !sameSelection(hover, selected)) drawMarker(context, hoverPoint.x, hoverPoint.y, "#ffffff", 4);
  drawSliceHandle(context, selectedPoint ?? middleSlicePoint(projection.points, sliceIndex), options.selectedColor ?? selectedLineColor);
  if (hoverPoint) drawCallout(context, hoverPoint.x + 14, hoverPoint.y - 48, "Hover/click chart");
  if (projection.xRange) drawXAxisLabels(context, area, projection.xRange);
  if (viewport) drawViewportStrip(context, area);
}

function drawSelectedSpectrum(
  context: CanvasRenderingContext2D,
  options: SpectralWaterfallChartOptions,
  area: WaterfallPlotArea,
  selected: WaterfallPointSelection | null,
  hover: WaterfallPointSelection | null,
  viewport: WaterfallRange | null
): void {
  const comparison = waterfallComparisonSeries(options, selected, hover, viewport);
  drawGrid(context, area, "Spectrum comparison", "Value");
  drawLegend(context, area, comparison);

  const allPoints = comparison.flatMap((series) => series.points);
  const xRange = viewport ?? range(allPoints.map((point) => point.xValue));
  const valueRange = paddedRange(allPoints.map((point) => point.value), 0.08);
  let selectedPoint: (WaterfallSeriesPoint & { x: number; y: number }) | undefined;
  let hoverPoint: (WaterfallSeriesPoint & { x: number; y: number }) | undefined;
  comparison.forEach((series) => {
    const projected = drawSmallSeries(context, area, series.points, {
      color: series.color,
      dash: series.kind === "hover" ? [2, 3] : undefined,
      xRange,
      valueRange
    });
    if (series.kind === "selected") selectedPoint = projected.find((point) => point.pointIndex === selected?.pointIndex);
    if (series.kind === "hover") hoverPoint = projected.find((point) => point.pointIndex === hover?.pointIndex);
  });

  if (selectedPoint) drawMarker(context, selectedPoint.x, selectedPoint.y, options.selectedColor ?? selectedLineColor, 4);
  if (hoverPoint) drawMarker(context, hoverPoint.x, hoverPoint.y, options.sliceColor ?? sliceLineColor, 4);
}

function drawSlice(
  context: CanvasRenderingContext2D,
  options: SpectralWaterfallChartOptions,
  area: WaterfallPlotArea,
  sliceIndex: number,
  selected: WaterfallPointSelection | null,
  hover: WaterfallPointSelection | null
): void {
  drawGrid(context, area, "Cross Section Slice", "Value");
  const points: WaterfallSeriesPoint[] = [];
  options.spectra.forEach((spectrum, spectrumIndex) => {
    const value = spectrum.values[sliceIndex];
    if (isFiniteNumber(value)) {
      points.push({ spectrumIndex, pointIndex: sliceIndex, xValue: spectrumIndex, value });
    }
  });

  const projected = drawSmallSeries(context, area, points, {
    color: options.sliceColor ?? sliceLineColor,
    dash: [2, 2]
  });
  const active = projected.find((point) => point.spectrumIndex === selected?.spectrumIndex);
  const hoverPoint = projected.find((point) => point.spectrumIndex === hover?.spectrumIndex);
  if (active) drawMarker(context, active.x, active.y, options.selectedColor ?? selectedLineColor, 4);
  if (hoverPoint && hover?.spectrumIndex !== selected?.spectrumIndex) {
    drawMarker(context, hoverPoint.x, hoverPoint.y, "#ffffff", 4);
  }
}

function drawSmallSeries(
  context: CanvasRenderingContext2D,
  area: WaterfallPlotArea,
  data: readonly WaterfallSeriesPoint[],
  style: {
    color: string;
    dash?: number[] | undefined;
    xRange?: WaterfallRange | null | undefined;
    valueRange?: WaterfallRange | null | undefined;
  }
): (WaterfallSeriesPoint & { x: number; y: number })[] {
  const xRange = style.xRange ?? range(data.map((point) => point.xValue));
  const valueRange = style.valueRange ?? paddedRange(data.map((point) => point.value), 0.08);
  if (!xRange || !valueRange) return [];
  const xSpan = xRange.max - xRange.min || 1;
  const valueSpan = valueRange.max - valueRange.min || 1;
  const projected = data.map((point) => ({
    ...point,
    x: area.left + ((point.xValue - xRange.min) / xSpan) * area.width,
    y: area.top + ((valueRange.max - point.value) / valueSpan) * area.height
  }));

  context.save();
  context.beginPath();
  projected.forEach((point, index) => {
    if (index === 0) context.moveTo(point.x, point.y);
    else context.lineTo(point.x, point.y);
  });
  context.setLineDash(style.dash ?? []);
  context.strokeStyle = style.color;
  context.lineWidth = 1.8;
  context.stroke();
  context.restore();
  return projected;
}

function pointsForSpectrum(
  spectrum: WaterfallSpectrum,
  x: ArrayLike<number> | undefined,
  spectrumIndex: number,
  viewport?: WaterfallRange | null
): WaterfallSeriesPoint[] {
  const points: WaterfallSeriesPoint[] = [];
  for (let pointIndex = 0; pointIndex < spectrum.values.length; pointIndex += 1) {
    const xRaw = xValue(x, pointIndex);
    const value = spectrum.values[pointIndex];
    if (!isFiniteNumber(xRaw) || !isFiniteNumber(value)) continue;
    if (viewport && (xRaw < viewport.min || xRaw > viewport.max)) continue;
    points.push({ pointIndex, spectrumIndex, xValue: xRaw, value });
  }
  return points;
}

function drawGrid(context: CanvasRenderingContext2D, area: WaterfallPlotArea, title: string, yLabel: string): void {
  context.save();
  context.strokeStyle = "rgba(125, 211, 252, 0.13)";
  context.lineWidth = 1;
  for (let index = 0; index <= 5; index += 1) {
    const x = area.left + (area.width / 5) * index;
    const y = area.top + (area.height / 5) * index;
    context.beginPath();
    context.moveTo(x, area.top);
    context.lineTo(x, area.top + area.height);
    context.moveTo(area.left, y);
    context.lineTo(area.left + area.width, y);
    context.stroke();
  }
  context.strokeStyle = "rgba(148, 163, 184, 0.45)";
  context.strokeRect(area.left, area.top, area.width, area.height);
  context.fillStyle = "#a8b6d8";
  context.font = "12px system-ui, sans-serif";
  context.fillText(title, area.left, Math.max(12, area.top - 8));
  context.fillText(yLabel, area.left + area.width - 48, Math.max(12, area.top - 8));
  context.restore();
}

function drawTitle(context: CanvasRenderingContext2D, title: string, x: number, y: number): void {
  context.fillStyle = "#f8fafc";
  context.font = "16px system-ui, sans-serif";
  context.fillText(title, x, y);
}

function drawMarker(context: CanvasRenderingContext2D, x: number, y: number, color: string, radius: number): void {
  context.save();
  context.beginPath();
  context.arc(x, y, radius, 0, Math.PI * 2);
  context.fillStyle = color;
  context.fill();
  context.strokeStyle = "#ffffff";
  context.lineWidth = 1.2;
  context.stroke();
  context.restore();
}

function drawSliceBand(
  context: CanvasRenderingContext2D,
  points: readonly ProjectedWaterfallPoint[],
  sliceIndex: number
): void {
  const slicePoints = points
    .filter((point) => point.pointIndex === sliceIndex)
    .sort((a, b) => a.spectrumIndex - b.spectrumIndex);
  if (slicePoints.length < 2) return;

  context.save();
  context.beginPath();
  slicePoints.forEach((point, index) => {
    if (index === 0) context.moveTo(point.x, point.y);
    else context.lineTo(point.x, point.y);
  });
  context.strokeStyle = "rgba(255, 122, 26, 0.18)";
  context.lineWidth = 18;
  context.stroke();
  context.strokeStyle = "rgba(255, 122, 26, 0.85)";
  context.lineWidth = 1.5;
  context.stroke();
  context.restore();
}

function drawSliceHandle(
  context: CanvasRenderingContext2D,
  point: ProjectedWaterfallPoint | null,
  color: string
): void {
  if (!point) return;
  drawMarker(context, point.x, point.y, color, 5);
  drawCallout(context, point.x - 47, point.y + 28, "Drag me!");
}

function drawCallout(context: CanvasRenderingContext2D, x: number, y: number, label: string): void {
  const width = Math.max(76, label.length * 7 + 18);
  context.save();
  context.fillStyle = "rgba(38, 90, 128, 0.92)";
  context.strokeStyle = "#74d6ff";
  context.lineWidth = 2;
  roundedRect(context, x, y, width, 30, 9);
  context.fill();
  context.stroke();
  context.fillStyle = "#ffffff";
  context.font = "14px system-ui, sans-serif";
  context.fillText(label, x + 10, y + 20);
  context.restore();
}

function drawLegend(
  context: CanvasRenderingContext2D,
  area: WaterfallPlotArea,
  series: readonly WaterfallComparisonSeries[]
): void {
  if (series.length === 0) return;
  context.save();
  const width = Math.min(area.width - 12, 96 * series.length + 12);
  const x = area.left + 10;
  const y = area.top + 10;
  context.fillStyle = "rgba(15, 23, 42, 0.82)";
  roundedRect(context, x, y, width, 34, 4);
  context.fill();
  series.forEach((item, index) => {
    const itemX = x + 12 + index * 96;
    context.fillStyle = item.color;
    context.fillRect(itemX, y + 12, 10, 10);
    context.fillStyle = "#ffffff";
    context.font = "12px system-ui, sans-serif";
    context.fillText(item.label, itemX + 18, y + 22);
  });
  context.restore();
}

function drawXAxisLabels(context: CanvasRenderingContext2D, area: WaterfallPlotArea, xRange: WaterfallRange): void {
  context.save();
  context.fillStyle = "#9fb1d1";
  context.font = "12px system-ui, sans-serif";
  for (let index = 0; index < 3; index += 1) {
    const ratio = index / 2;
    const value = xRange.min + (xRange.max - xRange.min) * ratio;
    const x = area.left + area.width * ratio;
    context.fillText(numberLabel(value), x - 10, area.top + area.height + 20);
  }
  context.restore();
}

function drawViewportStrip(context: CanvasRenderingContext2D, area: WaterfallPlotArea): void {
  context.save();
  context.fillStyle = "rgba(255, 255, 255, 0.12)";
  context.fillRect(area.left, area.top + area.height + 6, area.width, 4);
  context.restore();
}

function chartLayout(width: number, height: number): ChartLayout {
  const safeWidth = Math.max(width, 320);
  const safeHeight = Math.max(height, 320);
  const left = 56;
  const right = 24;
  const gap = 18;
  const topHeight = Math.max(190, Math.floor(safeHeight * 0.58));
  const bottomTop = topHeight + 34;
  const bottomHeight = Math.max(110, safeHeight - bottomTop - 24);
  const bottomWidth = Math.max(100, (safeWidth - left - right - gap) / 2);

  return {
    waterfall: {
      left,
      top: 34,
      width: safeWidth - left - right,
      height: topHeight - 48
    },
    spectrum: {
      left,
      top: bottomTop,
      width: bottomWidth,
      height: bottomHeight
    },
    slice: {
      left: left + bottomWidth + gap,
      top: bottomTop,
      width: bottomWidth,
      height: bottomHeight
    }
  };
}

function middleSlicePoint(
  points: readonly ProjectedWaterfallPoint[],
  sliceIndex: number
): ProjectedWaterfallPoint | null {
  const slicePoints = points.filter((point) => point.pointIndex === sliceIndex);
  return slicePoints[Math.floor(slicePoints.length / 2)] ?? null;
}

function pointForSelection(
  points: readonly ProjectedWaterfallPoint[],
  selection: WaterfallPointSelection
): ProjectedWaterfallPoint | null {
  return (
    points.find(
      (point) => point.spectrumIndex === selection.spectrumIndex && point.pointIndex === selection.pointIndex
    ) ?? null
  );
}

function nearestPointIndex(options: Pick<SpectralWaterfallChartOptions, "spectra" | "x">, target: number): number {
  const maxIndex = Math.max(0, ...options.spectra.map((spectrum) => spectrum.values.length - 1));
  let nearest = 0;
  let nearestDistance = Infinity;
  for (let index = 0; index <= maxIndex; index += 1) {
    const value = xValue(options.x, index);
    if (!Number.isFinite(value)) continue;
    const distance = Math.abs(value - target);
    if (distance < nearestDistance) {
      nearest = index;
      nearestDistance = distance;
    }
  }
  return nearest;
}

function fullXRange(options: Pick<SpectralWaterfallChartOptions, "spectra" | "x">): WaterfallRange | null {
  return range(normalizeWaterfallSpectra(options.spectra, options.x).map((point) => point.xValue));
}

function range(values: readonly number[]): WaterfallRange | null {
  let min = Infinity;
  let max = -Infinity;
  for (const value of values) {
    if (!Number.isFinite(value)) continue;
    min = Math.min(min, value);
    max = Math.max(max, value);
  }
  if (min === Infinity) return null;
  if (min === max) return { min: min - 1, max: max + 1 };
  return { min, max };
}

function paddedRange(values: readonly number[], padding: number): WaterfallRange | null {
  const base = range(values);
  if (!base) return null;
  const span = base.max - base.min || 1;
  return { min: base.min - span * padding, max: base.max + span * padding };
}

function normalizeViewportRange(rangeValue: WaterfallRange | null, full: WaterfallRange | null): WaterfallRange | null {
  if (!rangeValue || !full) return null;
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

function xValueAtPosition(x: number, area: WaterfallPlotArea, rangeValue: WaterfallRange): number {
  const ratio = clamp((x - area.left) / Math.max(area.width, 1), 0, 1);
  return rangeValue.min + (rangeValue.max - rangeValue.min) * ratio;
}

function pointerPosition(canvas: HTMLCanvasElement, event: MouseEvent): { x: number; y: number } {
  const rect = canvas.getBoundingClientRect();
  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top
  };
}

function isInArea(point: { x: number; y: number }, area: WaterfallPlotArea): boolean {
  return point.x >= area.left && point.x <= area.left + area.width && point.y >= area.top && point.y <= area.top + area.height;
}

function xValue(x: ArrayLike<number> | undefined, index: number): number {
  return x?.[index] ?? index;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function sameSelection(a: WaterfallPointSelection | null, b: WaterfallPointSelection | null): boolean {
  return a?.spectrumIndex === b?.spectrumIndex && a?.pointIndex === b?.pointIndex;
}

function sameRange(a: WaterfallRange | null, b: WaterfallRange | null): boolean {
  if (!a || !b) return a === b;
  return Math.abs(a.min - b.min) < 1e-9 && Math.abs(a.max - b.max) < 1e-9;
}

function numberLabel(value: number): string {
  return Math.abs(value) >= 100 ? value.toFixed(1) : value.toFixed(0);
}

function roundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
): void {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.lineTo(x + width - radius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + radius);
  context.lineTo(x + width, y + height - radius);
  context.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  context.lineTo(x + radius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - radius);
  context.lineTo(x, y + radius);
  context.quadraticCurveTo(x, y, x + radius, y);
}

function clamp(value: number, min: number, max: number): number {
  if (max < min) return min;
  return Math.max(min, Math.min(max, value));
}
