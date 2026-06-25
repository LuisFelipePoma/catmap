import type { TimeSeriesPoint } from "../timeseries/types";
import { minMaxDecimation } from "./minMaxDecimation";

export interface DecimateTimeSeriesOptions {
  maxPoints: number;
  useWorker?: boolean;
}

export async function decimateTimeSeries(
  points: readonly TimeSeriesPoint[],
  options: DecimateTimeSeriesOptions
): Promise<TimeSeriesPoint[]> {
  if (
    !options.useWorker ||
    typeof Worker === "undefined" ||
    typeof Blob === "undefined" ||
    points.length <= options.maxPoints
  ) {
    return minMaxDecimation(points, options.maxPoints);
  }

  return new Promise((resolve) => {
    const worker = new Worker(
      URL.createObjectURL(
        new Blob(
          [
            `self.onmessage = ({ data }) => {
              const { points, maxPoints } = data;
              if (maxPoints <= 0) return self.postMessage([]);
              if (points.length <= maxPoints) return self.postMessage(points);
              const bucketCount = Math.max(1, Math.floor(maxPoints / 2));
              const bucketSize = Math.ceil(points.length / bucketCount);
              const output = [];
              for (let start = 0; start < points.length && output.length < maxPoints; start += bucketSize) {
                const bucket = points.slice(start, start + bucketSize);
                let min = bucket[0], max = bucket[0];
                for (const point of bucket) {
                  if (point.value < min.value) min = point;
                  if (point.value > max.value) max = point;
                }
                const pair = min.timestamp <= max.timestamp ? [min, max] : [max, min];
                for (const point of pair) {
                  if (output[output.length - 1] !== point && output.length < maxPoints) output.push(point);
                }
              }
              self.postMessage(output.sort((a, b) => a.timestamp - b.timestamp));
            };`
          ],
          { type: "text/javascript" }
        )
      )
    );

    worker.onmessage = ({ data }: MessageEvent<TimeSeriesPoint[]>) => {
      worker.terminate();
      resolve(data);
    };
    worker.onerror = () => {
      worker.terminate();
      resolve(minMaxDecimation(points, options.maxPoints));
    };
    worker.postMessage({ points, maxPoints: options.maxPoints });
  });
}
