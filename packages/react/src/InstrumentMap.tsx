import { useEffect, useRef, type CSSProperties } from "react";
import {
  InstrumentMap as CatmapInstrumentMap,
  type ContourLayerOptions,
  type GeoInstrument,
  type HeatmapLayerOptions
} from "@catmap/maps";

export interface InstrumentMapProps {
  center: [number, number];
  zoom: number;
  instruments: GeoInstrument[];
  heatmap?: HeatmapLayerOptions;
  contours?: ContourLayerOptions;
  className?: string;
  style?: CSSProperties;
}

export function InstrumentMap({ center, zoom, instruments, heatmap, contours, className, style }: InstrumentMapProps) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<CatmapInstrumentMap | null>(null);

  useEffect(() => {
    if (!ref.current) return;
    const map = new CatmapInstrumentMap(ref.current, { center, zoom, basemap: "osm" });
    mapRef.current = map;
    map.addInstrumentLayer({ instruments });
    if (heatmap) map.setHeatmap(heatmap);
    if (contours) map.setContours(contours);
    return () => map.destroy();
  }, []);

  useEffect(() => {
    mapRef.current?.updateInstruments(instruments);
  }, [center, zoom, instruments]);

  useEffect(() => {
    if (heatmap) mapRef.current?.setHeatmap(heatmap);
    else mapRef.current?.clearHeatmap();
  }, [heatmap]);

  useEffect(() => {
    if (contours) mapRef.current?.setContours(contours);
    else mapRef.current?.clearContours();
  }, [contours]);

  return <div ref={ref} className={className} style={{ minHeight: 360, ...style }} />;
}
