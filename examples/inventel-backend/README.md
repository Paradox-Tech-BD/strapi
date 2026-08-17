# Inventel backend

This example app runs the Strapi 5.52.0 fork with the `@strapi/ecommerce-base` plugin enabled. It uses SQLite for a local sandbox database and seeds four published products only when the catalog is empty. Existing product records are never overwritten during bootstrap.

## Run locally

From the Strapi repository root:

```bash
yarn install
yarn workspace @strapi/ecommerce-base build
cd examples/inventel-backend
yarn develop
```

The admin panel is available at `http://localhost:1337/admin`. On the first run, create a Strapi super-admin account. Products can then be edited from the ecommerce-base catalog screens. Changes to published products are returned by `GET /api/ecommerce-base/products` and appear in the Inventel storefront after a refresh.

The Inventel Vite app proxies `/strapi/*` to `http://127.0.0.1:1337` by default. Override the target with `STRAPI_TARGET` when the backend runs elsewhere.
