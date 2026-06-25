import { createGeotechMonitoringMockData } from "@catmap/data";
import type {
  InclinometerCampaign,
  GeotechSeries,
  PiezometerInstrument,
  PiezometerReading,
  RainfallReading,
  SensorHealthReading,
  SettlementInstrument,
  SettlementReading,
  TriggerLevel
} from "@catmap/geotech";
import type { GeoInstrument } from "@catmap/maps";

const mock = createGeotechMonitoringMockData();

export const piezometerInstrument: PiezometerInstrument = mock.piezometerInstrument;
export const piezometerReadings: PiezometerReading[] = mock.piezometerReadings;
export const piezometerThresholds: TriggerLevel[] = mock.piezometerThresholds;
export const rainfall: RainfallReading[] = mock.rainfall;
export const settlementInstrument: SettlementInstrument = mock.settlementInstrument;
export const settlementReadings: SettlementReading[] = mock.settlementReadings;
export const settlementThresholds: TriggerLevel[] = mock.settlementThresholds;
export const comparisonSeries: GeotechSeries[] = mock.comparisonSeries;
export const inclinometerCampaigns: InclinometerCampaign[] = mock.inclinometerCampaigns;
export const sensorHealth: SensorHealthReading[] = mock.sensorHealth;
export const largeTimeSeries = mock.largeTimeSeries;

export const instruments: GeoInstrument[] = [
  {
    id: "PZ-001",
    name: "Piezometer PZ-001",
    type: "piezometer",
    longitude: -70.31,
    latitude: -27.44,
    status: "warning",
    latestValue: 1212.2
  },
  {
    id: "PZ-002",
    name: "Piezometer PZ-002",
    type: "piezometer",
    longitude: -70.316,
    latitude: -27.438,
    status: "normal",
    latestValue: 1211.7
  },
  {
    id: "SM-014",
    name: "Settlement marker SM-014",
    type: "settlement",
    longitude: -70.305,
    latitude: -27.445,
    status: "critical",
    latestValue: 14.7
  }
];
