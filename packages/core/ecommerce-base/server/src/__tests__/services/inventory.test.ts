import inventoryServiceFactory from '../../services/inventory';
import { INVENTORY_ITEM_MODEL_UID } from '../../constants';
import { createDbQueryMock, createStrapiMock } from '../../helpers/strapi';

describe('ecommerce-base inventory service', () => {
  it('returns only inventory rows at or below their own low-stock threshold', async () => {
    const db = createDbQueryMock({
      [INVENTORY_ITEM_MODEL_UID]: [
        { id: 1, sku: 'LOW', quantity: 3, lowStockThreshold: 5 },
        { id: 2, sku: 'HEALTHY', quantity: 12, lowStockThreshold: 5 },
        { id: 3, sku: 'EMPTY', quantity: 0, lowStockThreshold: 10 },
      ],
    });
    const ctx = createStrapiMock({ db });
    const inventory = inventoryServiceFactory({ strapi: ctx.strapi });

    await expect(inventory.lowStockReport()).resolves.toEqual([
      expect.objectContaining({ id: 1, sku: 'LOW' }),
      expect.objectContaining({ id: 3, sku: 'EMPTY' }),
    ]);
    expect(db.query(INVENTORY_ITEM_MODEL_UID).findMany).toHaveBeenCalledWith({
      populate: { product: true },
    });
  });
});
