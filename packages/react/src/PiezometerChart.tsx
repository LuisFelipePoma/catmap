import { useEffect, useRef, type CSSProperties } from "react";
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

  useEffect(() => {
    if (!ref.current) return;
    const chart = new CatmapPiezometerChart(ref.current, options);
    return () => chart.destroy();
  }, [options.instrument, options.readings, options.thresholds, options.yAxis]);

  return <div ref={ref} className={className} style={{ minHeight: 260, ...style }} />;
}
