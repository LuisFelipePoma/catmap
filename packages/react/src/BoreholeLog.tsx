import { useEffect, useLayoutEffect, useRef, type CSSProperties } from "react";
import { BoreholeLog as CatmapBoreholeLog, type BoreholeLogOptions } from "@catmap/geotech";

export type BoreholeLogProps = BoreholeLogOptions & {
  className?: string;
  style?: CSSProperties;
};

export function BoreholeLog({ className, style, ...options }: BoreholeLogProps) {
  const ref = useRef<HTMLDivElement>(null);
  const logRef = useRef<CatmapBoreholeLog | null>(null);

  useLayoutEffect(() => {
    if (!ref.current) return;
    const log = new CatmapBoreholeLog(ref.current, options);
    logRef.current = log;
    return () => log.destroy();
  }, []);

  useEffect(() => {
    logRef.current?.updateOptions(options);
  }, [options]);

  return <div ref={ref} className={className} style={{ minHeight: options.height ?? 420, ...style }} />;
}
