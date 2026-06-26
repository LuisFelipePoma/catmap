import { describe, expect, it } from "vitest";
import { toContourGeoJson, toHeatmapGeoJson } from "./geojson";
import { ContourLayer } from "./layers/ContourLayer";
import { HeatmapLayer } from "./layers/HeatmapLayer";

const context = { viewport: { width: 100, height: 100 } };

describe("map phase 3 layers", () => {
  it("converts heatmap points to finite GeoJSON features", () => {
    const geojson = toHeatmapGeoJson({
      points: [
        { id: "p1", longitude: -70.31, latitude: -27.44, value: 2 },
        { longitude: Number.NaN, latitude: -27.44, value: 5 }
      ]
    });

    expect(geojson.features).toHaveLength(1);
    expect(geojson.features[0]?.geometry.coordinates).toEqual([-70.31, -27.44]);
    expect(geojson.features[0]?.properties).toEqual({ id: "p1", value: 2 });
  });

  it("converts precalculated contours to finite line features", () => {
    const geojson = toContourGeoJson({
      lines: [
        {
          id: "c1",
          label: "1212 m",
          value: 1212,
          coordinates: [
            [-70.32, -27.45],
            [-70.31, -27.44],
            [Infinity, -27.43]
          ]
        }
      ]
    });

    expect(geojson.features).toHaveLength(1);
    expect(geojson.features[0]?.geometry.coordinates).toEqual([
      [-70.32, -27.45],
      [-70.31, -27.44]
    ]);
    expect(geojson.features[0]?.properties.label).toBe("1212 m");
  });

  it("updates and clears layer options", () => {
    const heatmap = new HeatmapLayer({ id: "heatmap" });
    const contours = new ContourLayer({ id: "contours" });

    heatmap.prepare({ points: [{ longitude: -70.31, latitude: -27.44, value: 1 }] }, context);
    contours.prepare(
      { lines: [{ id: "c1", value: 10, coordinates: [[-70.31, -27.44], [-70.3, -27.43]] }] },
      context
    );

    expect(heatmap.options.points).toHaveLength(1);
    expect(contours.options.lines).toHaveLength(1);

    heatmap.prepare({ points: [] }, context);
    contours.prepare({ lines: [] }, context);

    expect(heatmap.options.points).toHaveLength(0);
    expect(contours.options.lines).toHaveLength(0);
  });
});
