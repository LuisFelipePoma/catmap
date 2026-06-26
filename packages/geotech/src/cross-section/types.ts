import type { ReadingQuality } from "../piezometer/types";

export interface CrossSectionPoint {
  distance: number;
  elevation: number;
  value?: number;
  quality?: ReadingQuality;
}

export interface CrossSectionSeries {
  id: string;
  label: string;
  color?: string;
  points: CrossSectionPoint[];
}

export interface CrossSectionInstrument {
  id: string;
  label: string;
  distance: number;
  elevation?: number;
  depth?: number;
  quality?: ReadingQuality;
}

export interface CrossSectionViewOptions {
  title?: string;
  series: CrossSectionSeries[];
  instruments?: CrossSectionInstrument[];
  xLabel?: string;
  yLabel?: string;
  width?: number;
  height?: number;
}
