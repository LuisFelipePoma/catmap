import type { RendererAdapter } from "@catmap/core";
import uPlot from "uplot";

export type ChartValue = number | null;
export type UPlotData = [number[], ...ChartValue[][]];
export type UPlotOptions = uPlot.Options;
export type UPlotInstance = uPlot;

export class UPlotAdapter implements RendererAdapter {
  private chart: uPlot | undefined;
  private container: HTMLElement | undefined;

  constructor(
    private options: uPlot.Options,
    private data: UPlotData
  ) {}

  init(container: HTMLElement): void {
    this.container = container;
    this.chart = new uPlot(this.options, this.data, container);
  }

  setData(data: UPlotData): void {
    this.data = data;
    this.chart?.setData(data);
  }

  render(): void {
    this.chart?.redraw();
  }

  resize(width: number, height: number): void {
    this.options = { ...this.options, width, height };
    this.chart?.setSize({ width, height });
  }

  destroy(): void {
    this.chart?.destroy();
    this.chart = undefined;
    this.container = undefined;
  }
}
