import { createGeotechMonitoringMockData } from "@catmap/data";
import type { WaterfallSpectrum } from "@catmap/charts";
import type {
  BoreholeInterval,
  CrossSectionInstrument,
  CrossSectionSeries,
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
export const crossSectionSeries: CrossSectionSeries[] = mock.crossSectionSeries;
export const crossSectionInstruments: CrossSectionInstrument[] = mock.crossSectionInstruments;
export const boreholeIntervals: BoreholeInterval[] = mock.boreholeIntervals;
export const largeTimeSeries = mock.largeTimeSeries;
export const spectralX: number[] = mock.spectralX;
export const spectralSpectra: WaterfallSpectrum[] = mock.spectralSpectra;

export interface SpectralPerformanceData {
  x: Float32Array;
  spectra: WaterfallSpectrum[];
  vertexCount: number;
}

export function createSpectralPerformanceData(spectrumCount = 500, pointCount = 10_000): SpectralPerformanceData {
  const x = Float32Array.from({ length: pointCount }, (_item, index) => index);
  const spectra = Array.from({ length: spectrumCount }, (_item, spectrumIndex) => {
    const drift = Math.sin(spectrumIndex / 16) * 140;
    const values = Float32Array.from(x, (value) =>
      round(
        -36 +
          spectralPulse(value, 900 + drift, 110, 46) +
          spectralPulse(value, 3_200 - drift * 0.35, 180, 38) +
          spectralPulse(value, 6_700 + Math.cos(spectrumIndex / 20) * 260, 300, 62) +
          Math.sin(value / 38 + spectrumIndex / 9) * 1.8 +
          Math.sin(spectrumIndex / 12) * 5,
        2
      )
    );
    values[2_000 + (spectrumIndex % 80)] = Number.NaN;
    values[5_400 + (spectrumIndex % 120)] = Number.NaN;
    return { id: `perf-${spectrumIndex + 1}`, label: `Perf ${spectrumIndex + 1}`, values };
  });

  return { x, spectra, vertexCount: spectrumCount * pointCount };
}

function spectralPulse(index: number, center: number, width: number, height: number): number {
  return Math.max(0, height * (1 - Math.abs(index - center) / width));
}

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}
