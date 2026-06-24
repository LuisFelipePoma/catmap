import { MapLibreAdapter } from "./adapters/MapLibreAdapter";
import type { GeoInstrument, InstrumentMapOptions } from "./types";

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

  destroy(): void {
    this.adapter.destroy();
  }
}
