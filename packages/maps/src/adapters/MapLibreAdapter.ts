import type { RendererAdapter } from "@catmap/core";
import maplibregl, { Marker, type Map as MapLibreMap } from "maplibre-gl";
import type { GeoInstrument, InstrumentMapOptions, InstrumentStatus } from "../types";

export class MapLibreAdapter implements RendererAdapter {
  private map: MapLibreMap | undefined;
  private readonly markers: Marker[] = [];

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

  render(): void {}

  resize(): void {
    this.map?.resize();
  }

  destroy(): void {
    this.markers.splice(0).forEach((marker) => marker.remove());
    this.map?.remove();
    this.map = undefined;
  }
}

function colorForStatus(status: InstrumentStatus = "normal"): string {
  return {
    normal: "#16a34a",
    warning: "#f59e0b",
    critical: "#dc2626",
    offline: "#64748b"
  }[status];
}
