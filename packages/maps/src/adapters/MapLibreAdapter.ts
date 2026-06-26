import type { RendererAdapter } from "@catmap/core";
import maplibregl, { Marker, type Map as MapLibreMap } from "maplibre-gl";
import { heatmapMaxValue, toContourGeoJson, toHeatmapGeoJson } from "../geojson";
import type { ContourLayerOptions, GeoInstrument, HeatmapLayerOptions, InstrumentMapOptions, InstrumentStatus } from "../types";

const heatmapSourceId = "catmap-heatmap-source";
const heatmapLayerId = "catmap-heatmap-layer";
const contourSourceId = "catmap-contour-source";
const contourLayerId = "catmap-contour-layer";

export class MapLibreAdapter implements RendererAdapter {
  private map: MapLibreMap | undefined;
  private readonly markers: Marker[] = [];
  private ready = false;
  private heatmap: HeatmapLayerOptions | undefined;
  private contours: ContourLayerOptions | undefined;

  constructor(private readonly options: InstrumentMapOptions) {}

  init(container: HTMLElement): void {
    this.map = new maplibregl.Map({
      container,
      center: this.options.center,
      zoom: this.options.zoom,
      style: {
        version: 8,
        sources: {
          osm: {
            type: "raster",
            tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
            tileSize: 256,
            attribution: "OpenStreetMap"
          }
        },
        layers: [{ id: "osm", type: "raster", source: "osm" }]
      }
    });
    this.map.on("load", () => {
      this.ready = true;
      this.applyHeatmap();
      this.applyContours();
    });
  }

  setInstruments(instruments: readonly GeoInstrument[]): void {
    if (!this.map) return;
    this.markers.splice(0).forEach((marker) => marker.remove());

    for (const instrument of instruments) {
      this.markers.push(
        new maplibregl.Marker({ color: colorForStatus(instrument.status) })
          .setLngLat([instrument.longitude, instrument.latitude])
          .setPopup(new maplibregl.Popup().setText(instrument.name))
          .addTo(this.map)
      );
    }
  }

  setHeatmap(options: HeatmapLayerOptions): void {
    this.heatmap = options;
    this.applyHeatmap();
  }

  clearHeatmap(): void {
    this.heatmap = undefined;
    this.removeLayerAndSource(heatmapLayerId, heatmapSourceId);
  }

  setContours(options: ContourLayerOptions): void {
    this.contours = options;
    this.applyContours();
  }

  clearContours(): void {
    this.contours = undefined;
    this.removeLayerAndSource(contourLayerId, contourSourceId);
  }

  render(): void {}

  resize(): void {
    this.map?.resize();
  }

  destroy(): void {
    this.clearHeatmap();
    this.clearContours();
    this.markers.splice(0).forEach((marker) => marker.remove());
    this.map?.remove();
    this.map = undefined;
    this.ready = false;
  }

  private applyHeatmap(): void {
    if (!this.map || !this.ready || !this.heatmap) return;
    setGeoJsonData(this.map, heatmapSourceId, toHeatmapGeoJson(this.heatmap));
    if (!this.map.getLayer(heatmapLayerId)) {
      this.map.addLayer({
        id: heatmapLayerId,
        type: "heatmap",
        source: heatmapSourceId,
        paint: heatmapPaint(this.heatmap)
      } as Parameters<MapLibreMap["addLayer"]>[0]);
      return;
    }
    setPaint(this.map, heatmapLayerId, heatmapPaint(this.heatmap));
  }

  private applyContours(): void {
    if (!this.map || !this.ready || !this.contours) return;
    setGeoJsonData(this.map, contourSourceId, toContourGeoJson(this.contours));
    if (!this.map.getLayer(contourLayerId)) {
      this.map.addLayer({
        id: contourLayerId,
        type: "line",
        source: contourSourceId,
        paint: contourPaint(this.contours)
      } as Parameters<MapLibreMap["addLayer"]>[0]);
      return;
    }
    setPaint(this.map, contourLayerId, contourPaint(this.contours));
  }

  private removeLayerAndSource(layerId: string, sourceId: string): void {
    if (!this.map || !this.ready) return;
    if (this.map.getLayer(layerId)) this.map.removeLayer(layerId);
    if (this.map.getSource(sourceId)) this.map.removeSource(sourceId);
  }
}

function setGeoJsonData(map: MapLibreMap, sourceId: string, data: unknown): void {
  const source = map.getSource(sourceId) as { setData(data: unknown): void } | undefined;
  if (source) {
    source.setData(data);
    return;
  }
  map.addSource(sourceId, { type: "geojson", data } as Parameters<MapLibreMap["addSource"]>[1]);
}

function setPaint(map: MapLibreMap, layerId: string, paint: Record<string, unknown>): void {
  for (const [name, value] of Object.entries(paint)) map.setPaintProperty(layerId, name, value);
}

function heatmapPaint(options: HeatmapLayerOptions): Record<string, unknown> {
  return {
    "heatmap-weight": ["interpolate", ["linear"], ["get", "value"], 0, 0, heatmapMaxValue(options), 1],
    "heatmap-radius": options.radius ?? 28,
    "heatmap-opacity": options.opacity ?? 0.7,
    "heatmap-color": [
      "interpolate",
      ["linear"],
      ["heatmap-density"],
      0,
      "rgba(37,99,235,0)",
      0.3,
      "#22c55e",
      0.65,
      "#f59e0b",
      1,
      "#dc2626"
    ]
  };
}

function contourPaint(options: ContourLayerOptions): Record<string, unknown> {
  return {
    "line-color": ["coalesce", ["get", "color"], "#2563eb"],
    "line-width": ["coalesce", ["get", "width"], options.width ?? 2],
    "line-opacity": options.opacity ?? 0.8
  };
}

function colorForStatus(status: InstrumentStatus = "normal"): string {
  return {
    normal: "#16a34a",
    warning: "#f59e0b",
    critical: "#dc2626",
    offline: "#64748b"
  }[status];
}
