import { describe, expect, it } from "vitest";
import type { TimeSeriesChartAdapter, TimeSeriesChartSpec } from "@catmap/charts";
import { InclinometerProfile, PiezometerChart, RainfallResponseChart, SensorHealthChart } from "./index";

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

  it("creates missing markers only for missing piezometer readings", () => {
    const adapter = new FakeAdapter();
    const chart = new PiezometerChart(
      {} as HTMLElement,
      {
        instrument: { id: "PZ-001" },
        readings: [
          { timestamp: 1, waterLevel: 10 },
          { timestamp: 2, quality: "missing" },
          { timestamp: 3, waterLevel: 11 }
        ]
      },
      adapter
    );

    chart.updateData([
      { timestamp: 1, waterLevel: 10 },
      { timestamp: 2, quality: "missing" },
      { timestamp: 3, waterLevel: 11 }
    ]);

    expect(adapter.lastSpec?.markers).toHaveLength(1);
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

  it("transforms inclinometer campaigns into profile series", () => {
    const adapter = new FakeAdapter();
    const chart = new InclinometerProfile(
      {} as HTMLElement,
      {
        campaigns: [
          {
            id: "c1",
            label: "Campaign 1",
            timestamp: 1,
            readings: [
              { depth: 0, displacementX: 0 },
              { depth: 2, displacementX: 1 }
            ]
          }
        ]
      },
      adapter
    );

    chart.updateData([
      {
        id: "c1",
        label: "Campaign 1",
        timestamp: 1,
        readings: [
          { depth: 0, displacementX: 0 },
          { depth: 2, displacementX: 1 }
        ]
      }
    ]);

    expect(adapter.lastSpec?.xTime).toBe(false);
    expect(adapter.lastSpec?.invertY).toBe(true);
    expect(adapter.lastSpec?.series[0]?.data).toEqual([
      { timestamp: 0, value: 0 },
      { timestamp: 1, value: 2 }
    ]);
  });

  it("groups sensor health values by instrument index", () => {
    const adapter = new FakeAdapter();
    const chart = new SensorHealthChart(
      {} as HTMLElement,
      { readings: [{ instrumentId: "PZ-001", label: "PZ-001", uptime: 95, warning: 4, critical: 1 }] },
      adapter
    );

    chart.updateData([{ instrumentId: "PZ-001", label: "PZ-001", uptime: 95, warning: 4, critical: 1 }]);

    expect(adapter.lastSpec?.series).toHaveLength(3);
    expect(adapter.lastSpec?.series[0]?.data[0]).toEqual({ timestamp: 1, value: 95 });
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
