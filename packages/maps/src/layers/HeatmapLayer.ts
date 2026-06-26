import { Layer, type LayerContext, type RenderContext } from "@catmap/core";
import type { HeatmapLayerOptions } from "../types";

export class HeatmapLayer extends Layer<HeatmapLayerOptions> {
  options: HeatmapLayerOptions = { points: [] };

  prepare(options: HeatmapLayerOptions, _context: LayerContext): void {
    this.options = options;
  }

  render(_context: RenderContext): void {}
}
