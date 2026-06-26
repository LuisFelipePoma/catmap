import type { ContourLayerOptions, HeatmapLayerOptions } from "./types";

export interface GeoJsonFeatureCollection<TGeometry extends GeoJsonGeometry, TProperties> {
  type: "FeatureCollection";
  features: GeoJsonFeature<TGeometry, TProperties>[];
}

interface GeoJsonFeature<TGeometry extends GeoJsonGeometry, TProperties> {
  type: "Feature";
  geometry: TGeometry;
  properties: TProperties;
}

type GeoJsonGeometry = GeoJsonPoint | GeoJsonLineString;

interface GeoJsonPoint {
  type: "Point";
  coordinates: [number, number];
}

interface GeoJsonLineString {
  type: "LineString";
  coordinates: [number, number][];
}

export interface HeatmapFeatureProperties {
  id?: string;
  value: number;
}

export interface ContourFeatureProperties {
  id: string;
  value: number;
  label?: string;
  color?: string;
  width?: number;
}

export function toHeatmapGeoJson(
  options: HeatmapLayerOptions
): GeoJsonFeatureCollection<GeoJsonPoint, HeatmapFeatureProperties> {
  return {
    type: "FeatureCollection",
    features: options.points.filter(isFiniteHeatmapPoint).map((point) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [point.longitude, point.latitude] },
      properties: { ...(point.id ? { id: point.id } : {}), value: point.value }
    }))
  };
}

export function toContourGeoJson(
  options: ContourLayerOptions
): GeoJsonFeatureCollection<GeoJsonLineString, ContourFeatureProperties> {
  return {
    type: "FeatureCollection",
    features: options.lines.flatMap((line) => {
      if (!Number.isFinite(line.value)) return [];
      const coordinates = line.coordinates.filter(([longitude, latitude]) => isFinitePair(longitude, latitude));
      if (coordinates.length < 2) return [];
      return [
        {
          type: "Feature" as const,
          geometry: { type: "LineString" as const, coordinates },
          properties: {
            id: line.id,
            value: line.value,
            ...(line.label ? { label: line.label } : {}),
            ...(line.color ? { color: line.color } : {}),
            ...(line.width !== undefined && Number.isFinite(line.width) ? { width: line.width } : {})
          }
        }
      ];
    })
  };
}

export function heatmapMaxValue(options: HeatmapLayerOptions): number {
  if (options.maxValue !== undefined && Number.isFinite(options.maxValue) && options.maxValue > 0) return options.maxValue;
  return Math.max(1, ...options.points.map((point) => point.value).filter(Number.isFinite));
}

function isFiniteHeatmapPoint(point: HeatmapLayerOptions["points"][number]): boolean {
  return isFinitePair(point.longitude, point.latitude) && Number.isFinite(point.value);
}

function isFinitePair(longitude: number, latitude: number): boolean {
  return Number.isFinite(longitude) && Number.isFinite(latitude);
}
