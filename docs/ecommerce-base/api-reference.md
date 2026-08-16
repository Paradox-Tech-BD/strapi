---
title: E-commerce Base — API Reference
description: Complete endpoint, service and event reference
sidebar_label: API Reference
---

# E-commerce Base — API Reference

Base URL for admin endpoints: `/admin/ecommerce-base`. Content-API (storefront) endpoints: `/api/ecommerce-base`. All admin endpoints require an authenticated Strapi admin token; all routes additionally carry per-action `admin::hasPermissions` policies.

## Admin endpoints

### Dashboard

| Method | Path               | Action | Description                                                                           |
| ------ | ------------------ | ------ | ------------------------------------------------------------------------------------- |
| GET    | `/dashboard/stats` | —      | Aggregate KPIs: total orders, paid orders, revenue, orders by status, low-stock count |

### Products

| Method | Path                      | Action            | Description                                                                      |
| ------ | ------------------------- | ----------------- | -------------------------------------------------------------------------------- |
| GET    | `/products`               | `catalog.read`    | Paginated product list (`query` follows Strapi query syntax)                     |
| GET    | `/products/:id`           | `catalog.read`    | Single product with inventory ledger row                                         |
| POST   | `/products`               | `catalog.manage`  | Create product; auto-creates inventory ledger row when `stockTracking !== false` |
| PUT    | `/products/:id`           | `catalog.manage`  | Update product fields                                                            |
| POST   | `/products/:id/publish`   | `catalog.publish` | `status: published`, sets `publishedAt`                                          |
| POST   | `/products/:id/unpublish` | `catalog.publish` | `status: draft`, clears `publishedAt`                                            |
| POST   | `/products/:id/archive`   | `catalog.manage`  | `status: archived`                                                               |
| DELETE | `/products/:id`           | `catalog.manage`  | Deletes product and cascades to inventory ledger rows                            |

Request body (create/update): `{ name, price, description?, compareAtPrice?, sku?, barcode?, currency?, category?, weightKg?, stockTracking?, images?, metadata?, tags? }`.

### Inventory

| Method | Path                | Action             | Description                                                                                                                                                                    |
| ------ | ------------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| GET    | `/inventory`        | `inventory.read`   | Stock ledger with product join, reserved vs available quantities                                                                                                               |
| GET    | `/inventory/:id`    | `inventory.read`   | Single ledger row                                                                                                                                                              |
| POST   | `/inventory/adjust` | `inventory.adjust` | Body: `{ id, quantity, type: 'restock' \| 'writeoff', reason? }` — updates `quantity`, emits `ecommerce.inventory.updated` and `ecommerce.inventory.low-stock` when applicable |

### Orders

| Method | Path                     | Action          | Description                                                                                                                                                                                                                                                                 |
| ------ | ------------------------ | --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/orders`                | `orders.read`   | Paginated orders via `order.findPage` with permission-scoped query sanitization                                                                                                                                                                                             |
| GET    | `/orders/:id`            | `orders.read`   | Single order                                                                                                                                                                                                                                                                |
| POST   | `/orders`                | `orders.manage` | Create: `{ customer?, items: [{ productId, quantity, unitPrice?, promotionCode? }], shippingCost?, shippingAddress?, billingAddress?, notes? }`. Reserves inventory per stock-tracked line, computes `subtotal`, `discountAmount`, `total`, emits `ecommerce.order.created` |
| POST   | `/orders/:id/transition` | `orders.manage` | Body: `{ status }` — validates the state machine (`pending → confirmed → processing → shipped → delivered`, plus `cancelled`/`refunded`)                                                                                                                                    |
| POST   | `/orders/:id/cancel`     | `orders.cancel` | Transitions to `cancelled`, releases reservations, sets `paymentStatus: failed`                                                                                                                                                                                             |
| POST   | `/orders/:id/pay`        | `orders.manage` | Body: `{ method?, gatewayId? }` — captures payment through the gateway registry, emits `ecommerce.order.updated`                                                                                                                                                            |
| POST   | `/orders/:id/refund`     | `orders.manage` | Body: `{ gatewayId?, amount? }` — refunds through the gateway, transitions to `refunded`                                                                                                                                                                                    |
| GET    | `/orders/stats`          | `finance.read`  | `{ totalOrders, paidOrders, revenue, byStatus }`; optional query `from`/`to` filter on `createdAt`                                                                                                                                                                          |

### Customers

| Method | Path             | Action             | Description                                                                                     |
| ------ | ---------------- | ------------------ | ----------------------------------------------------------------------------------------------- |
| GET    | `/customers`     | `customers.read`   | Paginated customer list                                                                         |
| GET    | `/customers/:id` | `customers.read`   | Single customer with order history                                                              |
| POST   | `/customers`     | `customers.manage` | Body: `{ firstName, lastName?, email, phone?, metadata? }` — emits `ecommerce.customer.created` |
| PUT    | `/customers/:id` | `customers.manage` | Update customer — emits `ecommerce.customer.updated`                                            |

### Carts

| Method | Path                       | Action | Description                                                                               |
| ------ | -------------------------- | ------ | ----------------------------------------------------------------------------------------- |
| GET    | `/carts`                   | —      | List carts                                                                                |
| GET    | `/carts/:id`               | —      | Cart with items and computed total                                                        |
| POST   | `/carts/:id/items`         | —      | Add item `{ productId, quantity, unitPrice? }`                                            |
| PUT    | `/carts/:id/items/:itemId` | —      | Update quantity                                                                           |
| DELETE | `/carts/:id/items/:itemId` | —      | Remove line                                                                               |
| POST   | `/carts/:id/convert`       | —      | Check out: validates stock, converts cart into an order, emits `ecommerce.cart.converted` |
| POST   | `/carts/:id/clear`         | —      | Empty the basket                                                                          |

### Promotions

| Method | Path                     | Action           | Description                                                                                                                  |
| ------ | ------------------------ | ---------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/promotions`            | `catalog.read`   | List campaigns                                                                                                               |
| GET    | `/promotions/:id`        | `catalog.read`   | Single promotion                                                                                                             |
| POST   | `/promotions`            | `catalog.manage` | Body: `{ name, code, type: 'percentage' \| 'fixed' \| 'freeShipping', value, minOrderValue?, maxUses?, startsAt?, endsAt? }` |
| PUT    | `/promotions/:id`        | `catalog.manage` | Update campaign                                                                                                              |
| POST   | `/promotions/:id/toggle` | `catalog.manage` | Flip `active` flag                                                                                                           |
| DELETE | `/promotions/:id`        | `catalog.manage` | Delete campaign                                                                                                              |

### Payments

| Method | Path                 | Action          | Description                             |
| ------ | -------------------- | --------------- | --------------------------------------- |
| GET    | `/payments/gateways` | `finance.read`  | List registered gateways (`id`, `name`) |
| POST   | `/payments/gateways` | — (admin only)  | Register a gateway at runtime           |
| POST   | `/orders/:id/refund` | `orders.manage` | See Orders above                        |

### Webhooks

| Method | Path                  | Action       | Description                                                   |
| ------ | --------------------- | ------------ | ------------------------------------------------------------- |
| GET    | `/webhooks/events`    | `audit.read` | List plugin events (`WEBHOOK_EVENTS`)                         |
| POST   | `/webhooks/subscribe` | `audit.read` | Body: `{ event, handler }` — subscribe an in-process listener |

External URL delivery uses Strapi's native webhook store (Settings → Webhooks) — see [Extending](./extending.md).

### Audit

| Method | Path           | Action       | Description                                                                     |
| ------ | -------------- | ------------ | ------------------------------------------------------------------------------- |
| GET    | `/audit`       | `audit.read` | Paginated audit log: actor, action, resourceType, resourceId, detail, createdAt |
| POST   | `/audit/clear` | `audit.read` | Purge the audit log                                                             |

## Content-API endpoints (storefront)

Authenticated via Strapi API tokens or users-permissions.

| Method | Path                                   | Description                                                                               |
| ------ | -------------------------------------- | ----------------------------------------------------------------------------------------- |
| GET    | `/api/ecommerce-base/products`         | Public published-product listing                                                          |
| GET    | `/api/ecommerce-base/products/:id`     | Public product detail                                                                     |
| POST   | `/api/ecommerce-base/orders`           | Checkout order creation (same payload shape as the admin create, minus admin-only fields) |
| POST   | `/api/ecommerce-base/promotions/apply` | Body: `{ code, items }` — returns computed discount and new totals                        |

## Plugin events (`strapi.eventHub`)

| Event                                     | Payload                                           |
| ----------------------------------------- | ------------------------------------------------- |
| `ecommerce.order.created`                 | hydrated order object (totals, lines, customer)   |
| `ecommerce.order.updated`                 | updated order object                              |
| `ecommerce.order.cancelled`               | cancelled order object                            |
| `ecommerce.inventory.updated`             | `{ itemId, product, quantity, reservedQuantity }` |
| `ecommerce.inventory.low-stock`           | `{ itemId, product, quantity, threshold }`        |
| `ecommerce.customer.created` / `.updated` | customer object                                   |
| `ecommerce.cart.converted`                | `{ cart, order }`                                 |
| `ecommerce.promotion.used`                | `{ promotion, discountAmount }`                   |

## Permission actions

```
plugin::ecommerce-base.catalog.read|manage|publish
plugin::ecommerce-base.orders.read|manage|cancel
plugin::ecommerce-base.inventory.read|adjust
plugin::ecommerce-base.customers.read|manage
plugin::ecommerce-base.finance.read
plugin::ecommerce-base.audit.read
```

Conditions: `is-product-owner`, `is-order-assigned`, `is-customer-assigned`, `has-inventory-access`, `is-finance-role`, `is-catalog-manager`, `is-order-manager`, `is-support-agent`.

## Content-type UIDs

```
plugin::ecommerce-base.product          plugin::ecommerce-base.inventory-item
plugin::ecommerce-base.order            plugin::ecommerce-base.order-line
plugin::ecommerce-base.customer         plugin::ecommerce-base.cart
plugin::ecommerce-base.cart-item        plugin::ecommerce-base.promotion
```
