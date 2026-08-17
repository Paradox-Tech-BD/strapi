import type { Struct } from '@strapi/types';

export default {
  schema: {
    collectionName: 'ecommerce_cart_items',
    info: {
      singularName: 'cart-item',
      pluralName: 'cart-items',
      displayName: 'Cart Item',
      description: 'A line item inside a shopping cart.',
    },
    options: {
      timestamps: true,
    },
    pluginOptions: {},
    attributes: {
      cart: {
        type: 'relation',
        relation: 'manyToOne',
        target: 'plugin::ecommerce-base.cart',
        inversedBy: 'items',
      },
      product: {
        type: 'relation',
        relation: 'oneToOne',
        target: 'plugin::ecommerce-base.product',
      },
      quantity: {
        type: 'integer',
        required: true,
        default: 1,
      },
      unitPrice: {
        type: 'decimal',
        required: true,
      },
      currency: {
        type: 'string',
        default: 'USD',
      },
    },
  },
};
