import { Layer, type LayerContext, type RenderContext } from "@catmap/core";
import type { ContourLayerOptions } from "../types";

export class ContourLayer extends Layer<ContourLayerOptions> {
  options: ContourLayerOptions = { lines: [] };

  prepare(options: ContourLayerOptions, _context: LayerContext): void {
    this.options = options;
  }

  render(_context: RenderContext): void {}
}
