import assert from 'node:assert/strict';
import test from 'node:test';
import middlewaresConfig from '../config/middlewares';
import serverConfig from '../config/server';

type TestEnvironment = ((key: string, fallback?: unknown) => any) & {
  array: (key: string, fallback?: string[]) => string[];
  bool: (key: string, fallback?: boolean) => boolean;
  int: (key: string, fallback?: number) => number;
};

const createEnvironment = (values: Record<string, unknown>): TestEnvironment => {
  const env = ((key: string, fallback?: unknown) => values[key] ?? fallback) as TestEnvironment;
  env.array = (key, fallback = []) => {
    const value = values[key];
    if (Array.isArray(value)) return value.map(String);
    if (typeof value !== 'string') return fallback;
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  };
  env.bool = (key, fallback = false) => {
    const value = values[key];
    if (typeof value === 'boolean') return value;
    return typeof value === 'string' ? value.toLowerCase() === 'true' : fallback;
  };
  env.int = (key, fallback = 0) => Number(values[key] ?? fallback);
  return env;
};

test('production server configuration uses its public HTTPS URL and trusts the reverse proxy', () => {
  const config = serverConfig({
    env: createEnvironment({
      NODE_ENV: 'production',
      APP_KEYS: 'alpha,beta',
      PUBLIC_URL: 'https://inventel-api.example.com',
      IS_PROXIED: 'true',
    }),
  } as any);

  assert.equal(config.url, 'https://inventel-api.example.com');
  assert.equal(config.proxy, true);
  assert.deepEqual(config.app.keys, ['alpha', 'beta']);
});

test('production server configuration rejects an unsafe single signing key', () => {
  assert.throws(
    () =>
      serverConfig({
        env: createEnvironment({ NODE_ENV: 'production', APP_KEYS: 'only-one-key' }),
      } as any),
    /APP_KEYS must contain at least two strong comma-separated values/
  );
});

test('CORS accepts only the explicitly configured permanent storefront origins', () => {
  const config = middlewaresConfig({
    env: createEnvironment({
      CORS_ORIGINS: 'https://desktop.inventel.example,https://mobile.inventel.example',
    }),
  } as any);
  const cors = config.find((entry) => typeof entry === 'object' && entry.name === 'strapi::cors');

  assert.deepEqual((cors as any)?.config.origin, [
    'https://desktop.inventel.example',
    'https://mobile.inventel.example',
  ]);
  assert.deepEqual((cors as any)?.config.methods, [
    'GET',
    'POST',
    'PUT',
    'PATCH',
    'DELETE',
    'OPTIONS',
  ]);
});
