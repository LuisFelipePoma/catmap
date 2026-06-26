import { useEffect, useLayoutEffect, useRef, type CSSProperties } from "react";
import {
  SpectralWaterfallChart as CatmapSpectralWaterfallChart,
  type SpectralWaterfallChartOptions
} from "@catmap/charts";

export type SpectralWaterfallChartProps = SpectralWaterfallChartOptions & {
  className?: string;
  style?: CSSProperties;
};

export function SpectralWaterfallChart({ className, style, ...options }: SpectralWaterfallChartProps) {
  const ref = useRef<HTMLDivElement>(null);
  const chartRef = useRef<CatmapSpectralWaterfallChart | null>(null);

  useLayoutEffect(() => {
    if (!ref.current) return;
    const chart = new CatmapSpectralWaterfallChart(ref.current, options);
    chartRef.current = chart;
    return () => chart.destroy();
  }, []);

  useEffect(() => {
    chartRef.current?.updateOptions(options);
  }, [
    options.spectra,
    options.x,
    options.title,
    options.width,
    options.height,
    options.background,
    options.lineColor,
    options.selectedColor,
    options.sliceColor,
    options.initialSelection,
    options.initialSliceIndex,
    options.initialXRange,
    options.onSelectionChange,
    options.onSliceChange,
    options.onViewportChange
  ]);

  return <div ref={ref} className={className} style={{ minHeight: options.height ?? 560, ...style }} />;
}
