export interface BoreholeInterval {
  from: number;
  to: number;
  label: string;
  color?: string;
  description?: string;
}

export interface BoreholeLogOptions {
  title?: string;
  boreholeId?: string;
  intervals: BoreholeInterval[];
  waterLevel?: number;
  depthUnit?: string;
  width?: number;
  height?: number;
}
