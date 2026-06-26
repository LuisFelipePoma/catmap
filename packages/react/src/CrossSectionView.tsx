import { useEffect, useLayoutEffect, useRef, type CSSProperties } from "react";
import {
  CrossSectionView as CatmapCrossSectionView,
  type CrossSectionViewOptions
} from "@catmap/geotech";

export type CrossSectionViewProps = CrossSectionViewOptions & {
  className?: string;
  style?: CSSProperties;
};

export function CrossSectionView({ className, style, ...options }: CrossSectionViewProps) {
  const ref = useRef<HTMLDivElement>(null);
  const viewRef = useRef<CatmapCrossSectionView | null>(null);

  useLayoutEffect(() => {
    if (!ref.current) return;
    const view = new CatmapCrossSectionView(ref.current, options);
    viewRef.current = view;
    return () => view.destroy();
  }, []);

  useEffect(() => {
    viewRef.current?.updateOptions(options);
  }, [options]);

  return <div ref={ref} className={className} style={{ minHeight: options.height ?? 320, ...style }} />;
}
