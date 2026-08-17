# Next extension notes

## Playwright E2E source

The repository’s canonical E2E setup is `docs/docs/guides/e2e/00-setup.md`. It states that browser dependencies are installed with `npx playwright install`, tests live under `tests/e2e/tests/`, and the unified runner creates fresh generated Strapi test apps. Domain-scoped runs use `yarn test:e2e --domains=<domain> -- <file-or-playwright-options>`, and CI/script automation should use `--reporter=line` after the inner `--`. The existing admin E2E specs use `@playwright/test`, shared helpers such as `login`, `resetDatabaseAndImportDataFromPath`, `clickAndWait`, and `navToHeader`.

Relevant repository source: `/home/ubuntu/strapi-fork/docs/docs/guides/e2e/00-setup.md`.

## Current ecommerce architecture

The native ecommerce-base plugin currently has content-API routes for product listing, product detail, order creation, and promotion application. The cart service converts an active cart to an order through `order.create`, but it has no currency conversion, tax preview, tax exemption, or dashboard methods. The customer service has CRUD and lifetime-value accounting only. The current admin UI is the only existing dashboard surface; no customer-facing dashboard or standalone checkout frontend exists in this Strapi monorepo.

The current webhook service is an in-process event subscriber over `strapi.eventHub`; there is no provider-specific Stripe or PayPal callback route. Provider webhook integration will therefore need a content-API callback controller/service with signature verification and event-to-order/payment mapping, while preserving the existing eventHub surface.

## Design implication

The requested customer dashboard and checkout support should be implemented as a public content-API domain surface in the native plugin, with tax-preview/checkout endpoints and customer dashboard endpoints. A separate storefront application is not present in this repository and should not be invented without an explicit target UI.
