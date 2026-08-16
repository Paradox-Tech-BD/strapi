import type { Core } from '@strapi/types';
import { ACTIONS, STAFF_ROLES, WEBHOOK_EVENTS } from './constants';

const ADMIN_ACTIONS = [
  {
    uid: 'catalog.read',
    displayName: 'Read the catalog',
    pluginName: 'ecommerce-base',
    section: 'plugins',
    category: 'catalog',
  },
  {
    uid: 'catalog.manage',
    displayName: 'Manage the catalog',
    pluginName: 'ecommerce-base',
    section: 'plugins',
    category: 'catalog',
    subCategory: 'products',
  },
  {
    uid: 'catalog.publish',
    displayName: 'Publish products',
    pluginName: 'ecommerce-base',
    section: 'plugins',
    category: 'catalog',
    subCategory: 'products',
  },
  {
    uid: 'orders.read',
    displayName: 'Read orders',
    pluginName: 'ecommerce-base',
    section: 'plugins',
    category: 'orders',
  },
  {
    uid: 'orders.manage',
    displayName: 'Manage orders',
    pluginName: 'ecommerce-base',
    section: 'plugins',
    category: 'orders',
  },
  {
    uid: 'orders.cancel',
    displayName: 'Cancel orders',
    pluginName: 'ecommerce-base',
    section: 'plugins',
    category: 'orders',
  },
  {
    uid: 'inventory.read',
    displayName: 'Read inventory',
    pluginName: 'ecommerce-base',
    section: 'plugins',
    category: 'inventory',
  },
  {
    uid: 'inventory.adjust',
    displayName: 'Adjust inventory',
    pluginName: 'ecommerce-base',
    section: 'plugins',
    category: 'inventory',
  },
  {
    uid: 'customers.read',
    displayName: 'Read customers',
    pluginName: 'ecommerce-base',
    section: 'plugins',
    category: 'customers',
  },
  {
    uid: 'customers.manage',
    displayName: 'Manage customers',
    pluginName: 'ecommerce-base',
    section: 'plugins',
    category: 'customers',
  },
  {
    uid: 'finance.read',
    displayName: 'Read financial data',
    pluginName: 'ecommerce-base',
    section: 'plugins',
    category: 'finance',
  },
  {
    uid: 'audit.read',
    displayName: 'Read the audit log',
    pluginName: 'ecommerce-base',
    section: 'plugins',
    category: 'audit',
  },
];

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
 * Register our admin section actions with the admin permission engine.
 */
const registerPermissionActions = async () => {
  await strapi.service('admin::permission').actionProvider.registerMany(ADMIN_ACTIONS);
};

/**
 * Seed the staff roles shipped with the fork. Idempotent: existing roles are
 * reused, only their action set is synced when the seed runs.
 */
const seedStaffRoles = async () => {
  const roleService = strapi.service('admin::role');
  if (!roleService) return;

  for (const role of STAFF_ROLES) {
    let existing = (await roleService.findAllWithCount()) as any;
    let dbRole = existing[0]?.find?.((r: any) => r.name === role.name || r.code === role.code);
    if (Array.isArray(existing) && existing[0] && !dbRole) {
      dbRole = existing[0].find?.((r: any) => r.name === role.name || r.code === role.code);
    }

    if (!dbRole) {
      const [created] = await roleService.createWithPermission({
        name: role.name,
        description: role.description,
        code: role.code,
      });
      dbRole = created;
    }

    // Sync the permission set for the seeded role (best-effort; ignore if any
    // registered action is missing due to version drift).
    try {
      const permissions = role.actions.map((action) => ({
        action,
        role: dbRole.id,
      }));
      await roleService.assignPermissions(dbRole.id, permissions);
    } catch (err) {
      strapi.log?.warn?.(
        `[ecommerce-base] could not sync permissions for role "${role.name}": ${(err as Error).message}`
      );
    }
  }
};

export async function bootstrap({ strapi }: { strapi: Core.Strapi }) {
  // 1. Register allowed webhook events + permission actions.
  registerWebhookEvents();
  await registerPermissionActions();

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

  // 4. Register the recurring cron that marks abandoned carts.
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
