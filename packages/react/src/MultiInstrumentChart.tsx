import { useEffect, useLayoutEffect, useRef, type CSSProperties } from "react";
import {
  MultiInstrumentChart as CatmapMultiInstrumentChart,
  type MultiInstrumentChartOptions
} from "@catmap/geotech";

export type MultiInstrumentChartProps = MultiInstrumentChartOptions & {
  className?: string;
  style?: CSSProperties;
};

export function MultiInstrumentChart({ className, style, ...options }: MultiInstrumentChartProps) {
  const ref = useRef<HTMLDivElement>(null);
  const chartRef = useRef<CatmapMultiInstrumentChart | null>(null);

  useLayoutEffect(() => {
    if (!ref.current) return;
    const chart = new CatmapMultiInstrumentChart(ref.current, options);
    chartRef.current = chart;
    return () => chart.destroy();
  }, []);

  useEffect(() => {
    chartRef.current?.updateOptions(options);
  }, [options.series, options.thresholds, options.yLabel]);

  return <div ref={ref} className={className} style={{ minHeight: 300, ...style }} />;
}
