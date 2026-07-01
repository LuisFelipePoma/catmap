import { useEffect, useLayoutEffect, useRef, type CSSProperties } from "react";
import {
  RainfallResponseChart as CatmapRainfallResponseChart,
  type RainfallResponseChartOptions
} from "@catmap/geotech";

export type RainfallResponseChartProps = RainfallResponseChartOptions & {
  className?: string;
  style?: CSSProperties;
};

export function RainfallResponseChart({ className, style, ...options }: RainfallResponseChartProps) {
  const ref = useRef<HTMLDivElement>(null);
  const chartRef = useRef<CatmapRainfallResponseChart | null>(null);

  useLayoutEffect(() => {
    if (!ref.current) return;
    const chart = new CatmapRainfallResponseChart(ref.current, options);
    chartRef.current = chart;
    return () => chart.destroy();
  }, []);

  useEffect(() => {
    chartRef.current?.updateOptions(options);
  }, [options.rainfall, options.readings, options.responseAxis, options.thresholds, options.tools]);

  return <div ref={ref} className={className} style={{ minHeight: 300, ...style }} />;
}
