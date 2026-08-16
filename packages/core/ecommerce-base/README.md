# E-commerce Base — Native Strapi Core Plugin

> A generic, reusable e-commerce foundation built **directly into the Strapi 5 core** as a native core plugin (`packages/core/ecommerce-base`), following Strapi's internal monorepo conventions one-to-one. It ships a complete base commerce domain model, a native policy-based access control (PBAC) engine, and a dedicated admin panel UI, so that every future e-commerce application built on this fork inherits the same foundation.

This package is not a third-party npm dependency. It lives alongside Strapi's other core plugins (`packages/core/upload`, `packages/core/i18n`, …), is registered in the Strapi package itself (`packages/core/strapi`), and is compiled by the same rollup + TypeScript toolchain the Strapi team uses.

## What is included

| Layer         | Contents                                                                                                   | Location                                            |
| ------------- | ---------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| Content types | 8 models: product, inventory-item, order, order-line, customer, cart, cart-item, promotion                 | `server/src/content-types/`                         |
| Services      | 9 services: product, inventory, order, customer, cart, promotion, payment, webhook, audit                  | `server/src/services/`                              |
| Controllers   | 12 controllers (9 domain + dashboard, content-api, payment ops)                                            | `server/src/controllers/`                           |
| Routes        | Admin routes under `/admin/ecommerce-base/...` + public content-API routes under `/api/ecommerce-base/...` | `server/src/routes/`                                |
| PBAC/RBAC     | 8 condition handlers registered on the Strapi permission engine + 12 admin actions + 5 seeded staff roles  | `server/src/register.ts`, `server/src/bootstrap.ts` |
| Webhooks      | 8 plugin events emitted on `strapi.eventHub` for order, inventory, customer, cart and promotion lifecycle  | `server/src/constants.ts` (`WEBHOOK_EVENTS`)        |
| Admin UI      | 5 pages (Dashboard, Orders, Inventory, Catalog, Audit Log) registered in the Strapi admin                  | `admin/src/`                                        |
| Tests         | 56 passing unit tests covering services, controllers and PBAC conditions                                   | `server/src/__tests__/`                             |

## Philosophy

The system is deliberately **generic**: it does not encode any shop-specific logic (no storefront templates, no tax jurisdictions, no shipping carriers). Instead it provides the shared machinery every e-commerce app needs — catalog, inventory ledger, order lifecycle, customers, carts, promotions, pluggable payments, audit trail and permissions — and exposes clean extension points so domain specifics can be layered on in application plugins.

## The content model

All eight content types live under the `plugin::ecommerce-base.*` UID namespace and are registered with `strapi.kind = 'plugin'` as required by Strapi.

| Content type   | UID                                     | Purpose                                               | Key attributes                                                                                                                                                                                                                                                              |
| -------------- | --------------------------------------- | ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Product        | `plugin::ecommerce-base.product`        | Catalog item with publish lifecycle (draft & publish) | name, slug (uid), description, price, compareAtPrice, sku, barcode, status (draft/published/archived), stockTracking, currency, images, metadata                                                                                                                            |
| Inventory Item | `plugin::ecommerce-base.inventory-item` | Stock ledger row per product/SKU                      | product (oneToOne), sku, quantity, reservedQuantity, lowStockThreshold, warehouseLocation, restockAt                                                                                                                                                                        |
| Order          | `plugin::ecommerce-base.order`          | Customer order with totals and addresses              | orderNumber, customer, lines (oneToMany), status (pending→confirmed→processing→shipped→delivered, plus cancelled/refunded), subtotal, discountAmount, taxAmount, shippingCost, total, currency, shippingAddress, billingAddress, createdBy, paymentStatus, paymentReference |
| Order Line     | `plugin::ecommerce-base.order-line`     | Line item snapshot                                    | order, product, quantity, unitPrice, discountAmount                                                                                                                                                                                                                         |
| Customer       | `plugin::ecommerce-base.customer`       | CRM record                                            | firstName, lastName, email (unique), phone, orders (oneToMany), metadata                                                                                                                                                                                                    |
| Cart           | `plugin::ecommerce-base.cart`           | Shopping basket (registered or guest)                 | customer, sessionId, items (oneToMany), convertedAt                                                                                                                                                                                                                         |
| Cart Item      | `plugin::ecommerce-base.cart-item`      | Basket line                                           | cart, product, quantity, unitPrice                                                                                                                                                                                                                                          |
| Promotion      | `plugin::ecommerce-base.promotion`      | Discount campaigns                                    | name, code (unique), type (percentage/fixed/freeShipping), value, minOrderValue, maxUses, usedCount, active, startsAt, endsAt                                                                                                                                               |

### Order lifecycle

Orders follow a strict state machine enforced in the order service (`server/src/services/order.ts`):

```
pending ──→ confirmed ──→ processing ──→ shipped ──→ delivered
  │                                          │
  └──────→ cancelled (from any non-final) ────┘  ──→ refunded
```

`transition(id, newStatus)` validates against the allowed-transition map and refuses illegal moves (for example `pending → delivered`). Cancelling an order releases the reserved inventory quantities back to the ledger.

## Permissions model (PBAC/RBAC)

Strapi 5's admin permission system is already policy-driven (CASL-based). This plugin plugs into it natively on two levels.

### 1. Actions (RBAC surface)

`server/src/bootstrap.ts` registers twelve admin actions in the `plugin::ecommerce-base.*` namespace and seeds five staff roles that own them. All roles are seeded idempotently on bootstrap — existing roles are never overwritten.

| Action                                          | Namespace                             | Description                              |
| ----------------------------------------------- | ------------------------------------- | ---------------------------------------- |
| catalog.read / catalog.manage / catalog.publish | `plugin::ecommerce-base.catalog.*`    | Catalog data, editing, publish/unpublish |
| orders.read / orders.manage / orders.cancel     | `plugin::ecommerce-base.orders.*`     | Order listing, management, cancellation  |
| inventory.read / inventory.adjust               | `plugin::ecommerce-base.inventory.*`  | Stock visibility and manual adjustments  |
| customers.read / customers.manage               | `plugin::ecommerce-base.customers.*`  | Customer visibility and editing          |
| finance.read                                    | `plugin::ecommerce-base.finance.read` | Read-only financials and dashboards      |
| audit.read                                      | `plugin::ecommerce-base.audit.read`   | Audit log access                         |

| Seeded role       | Code                | Owns                                  |
| ----------------- | ------------------- | ------------------------------------- |
| Catalog Manager   | `catalog-manager`   | catalog.\* (read, manage, publish)    |
| Order Manager     | `order-manager`     | orders.\* (read, manage, cancel)      |
| Customer Support  | `customer-support`  | customers.read, orders.read           |
| Inventory Manager | `inventory-manager` | inventory.read, inventory.adjust      |
| Finance           | `finance`           | finance.read, orders.read, audit.read |

### 2. Conditions (PBAC surface)

`server/src/register.ts` registers eight attribute-level condition handlers with the Strapi permission engine. When a permission is granted to a role, an editor can attach conditions so the underlying DB query is narrowed at evaluation time.

| Condition              | Fragment returned for an eligible user                                                |
| ---------------------- | ------------------------------------------------------------------------------------- |
| `is-product-owner`     | `{ 'createdBy.id': user.id }`                                                         |
| `is-order-assigned`    | `{ 'assignedTo.id': user.id }`                                                        |
| `is-customer-assigned` | `{ 'assignedTo.id': user.id }`                                                        |
| `has-inventory-access` | `{ quantity: { $gte: 0 } }` (role check at evaluation time)                           |
| `is-finance-role`      | `{ 'assignedTo.roles': { $elemMatch: { code: { $in: userRoles } } } }`                |
| `is-catalog-manager`   | `{ publishedAt: { $notNull: true } }` (otherwise unsatisfiable `{ id: { $eq: -1 } }`) |
| `is-order-manager`     | `{ status: { $in: ['pending','confirmed','processing'] } }`                           |
| `is-support-agent`     | `{ 'customer.email': { $contains: '' } }`                                             |

Handlers that cannot authorise the user return an **unsatisfiable fragment** (`{ id: { $eq: -1 } }`) rather than an empty object, guaranteeing the CASL query layer always produces a valid — but empty — result set.

## Webhook events

Every mutating service emits a plugin event on `strapi.eventHub` so external systems can react without touching the domain code. Event names are exposed via `WEBHOOK_EVENTS`:

| Event                                                       | Emitted by                                                    |
| ----------------------------------------------------------- | ------------------------------------------------------------- |
| `ecommerce.order.created`                                   | `order.create` (after totals computed and inventory reserved) |
| `ecommerce.order.updated`                                   | `order.transition`, `payment.processPayment`                  |
| `ecommerce.order.cancelled`                                 | cancellation transition                                       |
| `ecommerce.inventory.updated`                               | inventory adjustments and reservations                        |
| `ecommerce.inventory.low-stock`                             | when a ledger row falls below `lowStockThreshold`             |
| `ecommerce.customer.created` / `ecommerce.customer.updated` | customer service                                              |
| `ecommerce.cart.converted`                                  | cart checkout conversion                                      |
| `ecommerce.promotion.used`                                  | promotion application                                         |

External webhook delivery is handled by Strapi's own webhook store (`strapi.webhookStore`), which already subscribes to `eventHub` events — registering a webhook with one of these event names in the Strapi admin (or via API) delivers them to your endpoint.

## API surface

### Admin API

All admin routes sit under the plugin prefix and are protected by `admin::isAuthenticatedAdmin` plus fine-grained `admin::hasPermissions` policies.

| Area       | Routes                                                                                                                                                                         | Required actions                                           |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------- |
| Dashboard  | `GET /dashboard/stats`                                                                                                                                                         | —                                                          |
| Products   | `GET/POST /products`, `GET/PUT/DELETE /products/:id`, `POST /products/:id/{publish,unpublish,archive}`                                                                         | catalog.read / catalog.manage / catalog.publish            |
| Inventory  | `GET /inventory`, `GET /inventory/:id`, `POST /inventory/adjust`                                                                                                               | inventory.read / inventory.adjust                          |
| Orders     | `GET /orders`, `GET /orders/:id`, `POST /orders`, `POST /orders/:id/transition`, `POST /orders/:id/cancel`, `POST /orders/:id/pay`, `GET /orders/stats`                        | orders.read / orders.manage / orders.cancel / finance.read |
| Customers  | `GET /customers`, `GET /customers/:id`, `POST /customers`, `PUT /customers/:id`                                                                                                | customers.read / customers.manage                          |
| Carts      | `GET /carts`, `GET /carts/:id`, `POST /carts/:id/items`, `PUT /carts/:id/items/:itemId`, `DELETE /carts/:id/items/:itemId`, `POST /carts/:id/convert`, `POST /carts/:id/clear` | —                                                          |
| Promotions | `GET/POST /promotions`, `GET/PUT/DELETE /promotions/:id`, `POST /promotions/:id/toggle`                                                                                        | catalog.read / catalog.manage                              |
| Payments   | `GET/POST /payments/gateways`, `POST /orders/:id/refund`                                                                                                                       | finance.read / orders.manage                               |
| Webhooks   | `GET /webhooks/events`, `POST /webhooks/subscribe`                                                                                                                             | audit.read                                                 |
| Audit      | `GET /audit`, `POST /audit/clear`                                                                                                                                              | audit.read                                                 |

### Content API (storefront)

Public routes are exposed under `/api/ecommerce-base/...` and authenticate via Strapi content-API tokens (API tokens or users-permissions):

```
GET  /api/ecommerce-base/products        → listProducts
GET  /api/ecommerce-base/products/:id    → getProduct
POST /api/ecommerce-base/orders          → createOrder
POST /api/ecommerce-base/promotions/apply → applyPromotion
```

## Extending the base system

The most common extension scenarios are covered in depth in the documentation:

- **Custom payment gateways** — see [Extending the base](https://github.com/Paradox-Tech-BD/strapi/tree/main/docs/ecommerce-base/extending.md). The payment service exposes a gateway registry (`payment.registerGateway`); every gateway is a plain object with `id`, `process`, `refund` and `verify` methods. Register one at runtime and it is usable through the admin `pay` endpoint and the storefront checkout flow.
- **Webhook notifications** — the same document shows how to subscribe external URLs to `ecommerce.order.created` and `ecommerce.inventory.updated` using Strapi's native webhook store, with signing secret and retry semantics handled by Strapi core.
- **Domain plugins** — application-specific logic (shop-specific taxes, shipping, checkout flows) should live in your own application plugins that depend on `@strapi/ecommerce-base`, listening to `eventHub` events and calling its services via `strapi.plugin('ecommerce-base').service(name)`.

## Development commands

The plugin inherits the Strapi monorepo tooling. From the repo root:

```bash
yarn nx run @strapi/ecommerce-base:build          # build dist
cd packages/core/ecommerce-base && yarn run test:unit   # 56 unit tests (jest, preset: repo jest-preset.unit.js)
cd packages/core/ecommerce-base && yarn run test:ts:back  # backend typecheck
cd packages/core/ecommerce-base && yarn run test:ts:front # admin typecheck
```

## License

See `LICENSE` — this fork is licensed identically to Strapi (EE-LICENSE).
