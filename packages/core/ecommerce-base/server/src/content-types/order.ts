import type { Struct } from '@strapi/types';

export default {
  schema: {
    collectionName: 'ecommerce_orders',
    info: {
      singularName: 'order',
      pluralName: 'orders',
      displayName: 'Order',
      description: 'Customer order with totals, addresses and payment state.',
    },
    options: {
      timestamps: true,
    },
    pluginOptions: {},
    attributes: {
      orderNumber: {
        type: 'string',
        unique: true,
        required: true,
      },
      customer: {
        type: 'relation',
        relation: 'oneToOne',
        target: 'plugin::ecommerce-base.customer',
      },
      lines: {
        type: 'relation',
        relation: 'oneToMany',
        target: 'plugin::ecommerce-base.order-line',
      },
      status: {
        type: 'enumeration',
        enum: [
          'pending',
          'confirmed',
          'processing',
          'shipped',
          'delivered',
          'cancelled',
          'refunded',
        ],
        default: 'pending',
      },
      subtotal: {
        type: 'decimal',
        required: true,
        default: 0,
      },
      discountAmount: {
        type: 'decimal',
        default: 0,
      },
      taxAmount: {
        type: 'decimal',
        default: 0,
      },
      shippingCost: {
        type: 'decimal',
        default: 0,
      },
      total: {
        type: 'decimal',
        required: true,
        default: 0,
      },
      currency: {
        type: 'string',
        default: 'USD',
      },
      shippingAddress: {
        type: 'json',
      },
      billingAddress: {
        type: 'json',
      },
      paymentStatus: {
        type: 'enumeration',
        enum: ['pending', 'authorized', 'paid', 'failed', 'refunded', 'partially_refunded'],
        default: 'pending',
      },
      paymentMethod: {
        type: 'string',
      },
      paymentGateway: {
        type: 'string',
      },
      paymentReference: {
        type: 'string',
      },
      promotionCode: {
        type: 'string',
      },
      assignedTo: {
        type: 'relation',
        relation: 'oneToOne',
        target: 'admin::user',
      },
      notes: {
        type: 'text',
      },
      metadata: {
        type: 'json',
      },
    },
  },
};
