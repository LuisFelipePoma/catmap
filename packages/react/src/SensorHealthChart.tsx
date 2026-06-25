import { useEffect, useLayoutEffect, useRef, type CSSProperties } from "react";
import {
  SensorHealthChart as CatmapSensorHealthChart,
  type SensorHealthChartOptions
} from "@catmap/geotech";

export type SensorHealthChartProps = SensorHealthChartOptions & {
  className?: string;
  style?: CSSProperties;
};

export function SensorHealthChart({ className, style, ...options }: SensorHealthChartProps) {
  const ref = useRef<HTMLDivElement>(null);
  const chartRef = useRef<CatmapSensorHealthChart | null>(null);

  useLayoutEffect(() => {
    if (!ref.current) return;
    const chart = new CatmapSensorHealthChart(ref.current, options);
    chartRef.current = chart;
    return () => chart.destroy();
  }, []);

  useEffect(() => {
    chartRef.current?.updateOptions(options);
  }, [options.title, options.readings]);

  return <div ref={ref} className={className} style={{ minHeight: 280, ...style }} />;
}
