/**
 * PBAC condition unit tests. The condition handlers are pure functions of the
 * requesting user; each must return a query fragment that the permission
 * engine merges into its database lookup. Handlers that narrow to nothing
 * return an unsatisfiable fragment (`{ id: { $eq: -1 } }`) instead of an
 * empty object so that the underlying CASL/CASL-query layer still produces a
 * valid (but empty) result set.
 */
import { conditions } from '../../register';
import { CONDITIONS } from '../../constants';

const CATALOG_MANAGER = { id: 1, roles: [{ name: 'Catalog Manager' }] };
const ORDER_MANAGER = { id: 2, roles: [{ name: 'Order Manager' }] };
const SUPPORT_AGENT = { id: 3, roles: [{ name: 'Customer Support' }] };
const FINANCE = { id: 4, roles: [{ name: 'Finance' }] };
const ANONYMOUS = { id: 5, roles: [] };
const WAREHOUSE_MANAGER = {
  id: 6,
  roles: [{ code: 'inventory-manager', name: 'Inventory Manager' }],
};
const CATALOG_MANAGER_WITH_CODE = {
  id: 7,
  roles: [{ code: 'catalog-manager', name: 'Catalog Manager' }],
};

function handlerFor(name: string): (user: any) => Record<string, any> {
  const condition = conditions.find((c) => c.name === name);
  if (!condition) throw new Error(`Unknown condition: ${name}`);
  return condition.handler as (user: any) => Record<string, any>;
}

describe('ecommerce-base PBAC conditions', () => {
  describe('is-product-owner', () => {
    const handler = handlerFor(CONDITIONS.isProductOwner);
    it('restricts to products created by the user', () => {
      expect(handler({ id: 42 })).toEqual({ 'createdBy.id': 42 });
    });
  });

  describe('is-order-assigned', () => {
    const handler = handlerFor(CONDITIONS.isOrderAssigned);
    it('restricts to orders assigned to the user', () => {
      expect(handler({ id: 7 })).toEqual({ 'assignedTo.id': 7 });
    });
  });

  describe('is-customer-assigned', () => {
    const handler = handlerFor(CONDITIONS.isCustomerAssigned);
    it('restricts to customers assigned to the user', () => {
      expect(handler({ id: 3 })).toEqual({ 'assignedTo.id': 3 });
    });
  });

  describe('has-inventory-access', () => {
    const handler = handlerFor(CONDITIONS.hasInventoryAccess);
    it('returns a non-restrictive fragment (role check happens at evaluation time)', () => {
      expect(handler(ANONYMOUS)).toEqual({ quantity: { $gte: 0 } });
    });
  });

  describe('is-finance-role', () => {
    const handler = handlerFor(CONDITIONS.isFinanceRole);
    it('matches when the user holds a finance role', () => {
      const fragment = handler(FINANCE);
      // The handler returns a query fragment with a flat dotted key
      // (`assignedTo.roles`), not a nested object path.
      // Handler builds `$in` from each role's `code ?? name`, so the
      // `Finance` role (name only, no code) maps to `'Finance'`.
      expect(fragment['assignedTo.roles']).toMatchObject({
        $elemMatch: { code: { $in: ['Finance'] } },
      });
    });
    it('returns an unsatisfiable fragment for users without a finance role', () => {
      const fragment = handler(ANONYMOUS);
      // Even users without a finance role still get a fragment keyed on
      // `assignedTo.roles`; the empty `$in` list makes it match nothing.
      expect(fragment).toMatchObject({
        'assignedTo.roles': { $elemMatch: { code: { $in: [] } } },
      });
    });
  });

  describe('is-catalog-manager', () => {
    const handler = handlerFor(CONDITIONS.isCatalogManager);
    it('allows published-product access to catalog managers', () => {
      expect(handler(CATALOG_MANAGER)).toEqual({ publishedAt: { $notNull: true } });
    });
    it('returns an unsatisfiable fragment for everyone else', () => {
      expect(handler(ANONYMOUS)).toEqual({ id: { $eq: -1 } });
      expect(handler(ORDER_MANAGER)).toEqual({ id: { $eq: -1 } });
    });
  });

  describe('is-order-manager', () => {
    const handler = handlerFor(CONDITIONS.isOrderManager);
    it('allows active-order access to order managers', () => {
      expect(handler(ORDER_MANAGER)).toEqual({
        status: { $in: ['pending', 'confirmed', 'processing'] },
      });
    });
    it('returns an unsatisfiable fragment for everyone else', () => {
      expect(handler(SUPPORT_AGENT)).toEqual({ id: { $eq: -1 } });
    });
  });

  describe('is-support-agent', () => {
    const handler = handlerFor(CONDITIONS.isSupportAgent);
    it('allows broad customer lookup to support agents', () => {
      expect(handler(SUPPORT_AGENT)).toEqual({ 'customer.email': { $contains: '' } });
    });
    it('returns an unsatisfiable fragment for everyone else', () => {
      expect(handler(FINANCE)).toEqual({ id: { $eq: -1 } });
    });
  });

  describe('is-warehouse-manager', () => {
    const handler = handlerFor(CONDITIONS.isWarehouseManager);

    it('allows users with the inventory-manager role code', () => {
      expect(handler(WAREHOUSE_MANAGER)).toEqual({
        warehouseLocation: { $notNull: true },
      });
    });

    it('allows users with a Warehouse role name', () => {
      expect(handler({ id: 8, roles: [{ name: 'Regional Warehouse Lead' }] })).toEqual({
        warehouseLocation: { $notNull: true },
      });
    });

    it('returns an unsatisfiable fragment for other users', () => {
      expect(handler(ANONYMOUS)).toEqual({ id: { $eq: -1 } });
    });
  });

  describe('is-recent-order-manager', () => {
    const handler = handlerFor(CONDITIONS.isRecentOrderManager);

    it('returns an ISO date within the last 30 days', () => {
      const fragment = handler(ANONYMOUS);
      const date = fragment.createdAt.$gte;
      expect(typeof date).toBe('string');
      expect(Number.isNaN(Date.parse(date))).toBe(false);
      expect(Date.now() - Date.parse(date)).toBeGreaterThanOrEqual(30 * 24 * 60 * 60 * 1000 - 1000);
      expect(Date.now() - Date.parse(date)).toBeLessThan(30 * 24 * 60 * 60 * 1000 + 1000);
    });
  });

  describe('is-active-promotion-manager', () => {
    const handler = handlerFor(CONDITIONS.isActivePromotionManager);

    it('allows catalog managers by role code', () => {
      expect(handler(CATALOG_MANAGER_WITH_CODE)).toEqual({
        active: { $eq: true },
        endsAt: { $gte: expect.any(String) },
      });
    });

    it('returns an unsatisfiable fragment for other users', () => {
      expect(handler(ANONYMOUS)).toEqual({ id: { $eq: -1 } });
    });
  });

  it('registers all eleven conditions under the ecommerce-base plugin', () => {
    for (const condition of conditions) {
      expect(condition.plugin).toBe('ecommerce-base');
      expect(typeof condition.handler).toBe('function');
      expect(condition.displayName).toBeTruthy();
    }
    expect(conditions).toHaveLength(11);
  });
});
