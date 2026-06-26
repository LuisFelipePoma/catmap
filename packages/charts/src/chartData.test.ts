import { describe, expect, it, vi } from "vitest";
import {
  createJpegPdf,
  findNearestWaterfallPoint,
  normalizeWaterfallSpectra,
  normalizeWebGLPoints,
  projectWaterfallSpectra,
  SpectralWaterfallChart,
  toUPlotData,
  waterfallComparisonSeries,
  type SpectralWaterfallChartOptions,
  type TimeSeriesChartSpec
} from "./index";

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

const waterfallArea = { left: 56, top: 34, width: 560, height: 276 };

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
