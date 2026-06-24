import type { GeoInstrument } from "@catmap/maps";
import type { PiezometerInstrument, PiezometerReading, TriggerLevel } from "@catmap/geotech";

const now = Date.now();
const hour = 60 * 60 * 1000;

export const instrument: PiezometerInstrument = {
  id: "PZ-001",
  name: "Piezometer PZ-001",
  groundElevation: 1240,
  tipElevation: 1198,
  location: { latitude: -27.44, longitude: -70.31 }
};

export const readings: PiezometerReading[] = Array.from({ length: 72 }, (_, index) => ({
  timestamp: now - (72 - index) * hour,
  waterLevel: 1210 + Math.sin(index / 6) * 1.8 + index * 0.015,
  porePressure: 85 + Math.cos(index / 8) * 6,
  quality: index > 58 ? "warning" : "valid"
}));

export const thresholds: TriggerLevel[] = [
  { value: 1211.5, label: "Warning", severity: "warning" },
  { value: 1213, label: "Critical", severity: "critical" }
];

export const instruments: GeoInstrument[] = [
  {
    id: "PZ-001",
    name: "Piezometer PZ-001",
    type: "piezometer",
    longitude: -70.31,
    latitude: -27.44,
    status: "warning",
    latestValue: 1211.2
  },
  {
    id: "INC-002",
    name: "Inclinometer INC-002",
    type: "inclinometer",
    longitude: -70.316,
    latitude: -27.438,
    status: "normal",
    latestValue: 3.2
  },
  {
    id: "SET-003",
    name: "Settlement SET-003",
    type: "settlement",
    longitude: -70.305,
    latitude: -27.445,
    status: "critical",
    latestValue: 18.5
  }
];
