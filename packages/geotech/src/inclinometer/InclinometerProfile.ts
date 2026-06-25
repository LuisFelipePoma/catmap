import type { ChartPoint, TimeSeriesChartAdapter, TimeSeriesChartSpec } from "@catmap/charts";
import { BaseTimeSeriesChart } from "../shared/BaseTimeSeriesChart";
import type { InclinometerCampaign, InclinometerProfileOptions } from "./types";

const colors = ["#2563eb", "#16a34a", "#7c3aed", "#dc2626"];

export class InclinometerProfile extends BaseTimeSeriesChart<
  InclinometerProfileOptions,
  InclinometerCampaign[]
> {
  constructor(
    container: HTMLElement,
    options: InclinometerProfileOptions,
    adapter?: TimeSeriesChartAdapter
  ) {
    super(container, options, toInclinometerSpec(options), adapter);
  }

  updateData(campaigns: InclinometerCampaign[]): void {
    this.updateOptions({ campaigns });
  }

  protected toSpec(options: InclinometerProfileOptions): TimeSeriesChartSpec {
    return toInclinometerSpec(options);
  }
}

function toInclinometerSpec(options: InclinometerProfileOptions): TimeSeriesChartSpec {
  const axis = options.axis ?? "displacementX";

  return {
    title: options.instrument?.name ?? options.instrument?.id ?? "Inclinometer profile",
    xLabel: axis === "displacementX" ? "Displacement X" : "Displacement Y",
    yLabel: "Depth",
    xTime: false,
    invertY: true,
    height: options.height ?? 360,
    maxPoints: options.maxPoints,
    thresholds: options.thresholds,
    series: options.campaigns.map((campaign, index) => ({
      id: campaign.id,
      label: campaign.label,
      color: colors[index % colors.length]!,
      data: toPoints(campaign, axis, options.showMissingData)
    }))
  };
}

function toPoints(
  campaign: InclinometerCampaign,
  axis: NonNullable<InclinometerProfileOptions["axis"]>,
  showMissingData = true
): ChartPoint[] {
  return campaign.readings.flatMap((reading) => {
    const missing = reading[axis] === undefined || reading.quality === "missing";
    if (missing && !showMissingData) return [];
    return [{ timestamp: reading[axis] ?? 0, value: missing ? null : reading.depth }];
  });
}
