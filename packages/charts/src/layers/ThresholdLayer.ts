import { Layer, type LayerContext, type RenderContext } from "@catmap/core";

export interface Threshold {
  value: number;
  label: string;
  severity: "info" | "warning" | "critical";
}

export class ThresholdLayer extends Layer<Threshold[]> {
  thresholds: Threshold[] = [];

  prepare(data: Threshold[], _context: LayerContext): void {
    this.thresholds = data;
  }

  render(_context: RenderContext): void {}
}
