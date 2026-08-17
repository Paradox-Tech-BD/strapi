import auditServiceFactory from '../../services/audit';
import { createStrapiMock } from '../../helpers/strapi';

describe('ecommerce-base audit service', () => {
  it('falls back to in-memory audit entries when the optional audit-entry model is absent', async () => {
    const ctx = createStrapiMock();
    ctx.strapi.db.query = jest.fn(() => {
      throw new Error('Model plugin::ecommerce-base.audit-entry not found');
    });
    const audit = auditServiceFactory({ strapi: ctx.strapi });

    await expect(
      audit.logAction({ action: 'inventory.adjust', resourceType: 'inventory-item', resourceId: 1 })
    ).resolves.toEqual(
      expect.objectContaining({
        id: 1,
        action: 'inventory.adjust',
        resourceType: 'inventory-item',
        resourceId: 1,
      })
    );
    await expect(audit.count()).resolves.toBe(1);
    await expect(audit.findPage()).resolves.toEqual(
      expect.objectContaining({
        results: [expect.objectContaining({ action: 'inventory.adjust' })],
      })
    );
  });
});
