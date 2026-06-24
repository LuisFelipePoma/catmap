import { Layer, type LayerContext, type RenderContext } from "@catmap/core";

export class HeatmapLayer extends Layer<unknown[]> {
  data: unknown[] = [];

  prepare(data: unknown[], _context: LayerContext): void {
    this.data = data;
  }

  render(_context: RenderContext): void {}
}
