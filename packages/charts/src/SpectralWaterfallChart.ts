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
  renderer?: WaterfallRendererMode;
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

export type WaterfallRendererMode = "auto" | "canvas" | "webgl2";

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

export interface PreparedWaterfallData {
  spectra: readonly WaterfallSpectrum[];
  x: Float32Array;
  values: Float32Array[];
  labels: Array<string | undefined>;
  ids: string[];
  spectrumCount: number;
  maxPointCount: number;
  finitePointCount: number;
  xRange: WaterfallRange | null;
  valueRange: WaterfallRange | null;
  drawRanges: WaterfallDrawRange[];
  xAscending: boolean;
}

export interface WaterfallDrawRange {
  spectrumIndex: number;
  pointIndex: number;
  count: number;
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

interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

const baseLineColor = "#55c7f7";
const hoverLineColor = "#f8fafc";
const waterfallSelectedLineColor = "#f8fafc";
const selectedLineColor = "#ff7a1a";
const sliceLineColor = "#78d7ff";
const dragCalloutLabel = "Drag me!";
const webglVertexThreshold = 100_000;

// ponytail: WebGL2 only draws the heavy waterfall lines; Canvas keeps the cheap UI overlays.
export class SpectralWaterfallChart {
  private readonly canvas: HTMLCanvasElement;
  private readonly context: CanvasRenderingContext2D | null;
  private readonly resizeObserver: ResizeObserver | undefined;
  private options: SpectralWaterfallChartOptions;
  private data: PreparedWaterfallData;
  private webglRenderer: WebGL2WaterfallRenderer | null = null;
  private selectedSpectrumIndex: number | null;
  private hoverSpectrumIndex: number | null = null;
  private slicePointIndex: number;
  private viewportRange: WaterfallRange | null;
  private draggingSlice = false;
  private draggingSliceOffsetX = 0;
  private panningViewport: ViewportPan | null = null;
  private suppressClick = false;
  private width = 0;
  private height = 0;

  constructor(
    private readonly container: HTMLElement,
    options: SpectralWaterfallChartOptions
  ) {
    this.options = options;
    this.data = prepareWaterfallData(options.spectra, options.x);
    this.selectedSpectrumIndex = this.initialSpectrumIndex();
    this.slicePointIndex = this.initialSliceIndex();
    this.viewportRange = normalizeViewportRange(options.initialXRange ?? null, this.data.xRange);
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
    const dataChanged = options.spectra !== undefined || options.x !== undefined;
    const rendererChanged = options.renderer !== undefined && options.renderer !== this.options.renderer;
    this.options = { ...this.options, ...options };
    if (dataChanged) this.resetData();
    if (rendererChanged) this.resetWebGLRenderer();
    this.selectedSpectrumIndex = this.validSpectrumIndex(this.selectedSpectrumIndex) ?? this.initialSpectrumIndex();
    this.hoverSpectrumIndex = this.validSpectrumIndex(this.hoverSpectrumIndex);
    this.slicePointIndex = clamp(this.slicePointIndex, 0, this.maxPointIndex());
    this.viewportRange = normalizeViewportRange(this.viewportRange, this.data.xRange);
    this.render();
  }

  updateData(spectra: readonly WaterfallSpectrum[]): void {
    this.options = { ...this.options, spectra };
    this.resetData();
    this.selectedSpectrumIndex = this.validSpectrumIndex(this.selectedSpectrumIndex) ?? this.initialSpectrumIndex();
    this.hoverSpectrumIndex = this.validSpectrumIndex(this.hoverSpectrumIndex);
    this.slicePointIndex = clamp(this.slicePointIndex, 0, this.maxPointIndex());
    this.viewportRange = normalizeViewportRange(this.viewportRange, this.data.xRange);
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
    this.resetWebGLRenderer();
    this.canvas.remove();
  }

  private readonly handlePointerMove = (event: PointerEvent): void => {
    const layout = chartLayout(this.width, this.height);
    const position = pointerPosition(this.canvas, event);

    if (this.draggingSlice) {
      this.updateSliceFromPosition(position.x - this.draggingSliceOffsetX, layout.waterfall);
      return;
    }

    if (this.panningViewport) {
      this.panViewport(position.x, layout.waterfall);
      return;
    }

    const point = this.pickPoint(position.x, position.y, layout.waterfall);
    this.hoverSpectrumIndex = point?.spectrumIndex ?? null;
    this.canvas.style.cursor =
      this.sliceHandleDragOffset(position, layout.waterfall) !== null
        ? "ew-resize"
        : point
          ? "crosshair"
          : isInArea(position, layout.waterfall)
            ? "grab"
            : "default";
    this.render();
  };

  private readonly handlePointerDown = (event: PointerEvent): void => {
    const layout = chartLayout(this.width, this.height);
    const position = pointerPosition(this.canvas, event);
    const sliceOffset = this.sliceHandleDragOffset(position, layout.waterfall);
    if (sliceOffset === null && !isInArea(position, layout.waterfall)) return;

    this.canvas.setPointerCapture?.(event.pointerId);
    if (sliceOffset !== null) {
      this.draggingSlice = true;
      this.draggingSliceOffsetX = sliceOffset;
      this.canvas.style.cursor = "ew-resize";
      this.updateSliceFromPosition(position.x - sliceOffset, layout.waterfall);
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
    this.draggingSliceOffsetX = 0;
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
    return findNearestWaterfallDataPoint(this.data, area, this.viewportRange, x, y, 20);
  }

  private setSelectedSpectrum(spectrumIndex: number): void {
    const valid = this.validSpectrumIndex(spectrumIndex);
    if (valid === null || valid === this.selectedSpectrumIndex) return;
    this.selectedSpectrumIndex = valid;
    this.options.onSelectionChange?.(this.selection);
    this.render();
  }

  private updateSliceFromPosition(x: number, area: WaterfallPlotArea): void {
    const next = nearestPreparedPointIndex(this.data, xValueAtPosition(x, area, this.currentXRange()));
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
    const full = this.data.xRange;
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
    const next = normalizeViewportRange(rangeValue, this.data.xRange);
    if (sameRange(next, this.viewportRange)) return;
    this.viewportRange = next;
    this.options.onViewportChange?.(next ? { ...next } : null);
    this.render();
  }

  private sliceHandleDragOffset(position: { x: number; y: number }, area: WaterfallPlotArea): number | null {
    const handle = this.sliceHandlePoint(area);
    if (!handle) return null;
    const nearMarker = (handle.x - position.x) ** 2 + (handle.y - position.y) ** 2 <= 26 ** 2;
    const nearCallout = isInRect(position, growRect(sliceHandleCalloutRect(handle), 6));
    return nearMarker || nearCallout ? position.x - handle.x : null;
  }

  private sliceHandlePoint(area: WaterfallPlotArea): ProjectedWaterfallPoint | null {
    const projection = projectWaterfallData(this.data, area, this.viewportRange);
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
    this.drawWaterfall(layout.waterfall, selected, hover);
    drawSelectedSpectrum(this.context, this.data, this.options, layout.spectrum, selected, hover, this.viewportRange);
    drawSlice(this.context, this.data, this.options, layout.slice, this.slicePointIndex, selected, hover);
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
    return Math.max(0, this.data.maxPointCount - 1);
  }

  private currentXRange(): WaterfallRange {
    return this.viewportRange ?? this.data.xRange ?? { min: 0, max: Math.max(this.maxPointIndex(), 1) };
  }

  private selectionAt(spectrumIndex: number, pointIndex: number): WaterfallPointSelection | null {
    const values = this.data.values[spectrumIndex];
    if (!values) return null;
    const value = values[pointIndex];
    const x = this.data.x[pointIndex];
    if (!isFiniteNumber(value) || !isFiniteNumber(x)) return null;

    return {
      spectrumIndex,
      pointIndex,
      spectrumId: this.data.ids[spectrumIndex] ?? "",
      x,
      value,
      ...(this.data.labels[spectrumIndex] ? { label: this.data.labels[spectrumIndex] } : {})
    };
  }

  private resetData(): void {
    this.data = prepareWaterfallData(this.options.spectra, this.options.x);
    this.webglRenderer?.setData(this.data);
  }

  private drawWaterfall(
    area: WaterfallPlotArea,
    selected: WaterfallPointSelection | null,
    hover: WaterfallPointSelection | null
  ): void {
    if (!this.context) return;
    const renderer = this.waterfallRenderer();
    const projection = renderer === "canvas" ? projectWaterfallData(this.data, area, this.viewportRange) : waterfallProjectionMeta(this.data, this.viewportRange);
    drawWaterfallGrid(this.context, area, projection);

    if (renderer === "webgl2" && this.drawWebGLWaterfall(area)) {
      drawWaterfallInteractionOverlay(this.context, this.data, this.options, area, selected, hover, this.slicePointIndex, this.viewportRange, true);
      return;
    }

    drawWaterfallLines(this.context, this.data, this.options, projection.points, selected, hover, true);
    drawWaterfallInteractionOverlay(this.context, this.data, this.options, area, selected, hover, this.slicePointIndex, this.viewportRange, false);
  }

  private waterfallRenderer(): "canvas" | "webgl2" {
    const requested = this.options.renderer ?? "auto";
    if (requested === "canvas" || (requested === "auto" && this.data.finitePointCount < webglVertexThreshold)) {
      return "canvas";
    }
    return selectWaterfallRenderer(requested, this.data.finitePointCount, this.canUseWebGL2());
  }

  private canUseWebGL2(): boolean {
    if (typeof document === "undefined") return false;
    if (this.webglRenderer?.ready) return true;
    if ((this.options.renderer ?? "auto") === "canvas") return false;
    this.webglRenderer = new WebGL2WaterfallRenderer();
    if (!this.webglRenderer.ready) {
      this.resetWebGLRenderer();
      return false;
    }
    this.webglRenderer.setData(this.data);
    return true;
  }

  private drawWebGLWaterfall(area: WaterfallPlotArea): boolean {
    if (!this.webglRenderer?.ready) return false;
    const source = this.webglRenderer.render({
      area,
      width: this.width,
      height: this.height,
      pixelRatio: typeof window === "undefined" ? 1 : window.devicePixelRatio || 1,
      viewport: this.viewportRange,
      data: this.data,
      color: this.options.lineColor ?? baseLineColor
    });
    if (!source) return false;
    this.context?.drawImage(source, 0, 0, this.width, this.height);
    return true;
  }

  private resetWebGLRenderer(): void {
    this.webglRenderer?.destroy();
    this.webglRenderer = null;
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

export function prepareWaterfallData(
  spectra: readonly WaterfallSpectrum[],
  x?: ArrayLike<number>
): PreparedWaterfallData {
  const maxPointCount = Math.max(0, ...spectra.map((spectrum) => spectrum.values.length));
  const xValues = new Float32Array(maxPointCount);
  let xAscending = true;
  let lastFiniteX = -Infinity;

  for (let pointIndex = 0; pointIndex < maxPointCount; pointIndex += 1) {
    const value = xValue(x, pointIndex);
    xValues[pointIndex] = isFiniteNumber(value) ? value : Number.NaN;
    if (!isFiniteNumber(value)) xAscending = false;
    else {
      if (value < lastFiniteX) xAscending = false;
      lastFiniteX = value;
    }
  }

  const values = spectra.map((spectrum) => {
    const output = new Float32Array(spectrum.values.length);
    for (let pointIndex = 0; pointIndex < spectrum.values.length; pointIndex += 1) {
      const value = spectrum.values[pointIndex];
      output[pointIndex] = isFiniteNumber(value) ? value : Number.NaN;
    }
    return output;
  });

  let minX = Infinity;
  let maxX = -Infinity;
  let minValue = Infinity;
  let maxValue = -Infinity;
  let finitePointCount = 0;

  values.forEach((spectrumValues) => {
    for (let pointIndex = 0; pointIndex < spectrumValues.length; pointIndex += 1) {
      const xRaw = xValues[pointIndex];
      const value = spectrumValues[pointIndex];
      if (!isFiniteNumber(xRaw) || !isFiniteNumber(value)) continue;
      minX = Math.min(minX, xRaw);
      maxX = Math.max(maxX, xRaw);
      minValue = Math.min(minValue, value);
      maxValue = Math.max(maxValue, value);
      finitePointCount += 1;
    }
  });

  return {
    spectra,
    x: xValues,
    values,
    labels: spectra.map((spectrum) => spectrum.label),
    ids: spectra.map((spectrum) => spectrum.id),
    spectrumCount: spectra.length,
    maxPointCount,
    finitePointCount,
    xRange: finitePointCount === 0 ? null : rangeFromBounds(minX, maxX),
    valueRange: finitePointCount === 0 ? null : paddedRangeFromBounds(minValue, maxValue, 0.22),
    drawRanges: waterfallDrawRanges(values, xValues),
    xAscending
  };
}

export function projectWaterfallSpectra(
  options: Pick<SpectralWaterfallChartOptions, "spectra" | "x">,
  area: WaterfallPlotArea,
  viewport?: WaterfallRange | null
): WaterfallProjection {
  return projectWaterfallData(prepareWaterfallData(options.spectra, options.x), area, viewport);
}

export function projectWaterfallData(
  data: PreparedWaterfallData,
  area: WaterfallPlotArea,
  viewport?: WaterfallRange | null
): WaterfallProjection {
  const xRange = normalizeViewportRange(viewport ?? null, data.xRange) ?? data.xRange;
  const valueRange = data.valueRange;
  if (!xRange || !valueRange) return { points: [], xRange, valueRange };

  const points: ProjectedWaterfallPoint[] = [];
  data.values.forEach((values, spectrumIndex) => {
    for (let pointIndex = 0; pointIndex < values.length; pointIndex += 1) {
      const xRaw = data.x[pointIndex];
      if (!isFiniteNumber(xRaw) || xRaw < xRange.min || xRaw > xRange.max) continue;
      const point = projectPreparedPoint(data, spectrumIndex, pointIndex, area, xRange, valueRange);
      if (point) points.push(point);
    }
  });

  return {
    xRange,
    valueRange,
    points
  };
}

export function selectWaterfallRenderer(
  requested: WaterfallRendererMode,
  finitePointCount: number,
  hasWebGL2: boolean
): "canvas" | "webgl2" {
  if (requested === "canvas") return "canvas";
  if (requested === "webgl2") return hasWebGL2 ? "webgl2" : "canvas";
  return hasWebGL2 && finitePointCount >= webglVertexThreshold ? "webgl2" : "canvas";
}

function waterfallProjectionMeta(data: PreparedWaterfallData, viewport?: WaterfallRange | null): WaterfallProjection {
  const xRange = normalizeViewportRange(viewport ?? null, data.xRange) ?? data.xRange;
  return { points: [], xRange, valueRange: data.valueRange };
}

function projectPreparedPoint(
  data: PreparedWaterfallData,
  spectrumIndex: number,
  pointIndex: number,
  area: WaterfallPlotArea,
  xRange: WaterfallRange,
  valueRange: WaterfallRange
): ProjectedWaterfallPoint | null {
  const values = data.values[spectrumIndex];
  const value = values?.[pointIndex];
  const xRaw = data.x[pointIndex];
  if (!isFiniteNumber(value) || !isFiniteNumber(xRaw)) return null;

  const geometry = waterfallGeometry(area);
  const spectrumSpan = Math.max(data.spectrumCount - 1, 1);
  const depth = spectrumIndex / spectrumSpan;
  const xSpan = xRange.max - xRange.min || 1;
  const valueSpan = valueRange.max - valueRange.min || 1;

  return {
    spectrumIndex,
    pointIndex,
    spectrumId: data.ids[spectrumIndex] ?? "",
    xValue: xRaw,
    value,
    x: area.left + geometry.xPad + ((xRaw - xRange.min) / xSpan) * geometry.plotWidth + depth * geometry.depthX,
    y:
      area.top +
      geometry.yPad +
      geometry.depthY +
      ((valueRange.max - value) / valueSpan) * geometry.plotHeight -
      depth * geometry.depthY
  };
}

function projectSpectrumPoints(
  data: PreparedWaterfallData,
  spectrumIndex: number,
  area: WaterfallPlotArea,
  viewport?: WaterfallRange | null
): ProjectedWaterfallPoint[] {
  const xRange = normalizeViewportRange(viewport ?? null, data.xRange) ?? data.xRange;
  const valueRange = data.valueRange;
  const values = data.values[spectrumIndex];
  if (!xRange || !valueRange || !values) return [];

  const points: ProjectedWaterfallPoint[] = [];
  for (let pointIndex = 0; pointIndex < values.length; pointIndex += 1) {
    const xRaw = data.x[pointIndex];
    if (!isFiniteNumber(xRaw) || xRaw < xRange.min || xRaw > xRange.max) continue;
    const point = projectPreparedPoint(data, spectrumIndex, pointIndex, area, xRange, valueRange);
    if (point) points.push(point);
  }
  return points;
}

function projectSlicePoints(
  data: PreparedWaterfallData,
  sliceIndex: number,
  area: WaterfallPlotArea,
  viewport?: WaterfallRange | null
): ProjectedWaterfallPoint[] {
  const xRange = normalizeViewportRange(viewport ?? null, data.xRange) ?? data.xRange;
  const valueRange = data.valueRange;
  if (!xRange || !valueRange) return [];

  const points: ProjectedWaterfallPoint[] = [];
  for (let spectrumIndex = 0; spectrumIndex < data.spectrumCount; spectrumIndex += 1) {
    const point = projectPreparedPoint(data, spectrumIndex, sliceIndex, area, xRange, valueRange);
    if (point) points.push(point);
  }
  return points;
}

function findNearestWaterfallDataPoint(
  data: PreparedWaterfallData,
  area: WaterfallPlotArea,
  viewport: WaterfallRange | null,
  x: number,
  y: number,
  maxDistance = 18
): ProjectedWaterfallPoint | null {
  const xRange = normalizeViewportRange(viewport ?? null, data.xRange) ?? data.xRange;
  const valueRange = data.valueRange;
  if (!xRange || !valueRange) return null;

  const geometry = waterfallGeometry(area);
  const spectrumSpan = Math.max(data.spectrumCount - 1, 1);
  let nearest: ProjectedWaterfallPoint | null = null;
  let nearestDistance = maxDistance * maxDistance;

  for (let spectrumIndex = 0; spectrumIndex < data.spectrumCount; spectrumIndex += 1) {
    const depth = spectrumIndex / spectrumSpan;
    const ratio = clamp((x - area.left - geometry.xPad - depth * geometry.depthX) / Math.max(geometry.plotWidth, 1), 0, 1);
    const pointIndex = nearestPreparedPointIndex(data, xRange.min + (xRange.max - xRange.min) * ratio);
    for (let offset = -2; offset <= 2; offset += 1) {
      const point = projectPreparedPoint(data, spectrumIndex, pointIndex + offset, area, xRange, valueRange);
      if (!point) continue;
      const distance = (point.x - x) ** 2 + (point.y - y) ** 2;
      if (distance <= nearestDistance) {
        nearest = point;
        nearestDistance = distance;
      }
    }
  }

  return nearest;
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

function waterfallComparisonSeriesFromData(
  data: PreparedWaterfallData,
  options: Pick<SpectralWaterfallChartOptions, "selectedColor" | "sliceColor">,
  selected: WaterfallPointSelection | null,
  hover: WaterfallPointSelection | null,
  viewport: WaterfallRange | null,
  maxPoints: number
): WaterfallComparisonSeries[] {
  const series: WaterfallComparisonSeries[] = [];
  if (selected) {
    series.push({
      id: data.ids[selected.spectrumIndex] ?? "",
      label: data.labels[selected.spectrumIndex] ?? data.ids[selected.spectrumIndex] ?? "",
      color: options.selectedColor ?? selectedLineColor,
      kind: "selected",
      points: decimateSeriesPoints(pointsForPreparedSpectrum(data, selected.spectrumIndex, viewport), maxPoints)
    });
  }

  if (hover && hover.spectrumIndex !== selected?.spectrumIndex) {
    series.push({
      id: data.ids[hover.spectrumIndex] ?? "",
      label: data.labels[hover.spectrumIndex] ?? data.ids[hover.spectrumIndex] ?? "",
      color: options.sliceColor ?? sliceLineColor,
      kind: "hover",
      points: decimateSeriesPoints(pointsForPreparedSpectrum(data, hover.spectrumIndex, viewport), maxPoints)
    });
  }

  return series.filter((item) => item.points.length > 0);
}

function pointsForPreparedSpectrum(
  data: PreparedWaterfallData,
  spectrumIndex: number,
  viewport?: WaterfallRange | null
): WaterfallSeriesPoint[] {
  const values = data.values[spectrumIndex];
  if (!values) return [];
  const points: WaterfallSeriesPoint[] = [];
  for (let pointIndex = 0; pointIndex < values.length; pointIndex += 1) {
    const xRaw = data.x[pointIndex];
    const value = values[pointIndex];
    if (!isFiniteNumber(xRaw) || !isFiniteNumber(value)) continue;
    if (viewport && (xRaw < viewport.min || xRaw > viewport.max)) continue;
    points.push({ pointIndex, spectrumIndex, xValue: xRaw, value });
  }
  return points;
}

function drawWaterfallLines(
  context: CanvasRenderingContext2D,
  data: PreparedWaterfallData,
  options: SpectralWaterfallChartOptions,
  points: readonly ProjectedWaterfallPoint[],
  selected: WaterfallPointSelection | null,
  hover: WaterfallPointSelection | null,
  drawBaseLines: boolean
): void {
  for (let spectrumIndex = data.spectrumCount - 1; spectrumIndex >= 0; spectrumIndex -= 1) {
    const isSelected = selected?.spectrumIndex === spectrumIndex;
    const isHover = hover?.spectrumIndex === spectrumIndex && !isSelected;
    if (!drawBaseLines && !isSelected && !isHover) continue;
    const seriesPoints = points.filter((point) => point.spectrumIndex === spectrumIndex);
    if (seriesPoints.length < 2) continue;
    context.beginPath();
    seriesPoints.forEach((point, index) => {
      if (index === 0) context.moveTo(point.x, point.y);
      else context.lineTo(point.x, point.y);
    });
    context.strokeStyle = isSelected
      ? (options.selectedColor ?? waterfallSelectedLineColor)
      : isHover
        ? hoverLineColor
        : (options.lineColor ?? baseLineColor);
    context.lineWidth = isSelected ? 2.4 : isHover ? 1.9 : 0.85;
    context.stroke();
  }
}

function drawWaterfallInteractionOverlay(
  context: CanvasRenderingContext2D,
  data: PreparedWaterfallData,
  options: SpectralWaterfallChartOptions,
  area: WaterfallPlotArea,
  selected: WaterfallPointSelection | null,
  hover: WaterfallPointSelection | null,
  sliceIndex: number,
  viewport: WaterfallRange | null,
  drawHighlightLines: boolean
): void {
  const xRange = normalizeViewportRange(viewport ?? null, data.xRange) ?? data.xRange;
  const valueRange = data.valueRange;
  if (!xRange || !valueRange) return;

  if (drawHighlightLines) {
    const selectedLine = selected ? projectSpectrumPoints(data, selected.spectrumIndex, area, viewport) : [];
    const hoverLine = hover && !sameSelection(hover, selected) ? projectSpectrumPoints(data, hover.spectrumIndex, area, viewport) : [];
    drawWaterfallLines(context, data, options, [...selectedLine, ...hoverLine], selected, hover, false);
  }

  const selectedPoint = selected && projectPreparedPoint(data, selected.spectrumIndex, selected.pointIndex, area, xRange, valueRange);
  const hoverPoint = hover && projectPreparedPoint(data, hover.spectrumIndex, hover.pointIndex, area, xRange, valueRange);
  const slicePoints = projectSlicePoints(data, sliceIndex, area, viewport);
  drawSliceBand(context, slicePoints, sliceIndex);
  if (selectedPoint) drawMarker(context, selectedPoint.x, selectedPoint.y, options.selectedColor ?? selectedLineColor, 5);
  if (hoverPoint && !sameSelection(hover, selected)) drawMarker(context, hoverPoint.x, hoverPoint.y, "#ffffff", 4);
  drawSliceHandle(context, selectedPoint ?? middleSlicePoint(slicePoints, sliceIndex), options.selectedColor ?? selectedLineColor);
  if (hoverPoint) drawCallout(context, hoverPoint.x + 14, hoverPoint.y - 48, "Hover/click chart");
  drawXAxisLabels(context, area, xRange);
  if (viewport) drawViewportStrip(context, area);
}

function drawSelectedSpectrum(
  context: CanvasRenderingContext2D,
  data: PreparedWaterfallData,
  options: SpectralWaterfallChartOptions,
  area: WaterfallPlotArea,
  selected: WaterfallPointSelection | null,
  hover: WaterfallPointSelection | null,
  viewport: WaterfallRange | null
): void {
  const comparison = waterfallComparisonSeriesFromData(data, options, selected, hover, viewport, Math.max(8, Math.floor(area.width * 2)));
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
  data: PreparedWaterfallData,
  options: SpectralWaterfallChartOptions,
  area: WaterfallPlotArea,
  sliceIndex: number,
  selected: WaterfallPointSelection | null,
  hover: WaterfallPointSelection | null
): void {
  drawGrid(context, area, "Cross Section Slice", "Value");
  const points: WaterfallSeriesPoint[] = [];
  data.values.forEach((values, spectrumIndex) => {
    const value = values[sliceIndex];
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

function decimateSeriesPoints(points: WaterfallSeriesPoint[], maxPoints: number): WaterfallSeriesPoint[] {
  if (points.length <= maxPoints || maxPoints <= 0) return points;
  const bucketCount = Math.max(1, Math.floor(maxPoints / 2));
  const bucketSize = Math.ceil(points.length / bucketCount);
  const output: WaterfallSeriesPoint[] = [];

  for (let start = 0; start < points.length && output.length < maxPoints; start += bucketSize) {
    let min = points[start]!;
    let max = points[start]!;
    const end = Math.min(points.length, start + bucketSize);
    for (let index = start + 1; index < end; index += 1) {
      const point = points[index]!;
      if (point.value < min.value) min = point;
      if (point.value > max.value) max = point;
    }
    const pair = min.xValue <= max.xValue ? [min, max] : [max, min];
    for (const point of pair) {
      if (output.at(-1) !== point && output.length < maxPoints) output.push(point);
    }
  }

  return output;
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

function drawWaterfallGrid(
  context: CanvasRenderingContext2D,
  area: WaterfallPlotArea,
  projection: WaterfallProjection
): void {
  const geometry = waterfallGeometry(area);
  const bottom = area.top + geometry.yPad + geometry.depthY + geometry.plotHeight;
  context.save();
  context.strokeStyle = "rgba(125, 211, 252, 0.12)";
  context.lineWidth = 1;

  for (let index = 0; index <= 5; index += 1) {
    const ratio = index / 5;
    const x = area.left + geometry.xPad + geometry.plotWidth * ratio;
    context.beginPath();
    context.moveTo(x, area.top);
    context.lineTo(x, bottom);
    context.stroke();
  }

  for (let index = 0; index <= 4; index += 1) {
    const y = area.top + geometry.yPad + (geometry.depthY + geometry.plotHeight) * (index / 4);
    context.beginPath();
    context.moveTo(area.left, y);
    context.lineTo(area.left + area.width, y);
    context.stroke();
  }

  context.strokeStyle = "rgba(148, 163, 184, 0.32)";
  context.strokeRect(area.left, area.top, area.width, area.height);
  context.fillStyle = "#a8b6d8";
  context.font = "12px system-ui, sans-serif";
  context.fillText("Amplitude", area.left + area.width - 56, Math.max(12, area.top - 8));

  if (projection.valueRange) drawYAxisLabels(context, area, projection.valueRange);
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
  const rect = sliceHandleCalloutRect(point);
  drawCallout(context, rect.left, rect.top, dragCalloutLabel);
}

function drawCallout(context: CanvasRenderingContext2D, x: number, y: number, label: string): void {
  const width = calloutWidth(label);
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

function sliceHandleCalloutRect(point: ProjectedWaterfallPoint): Rect {
  return {
    left: point.x - 47,
    top: point.y + 28,
    width: calloutWidth(dragCalloutLabel),
    height: 30
  };
}

function calloutWidth(label: string): number {
  return Math.max(76, label.length * 7 + 18);
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
  const geometry = waterfallGeometry(area);
  const y = area.top + geometry.yPad + geometry.depthY + geometry.plotHeight + 18;
  context.save();
  context.fillStyle = "#9fb1d1";
  context.font = "12px system-ui, sans-serif";
  context.textAlign = "center";
  for (let index = 0; index < 3; index += 1) {
    const ratio = index / 2;
    const value = xRange.min + (xRange.max - xRange.min) * ratio;
    const x = area.left + geometry.xPad + geometry.plotWidth * ratio;
    context.fillText(numberLabel(value), x, y);
  }
  context.restore();
}

function drawYAxisLabels(context: CanvasRenderingContext2D, area: WaterfallPlotArea, valueRange: WaterfallRange): void {
  const geometry = waterfallGeometry(area);
  const valueSpan = valueRange.max - valueRange.min || 1;
  context.fillStyle = "#9fb1d1";
  context.font = "12px system-ui, sans-serif";
  context.textAlign = "right";
  for (let index = 0; index < 3; index += 1) {
    const ratio = index / 2;
    const value = valueRange.max - valueSpan * ratio;
    const y = area.top + geometry.yPad + geometry.depthY + geometry.plotHeight * ratio + 4;
    context.fillText(numberLabel(value), area.left - 10, y);
  }
}

function drawViewportStrip(context: CanvasRenderingContext2D, area: WaterfallPlotArea): void {
  context.save();
  context.fillStyle = "rgba(255, 255, 255, 0.12)";
  context.fillRect(area.left, area.top + area.height + 6, area.width, 4);
  context.restore();
}

interface WebGLWaterfallRenderOptions {
  area: WaterfallPlotArea;
  width: number;
  height: number;
  pixelRatio: number;
  viewport: WaterfallRange | null;
  data: PreparedWaterfallData;
  color: string;
}

interface WebGLBufferRange {
  start: number;
  count: number;
}

const waterfallVertexShader = `#version 300 es
in vec3 a_point;
uniform vec2 u_canvasSize;
uniform vec4 u_area;
uniform vec4 u_range;
uniform vec4 u_geometryA;
uniform vec2 u_geometryB;

void main() {
  float xSpan = max(u_range.y - u_range.x, 0.000001);
  float valueSpan = max(u_range.w - u_range.z, 0.000001);
  float x = u_area.x + u_geometryA.z + ((a_point.x - u_range.x) / xSpan) * u_geometryB.x + a_point.z * u_geometryA.x;
  float y = u_area.y + u_geometryA.w + u_geometryA.y + ((u_range.w - a_point.y) / valueSpan) * u_geometryB.y - a_point.z * u_geometryA.y;
  gl_Position = vec4((x / u_canvasSize.x) * 2.0 - 1.0, 1.0 - (y / u_canvasSize.y) * 2.0, 0.0, 1.0);
}`;

const waterfallFragmentShader = `#version 300 es
precision mediump float;
uniform vec4 u_color;
out vec4 outColor;

void main() {
  outColor = u_color;
}`;

class WebGL2WaterfallRenderer {
  private readonly canvas: HTMLCanvasElement;
  private readonly gl: WebGL2RenderingContext | null;
  private readonly program: WebGLProgram | null;
  private buffer: WebGLBuffer | null = null;
  private ranges: WebGLBufferRange[] = [];
  private data: PreparedWaterfallData | null = null;

  constructor() {
    this.canvas = document.createElement("canvas");
    this.gl = this.canvas.getContext("webgl2", { alpha: true, antialias: false, premultipliedAlpha: true });
    this.program = this.gl ? createWebGLProgram(this.gl, waterfallVertexShader, waterfallFragmentShader) : null;
  }

  get ready(): boolean {
    return Boolean(this.gl && this.program);
  }

  setData(data: PreparedWaterfallData): void {
    if (this.data === data) return;
    this.data = data;
    this.ranges = [];
    const gl = this.gl;
    if (!gl || !this.program) return;

    const vertexCount = data.drawRanges.reduce((sum, rangeValue) => sum + rangeValue.count, 0);
    const vertices = new Float32Array(vertexCount * 3);
    const spectrumSpan = Math.max(data.spectrumCount - 1, 1);
    let offset = 0;

    for (const rangeValue of data.drawRanges) {
      this.ranges.push({ start: offset / 3, count: rangeValue.count });
      const values = data.values[rangeValue.spectrumIndex]!;
      const depth = rangeValue.spectrumIndex / spectrumSpan;
      for (let index = 0; index < rangeValue.count; index += 1) {
        const pointIndex = rangeValue.pointIndex + index;
        vertices[offset] = data.x[pointIndex]!;
        vertices[offset + 1] = values[pointIndex]!;
        vertices[offset + 2] = depth;
        offset += 3;
      }
    }

    this.buffer = this.buffer ?? gl.createBuffer();
    if (!this.buffer) return;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
  }

  render(options: WebGLWaterfallRenderOptions): HTMLCanvasElement | null {
    const gl = this.gl;
    const program = this.program;
    const xRange = normalizeViewportRange(options.viewport, options.data.xRange) ?? options.data.xRange;
    const valueRange = options.data.valueRange;
    if (!gl || !program || !this.buffer || !xRange || !valueRange) return null;

    const width = Math.max(1, Math.round(options.width * options.pixelRatio));
    const height = Math.max(1, Math.round(options.height * options.pixelRatio));
    if (this.canvas.width !== width) this.canvas.width = width;
    if (this.canvas.height !== height) this.canvas.height = height;

    const geometry = waterfallGeometry(options.area);
    gl.viewport(0, 0, width, height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(program);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);

    const position = gl.getAttribLocation(program, "a_point");
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 3, gl.FLOAT, false, 0, 0);
    gl.uniform2f(gl.getUniformLocation(program, "u_canvasSize"), options.width, options.height);
    gl.uniform4f(gl.getUniformLocation(program, "u_area"), options.area.left, options.area.top, options.area.width, options.area.height);
    gl.uniform4f(gl.getUniformLocation(program, "u_range"), xRange.min, xRange.max, valueRange.min, valueRange.max);
    gl.uniform4f(gl.getUniformLocation(program, "u_geometryA"), geometry.depthX, geometry.depthY, geometry.xPad, geometry.yPad);
    gl.uniform2f(gl.getUniformLocation(program, "u_geometryB"), geometry.plotWidth, geometry.plotHeight);
    gl.uniform4fv(gl.getUniformLocation(program, "u_color"), colorToRgba(options.color, 0.95));

    for (const rangeValue of this.ranges) {
      if (rangeValue.count > 1) gl.drawArrays(gl.LINE_STRIP, rangeValue.start, rangeValue.count);
    }

    return this.canvas;
  }

  destroy(): void {
    if (this.gl && this.buffer) this.gl.deleteBuffer(this.buffer);
    this.buffer = null;
    this.ranges = [];
    this.data = null;
  }
}

function chartLayout(width: number, height: number): ChartLayout {
  const safeWidth = Math.max(width, 320);
  const safeHeight = Math.max(height, 320);
  const left = 56;
  const right = 24;
  const gap = 18;
  const topHeight = Math.max(210, Math.floor(safeHeight * 0.61));
  const bottomTop = topHeight + 32;
  const bottomHeight = Math.max(110, safeHeight - bottomTop - 24);
  const bottomWidth = Math.max(100, (safeWidth - left - right - gap) / 2);

  return {
    waterfall: {
      left,
      top: 34,
      width: safeWidth - left - right,
      height: topHeight - 46
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

function waterfallGeometry(area: WaterfallPlotArea) {
  const depthX = area.width * 0.17;
  const depthY = area.height * 0.34;
  const xPad = area.width * 0.1;
  const yPad = area.height * 0.1;
  return {
    depthX,
    depthY,
    xPad,
    yPad,
    plotWidth: Math.max(1, area.width - depthX - xPad * 2),
    plotHeight: Math.max(1, area.height - depthY - yPad * 2)
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

function nearestPreparedPointIndex(data: PreparedWaterfallData, target: number): number {
  if (data.maxPointCount <= 1 || !Number.isFinite(target)) return 0;
  if (!data.xAscending) return nearestXIndexLinear(data.x, target);

  let low = 0;
  let high = data.maxPointCount - 1;
  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    if (data.x[mid]! < target) low = mid + 1;
    else high = mid;
  }

  const previous = Math.max(0, low - 1);
  return Math.abs(data.x[previous]! - target) <= Math.abs(data.x[low]! - target) ? previous : low;
}

function nearestXIndexLinear(xValues: Float32Array, target: number): number {
  let nearest = 0;
  let nearestDistance = Infinity;
  for (let index = 0; index < xValues.length; index += 1) {
    const value = xValues[index];
    if (!isFiniteNumber(value)) continue;
    const distance = Math.abs(value - target);
    if (distance < nearestDistance) {
      nearest = index;
      nearestDistance = distance;
    }
  }
  return nearest;
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

function rangeFromBounds(min: number, max: number): WaterfallRange {
  return min === max ? { min: min - 1, max: max + 1 } : { min, max };
}

function paddedRangeFromBounds(min: number, max: number, padding: number): WaterfallRange {
  const base = rangeFromBounds(min, max);
  const span = base.max - base.min || 1;
  return { min: base.min - span * padding, max: base.max + span * padding };
}

function waterfallDrawRanges(values: readonly Float32Array[], xValues: Float32Array): WaterfallDrawRange[] {
  const ranges: WaterfallDrawRange[] = [];
  for (let spectrumIndex = values.length - 1; spectrumIndex >= 0; spectrumIndex -= 1) {
    const spectrumValues = values[spectrumIndex]!;
    let start = -1;
    for (let pointIndex = 0; pointIndex <= spectrumValues.length; pointIndex += 1) {
      const value = spectrumValues[pointIndex];
      const finite = pointIndex < spectrumValues.length && isFiniteNumber(value) && isFiniteNumber(xValues[pointIndex]);
      if (finite && start === -1) start = pointIndex;
      if ((!finite || pointIndex === spectrumValues.length) && start !== -1) {
        const count = pointIndex - start;
        if (count > 1) ranges.push({ spectrumIndex, pointIndex: start, count });
        start = -1;
      }
    }
  }
  return ranges;
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
  const geometry = waterfallGeometry(area);
  const ratio = clamp((x - area.left - geometry.xPad) / Math.max(geometry.plotWidth, 1), 0, 1);
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

function isInRect(point: { x: number; y: number }, rect: Rect): boolean {
  return point.x >= rect.left && point.x <= rect.left + rect.width && point.y >= rect.top && point.y <= rect.top + rect.height;
}

function growRect(rect: Rect, padding: number): Rect {
  return {
    left: rect.left - padding,
    top: rect.top - padding,
    width: rect.width + padding * 2,
    height: rect.height + padding * 2
  };
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

function createWebGLProgram(gl: WebGL2RenderingContext, vertexSource: string, fragmentSource: string): WebGLProgram | null {
  const vertex = compileWebGLShader(gl, gl.VERTEX_SHADER, vertexSource);
  const fragment = compileWebGLShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
  if (!vertex || !fragment) return null;

  const program = gl.createProgram();
  if (!program) return null;
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  return gl.getProgramParameter(program, gl.LINK_STATUS) ? program : null;
}

function compileWebGLShader(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  return gl.getShaderParameter(shader, gl.COMPILE_STATUS) ? shader : null;
}

function colorToRgba(color: string, fallbackAlpha: number): [number, number, number, number] {
  if (!color.startsWith("#")) return [0.33, 0.78, 0.97, fallbackAlpha];
  const value = color.slice(1);
  const full = value.length === 3 ? value.split("").map((item) => item + item).join("") : value;
  const numberValue = Number.parseInt(full, 16);
  if (!Number.isFinite(numberValue)) return [0.33, 0.78, 0.97, fallbackAlpha];
  return [
    ((numberValue >> 16) & 255) / 255,
    ((numberValue >> 8) & 255) / 255,
    (numberValue & 255) / 255,
    fallbackAlpha
  ];
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
