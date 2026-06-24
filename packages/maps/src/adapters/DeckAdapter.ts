import type { RendererAdapter } from "@catmap/core";

export class DeckAdapter implements RendererAdapter {
  init(_container: HTMLElement): void {}
  render(): void {}
  resize(_width: number, _height: number): void {}
  destroy(): void {}
}
