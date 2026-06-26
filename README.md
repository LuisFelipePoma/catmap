# catmap

`catmap` is a TypeScript library for geotechnical visualization: sensor readings,
piezometers, instruments on maps, thresholds, layers, and large time series.

The core stays framework-agnostic. React, MapLibre, deck.gl, and uPlot live behind
package boundaries.

## Stack

- TypeScript, pnpm workspaces, Vite
- tsup for package builds
- Vitest for tests
- MapLibre GL JS for maps
- deck.gl prepared for heavier geospatial layers
- uPlot for fast time series charts
- React only in `@catmap/react`

## Packages

- `@catmap/core`: charts, layers, renderer adapters, events, plugins, data contracts
- `@catmap/data`: time series types, data source, min/max decimation, bucket aggregation
- `@catmap/charts`: uPlot adapter and chart layers
- `@catmap/geotech`: geotechnical APIs, charts, cross-sections, and borehole logs
- `@catmap/maps`: `InstrumentMap`, MapLibre adapter, heatmaps, contours, map layers
- `@catmap/react`: React wrappers for the geotech and map APIs
- `apps/playground`: Vite playground with mock geotechnical data

## Usage

```ts
import { PiezometerChart } from "@catmap/geotech";

const chart = new PiezometerChart(container, {
  instrument,
  readings,
  thresholds,
  yAxis: "waterLevel",
  showThresholds: true
});

chart.updateData(newReadings);
chart.destroy();
```

```tsx
import { InstrumentMap, PiezometerChart } from "@catmap/react";

<PiezometerChart instrument={instrument} readings={readings} thresholds={thresholds} />;
<InstrumentMap center={[-70.31, -27.44]} zoom={14} instruments={instruments} />;
```

## Roadmap

### Fase 1

- Monorepo, core contracts, data module
- `PiezometerChart`, `InstrumentMap`
- React wrappers
- Vite playground
- Basic tests

### Fase 2

- Inclinometer profile
- Rainfall overlay
- Missing data markers
- Multi-instrument comparison
- Worker-based decimation

### Fase 3

- Advanced heatmaps: implemented with native MapLibre heatmap layers
- Contour layer: implemented for precalculated isolines
- Cross-section view: implemented as framework-agnostic SVG
- Borehole log: implemented as framework-agnostic SVG

### Fase 4

- Apache Arrow support: implemented through Arrow-compatible column vectors in `@catmap/data`
- Custom WebGL renderer: implemented as `WebGLPointRenderer` in `@catmap/charts`
- OffscreenCanvas: supported by `WebGLPointRenderer` and canvas export helpers
- Optional WebAssembly: supported as an optional WebGL point projector hook
- PNG/PDF export: implemented for canvas and SVG browser exports
