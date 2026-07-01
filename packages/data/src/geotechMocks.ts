const day = 24 * 60 * 60 * 1000;
const start = Date.UTC(2026, 0, 1);

export function createGeotechMonitoringMockData() {
  const rainfall = Array.from({ length: 120 }, (_, index) => {
    const storm =
      pulse(index, 28, 7, 18) + pulse(index, 64, 10, 32) + pulse(index, 96, 6, 24);
    return {
      timestamp: start + index * day,
      rainfall: round(Math.max(0, storm + Math.sin(index / 5) * 1.5))
    };
  });

  const piezometerReadings = rainfall.map((reading, index) => {
    const response =
      1210 +
      index * 0.008 +
      delayedRain(rainfall, index, 3, 0.025) +
      Math.sin(index / 9) * 0.25;
    return {
      timestamp: reading.timestamp,
      ...(index === 73 ? {} : { waterLevel: round(response, 3) }),
      porePressure: round(82 + (response - 1210) * 7.5, 2),
      elevation: round(response + 1.8, 3),
      quality: index === 73 ? ("missing" as const) : response > 1212.1 ? ("warning" as const) : ("valid" as const)
    };
  });

  const settlementReadings = Array.from({ length: 120 }, (_, index) => ({
    timestamp: start + index * day,
    ...(index === 54 ? {} : { settlement: round(index * 0.11 + Math.max(0, index - 70) * 0.045, 2) }),
    quality: index === 54 ? ("missing" as const) : index > 92 ? ("warning" as const) : ("valid" as const)
  }));

  const comparisonSeries = ["PZ-001", "PZ-002", "PZ-003"].map((id, seriesIndex) => ({
    id,
    label: id,
    unit: "m",
    readings: piezometerReadings.map((reading, index) => ({
      timestamp: reading.timestamp,
      ...(reading.waterLevel === undefined
        ? {}
        : {
            value: round(
              reading.waterLevel + seriesIndex * 0.35 + Math.sin(index / (7 + seriesIndex)) * 0.18,
              3
            )
          }),
      quality: reading.quality
    }))
  }));

  const inclinometerCampaigns = [20, 55, 95].map((offset, campaignIndex) => ({
    id: `campaign-${campaignIndex + 1}`,
    label: `Campaign ${campaignIndex + 1}`,
    timestamp: start + offset * day,
    readings: Array.from({ length: 26 }, (_, index) => {
      const depth = index * 2;
      const displacement = Math.sin(depth / 8) * (2 + campaignIndex * 1.4) + campaignIndex * depth * 0.06;
      return {
        depth,
        displacementX: round(displacement, 2),
        displacementY: round(Math.cos(depth / 10) * (1 + campaignIndex * 0.7), 2),
        quality: index === 11 && campaignIndex === 1 ? ("missing" as const) : ("valid" as const)
      };
    })
  }));

  const sensorHealth = [
    { instrumentId: "PZ-001", label: "PZ-001", uptime: 97, warning: 2, critical: 1 },
    { instrumentId: "PZ-002", label: "PZ-002", uptime: 91, warning: 7, critical: 2 },
    { instrumentId: "SM-014", label: "SM-014", uptime: 88, warning: 8, critical: 4 },
    { instrumentId: "INC-004", label: "INC-004", uptime: 94, warning: 4, critical: 2 }
  ];

  const crossSectionSeries = [
    {
      id: "ground",
      label: "Ground surface",
      color: "#111827",
      points: Array.from({ length: 8 }, (_, index) => ({
        distance: index * 40,
        elevation: round(1240 - index * 1.6 + Math.sin(index / 1.5) * 2, 2)
      }))
    },
    {
      id: "water",
      label: "Piezometric level",
      color: "#2563eb",
      points: Array.from({ length: 8 }, (_, index) => ({
        distance: index * 40,
        elevation: round(1215 - index * 0.9 + Math.cos(index / 1.8) * 1.2, 2)
      }))
    }
  ];

  const crossSectionInstruments = [
    { id: "PZ-001", label: "PZ-001", distance: 60, elevation: 1238, depth: 42 },
    { id: "PZ-002", label: "PZ-002", distance: 170, elevation: 1232, depth: 38 },
    { id: "SM-014", label: "SM-014", distance: 250, elevation: 1228, depth: 2 }
  ];

  const boreholeIntervals = [
    { from: 0, to: 4, label: "Fill", color: "#d6d3d1" },
    { from: 4, to: 12, label: "Silty sand", color: "#fde68a" },
    { from: 12, to: 24, label: "Weathered rock", color: "#bfdbfe" },
    { from: 24, to: 42, label: "Andesite", color: "#c4b5fd" }
  ];

  const largeTimeSeries = Array.from({ length: 20000 }, (_, index) => ({
    timestamp: start + index * 60 * 1000,
    value: round(1210 + Math.sin(index / 90) * 2 + Math.sin(index / 11) * 0.25, 3)
  }));

  const spectralX = Array.from({ length: 320 }, (_, index) => index);
  const spectralSpectra = Array.from({ length: 48 }, (_, spectrumIndex) => {
    const drift = Math.sin(spectrumIndex / 7) * 10;
    const values = Float32Array.from(spectralX, (x) =>
      round(
        -32 +
          pulse(x, 48 + drift, 10, 42) +
          pulse(x, 112 - drift * 0.4, 8, 34) +
          pulse(x, 214 + Math.cos(spectrumIndex / 5) * 12, 18, 56) +
          Math.sin(x / 7 + spectrumIndex / 3) * 1.8 +
          Math.sin(spectrumIndex / 4) * 4,
        2
      )
    );
    values[80 + (spectrumIndex % 6)] = Number.NaN;
    return {
      id: `spectra-${spectrumIndex + 1}`,
      label: `Spectra ${spectrumIndex + 1}`,
      values,
      ...(spectrumIndex % 12 === 0 ? { color: "#ff7a1a" } : {})
    };
  });

  return {
    piezometerInstrument: {
      id: "PZ-001",
      name: "Piezometer PZ-001",
      groundElevation: 1240,
      tipElevation: 1198,
      location: { latitude: -27.44, longitude: -70.31 }
    },
    piezometerReadings,
    piezometerThresholds: [
      { value: 1211.6, label: "Alert", severity: "warning" as const },
      { value: 1212.6, label: "Action", severity: "critical" as const }
    ],
    rainfall,
    settlementInstrument: {
      id: "SM-014",
      name: "Settlement marker SM-014",
      location: { latitude: -27.445, longitude: -70.305 }
    },
    settlementReadings,
    settlementThresholds: [
      { value: 10, label: "Review", severity: "warning" as const },
      { value: 14, label: "Action", severity: "critical" as const }
    ],
    comparisonSeries,
    inclinometerCampaigns,
    sensorHealth,
    crossSectionSeries,
    crossSectionInstruments,
    boreholeIntervals,
    largeTimeSeries,
    spectralX,
    spectralSpectra
  };
}

function pulse(index: number, center: number, width: number, height: number): number {
  return Math.max(0, height * (1 - Math.abs(index - center) / width));
}

function delayedRain(
  rainfall: readonly { rainfall?: number }[],
  index: number,
  lagDays: number,
  factor: number
): number {
  let response = 0;
  for (let lag = 0; lag <= lagDays; lag += 1) {
    response += (rainfall[index - lag]?.rainfall ?? 0) * factor * (1 - lag / (lagDays + 1));
  }
  return response;
}

function round(value: number, decimals = 1): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}
