import type { Struct } from '@strapi/types';

export default {
  schema: {
    collectionName: 'ecommerce_carts',
    info: {
      singularName: 'cart',
      pluralName: 'carts',
      displayName: 'Cart',
      description: 'Shopping cart aggregating items for a customer or session.',
    },
    options: {
      timestamps: true,
    },
    pluginOptions: {},
    attributes: {
      customer: {
        type: 'relation',
        relation: 'oneToOne',
        target: 'plugin::ecommerce-base.customer',
      },
      sessionId: {
        type: 'string',
      },
      items: {
        type: 'relation',
        relation: 'oneToMany',
        target: 'plugin::ecommerce-base.cart-item',
      },
      status: {
        type: 'enumeration',
        enum: ['active', 'abandoned', 'converted'],
        default: 'active',
      },
      subtotal: {
        type: 'decimal',
        default: 0,
      },
      currency: {
        type: 'string',
        default: 'USD',
      },
      expiresAt: {
        type: 'datetime',
      },
      convertedOrderId: {
        type: 'string',
      },
    },
  },
};
