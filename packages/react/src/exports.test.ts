import { describe, expect, it } from "vitest";
import { BoreholeLog, CrossSectionView, InclinometerProfile, SensorHealthChart } from "./index";

describe("react exports", () => {
  it("exports phase 2 chart wrappers", () => {
    expect(typeof InclinometerProfile).toBe("function");
    expect(typeof SensorHealthChart).toBe("function");
    expect(typeof CrossSectionView).toBe("function");
    expect(typeof BoreholeLog).toBe("function");
  });
});
