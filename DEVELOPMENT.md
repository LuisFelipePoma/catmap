# Development Notes

This document tracks what has been implemented in `catmap`, what was deliberately kept small, and what should happen next. The public-facing usage guide is in [README.md](./README.md).

## Current Status

`catmap` is a TypeScript pnpm workspace for geotechnical visualization. The current implementation covers the original roadmap plus the spectral waterfall extension:

- Core package contracts and package boundaries
- Geotechnical charts and React wrappers
- MapLibre instrument maps with heatmaps and contours
- Cross-section and borehole SVG views
- Arrow-compatible column loading
- WebGL point rendering with OffscreenCanvas support
- Canvas 2D spectral waterfall rendering
- Browser PNG/PDF export helpers

## Completed Phases

### Phase 1: Foundation

Completed:

- Monorepo with `packages/*` and `apps/*`.
- Framework-agnostic `@catmap/core` contracts for charts, layers, renderers, events, plugins, and data sources.
- `@catmap/data` time-series types, in-memory data source, min/max decimation, and bucket aggregation.
- Initial `PiezometerChart` and `InstrumentMap`.
- React wrappers in `@catmap/react`.
- Vite playground with mock geotechnical data.
- Baseline Vitest coverage.

### Phase 2: Operational Charts

Completed:

- Inclinometer profile chart.
- Rainfall response chart.
- Missing-data markers.
- Multi-instrument comparison chart.
- Settlement and sensor-health chart surfaces.
- Async decimation helper with worker-style fallback behavior.

Deliberate simplification:

- Worker decimation currently falls back to the same TypeScript algorithm path. Add a real worker only when main-thread decimation becomes a measured bottleneck.

### Phase 3: Geotechnical Views And Advanced Maps

Completed:

- Native MapLibre heatmap support from `{ longitude, latitude, value }` points.
- Precalculated contour isolines rendered as MapLibre line layers.
- `CrossSectionView` as framework-agnostic SVG.
- `BoreholeLog` as framework-agnostic SVG.
- React wrappers for cross-sections and borehole logs.
- Mock data and playground examples for phase 3 views.

Deliberate simplification:

- Contours are not generated in the browser. Consumers pass isolines that were calculated upstream.
- Cross-sections and borehole logs use SVG string rendering instead of a new rendering framework.

### Phase 4: Data And Export Hardening

Completed:

- Arrow-compatible column loading through `timeSeriesFromArrow()`.
- `WebGLPointRenderer` for large point clouds.
- Optional OffscreenCanvas support in the WebGL renderer.
- Optional `WebGLPointProjector` hook for future WASM-backed projection.
- Browser export helpers for canvas/SVG to PNG/PDF.

Deliberate simplification:

- No Arrow IPC parser is bundled. Parse Arrow files upstream and pass an Arrow-compatible table.
- No WASM module is bundled. The WebGL renderer accepts an optional projector hook for future use.
- PDF export is intentionally browser-oriented and minimal. Use a dedicated server-side export pipeline for reporting workflows that require pagination, fonts, headers, or compliance controls.

### Phase 5: Spectral Waterfall Chart

Completed:

- `SpectralWaterfallChart` in `@catmap/charts`.
- Canvas 2D waterfall view with shifted spectra.
- Hover, click, and drag selection.
- Selected-spectrum and cross-section slice panels.
- React wrapper and playground example.
- Synthetic spectral mock data.

Deliberate simplification:

- The first version uses Canvas 2D instead of SciChart, WebGL line rendering, workers, or WebGPU. Add those only after benchmarked spectra sizes exceed this path.

## Package Boundaries

- `@catmap/core`: shared contracts only. No React, MapLibre, uPlot, browser file parsers, or renderer-specific code.
- `@catmap/data`: data structures, mock data, aggregation, decimation, Arrow-compatible table adapters.
- `@catmap/charts`: chart renderers, spectral waterfall chart, chart layer helpers, WebGL point renderer, canvas/SVG export utilities.
- `@catmap/maps`: MapLibre/deck.gl adapters, map layers, instrument map APIs, GeoJSON conversion.
- `@catmap/geotech`: geotechnical chart/view APIs and domain types.
- `@catmap/react`: React wrappers only.
- `apps/playground`: demo, smoke testing, visual QA, and mock scenarios.

## Verification Commands

Run these before merging or publishing:

```bash
pnpm typecheck
pnpm test
pnpm build
pnpm lint
```

Known note: `pnpm --filter playground build` may warn about a large bundle because the playground pulls MapLibre, uPlot, React, and the demo data into one app. That is acceptable for the playground until a deployed demo needs code splitting.

## Future Work

### Release Hardening

- Run `pnpm lint` once the local environment allows it.
- Run `pnpm -r build` and inspect generated package declarations.
- Confirm package `exports` are correct after build.
- Add README API examples for each exported geotechnical view.
- Decide whether the repository stays private or each `@catmap/*` package gets publishing metadata.

### Data Scale

- Add a real Web Worker for decimation only after benchmarks show main-thread cost.
- Add Arrow IPC parsing only if the library itself must own file ingestion.
- Add chunked/tiled data sources for very large monitoring datasets.
- Add viewport-aware filtering for map and chart data.

### Rendering

- Add WebGPU only after WebGL/uPlot paths are benchmarked and shown insufficient.
- Add WASM projection/decimation only behind the existing hook-style API.
- Add renderer benchmarks in the playground or a dedicated benchmark app.
- Add visual regression smoke tests for charts, spectral waterfalls, maps, cross-sections, and borehole logs.

### Exports And Reporting

- Add branded report templates only when there is a concrete reporting workflow.
- Add server-side PDF/image export through a browser renderer or a dedicated report service.
- Add multi-page report composition separately from low-level canvas/SVG export helpers.

### Framework Wrappers

- Add Vue or Svelte wrappers only after there is a real consuming application.
- Keep wrapper packages thin; domain behavior belongs in `@catmap/geotech` and renderers belong in `@catmap/charts` or `@catmap/maps`.

## Known Limitations

- The playground is a demo, not an optimized production application.
- Map contours must be supplied by the caller as precalculated isolines.
- Browser export helpers do not replace a full reporting engine.
- Arrow support expects an Arrow-compatible table object, not a raw file buffer.
- WebGL support is intentionally minimal and focused on point rendering.
- Spectral waterfalls use Canvas 2D; SciChart-level WebGL throughput is intentionally out of scope until measured.
