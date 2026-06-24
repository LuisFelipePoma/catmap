type Handler<T> = (payload: T) => void;

export class EventBus<TEvents extends Record<string, unknown> = Record<string, unknown>> {
  private readonly handlers = new Map<keyof TEvents, Set<Handler<TEvents[keyof TEvents]>>>();

  on<K extends keyof TEvents>(event: K, handler: Handler<TEvents[K]>): () => void {
    const handlers = this.handlers.get(event) ?? new Set();
    handlers.add(handler as Handler<TEvents[keyof TEvents]>);
    this.handlers.set(event, handlers);
    return () => this.off(event, handler);
  }

  off<K extends keyof TEvents>(event: K, handler: Handler<TEvents[K]>): void {
    this.handlers.get(event)?.delete(handler as Handler<TEvents[keyof TEvents]>);
  }

  emit<K extends keyof TEvents>(event: K, payload: TEvents[K]): void {
    this.handlers.get(event)?.forEach((handler) => handler(payload));
  }

  clear(): void {
    this.handlers.clear();
  }
}
