import type { Bounds, HitResult, Point, Theme, Viewport } from "../types";

export interface LayerContext {
  viewport: Viewport;
  theme?: Theme;
}

export interface RenderContext extends LayerContext {
  container: HTMLElement;
}

export abstract class Layer<TData = unknown> {
  readonly id: string;
  visible: boolean;
  zIndex: number;

  constructor(options: { id: string; visible?: boolean; zIndex?: number }) {
    this.id = options.id;
    this.visible = options.visible ?? true;
    this.zIndex = options.zIndex ?? 0;
  }

  abstract prepare(data: TData, context: LayerContext): void;
  abstract render(context: RenderContext): void;

  hitTest?(_point: Point): HitResult | null;
  getBounds?(): Bounds;
}
