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
    comparisonSeries
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
