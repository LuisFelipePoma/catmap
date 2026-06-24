import { Layer, type LayerContext, type RenderContext } from "@catmap/core";
import type { GeoInstrument } from "../types";

export class InstrumentLayer extends Layer<GeoInstrument[]> {
  instruments: GeoInstrument[] = [];

  prepare(data: GeoInstrument[], _context: LayerContext): void {
    this.instruments = data;
  }

  render(_context: RenderContext): void {}
}
