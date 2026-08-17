import type { Struct } from '@strapi/types';

export default {
  schema: {
    collectionName: 'ecommerce_customers',
    info: {
      singularName: 'customer',
      pluralName: 'customers',
      displayName: 'Customer',
      description: 'E-commerce customer record with addresses and order history.',
    },
    options: {
      timestamps: true,
    },
    pluginOptions: {},
    attributes: {
      firstName: {
        type: 'string',
        required: true,
      },
      lastName: {
        type: 'string',
      },
      email: {
        type: 'string',
        unique: true,
        required: true,
      },
      phone: {
        type: 'string',
      },
      status: {
        type: 'enumeration',
        enum: ['active', 'inactive', 'blocked'],
        default: 'active',
      },
      addresses: {
        type: 'json',
      },
      lifetimeValue: {
        type: 'decimal',
        default: 0,
      },
      orderCount: {
        type: 'integer',
        default: 0,
      },
      lastOrderAt: {
        type: 'datetime',
      },
      marketingOptIn: {
        type: 'boolean',
        default: false,
      },
      preferredCurrency: {
        type: 'string',
        default: 'USD',
      },
      metadata: {
        type: 'json',
      },
      user: {
        type: 'relation',
        relation: 'oneToOne',
        target: 'plugin::users-permissions.user',
      },
      assignedTo: {
        type: 'relation',
        relation: 'oneToOne',
        target: 'admin::user',
      },
    },
  },
};
