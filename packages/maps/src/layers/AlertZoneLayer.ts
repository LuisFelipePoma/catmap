import { Layer, type LayerContext, type RenderContext } from "@catmap/core";

export class AlertZoneLayer extends Layer<unknown[]> {
  zones: unknown[] = [];

  prepare(data: unknown[], _context: LayerContext): void {
    this.zones = data;
  }

  render(_context: RenderContext): void {}
}
