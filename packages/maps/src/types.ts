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
