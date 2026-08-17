import type { Core } from '@strapi/strapi';

const serverConfig = ({ env }: Core.Config.Shared.ConfigParams): Core.Config.Server => {
  const isProduction = env('NODE_ENV', 'development') === 'production';
  const appKeys = env.array('APP_KEYS', []);

  if (isProduction && appKeys.length < 2) {
    throw new Error(
      'APP_KEYS must contain at least two strong comma-separated values in production.'
    );
  }

  return {
    host: env('HOST', '0.0.0.0'),
    port: env.int('PORT', 1337),
    url: env('PUBLIC_URL', undefined),
    proxy: env.bool('IS_PROXIED', isProduction),
    app: {
      keys: appKeys.length ? appKeys : ['local-development-key-1', 'local-development-key-2'],
    },
  };
};

export default serverConfig;
