import type { Core } from '@strapi/types';

/**
 * Admin panel routes. Every route is protected by `admin::isAuthenticatedAdmin`
 * plus a fine-grained `admin::hasPermissions` policy tied to the plugin's
 * PBAC action set (see constants.ts).
 */
export const routes: Core.RouterConfig = {
  type: 'admin',
  routes: [
    // Dashboard
    {
      method: 'GET',
      path: '/dashboard/stats',
      handler: 'dashboard.stats',
      config: {
        policies: ['admin::isAuthenticatedAdmin'],
      },
    },
    // Products
    {
      method: 'GET',
      path: '/products',
      handler: 'product.find',
      config: {
        policies: [
          'admin::isAuthenticatedAdmin',
          {
            name: 'admin::hasPermissions',
            config: { actions: ['plugin::ecommerce-base.catalog.read'] },
          },
        ],
      },
    },
    {
      method: 'GET',
      path: '/products/:id',
      handler: 'product.findOne',
      config: {
        policies: [
          'admin::isAuthenticatedAdmin',
          {
            name: 'admin::hasPermissions',
            config: { actions: ['plugin::ecommerce-base.catalog.read'] },
          },
        ],
      },
    },
    {
      method: 'POST',
      path: '/products',
      handler: 'product.create',
      config: {
        policies: [
          'admin::isAuthenticatedAdmin',
          {
            name: 'admin::hasPermissions',
            config: { actions: ['plugin::ecommerce-base.catalog.manage'] },
          },
        ],
      },
    },
    {
      method: 'PUT',
      path: '/products/:id',
      handler: 'product.update',
      config: {
        policies: [
          'admin::isAuthenticatedAdmin',
          {
            name: 'admin::hasPermissions',
            config: { actions: ['plugin::ecommerce-base.catalog.manage'] },
          },
        ],
      },
    },
    {
      method: 'POST',
      path: '/products/:id/publish',
      handler: 'product.publish',
      config: {
        policies: [
          'admin::isAuthenticatedAdmin',
          {
            name: 'admin::hasPermissions',
            config: { actions: ['plugin::ecommerce-base.catalog.publish'] },
          },
        ],
      },
    },
    {
      method: 'POST',
      path: '/products/:id/unpublish',
      handler: 'product.unpublish',
      config: {
        policies: [
          'admin::isAuthenticatedAdmin',
          {
            name: 'admin::hasPermissions',
            config: { actions: ['plugin::ecommerce-base.catalog.publish'] },
          },
        ],
      },
    },
    {
      method: 'POST',
      path: '/products/:id/archive',
      handler: 'product.archive',
      config: {
        policies: [
          'admin::isAuthenticatedAdmin',
          {
            name: 'admin::hasPermissions',
            config: { actions: ['plugin::ecommerce-base.catalog.manage'] },
          },
        ],
      },
    },
    {
      method: 'DELETE',
      path: '/products/:id',
      handler: 'product.delete',
      config: {
        policies: [
          'admin::isAuthenticatedAdmin',
          {
            name: 'admin::hasPermissions',
            config: { actions: ['plugin::ecommerce-base.catalog.manage'] },
          },
        ],
      },
    },
    // Inventory
    {
      method: 'GET',
      path: '/inventory',
      handler: 'inventory.find',
      config: {
        policies: [
          'admin::isAuthenticatedAdmin',
          {
            name: 'admin::hasPermissions',
            config: { actions: ['plugin::ecommerce-base.inventory.read'] },
          },
        ],
      },
    },
    {
      method: 'GET',
      path: '/inventory/low-stock',
      handler: 'inventory.lowStock',
      config: {
        policies: [
          'admin::isAuthenticatedAdmin',
          {
            name: 'admin::hasPermissions',
            config: { actions: ['plugin::ecommerce-base.inventory.read'] },
          },
        ],
      },
    },
    {
      method: 'GET',
      path: '/inventory/:id',
      handler: 'inventory.findOne',
      config: {
        policies: [
          'admin::isAuthenticatedAdmin',
          {
            name: 'admin::hasPermissions',
            config: { actions: ['plugin::ecommerce-base.inventory.read'] },
          },
        ],
      },
    },
    {
      method: 'POST',
      path: '/inventory/:id/adjust',
      handler: 'inventory.adjust',
      config: {
        policies: [
          'admin::isAuthenticatedAdmin',
          {
            name: 'admin::hasPermissions',
            config: { actions: ['plugin::ecommerce-base.inventory.adjust'] },
          },
        ],
      },
    },
    {
      method: 'POST',
      path: '/inventory/:id/reserve',
      handler: 'inventory.reserve',
      config: {
        policies: [
          'admin::isAuthenticatedAdmin',
          {
            name: 'admin::hasPermissions',
            config: { actions: ['plugin::ecommerce-base.inventory.adjust'] },
          },
        ],
      },
    },
    {
      method: 'POST',
      path: '/inventory/:id/release-reservation',
      handler: 'inventory.releaseReservation',
      config: {
        policies: [
          'admin::isAuthenticatedAdmin',
          {
            name: 'admin::hasPermissions',
            config: { actions: ['plugin::ecommerce-base.inventory.adjust'] },
          },
        ],
      },
    },
    // Orders
    {
      method: 'GET',
      path: '/orders',
      handler: 'order.find',
      config: {
        policies: [
          'admin::isAuthenticatedAdmin',
          {
            name: 'admin::hasPermissions',
            config: { actions: ['plugin::ecommerce-base.orders.read'] },
          },
        ],
      },
    },
    {
      method: 'GET',
      path: '/orders/stats',
      handler: 'order.stats',
      config: {
        policies: [
          'admin::isAuthenticatedAdmin',
          {
            name: 'admin::hasPermissions',
            config: { actions: ['plugin::ecommerce-base.finance.read'] },
          },
        ],
      },
    },
    {
      method: 'GET',
      path: '/orders/:id',
      handler: 'order.findOne',
      config: {
        policies: [
          'admin::isAuthenticatedAdmin',
          {
            name: 'admin::hasPermissions',
            config: { actions: ['plugin::ecommerce-base.orders.read'] },
          },
        ],
      },
    },
    {
      method: 'POST',
      path: '/orders',
      handler: 'order.create',
      config: {
        policies: [
          'admin::isAuthenticatedAdmin',
          {
            name: 'admin::hasPermissions',
            config: { actions: ['plugin::ecommerce-base.orders.manage'] },
          },
        ],
      },
    },
    {
      method: 'POST',
      path: '/orders/:id/transition',
      handler: 'order.transition',
      config: {
        policies: [
          'admin::isAuthenticatedAdmin',
          {
            name: 'admin::hasPermissions',
            config: { actions: ['plugin::ecommerce-base.orders.manage'] },
          },
        ],
      },
    },
    {
      method: 'POST',
      path: '/orders/:id/cancel',
      handler: 'order.cancel',
      config: {
        policies: [
          'admin::isAuthenticatedAdmin',
          {
            name: 'admin::hasPermissions',
            config: { actions: ['plugin::ecommerce-base.orders.cancel'] },
          },
        ],
      },
    },
    {
      method: 'POST',
      path: '/orders/:id/pay',
      handler: 'order.pay',
      config: {
        policies: [
          'admin::isAuthenticatedAdmin',
          {
            name: 'admin::hasPermissions',
            config: { actions: ['plugin::ecommerce-base.orders.manage'] },
          },
        ],
      },
    },
    // Customers
    {
      method: 'GET',
      path: '/customers',
      handler: 'customer.find',
      config: {
        policies: [
          'admin::isAuthenticatedAdmin',
          {
            name: 'admin::hasPermissions',
            config: { actions: ['plugin::ecommerce-base.customers.read'] },
          },
        ],
      },
    },
    {
      method: 'GET',
      path: '/customers/:id',
      handler: 'customer.findOne',
      config: {
        policies: [
          'admin::isAuthenticatedAdmin',
          {
            name: 'admin::hasPermissions',
            config: { actions: ['plugin::ecommerce-base.customers.read'] },
          },
        ],
      },
    },
    {
      method: 'POST',
      path: '/customers',
      handler: 'customer.create',
      config: {
        policies: [
          'admin::isAuthenticatedAdmin',
          {
            name: 'admin::hasPermissions',
            config: { actions: ['plugin::ecommerce-base.customers.manage'] },
          },
        ],
      },
    },
    {
      method: 'PUT',
      path: '/customers/:id',
      handler: 'customer.update',
      config: {
        policies: [
          'admin::isAuthenticatedAdmin',
          {
            name: 'admin::hasPermissions',
            config: { actions: ['plugin::ecommerce-base.customers.manage'] },
          },
        ],
      },
    },
    {
      method: 'DELETE',
      path: '/customers/:id',
      handler: 'customer.delete',
      config: {
        policies: [
          'admin::isAuthenticatedAdmin',
          {
            name: 'admin::hasPermissions',
            config: { actions: ['plugin::ecommerce-base.customers.manage'] },
          },
        ],
      },
    },
    // Carts
    {
      method: 'GET',
      path: '/carts/active',
      handler: 'cart.getActive',
      config: {
        policies: ['admin::isAuthenticatedAdmin'],
      },
    },
    {
      method: 'POST',
      path: '/carts/active/items',
      handler: 'cart.addItem',
      config: {
        policies: ['admin::isAuthenticatedAdmin'],
      },
    },
    {
      method: 'PUT',
      path: '/carts/active/items/:itemId',
      handler: 'cart.updateItem',
      config: {
        policies: ['admin::isAuthenticatedAdmin'],
      },
    },
    {
      method: 'DELETE',
      path: '/carts/active/items/:itemId',
      handler: 'cart.removeItem',
      config: {
        policies: ['admin::isAuthenticatedAdmin'],
      },
    },
    {
      method: 'POST',
      path: '/carts/:id/convert',
      handler: 'cart.convert',
      config: {
        policies: [
          'admin::isAuthenticatedAdmin',
          {
            name: 'admin::hasPermissions',
            config: { actions: ['plugin::ecommerce-base.orders.manage'] },
          },
        ],
      },
    },
    {
      method: 'POST',
      path: '/carts/:id/clear',
      handler: 'cart.clear',
      config: {
        policies: ['admin::isAuthenticatedAdmin'],
      },
    },
    // Promotions
    {
      method: 'GET',
      path: '/promotions',
      handler: 'promotion.find',
      config: {
        policies: [
          'admin::isAuthenticatedAdmin',
          {
            name: 'admin::hasPermissions',
            config: { actions: ['plugin::ecommerce-base.catalog.read'] },
          },
        ],
      },
    },
    {
      method: 'GET',
      path: '/promotions/:id',
      handler: 'promotion.findOne',
      config: {
        policies: [
          'admin::isAuthenticatedAdmin',
          {
            name: 'admin::hasPermissions',
            config: { actions: ['plugin::ecommerce-base.catalog.read'] },
          },
        ],
      },
    },
    {
      method: 'POST',
      path: '/promotions',
      handler: 'promotion.create',
      config: {
        policies: [
          'admin::isAuthenticatedAdmin',
          {
            name: 'admin::hasPermissions',
            config: { actions: ['plugin::ecommerce-base.catalog.manage'] },
          },
        ],
      },
    },
    {
      method: 'PUT',
      path: '/promotions/:id',
      handler: 'promotion.update',
      config: {
        policies: [
          'admin::isAuthenticatedAdmin',
          {
            name: 'admin::hasPermissions',
            config: { actions: ['plugin::ecommerce-base.catalog.manage'] },
          },
        ],
      },
    },
    {
      method: 'POST',
      path: '/promotions/:id/toggle',
      handler: 'promotion.toggle',
      config: {
        policies: [
          'admin::isAuthenticatedAdmin',
          {
            name: 'admin::hasPermissions',
            config: { actions: ['plugin::ecommerce-base.catalog.manage'] },
          },
        ],
      },
    },
    {
      method: 'DELETE',
      path: '/promotions/:id',
      handler: 'promotion.delete',
      config: {
        policies: [
          'admin::isAuthenticatedAdmin',
          {
            name: 'admin::hasPermissions',
            config: { actions: ['plugin::ecommerce-base.catalog.manage'] },
          },
        ],
      },
    },
    // Payments
    {
      method: 'GET',
      path: '/payments/gateways',
      handler: 'payment.gateways',
      config: {
        policies: [
          'admin::isAuthenticatedAdmin',
          {
            name: 'admin::hasPermissions',
            config: { actions: ['plugin::ecommerce-base.finance.read'] },
          },
        ],
      },
    },
    {
      method: 'POST',
      path: '/payments/gateways',
      handler: 'payment.registerGateway',
      config: {
        policies: ['admin::isAuthenticatedAdmin'],
      },
    },
    {
      method: 'POST',
      path: '/orders/:id/refund',
      handler: 'payment.refund',
      config: {
        policies: [
          'admin::isAuthenticatedAdmin',
          {
            name: 'admin::hasPermissions',
            config: { actions: ['plugin::ecommerce-base.orders.manage'] },
          },
        ],
      },
    },
    // Webhooks (plugin event surface)
    {
      method: 'GET',
      path: '/webhooks/events',
      handler: 'webhook.events',
      config: {
        policies: [
          'admin::isAuthenticatedAdmin',
          {
            name: 'admin::hasPermissions',
            config: { actions: ['plugin::ecommerce-base.audit.read'] },
          },
        ],
      },
    },
    {
      method: 'POST',
      path: '/webhooks/subscribe',
      handler: 'webhook.subscribe',
      config: {
        policies: [
          'admin::isAuthenticatedAdmin',
          {
            name: 'admin::hasPermissions',
            config: { actions: ['plugin::ecommerce-base.audit.read'] },
          },
        ],
      },
    },
    // Audit
    {
      method: 'GET',
      path: '/audit',
      handler: 'audit.find',
      config: {
        policies: [
          'admin::isAuthenticatedAdmin',
          {
            name: 'admin::hasPermissions',
            config: { actions: ['plugin::ecommerce-base.audit.read'] },
          },
        ],
      },
    },
    {
      method: 'POST',
      path: '/audit/clear',
      handler: 'audit.clear',
      config: {
        policies: [
          'admin::isAuthenticatedAdmin',
          {
            name: 'admin::hasPermissions',
            config: { actions: ['plugin::ecommerce-base.audit.read'] },
          },
        ],
      },
    },
    // Tax rules
    {
      method: 'GET',
      path: '/tax-rules',
      handler: 'tax.find',
      config: {
        policies: [
          'admin::isAuthenticatedAdmin',
          {
            name: 'admin::hasPermissions',
            config: { actions: ['plugin::ecommerce-base.catalog.read'] },
          },
        ],
      },
    },
    {
      method: 'GET',
      path: '/tax-rules/:id',
      handler: 'tax.findOne',
      config: {
        policies: [
          'admin::isAuthenticatedAdmin',
          {
            name: 'admin::hasPermissions',
            config: { actions: ['plugin::ecommerce-base.catalog.read'] },
          },
        ],
      },
    },
    {
      method: 'POST',
      path: '/tax-rules',
      handler: 'tax.create',
      config: {
        policies: [
          'admin::isAuthenticatedAdmin',
          {
            name: 'admin::hasPermissions',
            config: { actions: ['plugin::ecommerce-base.catalog.manage'] },
          },
        ],
      },
    },
    {
      method: 'PUT',
      path: '/tax-rules/:id',
      handler: 'tax.update',
      config: {
        policies: [
          'admin::isAuthenticatedAdmin',
          {
            name: 'admin::hasPermissions',
            config: { actions: ['plugin::ecommerce-base.catalog.manage'] },
          },
        ],
      },
    },
    {
      method: 'DELETE',
      path: '/tax-rules/:id',
      handler: 'tax.delete',
      config: {
        policies: [
          'admin::isAuthenticatedAdmin',
          {
            name: 'admin::hasPermissions',
            config: { actions: ['plugin::ecommerce-base.catalog.manage'] },
          },
        ],
      },
    },
    {
      method: 'POST',
      path: '/tax-rules/compute',
      handler: 'tax.compute',
      config: {
        policies: ['admin::isAuthenticatedAdmin'],
      },
    },
  ],
};
