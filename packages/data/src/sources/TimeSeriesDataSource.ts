import type { DataBatch, DataSource } from "@catmap/core";
import { minMaxDecimation } from "../decimation/minMaxDecimation";
import type { TimeSeriesPoint, TimeSeriesQuery } from "../timeseries/types";

export class TimeSeriesDataSource implements DataSource<TimeSeriesPoint, TimeSeriesQuery> {
  constructor(private readonly points: readonly TimeSeriesPoint[]) {}

  async query(query: TimeSeriesQuery): Promise<DataBatch<TimeSeriesPoint>> {
    const filtered = this.points.filter(
      (point) => point.timestamp >= query.from && point.timestamp <= query.to
    );

    return {
      data: query.maxPoints ? minMaxDecimation(filtered, query.maxPoints) : filtered,
      total: filtered.length
    };
  }
}
