import { CONDITIONS } from './constants';

type User = any;
type Role = any;

/**
 * Conditions return database-filter fragments that are merged into the
 * permission query when the permission engine evaluates access.
 */
export const conditions = [
  {
    displayName: 'Is product owner',
    name: CONDITIONS.isProductOwner,
    plugin: 'ecommerce-base',
    handler: (user: User) => {
      // Product owners manage products whose createdBy matches the user.
      return { 'createdBy.id': user.id };
    },
  },
  {
    displayName: 'Is assigned to order',
    name: CONDITIONS.isOrderAssigned,
    plugin: 'ecommerce-base',
    handler: (user: User) => {
      return { 'assignedTo.id': user.id };
    },
  },
  {
    displayName: 'Is assigned to customer',
    name: CONDITIONS.isCustomerAssigned,
    plugin: 'ecommerce-base',
    handler: (user: User) => {
      return { 'assignedTo.id': user.id };
    },
  },
  {
    displayName: 'Has inventory access',
    name: CONDITIONS.hasInventoryAccess,
    plugin: 'ecommerce-base',
    handler: (_user: User) => {
      // Granted when the user holds any role that includes the
      // inventory.read / inventory.adjust actions. Checked at evaluation time
      // by the PBAC middleware; the condition passes for all warehouse sites.
      return { quantity: { $gte: 0 } };
    },
  },
  {
    displayName: 'Is finance role',
    name: CONDITIONS.isFinanceRole,
    plugin: 'ecommerce-base',
    handler: (user: User) => {
      return {
        'assignedTo.roles': {
          $elemMatch: {
            code: { $in: user.roles?.map((r: Role) => r.code ?? r.name) ?? [] },
          },
        },
      };
    },
  },
  {
    displayName: 'Is catalog manager',
    name: CONDITIONS.isCatalogManager,
    plugin: 'ecommerce-base',
    handler: (user: User) => {
      const roleNames = user.roles?.map((r: Role) => r.name) ?? [];
      const isManager = roleNames.some((name: string) => name === 'Catalog Manager');
      if (!isManager) return { id: { $eq: -1 } }; // never match
      return { publishedAt: { $notNull: true } };
    },
  },
  {
    displayName: 'Is order manager',
    name: CONDITIONS.isOrderManager,
    plugin: 'ecommerce-base',
    handler: (user: User) => {
      const roleNames = user.roles?.map((r: Role) => r.name) ?? [];
      const isManager = roleNames.some((name: string) => name === 'Order Manager');
      if (!isManager) return { id: { $eq: -1 } };
      return { status: { $in: ['pending', 'confirmed', 'processing'] } };
    },
  },
  {
    displayName: 'Is support agent',
    name: CONDITIONS.isSupportAgent,
    plugin: 'ecommerce-base',
    handler: (user: User) => {
      const roleNames = user.roles?.map((r: Role) => r.name) ?? [];
      const isAgent = roleNames.some((name: string) => name === 'Customer Support');
      if (!isAgent) return { id: { $eq: -1 } };
      return { 'customer.email': { $contains: '' } };
    },
  },
];

export async function register({ strapi }: { strapi: any }) {
  // Register PBAC conditions on the admin permission engine.
  const permissionService = strapi.service('admin::permission');
  if (permissionService?.conditionProvider) {
    for (const condition of conditions) {
      await permissionService.conditionProvider.register(condition);
    }
  }
  // Subscribe to engine lifecycle to log denied evaluations for audit.
  const engine = permissionService?.engine;
  if (engine?.on) {
    engine.on('after-format::validate.permission', ({ permission }: { permission: any }) => {
      const denied = permission.properties?.denied;
      if (denied) {
        strapi.log?.debug(
          `[ecommerce-base] permission "${permission.action}" denied for ${permission.role}`
        );
      }
    });
  }
}
