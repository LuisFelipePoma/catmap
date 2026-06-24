export interface RendererAdapter {
  init(container: HTMLElement): void;
  render(): void;
  resize(width: number, height: number): void;
  destroy(): void;
}
