---
title: E-commerce Base — Architecture
description: How the ecommerce-base core plugin extends Strapi core natively
sidebar_label: Architecture
---

# E-commerce Base — Architecture

This document explains how the `ecommerce-base` feature is woven into the Strapi 5 monorepo at the core level, rather than attached as an external npm package. Understanding the integration points helps contributors extend the fork safely and keeps future upgrades of upstream Strapi merge-friendly.

## Repository integration

The official Strapi repository is a Yarn 4 workspaces monorepo managed by Nx. Core plugins live in `packages/core/` (`upload`, `i18n`, `users-permissions`, `documentation`, …) and the Strapi runtime itself in `packages/core/strapi`. The fork adds one more package in exactly the same style:

```
packages/
└── core/
    ├── strapi/                  ← patched (see below)
    ├── upload/
    └── ecommerce-base/          ← NEW core plugin
        ├── admin/src/           ← StrapiApp registration + 5 admin pages
        ├── server/src/          ← content-types, services, controllers, routes, register/bootstrap
        ├── server/src/__tests__/← 56 jest unit tests (services, controllers, pbac)
        ├── package.json         ← strapi.kind = plugin, strapi.required = true
        ├── rollup.config.mjs    ← mirrors upload's rollup config
        └── jest.config.js       ← mirrors upload's jest config
```

Three integration points bind the plugin into the Strapi runtime:

| Integration           | File                                            | Change                                                                                                                                                 |
| --------------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Package dependency    | `packages/core/strapi/package.json`             | Adds `@strapi/ecommerce-base: 5.52.0` alongside the other core plugin deps, so yarn workspaces hoist it and the Strapi CLI resolves it at startup      |
| Admin UI registration | `packages/core/strapi/src/admin.ts`             | `renderAdmin()` passes the plugin's admin export into the `plugins` map of the admin build, so the five menu pages are compiled into the admin bundle  |
| Dev alias             | `packages/core/strapi/src/node/core/aliases.ts` | Adds `@strapi/ecommerce-base/strapi-admin → ./packages/core/ecommerce-base/admin/src` so the dev server resolves the admin source without a build step |

Because the plugin is `required: true` in its manifest, Strapi loads it unconditionally during `strapi.register()` — every application on this fork starts with the commerce domain available.

## Startup sequence

The plugin follows Strapi's standard lifecycle:

1. **register** (`server/src/register.ts`) — registers the eight PBAC condition handlers with `strapi.service('admin::permission').conditionProvider` and subscribes to the permission engine's `after-format::validate.permission` event for audit logging of denied evaluations.
2. **bootstrap** (`server/src/bootstrap.ts`) — runs after content types are loaded. It registers twelve admin actions in the `plugin::ecommerce-base.*` namespace, seeds five staff roles idempotently through `strapi.service('admin::role')` (existing roles are never clobbered), and registers the plugin's webhook events.
3. **routes** — the admin router mounts under the plugin prefix with `admin::isAuthenticatedAdmin` + `admin::hasPermissions` policies per route; the content-API router mounts under `/api/ecommerce-base/...` with standard content-API token authentication.

## Layered design

```
┌───────────────────────────────────────────────────────┐
│ Admin UI (5 pages)          Content-API (storefront)  │
├───────────────────────────────────────────────────────┤
│ Controllers (plain objects, Strapi upload convention) │
├───────────────────────────────────────────────────────┤
│ Services (product, inventory, order, customer, cart,  │
│ promotion, payment, webhook, audit)                   │
├───────────────────────────────────────────────────────┤
│ PBAC layer: condition handlers + permission actions   │
├───────────────────────────────────────────────────────┤
│ Content types (8)  ·  eventHub events  ·  webhook store│
└───────────────────────────────────────────────────────┘
```

### Services

All services follow Strapi's plain-object factory convention, exactly as in `packages/core/upload/server/src/services`:

```typescript
// server/src/services/order.ts
import { getService } from '../utils';

export default ({ strapi }: { strapi: any }) => ({
  async create(input) { ... },
  async transition(id, newStatus) { ... },
});
```

Cross-service calls go through `getService('name')` (a thin typed wrapper over `strapi.plugin('ecommerce-base').service(name)`, mirroring how upload calls `strapi.plugin('upload').service('file')`). Dependency flows are one-directional: domain services call each other through the registry, never by direct file imports, which keeps the modules swappable in tests.

### Controllers

Controllers are plain handler objects — no class, no service injection into the factory — and resolve services via `getService` inside each handler. Permissions are enforced through Strapi's permission manager:

```typescript
const pm = strapi
  .service('admin::permission')
  .createPermissionsManager({
    ability: userAbility,
    action: ACTIONS.ordersRead,
    model: ORDER_MODEL_UID,
  });
if (!pm.isAllowed) return ctx.forbidden();
```

### PBAC conditions

Condition handlers are pure functions of the requesting user returning a database-filter fragment. Fragments are merged into the permission engine's query by the underlying CASL layer. Unsatisfiable fragments use `{ id: { $eq: -1 } }` instead of an empty object so the query layer always remains valid.

### Events and webhooks

Mutating services emit plugin events on `strapi.eventHub` (Strapi 5's native event bus). External notifications ride on Strapi's built-in webhook store, which subscribes to `eventHub` events and delivers payloads to registered URLs with signing secrets and retries — no custom delivery code is needed in the plugin.

## Testing strategy

Tests live in `server/src/__tests__/` and run against the Strapi repo's standard unit preset (`jest-preset.unit.js` at the monorepo root), exactly like upload's test suite. A purpose-built mock harness in `server/src/helpers/strapi.ts` (`createStrapiMock`, `mountServices`, `seedRecords`) provides:

- a stable per-UID `db.query()` mock with an in-memory store and a `matchesWhere` evaluator (supporting `$in`, `$gte`/`$lte`, `$eq`, `$ne`, `$contains` and nested relation fragments such as `{ product: { id } }`);
- a `plugins` surface shaped so the repo's own `tests/setup/unit.setup.js` global-strapi replacement resolves plugin services (`strapi.plugin('ecommerce-base').service(name)` works, which is what `getService` reads from `global.strapi`);
- per-test fresh mocks so call-count assertions do not leak between tests.

Current coverage: 15 product service tests, 17 order service tests, 11 order controller tests, 6 PBAC condition tests — 56 passing.

## Upgrade path

Because the fork modifies only three files outside the new package (`package.json`, `admin.ts`, `aliases.ts`), rebasing onto upstream Strapi releases is a small, reviewable diff. The ecommerce-base package itself is pure additive and needs no porting work.
