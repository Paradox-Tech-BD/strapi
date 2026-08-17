import type { Core } from '@strapi/strapi';

const config = ({ env }: Core.Config.Shared.ConfigParams): Core.Config.Plugin => ({
  'ecommerce-base': {
    enabled: true,
    resolve: '../../packages/core/ecommerce-base',
  },
});

export default config;
