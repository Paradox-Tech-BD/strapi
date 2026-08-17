import type { Struct } from '@strapi/types';

const schema: Partial<Struct.CollectionTypeSchema> & {
  options: { timestamps: boolean };
} = {
  collectionName: 'ecommerce_tax_rules',
  info: {
    singularName: 'tax-rule',
    pluralName: 'tax-rules',
    displayName: 'Tax Rule',
    description: 'Regional tax rules applied to ecommerce orders.',
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
    region: {
      type: 'string',
      required: true,
    },
    rate: {
      type: 'decimal',
      required: true,
    },
    type: {
      type: 'enumeration',
      enum: ['inclusive', 'exclusive'],
      default: 'exclusive',
    },
    active: {
      type: 'boolean',
      default: true,
    },
    appliesTo: {
      type: 'enumeration',
      enum: ['all', 'physical', 'digital'],
      default: 'all',
    },
  },
};

export default { schema };
