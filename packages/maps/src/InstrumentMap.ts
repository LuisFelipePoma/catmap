import { MapLibreAdapter } from "./adapters/MapLibreAdapter";
import type { ContourLayerOptions, GeoInstrument, HeatmapLayerOptions, InstrumentMapOptions } from "./types";

export class InstrumentMap {
  private readonly adapter: MapLibreAdapter;

  constructor(container: HTMLElement, options: InstrumentMapOptions) {
    this.adapter = new MapLibreAdapter(options);
    this.adapter.init(container);
  }

  addInstrumentLayer(options: { instruments: GeoInstrument[] }): void {
    this.adapter.setInstruments(options.instruments);
  }

  updateInstruments(instruments: GeoInstrument[]): void {
    this.adapter.setInstruments(instruments);
  }

  setHeatmap(options: HeatmapLayerOptions): void {
    this.adapter.setHeatmap(options);
  }

  clearHeatmap(): void {
    this.adapter.clearHeatmap();
  }

  setContours(options: ContourLayerOptions): void {
    this.adapter.setContours(options);
  }

  clearContours(): void {
    this.adapter.clearContours();
  }

  destroy(): void {
    this.adapter.destroy();
  }
}
