# Inventel Strapi backend: production deployment

This Strapi application is the **single system of record** for both Inventel storefronts. Product changes made through the Strapi administration experience are exposed immediately through the public catalog API; the storefronts do not carry a separately seeded catalog in production.

## Required runtime choices

Use a managed PostgreSQL database and persistent object storage for uploads. Do not use the SQLite development database for a multi-instance or production deployment, because its file is local to an individual runtime instance.

The server is configured to be deployed behind HTTPS. Set `PUBLIC_URL` to the permanent backend URL and `IS_PROXIED=true` when the hosting provider uses a reverse proxy. Restrict `CORS_ORIGINS` to the two permanent storefront origins, separated by commas. Do not use a wildcard origin for the production service.

## Required environment variables

Generate unique, high-entropy values for every secret below and keep them only in the host’s secret manager.

| Variable              | Purpose                                                         |
| --------------------- | --------------------------------------------------------------- |
| `APP_KEYS`            | At least two comma-separated application signing keys.          |
| `API_TOKEN_SALT`      | Salt used to create content API tokens.                         |
| `ADMIN_JWT_SECRET`    | Secret used for Strapi admin authentication.                    |
| `TRANSFER_TOKEN_SALT` | Salt for Strapi transfer tokens.                                |
| `JWT_SECRET`          | Secret used by the users-permissions plugin.                    |
| `ENCRYPTION_KEY`      | Key used to encrypt Strapi sensitive values.                    |
| `DATABASE_URL`        | Connection URL for the managed PostgreSQL database.             |
| `CORS_ORIGINS`        | Comma-separated permanent URLs of the two Inventel storefronts. |
| `PUBLIC_URL`          | External HTTPS base URL of this Strapi deployment.              |

## Catalog and checkout API

The public storefront contract is intentionally small:

| Method | Endpoint                               | Role                                                  |
| ------ | -------------------------------------- | ----------------------------------------------------- |
| `GET`  | `/api/ecommerce-base/products`         | Read the current published catalogue.                 |
| `GET`  | `/api/ecommerce-base/products/:id`     | Read one product for a product-detail page.           |
| `POST` | `/api/ecommerce-base/checkout/preview` | Validate line items and calculate totals server-side. |

Product creation, updates, publishing, and deletion remain in Strapi’s authenticated administration interface and the plugin’s admin-protected product routes. This preserves full CRUD while ensuring the two public sites have read-only catalog access.

## Deployment verification

After deployment, create the first Strapi administrator through the hosted `/admin` route, then verify that the bootstrap seed catalog is present. Edit one product from the admin interface and request the public `/api/ecommerce-base/products` endpoint: the changed name, price, image, or published status should be returned without rebuilding either storefront.

Use the `.env.example` file as a variable-name reference only. Never deploy the documented development values.
