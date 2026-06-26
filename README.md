# catmap

`catmap` is a TypeScript visualization library for geotechnical monitoring systems. It provides time-series charts, instrument maps, cross-sections, borehole logs, data utilities, and React wrappers while keeping the core contracts framework-agnostic.

The library is split by responsibility: data parsing and decimation live in `@catmap/data`, chart renderers live in `@catmap/charts`, map renderers live in `@catmap/maps`, geotechnical views live in `@catmap/geotech`, and React bindings live in `@catmap/react`.

## Features

- Piezometer, settlement, rainfall-response, inclinometer, sensor-health, multi-instrument, and spectral waterfall charts
- MapLibre instrument maps with markers, native heatmaps, and precalculated contour isolines
- SVG cross-section views and borehole logs
- Time-series decimation, bucket aggregation, in-memory data sources, and Arrow-compatible column loading
- uPlot time-series rendering, Canvas 2D spectral waterfall rendering, and a lightweight WebGL point renderer with optional OffscreenCanvas support
- Browser PNG/PDF export helpers for canvas and SVG output
- React wrappers for geotechnical charts, spectral waterfalls, maps, cross-sections, and borehole logs

## Packages

| Package | Purpose |
| --- | --- |
| `@catmap/core` | Framework-agnostic contracts for charts, layers, renderer adapters, events, plugins, and data sources |
| `@catmap/data` | Time-series types, data sources, decimation, aggregation, mock data, and Arrow-like column import |
| `@catmap/charts` | uPlot adapter, spectral waterfall chart, chart layer helpers, WebGL point renderer, and browser export utilities |
| `@catmap/geotech` | Domain APIs for geotechnical charts, cross-sections, and borehole logs |
| `@catmap/maps` | MapLibre adapter, instrument maps, heatmap/contour layers, and GeoJSON helpers |
| `@catmap/react` | React components wrapping `@catmap/charts`, `@catmap/geotech`, and `@catmap/maps` APIs |
| `apps/playground` | Vite playground using mock geotechnical data |

## Installation

This repository is a pnpm workspace. Inside the monorepo, packages consume each other through `workspace:*`.

```bash
pnpm install
pnpm dev
```

For an external application, install only the packages you need once they are published:

```bash
pnpm add @catmap/react @catmap/charts @catmap/geotech @catmap/maps @catmap/data
```

Peer/runtime dependencies depend on the package surface you use:

- React components require `react >=18`.
- Map views require `maplibre-gl` styles to be loaded by the application.
- Time-series charts require `uplot` styles to be loaded by the application.

```ts
import "maplibre-gl/dist/maplibre-gl.css";
import "uplot/dist/uPlot.min.css";
```

## Quick Start

### React

```tsx
import {
  BoreholeLog,
  CrossSectionView,
  InstrumentMap,
  PiezometerChart,
  SpectralWaterfallChart
} from "@catmap/react";

export function MonitoringDashboard() {
  return (
    <>
      <PiezometerChart
        instrument={{ id: "PZ-001", name: "Piezometer PZ-001" }}
        readings={[
          { timestamp: Date.UTC(2026, 0, 1), waterLevel: 1210.4 },
          { timestamp: Date.UTC(2026, 0, 2), waterLevel: 1211.2 }
        ]}
        thresholds={[
          { value: 1211.6, label: "Alert", severity: "warning" },
          { value: 1212.6, label: "Action", severity: "critical" }
        ]}
        yAxis="waterLevel"
        showThresholds
      />

      <InstrumentMap
        center={[-70.31, -27.44]}
        zoom={14}
        instruments={[
          {
            id: "PZ-001",
            name: "Piezometer PZ-001",
            type: "piezometer",
            longitude: -70.31,
            latitude: -27.44,
            status: "warning"
          }
        ]}
        heatmap={{
          points: [{ longitude: -70.31, latitude: -27.44, value: 1.8 }]
        }}
        contours={{
          lines: [
            {
              id: "wl-1212",
              value: 1212,
              label: "1212 m",
              coordinates: [
                [-70.32, -27.45],
                [-70.31, -27.44],
                [-70.3, -27.43]
              ]
            }
          ]
        }}
      />

      <CrossSectionView
        title="Section A"
        series={[
          {
            id: "ground",
            label: "Ground surface",
            points: [
              { distance: 0, elevation: 1240 },
              { distance: 100, elevation: 1233 }
            ]
          }
        ]}
      />

      <BoreholeLog
        boreholeId="BH-01"
        waterLevel={10.5}
        intervals={[
          { from: 0, to: 4, label: "Fill" },
          { from: 4, to: 12, label: "Silty sand" },
          { from: 12, to: 24, label: "Weathered rock" }
        ]}
      />

      <SpectralWaterfallChart
        title="Interactive waterfall spectral chart"
        x={[0, 1, 2, 3]}
        spectra={[
          { id: "s0", label: "Spectra 0", values: [0, 3, 1, 2] },
          { id: "s1", label: "Spectra 1", values: [1, 4, 2, 1] }
        ]}
        height={420}
      />
    </>
  );
}
```

### Framework-Agnostic APIs

```ts
import { PiezometerChart } from "@catmap/geotech";

const chart = new PiezometerChart(container, {
  instrument: { id: "PZ-001", name: "Piezometer PZ-001" },
  readings,
  thresholds,
  yAxis: "waterLevel",
  showThresholds: true
});

chart.updateData(nextReadings);
chart.resize();
chart.destroy();
```

```ts
import { InstrumentMap } from "@catmap/maps";

const map = new InstrumentMap(container, {
  center: [-70.31, -27.44],
  zoom: 14,
  basemap: "osm"
});

map.addInstrumentLayer({ instruments });
map.setHeatmap({ points: heatmapPoints, radius: 32 });
map.setContours({ lines: contourLines, width: 2 });
map.destroy();
```

```ts
import { SpectralWaterfallChart } from "@catmap/charts";

const waterfall = new SpectralWaterfallChart(container, {
  x,
  spectra,
  height: 560,
  onSelectionChange: (selection) => console.log(selection)
});

waterfall.updateData(nextSpectra);
waterfall.resize();
waterfall.destroy();
```

## Data Utilities

```ts
import {
  TimeSeriesDataSource,
  bucketAggregation,
  decimateTimeSeries,
  timeSeriesFromArrow
} from "@catmap/data";

const source = new TimeSeriesDataSource(points);
const { data, total } = await source.query({
  from: Date.UTC(2026, 0, 1),
  to: Date.UTC(2026, 0, 31),
  maxPoints: 600
});

const hourly = bucketAggregation(data, 60 * 60 * 1000);
const decimated = await decimateTimeSeries(points, { maxPoints: 1000, useWorker: true });

const fromArrow = timeSeriesFromArrow(arrowTable, {
  timestampColumn: "timestamp",
  valueColumn: "water_level",
  qualityColumn: "quality",
  timestampUnit: "ms"
});

console.log(total, hourly.length, decimated.length, fromArrow.length);
```

`timeSeriesFromArrow` accepts Arrow-compatible table objects that expose `getChild(name)` and vector columns with `get(index)`. It intentionally does not parse Arrow IPC files; parse those upstream and pass the table object into `catmap`.

## Export Utilities

```ts
import { canvasToPngBlob, svgToPdfBlob } from "@catmap/charts";

const png = await canvasToPngBlob(canvas);
const pdf = await svgToPdfBlob(svgElement, {
  width: 900,
  height: 500,
  background: "#ffffff"
});
```

Exports run in browser environments. Server-side export should use a browser renderer or a dedicated PDF/image pipeline.

## Development

```bash
pnpm install
pnpm dev
pnpm typecheck
pnpm test
pnpm build
```

Workspace scripts:

- `pnpm dev`: starts the Vite playground.
- `pnpm typecheck`: runs TypeScript checks across packages.
- `pnpm test`: runs Vitest across packages.
- `pnpm build`: builds package outputs with tsup and the playground with Vite.
- `pnpm lint`: runs ESLint with zero warnings.

See [DEVELOPMENT.md](./DEVELOPMENT.md) for completed phases, design constraints, known limitations, and future work.

## Architecture Notes

- `@catmap/core` stays framework-agnostic and renderer-agnostic.
- React components live only in `@catmap/react`.
- Concrete rendering engines stay behind package boundaries: uPlot and Canvas 2D in `@catmap/charts`, MapLibre/deck.gl in `@catmap/maps`.
- Large-data paths prefer typed arrays, Arrow-compatible columns, chunks, or tiles over object-heavy hot paths.
- WebGPU, Rust/WASM, backend tiling, and custom parsers should be added only after benchmarks show the current path is the bottleneck.

## License

See [LICENSE](./LICENSE).
