# Multi-currency tax and dynamic exemption contract

The ecommerce-base plugin remains currency-provider agnostic. It does not fetch live foreign-exchange rates. Applications configure a base currency and a static exchange-rate map through the plugin configuration, making checkout totals deterministic and auditable.

## Configuration

```js
module.exports = ({ env }) => ({
  ecommerceBase: {
    tax: {
      baseCurrency: 'USD',
      supportedCurrencies: ['USD', 'BDT', 'EUR', 'GBP'],
      exchangeRates: {
        USD: 1,
        BDT: 120,
        EUR: 0.92,
        GBP: 0.79,
      },
    },
  },
});
```

Rates express one unit of the configured base currency in each supported currency. Conversion follows `amountInTarget = amountInBase * targetRate / sourceRate`. Missing or unsupported currency rates are rejected rather than guessed.

## Tax rules

Tax rules keep their existing regional, active-window, inclusive/exclusive, and applies-to behavior. A rule may optionally specify a currency; currency-specific rules are preferred, followed by currency-neutral rules. Exclusive rates are summed and rounded to four decimal places before tax is calculated.

## Dynamic exemption rules

A tax-exemption rule may match any combination of region, currency, customer relation, customer tags, email domains, minimum subtotal, and an optional customer-entered exemption code. All specified predicates must match. Rules are active only when their active flag and optional start/end timestamps allow them. When multiple rules match, the highest exemption percentage wins and is capped at 100 percent.

## Checkout and dashboard endpoints

The public Content API exposes:

| Method | Path                                       | Purpose                                                                                                                                      |
| ------ | ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST` | `/api/ecommerce-base/checkout/preview`     | Convert product prices into the requested currency, apply promotion and regional tax, evaluate exemptions, and return a non-persisted total. |
| `POST` | `/api/ecommerce-base/checkout/orders`      | Run the same calculation and persist the order with currency conversion and exemption metadata.                                              |
| `GET`  | `/api/ecommerce-base/customer/dashboard`   | Return the authenticated customer profile, preferred currency, recent orders, and lifetime totals.                                           |
| `PUT`  | `/api/ecommerce-base/customer/preferences` | Update the authenticated customer’s preferred currency.                                                                                      |

The existing `POST /api/ecommerce-base/orders` route remains backward compatible and accepts the new optional `currency`, `region`, `exemptionCode`, and `customerId` fields.

## Stored audit data

Orders persist the selected currency, source currency, conversion rate, tax amount, effective rate, matched rules, and exemption result in `metadata.tax`. The line prices are snapshots in the order currency, and the original product currency is retained in each line’s product snapshot.
