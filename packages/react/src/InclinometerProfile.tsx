import { useEffect, useLayoutEffect, useRef, type CSSProperties } from "react";
import {
  InclinometerProfile as CatmapInclinometerProfile,
  type InclinometerProfileOptions
} from "@catmap/geotech";

export type InclinometerProfileProps = InclinometerProfileOptions & {
  className?: string;
  style?: CSSProperties;
};

export function InclinometerProfile({ className, style, ...options }: InclinometerProfileProps) {
  const ref = useRef<HTMLDivElement>(null);
  const chartRef = useRef<CatmapInclinometerProfile | null>(null);

  useLayoutEffect(() => {
    if (!ref.current) return;
    const chart = new CatmapInclinometerProfile(ref.current, options);
    chartRef.current = chart;
    return () => chart.destroy();
  }, []);

  useEffect(() => {
    chartRef.current?.updateOptions(options);
  }, [options.instrument, options.campaigns, options.axis, options.thresholds]);

  return <div ref={ref} className={className} style={{ minHeight: 360, ...style }} />;
}
