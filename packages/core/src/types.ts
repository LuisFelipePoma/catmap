export type Point = { x: number; y: number };
export type Bounds = { minX: number; minY: number; maxX: number; maxY: number };
export type HitResult<T = unknown> = { id: string; data?: T };

export interface Viewport {
  width: number;
  height: number;
  bounds?: Bounds;
}

export interface Theme {
  background: string;
  text: string;
  grid: string;
  warning: string;
  critical: string;
}

export interface DataQuery {
  from?: number;
  to?: number;
  maxPoints?: number;
}

export interface DataBatch<T = unknown> {
  data: T[];
  total?: number;
}

export interface DataSource<T = unknown, TQuery extends DataQuery = DataQuery> {
  query(query: TQuery): Promise<DataBatch<T>>;
}
