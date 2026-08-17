# Phase 2 — Native Ecommerce Base Extension

## Slide 1 — Phase 2 at a glance

**Title:** Native Ecommerce Base: Multi-Currency Checkout and Tax Operations

**Subtitle:** Strapi 5.52.0 fork | Phase 2 implementation and validation

**Key message:** Phase 2 extended the native `@strapi/ecommerce-base` plugin with BDT-aware tax computation, dynamic exemptions, customer currency preferences, checkout preview/order APIs, and a validated Tax Rules admin workflow.

**Outcome metrics:**

- 81 ecommerce-base unit tests passed.
- Frontend and backend TypeScript checks passed.
- Ecommerce-base build passed.
- 3 of 3 Tax Rules Playwright workflows passed.
- Commit `3ddd016b449611adf255afaefca26961ff582ea5` pushed to `main`.

## Slide 2 — Why the extension was needed

**Title:** From generic commerce foundation to regional checkout capability

The original native plugin provided catalog, inventory, orders, carts, customers, promotions, payments, webhooks, and audit services. Phase 2 addressed the gap between a generic commerce core and a Bangladesh-ready checkout contract.

| Gap                             | Phase 2 response                                     |
| ------------------------------- | ---------------------------------------------------- |
| Single-currency tax assumptions | Base currency plus supported-currency configuration  |
| No BDT support                  | BDT added at 1 USD = 120 BDT                         |
| Static tax rules only           | Currency-aware rule selection and exemption matching |
| No preflight checkout result    | Checkout preview endpoint                            |
| No customer currency preference | Customer preference field and API                    |
| No customer summary surface     | Authenticated customer dashboard endpoint            |
| No admin Tax Rules workflow     | Strapi Design System page with create/delete flows   |

## Slide 3 — Currency-aware tax architecture

**Title:** Currency and tax computation pipeline

```text
Checkout request
  → normalize currency and region
  → validate supported currency
  → convert product/cart prices
  → select region + currency tax rules
  → match active exemption rules
  → calculate gross tax, exempt amount, net tax
  → persist tax metadata on order
```

**Configuration contract:**

```ts
{
  baseCurrency: 'USD',
  supportedCurrencies: ['USD', 'BDT'],
  exchangeRates: { USD: 1, BDT: 120 }
}
```

**Compatibility decision:** Calls that do not provide currency context preserve the legacy `{ taxAmount, effectiveRate, rules }` result shape. Context-aware calls return gross tax, exemption, currency, and exemption percentage fields.

## Slide 4 — Dynamic exemption model

**Title:** Exemptions are data-driven, contextual, and auditable

The new `tax-exemption-rule` model supports matching by region, currency, customer relation, customer tags, email domains, exemption code, minimum subtotal, active window, and exemption percentage.

**Matching sequence:**

1. Reject inactive, region-mismatched, or currency-mismatched rules.
2. Match customer identity, tags, and email domain when configured.
3. Enforce minimum subtotal and start/end dates.
4. Require an exemption code when the rule defines one.
5. Select the highest matching exemption percentage.
6. Persist the matched exemption and tax result in `order.metadata.tax`.

## Slide 5 — Checkout and customer API surface

**Title:** A coherent storefront contract

| Endpoint                    | Purpose                                                                          | Authentication            |
| --------------------------- | -------------------------------------------------------------------------------- | ------------------------- |
| `POST /checkout/preview`    | Calculate converted prices, promotions, tax, and exemptions without persistence. | Public/content API policy |
| `POST /checkout/orders`     | Persist an order using the same checkout calculation pipeline.                   | Public/content API policy |
| `GET /customer/dashboard`   | Return authenticated customer summary and recent orders in a requested currency. | Authenticated user        |
| `PUT /customer/preferences` | Update preferred customer currency with support validation.                      | Authenticated user        |

**Design principle:** Preview and create share the order-service calculation path, reducing drift between what the storefront displays and what is persisted.

## Slide 6 — E2E failure diagnosis

**Title:** The failure was generated-app composition, not page rendering

**Observed behavior:**

- Strapi admin shell loaded successfully.
- `/admin/plugins/ecommerce-base/tax-rules` did not render the expected page.
- `/ecommerce-base/tax-rules?page=1&pageSize=10` returned 404.

**Root cause:** The generated app’s `tests/app-template/config/plugins.js` was empty and its `package.json` did not declare `@strapi/ecommerce-base`. The core admin bundle registration did not install the server-side plugin into the generated test application.

**Diagnostic clue:** A missing server route plus a valid admin shell indicated plugin loading failure rather than a React component failure.

## Slide 7 — E2E fixes and secondary failures uncovered

**Title:** Fixing the loader exposed the real integration chain

| Stage | Failure                                                                      | Fix                                                                                                                       |
| ----- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| 1     | Plugin server routes were absent.                                            | Added ecommerce dependency and explicit `config/plugins.js` enablement; regenerated app.                                  |
| 2     | Permission validation rejected plugin `category` metadata.                   | Removed duplicate legacy bootstrap registration; registered valid plugin actions through `actionProvider.registerMany()`. |
| 3     | Bootstrap called unavailable role-service methods.                           | Migrated seeding to `findAllWithUsersCount`, `create`, and `assignPermissions`.                                           |
| 4     | Test looked for `dialog`, rendered component was `alertdialog`.              | Updated Playwright role selector.                                                                                         |
| 5     | Dialog footer buttons were absent because Radix-based actions use `asChild`. | Wrapped actions in Design System Buttons and used direct submit/mutation buttons.                                         |

## Slide 8 — Validation results

**Title:** Phase 2 completed with deterministic evidence

| Validation                 |                                 Result |
| -------------------------- | -------------------------------------: |
| Ecommerce-base unit tests  |                          **81 passed** |
| Tax Rules Playwright tests |                           **3 passed** |
| Frontend TypeScript        |                             **Passed** |
| Backend TypeScript         |                             **Passed** |
| Ecommerce-base build       |                             **Passed** |
| Git status                 | `main` synchronized with `origin/main` |

**E2E workflows covered:**

- Empty Tax Rules state and create action.
- Create and list a BDT-specific rule with a 15% rate.
- Delete a rule after confirmation.

## Slide 9 — Phase 3 priorities

**Title:** Phase 3 — production hardening and storefront integration

**Priority 1: Checkout contract hardening.** Add shared validation and deterministic error responses for items, quantities, region, currency, addresses, and exemption codes.

**Priority 2: Cart-to-checkout integration.** Cover active-cart creation, BDT price snapshots, item currency persistence, conversion to orders, idempotency, and tax metadata propagation.

**Priority 3: Customer API coverage.** Test authenticated user-to-customer resolution, dashboard currency selection, preferences, unsupported currencies, and missing profiles.

**Priority 4: Exemption operations.** Add a protected administrator workflow for managing exemption rules and validating date, percentage, code, region, and currency constraints.

**Priority 5: Operational readiness.** Standardize structured tax metadata, audit events, provider-neutral payment callback seams, and deterministic webhook contract tests.

## Slide 10 — Engineering principles and next decision

**Title:** Preserve native Strapi behavior while extending safely

- Keep domain logic in the native plugin’s services and content types.
- Register permissions server-side before admin-side menu/page protection.
- Use Strapi Design System v2 root imports and Radix-compatible compound components.
- Preserve legacy service result shapes where existing callers depend on them.
- Prefer deterministic adapter and contract tests over live payment sandbox tests.
- Keep storefront-specific policies and jurisdiction logic in application-level extensions.

**Decision for Phase 3:** Start with checkout validation and cart/customer integration tests, then expose exemption administration once the contract is stable.

## References

[1]: https://docs.strapi.io/cms/plugins-development/guides/admin-permissions-for-plugins 'How to create admin permissions from plugins — Strapi 5 Documentation'
[2]: https://docs.strapi.io/cms/plugins-development/developing-plugins 'Developing plugins — Strapi 5 Documentation'
[3]: https://docs.strapi.io/cms/migration/v4-to-v5/breaking-changes/design-system 'The Strapi Design System has been upgraded to v2 — Strapi 5 Documentation'
