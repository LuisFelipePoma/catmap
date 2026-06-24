import { Layer, type LayerContext, type RenderContext } from "@catmap/core";
import type { TimeSeriesPoint } from "@catmap/data";

export class TimeSeriesLayer extends Layer<TimeSeriesPoint[]> {
  data: TimeSeriesPoint[] = [];

  prepare(data: TimeSeriesPoint[], _context: LayerContext): void {
    this.data = data;
  }

  render(_context: RenderContext): void {}
}
