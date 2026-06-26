export type InstrumentStatus = "normal" | "warning" | "critical" | "offline";

export interface GeoInstrument {
  id: string;
  name: string;
  type: "piezometer" | "inclinometer" | "settlement" | "other";
  longitude: number;
  latitude: number;
  status?: InstrumentStatus;
  latestValue?: number;
}

export interface InstrumentMapOptions {
  center: [number, number];
  zoom: number;
  basemap?: "osm";
}

export interface HeatmapPoint {
  id?: string;
  longitude: number;
  latitude: number;
  value: number;
}

export interface HeatmapLayerOptions {
  points: HeatmapPoint[];
  radius?: number;
  opacity?: number;
  maxValue?: number;
}

export interface ContourLine {
  id: string;
  value: number;
  coordinates: [number, number][];
  label?: string;
  color?: string;
  width?: number;
}

export interface ContourLayerOptions {
  lines: ContourLine[];
  width?: number;
  opacity?: number;
}
