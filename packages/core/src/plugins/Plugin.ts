import type { EventBus } from "../events/EventBus";

export interface PluginContext {
  container: HTMLElement;
  events: EventBus;
}

export interface Plugin {
  name: string;
  install(context: PluginContext): void;
  destroy?(): void;
}
