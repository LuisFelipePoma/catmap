import { useEffect, useLayoutEffect, useRef, type CSSProperties } from "react";
import {
  PiezometerChart as CatmapPiezometerChart,
  type PiezometerChartOptions
} from "@catmap/geotech";

export type PiezometerChartProps = PiezometerChartOptions & {
  className?: string;
  style?: CSSProperties;
};

export function PiezometerChart({ className, style, ...options }: PiezometerChartProps) {
  const ref = useRef<HTMLDivElement>(null);
  const chartRef = useRef<CatmapPiezometerChart | null>(null);

  useLayoutEffect(() => {
    if (!ref.current) return;
    const chart = new CatmapPiezometerChart(ref.current, options);
    chartRef.current = chart;
    return () => chart.destroy();
  }, []);

  useEffect(() => {
    chartRef.current?.updateOptions(options);
  }, [options.instrument, options.readings, options.thresholds, options.yAxis, options.tools]);

  return <div ref={ref} className={className} style={{ minHeight: 260, ...style }} />;
}
