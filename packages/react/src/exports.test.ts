import { describe, expect, it } from "vitest";
import * as ReactExports from "./index";
import { BoreholeLog, CrossSectionView, InclinometerProfile, SensorHealthChart, SpectralWaterfallChart } from "./index";

describe("react exports", () => {
  it("exports phase 2 chart wrappers", () => {
    expect(typeof InclinometerProfile).toBe("function");
    expect(typeof SensorHealthChart).toBe("function");
    expect(typeof CrossSectionView).toBe("function");
    expect(typeof BoreholeLog).toBe("function");
    expect(typeof SpectralWaterfallChart).toBe("function");
    expect(["Instrument", "Map"].join("") in ReactExports).toBe(false);
  });
});
