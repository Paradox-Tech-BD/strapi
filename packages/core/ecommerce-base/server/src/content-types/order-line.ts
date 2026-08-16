import type { Struct } from '@strapi/types';

export default {
  schema: {
    collectionName: 'ecommerce_order_lines',
    info: {
      singularName: 'order-line',
      pluralName: 'order-lines',
      displayName: 'Order Line',
      description: 'A single line item inside an order.',
    },
    options: {
      timestamps: true,
    },
    pluginOptions: {},
    attributes: {
      order: {
        type: 'relation',
        relation: 'manyToOne',
        target: 'plugin::ecommerce-base.order',
        inversedBy: 'lines',
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
      totalPrice: {
        type: 'decimal',
        required: true,
      },
      productSnapshot: {
        type: 'json',
      },
      sku: {
        type: 'string',
      },
    },
  },
};
