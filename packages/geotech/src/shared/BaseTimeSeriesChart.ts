import { UPlotAdapter, type TimeSeriesChartAdapter, type TimeSeriesChartSpec } from "@catmap/charts";

export abstract class BaseTimeSeriesChart<TOptions extends object, TData> {
  protected readonly adapter: TimeSeriesChartAdapter;
  protected options: TOptions;

  protected constructor(
    container: HTMLElement,
    options: TOptions,
    spec: TimeSeriesChartSpec,
    adapter: TimeSeriesChartAdapter = new UPlotAdapter(spec)
  ) {
    this.options = options;
    this.adapter = adapter;
    this.adapter.init(container);
  }

  updateOptions(options: Partial<TOptions>): void {
    this.options = { ...this.options, ...options };
    this.adapter.update(this.toSpec(this.options));
  }

  resize(): void {
    this.adapter.resize();
  }

  resetViewport(): void {
    this.adapter.resetViewport();
  }

  destroy(): void {
    this.adapter.destroy();
  }

  get dataLength(): number {
    return this.adapter.dataLength;
  }

  abstract updateData(data: TData): void;
  protected abstract toSpec(options: TOptions): TimeSeriesChartSpec;
}
