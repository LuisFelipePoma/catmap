import { useEffect, useLayoutEffect, useRef, type CSSProperties } from "react";
import {
  SettlementChart as CatmapSettlementChart,
  type SettlementChartOptions
} from "@catmap/geotech";

export type SettlementChartProps = SettlementChartOptions & {
  className?: string;
  style?: CSSProperties;
};

export function SettlementChart({ className, style, ...options }: SettlementChartProps) {
  const ref = useRef<HTMLDivElement>(null);
  const chartRef = useRef<CatmapSettlementChart | null>(null);

  useLayoutEffect(() => {
    if (!ref.current) return;
    const chart = new CatmapSettlementChart(ref.current, options);
    chartRef.current = chart;
    return () => chart.destroy();
  }, []);

  useEffect(() => {
    chartRef.current?.updateOptions(options);
  }, [options.instrument, options.readings, options.thresholds, options.showThresholds]);

  return <div ref={ref} className={className} style={{ minHeight: 260, ...style }} />;
}
