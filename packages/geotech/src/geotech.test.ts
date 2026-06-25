import { describe, expect, it } from "vitest";
import type { TimeSeriesChartAdapter, TimeSeriesChartSpec } from "@catmap/charts";
import { PiezometerChart, RainfallResponseChart } from "./index";

describe("geotech charts", () => {
  it("updates PiezometerChart data without replacing the adapter", () => {
    const adapter = new FakeAdapter();
    const chart = new PiezometerChart(
      {} as HTMLElement,
      {
        instrument: { id: "PZ-001" },
        readings: [{ timestamp: 1, waterLevel: 10 }]
      },
      adapter
    );

    chart.updateData([
      { timestamp: 1, waterLevel: 10 },
      { timestamp: 2, waterLevel: 11 }
    ]);

    expect(adapter.initCount).toBe(1);
    expect(adapter.updateCount).toBe(1);
    expect(adapter.lastSpec?.series[0]?.data).toHaveLength(2);
  });

  it("builds RainfallResponseChart with rainfall bars and response line", () => {
    const adapter = new FakeAdapter();

    const chart = new RainfallResponseChart(
      {} as HTMLElement,
      {
        rainfall: [{ timestamp: 1, rainfall: 12 }],
        readings: [{ timestamp: 1, waterLevel: 10 }]
      },
      adapter
    );
    chart.updateData({
      rainfall: [{ timestamp: 1, rainfall: 12 }],
      readings: [{ timestamp: 1, waterLevel: 10 }]
    });

    expect(adapter.seriesKinds).toEqual(["bar", "line"]);
  });
});

class FakeAdapter implements TimeSeriesChartAdapter {
  initCount = 0;
  updateCount = 0;
  lastSpec: TimeSeriesChartSpec | undefined;

  constructor(private spec?: TimeSeriesChartSpec) {}

  get dataLength(): number {
    return this.lastSpec?.series[0]?.data.length ?? this.spec?.series[0]?.data.length ?? 0;
  }

  get seriesKinds() {
    return (this.lastSpec ?? this.spec)?.series.map((series) => series.kind ?? "line") ?? [];
  }

  init(_container: HTMLElement): void {
    this.initCount += 1;
  }

  update(spec: TimeSeriesChartSpec): void {
    this.updateCount += 1;
    this.lastSpec = spec;
  }

  render(): void {}
  resize(): void {}
  destroy(): void {}
}
