import type { Struct } from '@strapi/types';

export default {
  schema: {
    collectionName: 'ecommerce_inventory_items',
    info: {
      singularName: 'inventory-item',
      pluralName: 'inventory-items',
      displayName: 'Inventory Item',
      description: 'Stock ledger row bound to a product variant/SKU.',
    },
    options: {
      timestamps: true,
    },
    pluginOptions: {},
    attributes: {
      product: {
        type: 'relation',
        relation: 'oneToOne',
        target: 'plugin::ecommerce-base.product',
        required: true,
      },
      sku: {
        type: 'string',
        required: true,
        unique: true,
      },
      quantity: {
        type: 'integer',
        default: 0,
      },
      reservedQuantity: {
        type: 'integer',
        default: 0,
      },
      lowStockThreshold: {
        type: 'integer',
        default: 10,
      },
      warehouseLocation: {
        type: 'string',
      },
      restockAt: {
        type: 'datetime',
      },
      notes: {
        type: 'text',
      },
    },
  },
};
