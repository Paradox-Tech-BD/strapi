# Ecommerce Base Phase 3 Roadmap and Phase 2 E2E Diagnosis

**Author:** Manus AI  
**Repository:** [Paradox-Tech-BD/strapi](https://github.com/Paradox-Tech-BD/strapi)  
**Baseline:** Strapi 5.52.0 native monorepo fork  
**Current branch:** `main`  
**Phase 2 commit:** [`3ddd016b449611adf255afaefca26961ff582ea5`](https://github.com/Paradox-Tech-BD/strapi/commit/3ddd016b449611adf255afaefca26961ff582ea5)

## Executive summary

Phase 2 expanded the native `@strapi/ecommerce-base` plugin from a tax-rule foundation into a currency-aware checkout and customer domain. It added BDT support at a configured rate of **1 USD = 120 BDT**, dynamic tax exemption matching, customer currency preferences, checkout preview and order routes, dashboard routes, and Playwright coverage for the Tax Rules admin workflow. The final validation set passed with **81 plugin unit tests**, frontend and backend TypeScript checks, a plugin build, and **3 of 3 Tax Rules Playwright tests**.

The principal E2E failure was not caused by the Tax Rules page itself. It was a generated-app composition problem: the test app had an empty `config/plugins.js`, did not declare `@strapi/ecommerce-base` as an app dependency, and therefore did not load the plugin server routes. After explicit package installation and configuration, a second startup failure exposed stale permission metadata and a Strapi 5 role-service incompatibility. Those were corrected before the UI-level dialog semantics were fixed.

## Phase 3 priorities

Phase 3 is planned as a **production-hardening and storefront-contract phase**. The goal is to close the gap between the newly implemented domain services and the integration surfaces that a real storefront, operations team, and deployment pipeline will exercise.

| Priority                              | Technical objective                                                                                    | Main tasks                                                                                                                                                                                       | Completion evidence                                                                         |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| **P1: Checkout contract hardening**   | Make preview and order creation deterministic, validated, and safe for malformed input.                | Add shared input validation for items, quantities, product identifiers, region, currency, addresses, and exemption codes; normalize error responses; preserve legacy order behavior.             | Controller/service tests cover valid, invalid, unsupported-currency, and exemption cases.   |
| **P1: Cart-to-checkout integration**  | Verify the currency-aware cart path reaches the same tax and order pipeline as direct checkout.        | Cover active-cart creation, price conversion, item currency persistence, cart conversion, converted-cart idempotency, and order metadata propagation.                                            | Integration-style Jest tests cover cart → order conversion for USD and BDT.                 |
| **P1: Customer API coverage**         | Turn the dashboard and preferences endpoints into stable authenticated contracts.                      | Test user-to-customer resolution, preferred-currency validation, dashboard currency selection, unsupported-currency errors, and missing customer profiles.                                       | Content-API controller tests and documented response examples.                              |
| **P2: Exemption operations**          | Give administrators a safe way to manage the new `tax-exemption-rule` records.                         | Add admin-facing list/create/update/delete operations or a dedicated management page, including currency, region, customer/tag/code matching, date windows, and exemption percentage validation. | Permission-protected admin workflow tests and validation tests.                             |
| **P2: Operational observability**     | Make tax and checkout behavior diagnosable in production.                                              | Standardize structured checkout/tax metadata, add audit events for exemption matches and currency conversion, and document rate-source/configuration expectations.                               | Metadata contract tests, audit assertions, and runbook documentation.                       |
| **P3: Payment and webhook readiness** | Prepare native payment adapters for real application integration without requiring live sandbox tests. | Add callback contract boundaries, signature-verification seams, idempotency keys, and provider-neutral payment event mapping; continue using mocked adapter tests.                               | Deterministic adapter and webhook contract tests; no live Stripe/PayPal sandbox dependency. |

### Recommended execution order

The recommended order is to harden the shared checkout input contract first, then cover cart conversion and customer endpoints, and only afterwards add the exemption administration surface. This sequence reduces the chance that an admin UI exposes records whose checkout behavior is not yet protected by deterministic validation. Operational metadata and payment callback seams should follow once the core request/response contracts are stable.

## Phase 2 implementation summary

| Area                   | Implementation result                                                                                                                                           | Primary files                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Currency configuration | Added `USD` and `BDT` support with static exchange rates and `USD` as base currency.                                                                            | [`server/src/config.ts`](https://github.com/Paradox-Tech-BD/strapi/blob/main/packages/core/ecommerce-base/server/src/config.ts), [`server/src/services/tax.ts`](https://github.com/Paradox-Tech-BD/strapi/blob/main/packages/core/ecommerce-base/server/src/services/tax.ts)                                                                                                                                                                                                |
| Tax computation        | Added currency conversion, currency-specific tax-rule selection, exemption matching, exemption percentage calculation, and legacy result-shape preservation.    | [`server/src/services/tax.ts`](https://github.com/Paradox-Tech-BD/strapi/blob/main/packages/core/ecommerce-base/server/src/services/tax.ts)                                                                                                                                                                                                                                                                                                                                 |
| Exemption model        | Added the `tax-exemption-rule` collection type with region, currency, customer, tag, email-domain, code, subtotal, percentage, and date-window matching fields. | [`server/src/content-types/tax-exemption-rule.ts`](https://github.com/Paradox-Tech-BD/strapi/blob/main/packages/core/ecommerce-base/server/src/content-types/tax-exemption-rule.ts)                                                                                                                                                                                                                                                                                         |
| Checkout               | Added preview and checkout-order content API routes and passed currency and exemption context into order creation.                                              | [`server/src/controllers/content-api.ts`](https://github.com/Paradox-Tech-BD/strapi/blob/main/packages/core/ecommerce-base/server/src/controllers/content-api.ts), [`server/src/routes/content-api.ts`](https://github.com/Paradox-Tech-BD/strapi/blob/main/packages/core/ecommerce-base/server/src/routes/content-api.ts), [`server/src/services/order.ts`](https://github.com/Paradox-Tech-BD/strapi/blob/main/packages/core/ecommerce-base/server/src/services/order.ts) |
| Customer experience    | Added customer lookup by authenticated user, dashboard summary, recent orders, preferred currency, and preference update route.                                 | [`server/src/services/customer.ts`](https://github.com/Paradox-Tech-BD/strapi/blob/main/packages/core/ecommerce-base/server/src/services/customer.ts)                                                                                                                                                                                                                                                                                                                       |
| Cart                   | Added active-cart currency handling, converted item price snapshots, item currency persistence, and currency propagation to order conversion.                   | [`server/src/services/cart.ts`](https://github.com/Paradox-Tech-BD/strapi/blob/main/packages/core/ecommerce-base/server/src/services/cart.ts)                                                                                                                                                                                                                                                                                                                               |
| Admin UI               | Added Tax Rules page with currency display, BDT-aware form input, empty state, create flow, delete confirmation, and Strapi Design System components.           | [`admin/src/pages/TaxRulesPage.tsx`](https://github.com/Paradox-Tech-BD/strapi/blob/main/packages/core/ecommerce-base/admin/src/pages/TaxRulesPage.tsx)                                                                                                                                                                                                                                                                                                                     |
| E2E test application   | Added explicit ecommerce package dependency and plugin configuration to the app template.                                                                       | [`tests/app-template/package.json`](https://github.com/Paradox-Tech-BD/strapi/blob/main/tests/app-template/package.json), [`tests/app-template/config/plugins.js`](https://github.com/Paradox-Tech-BD/strapi/blob/main/tests/app-template/config/plugins.js)                                                                                                                                                                                                                |

## Detailed E2E diagnosis

### 1. Initial symptom

The Playwright app started successfully and served the Strapi admin shell, but the Tax Rules page did not render its heading. The page request was made against `/admin/plugins/ecommerce-base/tax-rules`, while the page’s data query to `/ecommerce-base/tax-rules?page=1&pageSize=10` returned **404**. The failure pattern distinguished a missing server plugin from a React rendering defect: the admin shell existed, but the plugin’s server route registry did not.

### 2. Why the first hypothesis was plausible but incomplete

The native core admin bundle already imported and registered `ecommerceBase` in `packages/core/strapi/src/admin.ts`. That registration only affects the admin-side plugin bundle. It does not install or enable the server-side plugin inside a generated application. The generated E2E app was created from `tests/app-template`, whose `config/plugins.js` was initially:

```js
module.exports = () => ({});
```

The app template also did not list `@strapi/ecommerce-base` in its dependencies. Consequently, the generated app had no explicit server-side plugin configuration and no package dependency that the loader could resolve.

This distinction is consistent with Strapi’s plugin model: plugin functionality spans the Admin Panel API and Server API, and permission actions must be registered server-side before the admin-side permission declarations can be used effectively [1] [2].

### 3. First fix: explicit dependency and plugin configuration

The app template was updated to declare the native package:

```json
{
  "dependencies": {
    "@strapi/ecommerce-base": "latest"
  }
}
```

The plugin configuration was changed to:

```js
module.exports = () => ({
  'ecommerce-base': { enabled: true },
});
```

The E2E app was then regenerated with the setup flag so the template, package links, and generated dependencies were rebuilt rather than reusing the stale application.

### 4. Second failure exposed by the correct loader path

Once the plugin became visible to the generated app, startup failed during permission registration. The error stated that `category` was only valid for the `settings` section, while ecommerce actions supplied values such as `catalog`, `orders`, and `inventory` under the `plugins` section.

The source of that error was a duplicate legacy action definition in `server/src/bootstrap.ts`. The old `ADMIN_ACTIONS` array registered plugin actions with invalid `category` metadata. The canonical Strapi payload for plugin actions uses `section`, `displayName`, `uid`, and `pluginName`, without a `category` field [1].

The fix consolidated action registration into the plugin `register` lifecycle using `actionProvider.registerMany()`, with UIDs such as `catalog.read` and `orders.read`. This produces action IDs such as `plugin::ecommerce-base.catalog.read` while satisfying the Strapi 5 validation schema.

### 5. Third failure exposed by normal bootstrap execution

After permission validation succeeded, bootstrap failed because the staff-role seeding code called methods from an older or incompatible role-service contract: `findAllWithCount()` and `createWithPermission()` were not present in the Strapi 5.52.0 admin role service.

The seeding path was updated to use `findAllWithUsersCount({})`, `create()`, and `assignPermissions()`. Role creation remains idempotent: existing roles are matched by name or code, new roles are created only when absent, and permission synchronization remains best-effort for version drift.

### 6. Fourth failure was a Design System accessibility/API issue

After the route returned 200 and the Tax Rules page rendered, clicking **Create tax rule** opened an accessible `alertdialog`, not a generic `dialog`. The test initially used `getByRole('dialog')` and was corrected to `getByRole('alertdialog')`.

The form footer then exposed a second Strapi Design System v2 issue. `Dialog.Cancel` and `Dialog.Action` are Radix-based compound components that render with `asChild` semantics. Passing raw text as their child caused the footer buttons not to appear in the accessible DOM. The controls were changed to use nested Design System `Button` elements, and the create/delete mutations were wired to direct buttons so native form submission and mutation callbacks were not intercepted.

This is aligned with Strapi 5’s Design System migration, which documents the Radix-UI migration for Dialog and the broader shift toward root imports, new component APIs, and accessibility-oriented primitives [3].

### 7. Final verification

The regenerated application served the plugin routes, the admin bundle loaded `TaxRulesPage`, and the API requests returned 200. The final Playwright run passed all three workflows: empty state, BDT rule creation/listing, and delete confirmation.

| Validation                |                                 Result |
| ------------------------- | -------------------------------------: |
| Tax Rules E2E workflows   |                           **3 passed** |
| Ecommerce-base unit tests |                          **81 passed** |
| Frontend TypeScript       |                             **Passed** |
| Backend TypeScript        |                             **Passed** |
| Ecommerce-base build      |                             **Passed** |
| Git branch state          | `main` synchronized with `origin/main` |

## References

[1]: https://docs.strapi.io/cms/plugins-development/guides/admin-permissions-for-plugins 'How to create admin permissions from plugins — Strapi 5 Documentation'
[2]: https://docs.strapi.io/cms/plugins-development/developing-plugins 'Developing plugins — Strapi 5 Documentation'
[3]: https://docs.strapi.io/cms/migration/v4-to-v5/breaking-changes/design-system 'The Strapi Design System has been upgraded to v2 — Strapi 5 Documentation'

## Phase 3 implementation completed in this iteration

The first Phase 3 slice has now been implemented as **checkout contract hardening plus cart/customer integration coverage**.

| Change                           | Technical result                                                                                                                                                                                                                            |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Shared checkout normalizer       | Added `server/src/utils/checkout.ts` to validate object payloads, non-empty line items, positive integer product IDs and quantities, non-negative shipping cost, normalized region/codes, and supported checkout- and line-item currencies. |
| Deterministic content-API errors | `previewCheckout` and `createOrder` now convert validation/application failures into consistent 400 responses while allowing unexpected errors to surface.                                                                                  |
| Customer preference validation   | Preference updates normalize currency to uppercase and reject unsupported currencies before reaching the customer service.                                                                                                                  |
| Service-level defense            | Order preview and persisted creation now validate positive quantities, positive product IDs, and supported line-item currencies even when called directly outside the content API.                                                          |
| Content-API contract tests       | Added coverage for valid BDT normalization, malformed quantity rejection, unsupported checkout and line-item currencies, authenticated customer binding, dashboard currency selection, and preference updates.                              |
| Cart integration tests           | Added coverage for BDT price snapshots, cart-to-order currency propagation, converted-cart state, conversion events, and refusal to reconvert a non-active cart.                                                                            |

The Phase 3 slice passes **92 ecommerce-base unit tests**, backend TypeScript validation, the ecommerce-base build, and the existing **3 of 3 Tax Rules Playwright workflows** after regenerating the E2E application. Frontend TypeScript validation remains part of the final repository gate because the Phase 3 changes are server-side but the plugin bundle is built as a whole.

### Phase 3 files added or changed

- [`server/src/utils/checkout.ts`](https://github.com/Paradox-Tech-BD/strapi/blob/main/packages/core/ecommerce-base/server/src/utils/checkout.ts)
- [`server/src/controllers/content-api.ts`](https://github.com/Paradox-Tech-BD/strapi/blob/main/packages/core/ecommerce-base/server/src/controllers/content-api.ts)
- [`server/src/services/order.ts`](https://github.com/Paradox-Tech-BD/strapi/blob/main/packages/core/ecommerce-base/server/src/services/order.ts)
- [`server/src/__tests__/controllers/content-api.test.ts`](https://github.com/Paradox-Tech-BD/strapi/blob/main/packages/core/ecommerce-base/server/src/__tests__/controllers/content-api.test.ts)
- [`server/src/__tests__/services/cart.test.ts`](https://github.com/Paradox-Tech-BD/strapi/blob/main/packages/core/ecommerce-base/server/src/__tests__/services/cart.test.ts)
