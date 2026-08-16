---
title: Extending the E-commerce Base
description: Payment gateways, webhook notifications, and domain plugins
sidebar_label: Extending
---

# Extending the E-commerce Base

The base system is deliberately generic. This guide covers the three most common extension scenarios: adding a custom payment gateway, configuring webhook notifications for new orders and inventory updates, and building domain-specific application plugins on top of the base.

## 1. Custom payment gateway integration

The payment service (`server/src/services/payment.ts`) implements a **gateway registry** — gateways are plain objects registered at runtime, exactly like Strapi's own provider pattern in the email/upload plugins.

### Gateway contract

```typescript
interface PaymentGateway {
  id: string; // unique registry key, e.g. 'stripe'
  name: string; // human-readable label
  process(args: {
    // capture a payment
    orderId: number | string;
    amount: number;
    currency: string;
    method?: string;
    metadata?: Record<string, unknown>;
  }): Promise<{
    success: boolean;
    paymentReference?: string; // gateway transaction id
    error?: string;
  }>;
  refund(args: {
    // refund a captured payment
    orderId: number | string;
    paymentReference: string;
    amount?: number;
  }): Promise<{ success: boolean; error?: string }>;
  verify?(paymentReference: string): Promise<boolean>;
}
```

### Registering a gateway

```typescript
// In your own plugin (or a server bootstrap file)
strapi
  .plugin('ecommerce-base')
  .service('payment')
  .registerGateway({
    id: 'stripe',
    name: 'Stripe',
    async process({ amount, currency, metadata }) {
      const charge = await stripeClient.charges.create({
        amount: Math.round(amount * 100),
        currency: currency.toLowerCase(),
        ...metadata,
      });
      return { success: true, paymentReference: charge.id };
    },
    async refund({ paymentReference, amount }) {
      await stripeClient.refunds.create({ charge: paymentReference, amount });
      return { success: true };
    },
  });
```

### Triggering payments

Once registered, a gateway is usable end-to-end:

- **Admin API** — `POST /admin/ecommerce-base/orders/:id/pay` with body `{ method, gatewayId }` runs `payment.processPayment`, which looks the gateway up in the registry, marks the order `paid`, stores the `paymentReference`, and emits `ecommerce.order.updated`.
- **Refunds** — `POST /admin/ecommerce-base/orders/:id/refund` reverses a captured payment through the same gateway.
- The built-in `mock` gateway (`payment.registerGateway` in tests) demonstrates the full flow and is useful in development.

Secrets (API keys) should be read from environment variables inside your gateway module — never stored in content types or plugin config.

## 2. Webhook notifications for new orders and inventory updates

External notification delivery is delegated to Strapi's native webhook store, which already subscribes to the `eventHub` events the ecommerce-base services emit. You configure it once; the plugin does the rest.

### Supported events

| Event                                                       | When it fires                                               |
| ----------------------------------------------------------- | ----------------------------------------------------------- |
| `ecommerce.order.created`                                   | After `order.create` computes totals and reserves inventory |
| `ecommerce.order.updated`                                   | On status transitions and payment captures                  |
| `ecommerce.order.cancelled`                                 | On cancellation transitions                                 |
| `ecommerce.inventory.updated`                               | On every stock adjustment or reservation change             |
| `ecommerce.inventory.low-stock`                             | When a ledger row drops below `lowStockThreshold`           |
| `ecommerce.customer.created` / `ecommerce.customer.updated` | Customer service mutations                                  |
| `ecommerce.cart.converted`                                  | Checkout conversion                                         |
| `ecommerce.promotion.used`                                  | Promotion code application                                  |

### Option A — Register via the admin UI

1. Open **Settings → Webhooks** in the Strapi admin.
2. Add a webhook pointing at your endpoint (e.g. `https://your-notifier.example.com/webhooks/strapi`).
3. Select the events you want — at minimum `ecommerce.order.created` and `ecommerce.inventory.updated`. Strapi signs every delivery with the webhook secret (HMAC-SHA256, `Strapi-Signature` header) and retries failed deliveries with exponential backoff.

### Option B — Register via the plugin's API

```typescript
const webhookService = strapi.service('admin::webhook-store');

await webhookService.createWebhook({
  name: 'Order notifier',
  url: 'https://your-notifier.example.com/webhooks/strapi',
  headers: { 'X-Custom-Token': process.env.NOTIFIER_TOKEN },
  events: ['ecommerce.order.created', 'ecommerce.order.updated'],
});

await webhookService.createWebhook({
  name: 'Inventory alerts',
  url: 'https://your-notifier.example.com/webhooks/strapi',
  headers: {},
  events: ['ecommerce.inventory.updated', 'ecommerce.inventory.low-stock'],
});
```

### Option C — React inside server code (eventHub listeners)

For in-process reactions (e.g. updating an external ERP):

```typescript
strapi.eventHub.on('ecommerce.order.created', async (order) => {
  await erpClient.pushOrder(order);
});
```

### Example: Slack notification for new orders

```typescript
strapi
  .plugin('ecommerce-base')
  .service('webhook')
  .subscribe('ecommerce.order.created', async (order) => {
    await fetch(process.env.SLACK_WEBHOOK_URL, {
      method: 'POST',
      body: JSON.stringify({
        text: `New order ${order.orderNumber} — $${order.total} (${order.currency})`,
      }),
    });
  });
```

## 3. Building domain-specific applications on the base

Treat `ecommerce-base` as the foundation and layer shop-specific logic in your own application plugins. Recommended pattern:

1. **Depend on the base UID namespace** — never duplicate content types. Reference `plugin::ecommerce-base.product`, `plugin::ecommerce-base.order`, etc., in your relations.
2. **Listen to events, don't monkey-patch services** — react to `eventHub` events for side effects (tax calculation, shipping estimation, ERP sync).
3. **Call base services through the registry**:

```typescript
const order = await strapi
  .plugin('ecommerce-base')
  .service('order')
  .create({
    customer: 7,
    items: [{ productId: 12, quantity: 2, unitPrice: 19.99 }],
    shippingCost: 5,
  });
```

4. **Add content types to the PBAC model** — register your own actions (`plugin::your-shop.*`) and conditions in your plugin's `register.ts`, and reuse the base condition handlers where appropriate.
5. **Extend the admin UI** — add menu links in your plugin's `admin/src/index.ts` beside the base's five pages.

A typical first application plugin would add: shop-specific tax rules (listen to `order.create`, compute `taxAmount`), a shipping provider (listen to `cart.converted`), and checkout validation (guard `order.create` input). All three stay decoupled from the base, so the fork remains a clean, upgradeable foundation for every future e-commerce app you build.

## Reference

- Full endpoint list: [API reference](./api-reference.md)
- Core integration details: [Architecture](./architecture.md)
- Package overview: [packages/core/ecommerce-base/README.md](https://github.com/Paradox-Tech-BD/strapi/tree/main/packages/core/ecommerce-base/README.md)
