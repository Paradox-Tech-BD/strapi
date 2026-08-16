import type { Struct } from '@strapi/types';

export default {
  schema: {
    collectionName: 'ecommerce_promotions',
    info: {
      singularName: 'promotion',
      pluralName: 'promotions',
      displayName: 'Promotion',
      description: 'Discount code / campaign with eligibility windows and limits.',
    },
    options: {
      timestamps: true,
    },
    pluginOptions: {},
    attributes: {
      name: {
        type: 'string',
        required: true,
      },
      code: {
        type: 'string',
        unique: true,
        required: true,
      },
      type: {
        type: 'enumeration',
        enum: ['percentage', 'fixed', 'freeShipping'],
        required: true,
      },
      value: {
        type: 'decimal',
        required: true,
      },
      minOrderAmount: {
        type: 'decimal',
        default: 0,
      },
      maxUses: {
        type: 'integer',
      },
      maxUsesPerCustomer: {
        type: 'integer',
      },
      usedCount: {
        type: 'integer',
        default: 0,
      },
      startsAt: {
        type: 'datetime',
      },
      expiresAt: {
        type: 'datetime',
      },
      isActive: {
        type: 'boolean',
        default: true,
      },
      appliesTo: {
        type: 'enumeration',
        enum: ['all', 'categories', 'products'],
        default: 'all',
      },
      conditions: {
        type: 'json',
      },
    },
  },
};
