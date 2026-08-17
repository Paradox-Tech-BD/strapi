export const config = {
  default: {
    /**
     * Default payment configuration.
     * `gateway` is the identifier of the default gateway; `gateways` is a registry
     * of gateway factories that can be extended by application code at runtime.
     */
    payment: {
      gateway: 'mock',
      currency: 'USD',
      gateways: {},
    },
    /**
     * Webhook notification configuration.
     * `emitEvents` toggles whether the plugin emits events on strapi.eventHub.
     */
    webhooks: {
      emitEvents: true,
    },
    /**
     * Audit configuration.
     * `enabled` toggles audit log entry creation for state-changing operations.
     */
    audit: {
      enabled: true,
    },
    /**
     * Cart configuration.
     * `expirationDays` controls how many days before an abandoned cart is
     * marked as abandoned automatically.
     */
    carts: {
      expirationDays: 30,
    },
    /**
     * Deterministic tax and currency configuration. Rates express one unit
     * of the base currency in each supported currency; applications should
     * update them from their own FX source rather than relying on the plugin
     * to fetch live rates.
     */
    tax: {
      baseCurrency: 'USD',
      supportedCurrencies: ['USD', 'BDT'],
      exchangeRates: { USD: 1, BDT: 120 },
    },
  },
};
