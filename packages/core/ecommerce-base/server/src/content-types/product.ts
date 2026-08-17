import type { Struct } from '@strapi/types';

export default {
  schema: {
    collectionName: 'ecommerce_products',
    info: {
      singularName: 'product',
      pluralName: 'products',
      displayName: 'Product',
      description: 'Catalog product with pricing, media and publish lifecycle.',
    },
    options: {
      draftAndPublish: true,
      timestamps: true,
    },
    pluginOptions: {
      'content-manager': { visible: false },
    },
    attributes: {
      name: {
        type: 'string',
        required: true,
      },
      slug: {
        type: 'uid',
        targetField: 'name',
      },
      description: {
        type: 'richtext',
      },
      price: {
        type: 'decimal',
        required: true,
      },
      compareAtPrice: {
        type: 'decimal',
      },
      sku: {
        type: 'string',
      },
      barcode: {
        type: 'string',
      },
      status: {
        type: 'enumeration',
        enum: ['draft', 'published', 'archived'],
        default: 'draft',
      },
      stockTracking: {
        type: 'boolean',
        default: true,
      },
      weightKg: {
        type: 'decimal',
      },
      images: {
        type: 'json',
      },
      metadata: {
        type: 'json',
      },
      tags: {
        type: 'json',
      },
      category: {
        type: 'string',
      },
      currency: {
        type: 'string',
        default: 'USD',
      },
    },
  },
};
