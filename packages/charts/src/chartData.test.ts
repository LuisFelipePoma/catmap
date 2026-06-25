import { describe, expect, it } from "vitest";
import { toUPlotData, type TimeSeriesChartSpec } from "./index";

describe("time series chart data", () => {
  it("decimates without exceeding maxPoints", () => {
    const spec: TimeSeriesChartSpec = {
      series: [
        {
          id: "pore-pressure",
          label: "Pore pressure",
          color: "#2563eb",
          data: Array.from({ length: 500 }, (_, index) => ({
            timestamp: index,
            value: Math.sin(index / 10)
          }))
        }
      ]
    };

    expect(toUPlotData(spec, 40)[0]).toHaveLength(40);
  });

  it("preserves missing data as chart gaps", () => {
    const spec: TimeSeriesChartSpec = {
      series: [
        {
          id: "water-level",
          label: "Water level",
          color: "#2563eb",
          data: [
            { timestamp: 1, value: 10 },
            { timestamp: 2, value: null },
            { timestamp: 3, value: 11 }
          ]
        }
      ]
    };

    expect(toUPlotData(spec, 10)[1]).toEqual([10, null, 11]);
  });

  it("adds marker series to chart data", () => {
    const spec: TimeSeriesChartSpec = {
      markers: [{ id: "missing-1", label: "Missing", timestamp: 2, value: 10, color: "#dc2626" }],
      series: [
        {
          id: "water-level",
          label: "Water level",
          color: "#2563eb",
          data: [
            { timestamp: 1, value: 10 },
            { timestamp: 3, value: 11 }
          ]
        }
      ]
    };

    expect(toUPlotData(spec, 10)[2]).toEqual([null, 10, null]);
  });
});
