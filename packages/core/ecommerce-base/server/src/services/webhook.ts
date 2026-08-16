import { WEBHOOK_EVENTS } from '../constants';

/**
 * Programmatic subscriber API for the plugin's own event surface. External
 * code (app code, other plugins) may subscribe the same way:
 *
 *   strapi.plugin('ecommerce-base').service('webhook').subscribe('ecommerce.order.created', handler)
 */
export default ({ strapi }: { strapi: any }) => {
  const handlers = new Map<string, Set<(payload: unknown) => void | Promise<void>>>();

  function onEvent(payload: unknown) {
    const set = handlers.get(String(payload));
    if (set) {
      set.forEach((handler) => {
        try {
          const result = handler(payload);
          if (result instanceof Promise)
            result.catch((err) => {
              strapi.log?.error?.(
                `[ecommerce-base] webhook handler failed: ${(err as Error).message}`
              );
            });
        } catch (err) {
          strapi.log?.error?.(`[ecommerce-base] webhook handler failed: ${(err as Error).message}`);
        }
      });
    }
  }

  return {
    /**
     * Subscribe a handler to a plugin event (e.g. ecommerce.order.created).
     */
    subscribe(event: string, handler: (payload: unknown) => void | Promise<void>) {
      if (!handlers.has(event)) {
        handlers.set(event, new Set());
        strapi.eventHub?.on?.(event, onEvent.bind(null, event));
      }
      handlers.get(event)!.add(handler);
      return () => {
        handlers.get(event)?.delete(handler);
      };
    },

    /**
     * List events exposed by the plugin (mirrors WEBHOOK_EVENTS).
     */
    listEvents() {
      return WEBHOOK_EVENTS;
    },

    /**
     * Emit an event manually (useful for tests and migrations).
     */
    emit(event: string, payload: unknown) {
      strapi.eventHub?.emit?.(event, payload);
    },
  };
};
