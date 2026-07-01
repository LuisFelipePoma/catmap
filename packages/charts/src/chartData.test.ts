import { describe, expect, it, vi } from "vitest";
import {
  createJpegPdf,
  findNearestWaterfallPoint,
  normalizeWaterfallSpectra,
  normalizeWebGLPoints,
  prepareWaterfallData,
  projectWaterfallSpectra,
  selectWaterfallRenderer,
  SpectralWaterfallChart,
  toUPlotData,
  UPlotAdapter,
  waterfallComparisonSeries,
  type SpectralWaterfallChartOptions,
  type TimeSeriesChartSpec
} from "./index";

interface FakeUPlotInstance {
  cursor: { idx: number | null };
  data: unknown[][];
  hooks: {
    setCursor?: Array<(chart: FakeUPlotInstance) => void>;
    setScale?: Array<(chart: FakeUPlotInstance, scaleKey: string) => void>;
  };
  over: {
    addEventListener: ReturnType<typeof vi.fn>;
    removeEventListener: ReturnType<typeof vi.fn>;
    getBoundingClientRect: () => { left: number; top: number; width: number; height: number };
  };
  scales: Record<string, { min?: number; max?: number }>;
  width: number;
  dispatch: (type: string, event: unknown) => void;
  setCursor: (options: { left: number; top: number }) => void;
}

const uPlotMock = vi.hoisted(() => ({ instances: [] as FakeUPlotInstance[] }));

vi.mock("uplot", () => {
  class FakeUPlot {
    static paths = { bars: () => undefined };

    cursor = { idx: null as number | null };
    hooks: FakeUPlotInstance["hooks"];
    over: FakeUPlotInstance["over"];
    scales: FakeUPlotInstance["scales"];
    width: number;
    height: number;
    data: unknown[][];
    private listeners = new Map<string, Array<(event: unknown) => void>>();

    constructor(
      public opts: { width: number; height: number; hooks?: FakeUPlotInstance["hooks"] },
      data: unknown[][]
    ) {
      this.width = opts.width;
      this.height = opts.height;
      this.data = data;
      this.hooks = opts.hooks ?? {};
      this.scales = { x: { min: data[0]?.[0] as number, max: data[0]?.at(-1) as number }, y: {} };
      this.over = {
        addEventListener: vi.fn((type: string, handler: (event: unknown) => void) => {
          this.listeners.set(type, [...(this.listeners.get(type) ?? []), handler]);
        }),
        removeEventListener: vi.fn((type: string, handler: (event: unknown) => void) => {
          this.listeners.set(
            type,
            (this.listeners.get(type) ?? []).filter((item) => item !== handler)
          );
        }),
        getBoundingClientRect: () => ({ left: 0, top: 0, width: this.width, height: this.height })
      };
      uPlotMock.instances.push(this as unknown as FakeUPlotInstance);
    }

    setData(data: unknown[][]): void {
      this.data = data;
    }

    setScale(scaleKey: string, limits: { min: number; max: number }): void {
      this.scales[scaleKey] = { ...this.scales[scaleKey], ...limits };
      this.hooks.setScale?.forEach((hook) => hook(this as unknown as FakeUPlotInstance, scaleKey));
    }

    setCursor(_options: { left: number; top: number }): void {
      this.hooks.setCursor?.forEach((hook) => hook(this as unknown as FakeUPlotInstance));
    }

    posToVal(left: number): number {
      const scale = this.scales.x;
      const min = scale?.min ?? 0;
      const max = scale?.max ?? 1;
      return min + (left / Math.max(this.width, 1)) * (max - min);
    }

    setSize(options: { width: number; height: number }): void {
      this.width = options.width;
      this.height = options.height;
    }

    redraw(): void {}
    destroy(): void {}

    dispatch(type: string, event: unknown): void {
      for (const handler of this.listeners.get(type) ?? []) handler(event);
    }
  }

  return { default: FakeUPlot };
});

describe("time series chart data", () => {
  it("decimates without exceeding maxPoints", () => {
    const spec: TimeSeriesChartSpec = {
      series: [
        {
          id: "pore-pressure",
          label: "Pore pressure",
          color: "#2563eb",
          data: Array.from({ length: 500 }, (_, index) => ({
            timestamp: index,
            value: Math.sin(index / 10)
          }))
        }
      ]
    };

    expect(toUPlotData(spec, 40)[0]).toHaveLength(40);
  });

  it("preserves missing data as chart gaps", () => {
    const spec: TimeSeriesChartSpec = {
      series: [
        {
          id: "water-level",
          label: "Water level",
          color: "#2563eb",
          data: [
            { timestamp: 1, value: 10 },
            { timestamp: 2, value: null },
            { timestamp: 3, value: 11 }
          ]
        }
      ]
    };

    expect(toUPlotData(spec, 10)[1]).toEqual([10, null, 11]);
  });

  it("adds marker series to chart data", () => {
    const spec: TimeSeriesChartSpec = {
      markers: [{ id: "missing-1", label: "Missing", timestamp: 2, value: 10, color: "#dc2626" }],
      series: [
        {
          id: "water-level",
          label: "Water level",
          color: "#2563eb",
          data: [
            { timestamp: 1, value: 10 },
            { timestamp: 3, value: 11 }
          ]
        }
      ]
    };

    expect(toUPlotData(spec, 10)[2]).toEqual([null, 10, null]);
  });

  it("emits inspected time-series points", () => {
    const onInspect = vi.fn();
    const adapter = new UPlotAdapter({
      tools: { onInspect },
      series: [
        {
          id: "water-level",
          label: "Water level",
          color: "#2563eb",
          data: [
            { timestamp: 1000, value: 10 },
            { timestamp: 2000, value: 11 }
          ]
        }
      ]
    });
    adapter.init(fakeContainer());
    const plot = uPlotMock.instances.at(-1)!;

    plot.cursor.idx = 1;
    plot.setCursor({ left: 1, top: 1 });

    expect(onInspect).toHaveBeenCalledWith({
      index: 1,
      x: 2000,
      series: [{ id: "water-level", label: "Water level", color: "#2563eb", value: 11 }]
    });
    adapter.destroy();
  });

  it("emits viewport changes from wheel zoom", () => {
    const onViewportChange = vi.fn();
    const preventDefault = vi.fn();
    const adapter = new UPlotAdapter({
      tools: { onViewportChange },
      series: [
        {
          id: "water-level",
          label: "Water level",
          color: "#2563eb",
          data: [
            { timestamp: 1000, value: 10 },
            { timestamp: 2000, value: 11 },
            { timestamp: 3000, value: 12 }
          ]
        }
      ]
    });
    adapter.init(fakeContainer());
    const plot = uPlotMock.instances.at(-1)!;

    plot.dispatch("wheel", { clientX: 160, deltaX: 0, deltaY: -100, shiftKey: false, preventDefault });

    expect(preventDefault).toHaveBeenCalled();
    expect(onViewportChange).toHaveBeenCalledWith({ min: 1100, max: 2700 });
    adapter.destroy();
  });

  it("pans a zoomed viewport with shift wheel by default", () => {
    const preventDefault = vi.fn();
    const adapter = new UPlotAdapter({
      series: [
        {
          id: "water-level",
          label: "Water level",
          color: "#2563eb",
          data: [
            { timestamp: 1000, value: 10 },
            { timestamp: 2000, value: 11 },
            { timestamp: 3000, value: 12 }
          ]
        }
      ]
    });
    adapter.init(fakeContainer());
    const plot = uPlotMock.instances.at(-1)!;
    plot.scales.x = { min: 1.2, max: 2.4 };

    plot.dispatch("wheel", { clientX: 160, deltaX: 0, deltaY: 100, shiftKey: true, preventDefault });

    expect(preventDefault).toHaveBeenCalled();
    expect(plot.scales.x).toEqual({ min: 1.3875, max: 2.5875 });
    adapter.destroy();
  });

  it("resets the viewport to the full x range", () => {
    const onViewportChange = vi.fn();
    const adapter = new UPlotAdapter({
      tools: { onViewportChange },
      series: [
        {
          id: "water-level",
          label: "Water level",
          color: "#2563eb",
          data: [
            { timestamp: 1000, value: 10 },
            { timestamp: 2000, value: 11 },
            { timestamp: 3000, value: 12 }
          ]
        }
      ]
    });
    adapter.init(fakeContainer());
    const plot = uPlotMock.instances.at(-1)!;
    plot.scales.x = { min: 1.2, max: 2.4 };

    adapter.resetViewport();

    expect(plot.scales.x).toEqual({ min: 1, max: 3 });
    expect(onViewportChange).toHaveBeenCalledWith(null);
    adapter.destroy();
  });

  it("normalizes finite points for WebGL clip space", () => {
    expect(Array.from(normalizeWebGLPoints([{ x: 0, y: 0 }, { x: 10, y: 20 }, { x: Number.NaN, y: 5 }]))).toEqual([
      -1, -1, 1, 1
    ]);
  });

  it("creates a one-page PDF around JPEG bytes", () => {
    const pdf = new TextDecoder().decode(createJpegPdf(new Uint8Array([1, 2, 3]), 100, 80));

    expect(pdf.startsWith("%PDF-1.4")).toBe(true);
    expect(pdf).toContain("/DCTDecode");
    expect(pdf).toContain("/MediaBox [0 0 100 80]");
  });

  it("normalizes finite waterfall spectra points", () => {
    expect(
      normalizeWaterfallSpectra(
        [
          { id: "a", values: [1, Number.NaN, 3] },
          { id: "b", values: [2, 4, 6] }
        ],
        [10, 20, Number.POSITIVE_INFINITY]
      )
    ).toEqual([
      { spectrumIndex: 0, pointIndex: 0, spectrumId: "a", xValue: 10, value: 1 },
      { spectrumIndex: 1, pointIndex: 0, spectrumId: "b", xValue: 10, value: 2 },
      { spectrumIndex: 1, pointIndex: 1, spectrumId: "b", xValue: 20, value: 4 }
    ]);
  });

  it("prepares typed waterfall data with finite ranges and NaN draw gaps", () => {
    const data = prepareWaterfallData(
      [
        { id: "a", values: Float32Array.from([1, Number.NaN, 3, 4]) },
        { id: "b", values: [2, 5] }
      ],
      [10, 20, 30, 40]
    );

    expect(data.maxPointCount).toBe(4);
    expect(data.finitePointCount).toBe(5);
    expect(data.xRange).toEqual({ min: 10, max: 40 });
    expect(data.valueRange).toEqual(expect.objectContaining({ min: expect.any(Number), max: expect.any(Number) }));
    expect(data.drawRanges).toEqual([
      { spectrumIndex: 1, pointIndex: 0, count: 2 },
      { spectrumIndex: 0, pointIndex: 2, count: 2 }
    ]);
  });

  it("selects the waterfall renderer from mode, size, and WebGL2 support", () => {
    expect(selectWaterfallRenderer("canvas", 1_000_000, true)).toBe("canvas");
    expect(selectWaterfallRenderer("webgl2", 1_000_000, false)).toBe("canvas");
    expect(selectWaterfallRenderer("auto", 99_999, true)).toBe("canvas");
    expect(selectWaterfallRenderer("auto", 100_000, true)).toBe("webgl2");
  });

  it.skip("benchmarks a synthetic 500 x 10,000 waterfall data load", () => {
    const x = Float32Array.from({ length: 10_000 }, (_item, index) => index);
    const spectra = Array.from({ length: 500 }, (_item, spectrumIndex) => ({
      id: `s-${spectrumIndex}`,
      values: Float32Array.from(x, (value) => Math.sin(value / 20 + spectrumIndex / 8))
    }));
    const started = performance.now();
    const data = prepareWaterfallData(spectra, x);
    const preparedMs = performance.now() - started;

    console.info({ preparedMs, vertices: data.finitePointCount, ranges: data.drawRanges.length });
    expect(data.finitePointCount).toBe(5_000_000);
  });

  it("projects and selects the nearest waterfall point", () => {
    const projection = projectWaterfallSpectra(
      {
        spectra: [
          { id: "a", values: [1, 2] },
          { id: "b", values: [3, 4] }
        ],
        x: [0, 1]
      },
      { left: 10, top: 20, width: 100, height: 80 }
    );
    const target = projection.points[2]!;

    expect(projection.points).toHaveLength(4);
    expect(findNearestWaterfallPoint(projection.points, target.x + 1, target.y + 1)?.spectrumId).toBe("b");
  });

  it("projects later spectra right and upward for the 2.5D waterfall", () => {
    const projection = projectWaterfallSpectra(
      {
        spectra: [
          { id: "front", values: [1] },
          { id: "back", values: [1] }
        ],
        x: [0]
      },
      { left: 10, top: 20, width: 100, height: 80 }
    );
    const front = projection.points.find((point) => point.spectrumId === "front")!;
    const back = projection.points.find((point) => point.spectrumId === "back")!;

    expect(back.x - front.x).toBeGreaterThan(15);
    expect(front.y - back.y).toBeGreaterThan(25);
  });

  it("updates spectral chart data", () => {
    const canvas = fakeCanvas();
    vi.stubGlobal("document", { createElement: () => canvas.canvas });
    vi.stubGlobal("window", { devicePixelRatio: 1 });

    try {
      const chart = new SpectralWaterfallChart(fakeContainer(), { spectra: [{ id: "a", values: [1, 2, 3] }] });

      expect(chart.selection?.spectrumId).toBe("a");
      chart.updateData([{ id: "b", values: [Number.NaN, 5] }]);
      expect(chart.selection).toMatchObject({ spectrumId: "b", pointIndex: 1, value: 5 });
      chart.destroy();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("hovers without changing the clicked waterfall spectrum", () => {
    const { chart, dispatch, spectra } = fakeChart();
    const target = projectWaterfallSpectra({ spectra, x: [0, 1, 2] }, waterfallArea).points.find(
      (point) => point.spectrumIndex === 1 && point.pointIndex === 1
    )!;

    dispatch("pointermove", pointerEvent(target.x, target.y));
    expect(chart.selection).toMatchObject({ spectrumId: "a", pointIndex: 1 });
    expect(chart.hoverSelection).toMatchObject({ spectrumId: "b", pointIndex: 1 });

    dispatch("click", pointerEvent(target.x, target.y));
    expect(chart.selection).toMatchObject({ spectrumId: "b", pointIndex: 1 });
    chart.destroy();
    vi.unstubAllGlobals();
  });

  it("drags the cross-section slice without changing the selected spectrum", () => {
    const onSliceChange = vi.fn();
    const { chart, dispatch, spectra } = fakeChart({ onSliceChange });
    const projection = projectWaterfallSpectra({ spectra, x: [0, 1, 2] }, waterfallArea);
    const start = projection.points.find((point) => point.spectrumIndex === 0 && point.pointIndex === 1)!;
    const end = projection.points.find((point) => point.spectrumIndex === 0 && point.pointIndex === 2)!;

    dispatch("pointerdown", pointerEvent(start.x, start.y));
    dispatch("pointermove", pointerEvent(end.x, end.y));
    dispatch("pointerup", pointerEvent(end.x, end.y));

    expect(chart.sliceIndex).toBe(2);
    expect(chart.selection).toMatchObject({ spectrumId: "a", pointIndex: 2 });
    expect(onSliceChange).toHaveBeenCalledWith(2);
    chart.destroy();
    vi.unstubAllGlobals();
  });

  it("drags the cross-section slice from the Drag me callout", () => {
    const { chart, dispatch, spectra } = fakeChart();
    const projection = projectWaterfallSpectra({ spectra, x: [0, 1, 2] }, waterfallArea);
    const start = projection.points.find((point) => point.spectrumIndex === 0 && point.pointIndex === 1)!;
    const end = projection.points.find((point) => point.spectrumIndex === 0 && point.pointIndex === 2)!;
    const labelOffsetX = -9;
    const labelY = start.y + 43;

    dispatch("pointerdown", pointerEvent(start.x + labelOffsetX, labelY));
    dispatch("pointermove", pointerEvent(end.x + labelOffsetX, labelY));
    dispatch("pointerup", pointerEvent(end.x + labelOffsetX, labelY));

    expect(chart.sliceIndex).toBe(2);
    expect(chart.selection).toMatchObject({ spectrumId: "a", pointIndex: 2 });
    chart.destroy();
    vi.unstubAllGlobals();
  });

  it("zooms and resets the waterfall viewport", () => {
    const onViewportChange = vi.fn();
    const { chart, dispatch } = fakeChart({ onViewportChange });
    const preventDefault = vi.fn();

    dispatch("wheel", { ...pointerEvent(320, 140), deltaY: -100, preventDefault });
    expect(preventDefault).toHaveBeenCalled();
    expect(chart.viewport).toEqual(expect.objectContaining({ min: expect.any(Number), max: expect.any(Number) }));
    expect(onViewportChange).toHaveBeenCalled();

    dispatch("dblclick", pointerEvent(320, 140));
    expect(chart.viewport).toBeNull();
    chart.destroy();
    vi.unstubAllGlobals();
  });

  it("filters comparison spectra by viewport", () => {
    const spectra = [
      { id: "a", label: "Spectra A", values: [1, 2, 3] },
      { id: "b", label: "Spectra B", values: [4, 5, 6] }
    ];

    const comparison = waterfallComparisonSeries(
      { spectra, x: [0, 1, 2] },
      { spectrumIndex: 0, pointIndex: 1, spectrumId: "a", x: 1, value: 2, label: "Spectra A" },
      { spectrumIndex: 1, pointIndex: 1, spectrumId: "b", x: 1, value: 5, label: "Spectra B" },
      { min: 0.5, max: 1.5 }
    );

    expect(comparison.map((series) => series.kind)).toEqual(["selected", "hover"]);
    expect(comparison.map((series) => series.points.map((point) => point.pointIndex))).toEqual([[1], [1]]);
  });
});

const waterfallArea = { left: 56, top: 34, width: 560, height: 295 };

function fakeChart(options: Partial<SpectralWaterfallChartOptions> = {}) {
  const spectra = [
    { id: "a", label: "Spectra A", values: [1, 2, 3] },
    { id: "b", label: "Spectra B", values: [4, 5, 6] }
  ];
  const canvas = fakeCanvas();
  vi.stubGlobal("document", { createElement: () => canvas.canvas });
  vi.stubGlobal("window", { devicePixelRatio: 1 });
  const chart = new SpectralWaterfallChart(fakeContainer(), {
    spectra,
    x: [0, 1, 2],
    initialSelection: { spectrumIndex: 0 },
    initialSliceIndex: 1,
    ...options
  });
  return { chart, dispatch: canvas.dispatch, spectra };
}

function fakeContainer(): HTMLElement {
  return {
    clientWidth: 640,
    appendChild: vi.fn()
  } as unknown as HTMLElement;
}

function pointerEvent(clientX: number, clientY: number): PointerEvent {
  return {
    clientX,
    clientY,
    pointerId: 1,
    preventDefault: vi.fn()
  } as unknown as PointerEvent;
}

function fakeCanvas(): { canvas: HTMLCanvasElement; dispatch: (type: string, event: unknown) => void } {
  const listeners = new Map<string, ((event: unknown) => void)[]>();
  const context = new Proxy<Record<string, unknown>>(
    {},
    {
      get: (_target, property) => (property === "canvas" ? { width: 640, height: 560 } : vi.fn()),
      set: (target, property, value) => {
        target[String(property)] = value;
        return true;
      }
    }
  ) as unknown as CanvasRenderingContext2D;

  const canvas = {
    style: {},
    width: 0,
    height: 0,
    getContext: () => context,
    addEventListener: vi.fn((type: string, handler: (event: unknown) => void) => {
      listeners.set(type, [...(listeners.get(type) ?? []), handler]);
    }),
    removeEventListener: vi.fn((type: string, handler: (event: unknown) => void) => {
      listeners.set(
        type,
        (listeners.get(type) ?? []).filter((item) => item !== handler)
      );
    }),
    setPointerCapture: vi.fn(),
    releasePointerCapture: vi.fn(),
    remove: vi.fn(),
    getBoundingClientRect: () => ({
      left: 0,
      top: 0,
      width: 640,
      height: 560,
      right: 640,
      bottom: 560,
      x: 0,
      y: 0,
      toJSON: () => ({})
    })
  } as unknown as HTMLCanvasElement;

  return {
    canvas,
    dispatch(type: string, event: unknown) {
      for (const handler of listeners.get(type) ?? []) handler(event);
    }
  };
}
