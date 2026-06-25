import { useEffect, useRef, type CSSProperties } from "react";
import { InstrumentMap as CatmapInstrumentMap, type GeoInstrument } from "@catmap/maps";

export interface InstrumentMapProps {
  center: [number, number];
  zoom: number;
  instruments: GeoInstrument[];
  className?: string;
  style?: CSSProperties;
}

export function InstrumentMap({ center, zoom, instruments, className, style }: InstrumentMapProps) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<CatmapInstrumentMap | null>(null);

  useEffect(() => {
    if (!ref.current) return;
    const map = new CatmapInstrumentMap(ref.current, { center, zoom, basemap: "osm" });
    mapRef.current = map;
    map.addInstrumentLayer({ instruments });
    return () => map.destroy();
  }, []);

  useEffect(() => {
    mapRef.current?.updateInstruments(instruments);
  }, [center, zoom, instruments]);

  return <div ref={ref} className={className} style={{ minHeight: 360, ...style }} />;
}
