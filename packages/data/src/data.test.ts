import { describe, expect, it } from "vitest";
import { bucketAggregation, decimateTimeSeries, minMaxDecimation } from "./index";

describe("time series utilities", () => {
  it("decimates without exceeding maxPoints", () => {
    const points = Array.from({ length: 100 }, (_, index) => ({
      timestamp: index,
      value: index % 10
    }));

    const decimated = minMaxDecimation(points, 12);

    expect(decimated.length).toBeLessThanOrEqual(12);
    expect(decimated[0]?.timestamp).toBe(0);
  });

  it("aggregates by bucket average", () => {
    expect(
      bucketAggregation(
        [
          { timestamp: 0, value: 2 },
          { timestamp: 5, value: 4 },
          { timestamp: 12, value: 10 }
        ],
        10
      )
    ).toEqual([
      { timestamp: 0, value: 3 },
      { timestamp: 10, value: 10 }
    ]);
  });

  it("decimates through the async worker helper fallback", async () => {
    const points = Array.from({ length: 80 }, (_, index) => ({
      timestamp: index,
      value: index
    }));

    await expect(decimateTimeSeries(points, { maxPoints: 10, useWorker: true })).resolves.toHaveLength(10);
  });
});
