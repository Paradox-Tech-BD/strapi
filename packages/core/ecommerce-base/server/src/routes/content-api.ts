import type { Core } from '@strapi/types';

/**
 * Public content-API routes for storefront consumption. These are exposed
 * under `/api/ecommerce-base/...` and are authenticated via Strapi's standard
 * content-API API tokens or the users-permissions auth layer.
 */
export const routes: Core.RouterConfig = {
  type: 'content-api',
  routes: [
    {
      method: 'GET',
      path: '/products',
      handler: 'content-api.listProducts',
    },
    {
      method: 'GET',
      path: '/products/:id',
      handler: 'content-api.getProduct',
    },
    {
      method: 'POST',
      path: '/orders',
      handler: 'content-api.createOrder',
    },
    {
      method: 'POST',
      path: '/checkout/preview',
      handler: 'content-api.previewCheckout',
    },
    {
      method: 'POST',
      path: '/checkout/orders',
      handler: 'content-api.createCheckoutOrder',
    },
    {
      method: 'GET',
      path: '/customer/dashboard',
      handler: 'content-api.getCustomerDashboard',
      config: { auth: { scope: ['authenticated'] } },
    },
    {
      method: 'PUT',
      path: '/customer/preferences',
      handler: 'content-api.updateCustomerPreferences',
      config: { auth: { scope: ['authenticated'] } },
    },
    {
      method: 'POST',
      path: '/promotions/apply',
      handler: 'content-api.applyPromotion',
    },
  ],
};
