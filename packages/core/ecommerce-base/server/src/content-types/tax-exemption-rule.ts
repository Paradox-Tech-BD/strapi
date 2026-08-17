import type { Struct } from '@strapi/types';

const schema: Partial<Struct.CollectionTypeSchema> & {
  options: { timestamps: boolean };
} = {
  collectionName: 'ecommerce_tax_exemption_rules',
  info: {
    singularName: 'tax-exemption-rule',
    pluralName: 'tax-exemption-rules',
    displayName: 'Tax Exemption Rule',
    description: 'Dynamic customer and checkout tax exemption rules.',
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
    },
    region: {
      type: 'string',
    },
    currency: {
      type: 'string',
    },
    customer: {
      type: 'relation',
      relation: 'oneToOne',
      target: 'plugin::ecommerce-base.customer',
    },
    customerTags: {
      type: 'json',
    },
    emailDomains: {
      type: 'json',
    },
    minimumSubtotal: {
      type: 'decimal',
      default: 0,
    },
    exemptionPercentage: {
      type: 'decimal',
      default: 100,
    },
    active: {
      type: 'boolean',
      default: true,
    },
    startsAt: {
      type: 'datetime',
    },
    endsAt: {
      type: 'datetime',
    },
    metadata: {
      type: 'json',
    },
  },
};

export default { schema };
