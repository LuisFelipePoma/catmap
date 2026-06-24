import { EventBus } from "../events/EventBus";
import type { Plugin } from "../plugins/Plugin";
import type { RendererAdapter } from "../renderer/RendererAdapter";

export class Chart {
  readonly events = new EventBus();
  private readonly plugins: Plugin[] = [];

  constructor(
    protected readonly container: HTMLElement,
    protected readonly renderer: RendererAdapter
  ) {
    this.renderer.init(container);
  }

  use(plugin: Plugin): this {
    plugin.install({ container: this.container, events: this.events });
    this.plugins.push(plugin);
    return this;
  }

  resize(width = this.container.clientWidth, height = this.container.clientHeight): void {
    this.renderer.resize(width, height);
  }

  destroy(): void {
    this.plugins.splice(0).forEach((plugin) => plugin.destroy?.());
    this.renderer.destroy();
    this.events.clear();
  }
}
