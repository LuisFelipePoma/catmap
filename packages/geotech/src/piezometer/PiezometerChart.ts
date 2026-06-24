import { Chart } from "@catmap/core";
import { UPlotAdapter, type UPlotData, type UPlotInstance, type UPlotOptions } from "@catmap/charts";
import type { PiezometerChartOptions, PiezometerReading } from "./types";

export class PiezometerChart extends Chart {
  private readonly adapter: UPlotAdapter;
  private options: PiezometerChartOptions;

  constructor(container: HTMLElement, options: PiezometerChartOptions) {
    const adapter = new UPlotAdapter(createOptions(container, options), toData(options.readings, options));
    super(container, adapter);
    this.adapter = adapter;
    this.options = options;
  }

  updateData(readings: PiezometerReading[]): void {
    this.options = { ...this.options, readings };
    this.adapter.setData(toData(readings, this.options));
    this.adapter.render();
  }
}

function toData(readings: PiezometerReading[], options: PiezometerChartOptions): UPlotData {
  const yAxis = options.yAxis ?? "waterLevel";
  return [
    readings.map((reading) => reading.timestamp / 1000),
    readings.map((reading) => {
      const value = reading[yAxis];
      if (value === undefined && options.showMissingData === false) return null;
      return value ?? null;
    })
  ];
}

function createOptions(container: HTMLElement, options: PiezometerChartOptions): UPlotOptions {
  const yAxis = options.yAxis ?? "waterLevel";

  return {
    title: options.instrument.name ?? options.instrument.id,
    width: Math.max(container.clientWidth, 320),
    height: Math.max(container.clientHeight, 240),
    scales: {
      x: { time: true }
    },
    axes: [{}, { label: yAxis }],
    series: [{ label: "Time" }, { label: yAxis, stroke: "#2563eb", width: 2 }],
    hooks: {
      draw: [
        (chart: UPlotInstance) => {
          if (options.showThresholds === false) return;
          const ctx = chart.ctx;
          const left = chart.bbox.left / devicePixelRatio;
          const top = chart.bbox.top / devicePixelRatio;
          const width = chart.bbox.width / devicePixelRatio;

          for (const threshold of options.thresholds ?? []) {
            const y = chart.valToPos(threshold.value, "y", true);
            ctx.save();
            ctx.strokeStyle = threshold.severity === "critical" ? "#dc2626" : "#f59e0b";
            ctx.setLineDash([4, 4]);
            ctx.beginPath();
            ctx.moveTo(left, top + y);
            ctx.lineTo(left + width, top + y);
            ctx.stroke();
            ctx.restore();
          }
        }
      ]
    }
  };
}
