import { describe, expect, it } from "vitest";
import { InclinometerProfile, SensorHealthChart } from "./index";

describe("react exports", () => {
  it("exports phase 2 chart wrappers", () => {
    expect(typeof InclinometerProfile).toBe("function");
    expect(typeof SensorHealthChart).toBe("function");
  });
});
