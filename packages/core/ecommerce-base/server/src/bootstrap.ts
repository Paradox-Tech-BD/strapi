import type { Core } from '@strapi/types';
import { STAFF_ROLES, WEBHOOK_EVENTS } from './constants';
import { createPayPalGateway, createStripeGateway } from './gateways';

/**
 * Register custom webhook events so they can be forwarded to
 * webhook endpoints defined in the admin panel (Webhooks settings page).
 */
const registerWebhookEvents = () => {
  if (strapi.get?.('webhookStore')?.addAllowedEvent) {
    Object.entries(WEBHOOK_EVENTS).forEach(([key, value]) => {
      strapi.get('webhookStore').addAllowedEvent(key, value);
    });
  }
};

/**
 * Seed the staff roles shipped with the fork. Idempotent: existing roles are
 * reused, only their action set is synced when the seed runs.
 */
const seedStaffRoles = async () => {
  const roleService = strapi.service('admin::role');
  if (!roleService?.findAllWithUsersCount || !roleService.create) return;

  const existingRoles = (await roleService.findAllWithUsersCount({})) as any[];

  for (const role of STAFF_ROLES) {
    let dbRole = existingRoles.find(
      (candidate) => candidate.name === role.name || candidate.code === role.code
    );

    if (!dbRole) {
      dbRole = await roleService.create({
        name: role.name,
        description: role.description,
        code: role.code,
      });
      existingRoles.push(dbRole);
    }

    // Sync the permission set for the seeded role (best-effort; ignore if any
    // registered action is missing due to version drift).
    try {
      const permissions = role.actions.map((action) => ({ action }));
      await roleService.assignPermissions(dbRole.id, permissions);
    } catch (err) {
      strapi.log?.warn?.(
        `[ecommerce-base] could not sync permissions for role "${role.name}": ${(err as Error).message}`
      );
    }
  }
};

export async function bootstrap({ strapi }: { strapi: Core.Strapi }) {
  // 1. Register allowed webhook events. Permission actions are registered in
  // the plugin register lifecycle before bootstrap runs.
  registerWebhookEvents();

  // 2. Seed default staff roles (Catalog Manager, Order Manager, …).
  await seedStaffRoles();

  // 3. Persist the plugin store defaults (payment, webhooks, audit).
  const storeDefaults = {
    payment: { gateway: 'mock' },
    webhooks: { emitEvents: true },
    audit: { enabled: true },
  };
  const configurator = strapi.store!({ type: 'plugin', name: 'ecommerce-base', key: 'settings' });
  const existing = await configurator.get({});
  await configurator.set({
    value: { ...storeDefaults, ...(existing ?? {}) },
  });

  // 4. Register optional payment gateways when their credentials are configured.
  try {
    const paymentService = strapi.plugin('ecommerce-base').service('payment');
    if (process.env.STRIPE_SECRET_KEY) {
      paymentService.registerGateway(createStripeGateway(process.env.STRIPE_SECRET_KEY));
    } else {
      strapi.log?.warn?.('[ecommerce-base] STRIPE_SECRET_KEY is not set; Stripe gateway skipped');
    }
    if (process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET) {
      paymentService.registerGateway(
        createPayPalGateway(process.env.PAYPAL_CLIENT_ID, process.env.PAYPAL_CLIENT_SECRET)
      );
    } else {
      strapi.log?.warn?.('[ecommerce-base] PayPal credentials are not set; PayPal gateway skipped');
    }
  } catch (error) {
    strapi.log?.warn?.(
      `[ecommerce-base] optional payment gateway registration failed: ${(error as Error).message}`
    );
  }

  // 5. Register the recurring cron that marks abandoned carts.
  strapi.cron.add({
    'ecommerce-abandon-carts': {
      task: async () => {
        const days = Number(
          strapi.config?.get?.('plugin::ecommerce-base.carts.expirationDays') ?? 30
        );
        const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
        await strapi.db.query('plugin::ecommerce-base.cart').updateMany({
          where: {
            status: 'active',
            updatedAt: { $lt: cutoff },
          },
          data: { status: 'abandoned' },
        });
      },
      options: { rule: '0 0 */12 * *' },
    },
  });

  strapi.log?.info?.('[ecommerce-base] e-commerce base plugin bootstrapped');
}
