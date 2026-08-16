import { errors } from '@strapi/utils';
import productFactory from '../../services/product';
import { createStrapiMock, mountServices, seedRecords } from '../../helpers/strapi';
import { PRODUCT_MODEL_UID } from '../../constants';

const { ApplicationError, ValidationError } = errors;

describe('ecommerce-base product service', () => {
  let ctx: ReturnType<typeof createStrapiMock>;
  let product: ReturnType<typeof productFactory>;
  let dbQuery: jest.Mock;
  let inventoryMock: { createForProduct: jest.Mock };

  beforeEach(() => {
    ctx = createStrapiMock();
    dbQuery = ctx.db.query as unknown as jest.Mock;
    // Fresh mock per test so call counts do not leak between tests.
    inventoryMock = { createForProduct: jest.fn(async () => ({})) };
    mountServices(ctx, { inventory: inventoryMock });
    product = productFactory({ strapi: ctx.strapi });
    // `getService()` reads `global.strapi` (see `server/src/utils`).
    (global as unknown as Record<string, unknown>).strapi = ctx.strapi;
  });

  afterEach(() => {
    delete (global as unknown as Record<string, unknown>).strapi;
  });

  describe('create', () => {
    it('persists a product and auto-creates an inventory ledger row', async () => {
      const input = { name: 'Denim Jacket', price: 89.99, currency: 'USD' };
      const created = await product.create(input);

      const createCall = dbQuery(PRODUCT_MODEL_UID).create as jest.Mock;
      expect(createCall).toHaveBeenCalledWith({ data: expect.objectContaining(input) });
      expect(created.id).toBe(1);
      // stock tracking on by default: an inventory ledger row is seeded for
      // every new product unless explicitly disabled.
      expect(inventoryMock.createForProduct).toHaveBeenCalledWith({
        productId: created.id,
        sku: `SKU-${created.id}`,
      });
    });

    it('skips inventory seeding when stock tracking is disabled', async () => {
      await product.create({ name: 'Digital Download', price: 10, stockTracking: false });
      expect(inventoryMock.createForProduct).not.toHaveBeenCalled();
    });

    it('rejects products with negative prices', async () => {
      await expect(product.create({ name: 'Bad', price: -5 })).rejects.toBeInstanceOf(
        ValidationError
      );
    });

    it('rejects a compareAtPrice lower than the price', async () => {
      await expect(
        product.create({ name: 'Jacket', price: 100, compareAtPrice: 50 })
      ).rejects.toBeInstanceOf(ValidationError);
    });
  });

  describe('findOne', () => {
    it('throws when the product does not exist', async () => {
      seedRecords(ctx.db.query as any, PRODUCT_MODEL_UID, []);
      await expect(product.findOne(42)).rejects.toBeInstanceOf(ApplicationError);
    });

    it('returns the product', async () => {
      seedRecords(ctx.db.query as any, PRODUCT_MODEL_UID, [{ id: 1, name: 'Cap', price: 25 }]);
      const result = await product.findOne(1);
      expect(result?.name).toBe('Cap');
    });
  });

  describe('update', () => {
    it('throws when the product does not exist', async () => {
      seedRecords(ctx.db.query as any, PRODUCT_MODEL_UID, []);
      await expect(product.update(42, { price: 5 })).rejects.toBeInstanceOf(ApplicationError);
    });

    it('updates product data', async () => {
      seedRecords(ctx.db.query as any, PRODUCT_MODEL_UID, [{ id: 5, name: 'Beanie', price: 12 }]);
      await product.update(5, { price: 15 });
      expect(dbQuery(PRODUCT_MODEL_UID).update).toHaveBeenCalledWith({
        where: { id: 5 },
        data: { price: 15 },
      });
    });
  });

  describe('publish / unpublish', () => {
    it('publishes a draft product with a timestamp', async () => {
      seedRecords(ctx.db.query as any, PRODUCT_MODEL_UID, [
        { id: 7, name: 'Hoodie', status: 'draft' },
      ]);
      const published = await product.publish(7);
      const updateCall = dbQuery(PRODUCT_MODEL_UID).update as jest.Mock;
      expect(updateCall).toHaveBeenCalledWith({
        where: { id: 7 },
        data: { status: 'published', publishedAt: expect.any(String) },
      });
      expect(published.status).toBe('published');
    });

    it('refuses to publish archived products', async () => {
      seedRecords(ctx.db.query as any, PRODUCT_MODEL_UID, [
        { id: 8, name: 'Boots', status: 'archived' },
      ]);
      await expect(product.publish(8)).rejects.toBeInstanceOf(ApplicationError);
    });

    it('unpublishes a published product back to draft', async () => {
      seedRecords(ctx.db.query as any, PRODUCT_MODEL_UID, [
        { id: 10, name: 'Gloves', status: 'published' },
      ]);
      const unpublished = await product.unpublish(10);
      expect(dbQuery(PRODUCT_MODEL_UID).update).toHaveBeenCalledWith({
        where: { id: 10 },
        data: { status: 'draft', publishedAt: null },
      });
      expect(unpublished.status).toBe('draft');
    });

    it('archives a product', async () => {
      seedRecords(ctx.db.query as any, PRODUCT_MODEL_UID, [
        { id: 9, name: 'Scarf', status: 'published' },
      ]);
      await product.archive(9);
      expect(dbQuery(PRODUCT_MODEL_UID).update).toHaveBeenCalledWith({
        where: { id: 9 },
        data: { status: 'archived' },
      });
    });
  });

  describe('delete', () => {
    it('throws when the product does not exist', async () => {
      seedRecords(ctx.db.query as any, PRODUCT_MODEL_UID, []);
      await expect(product.delete(99)).rejects.toBeInstanceOf(ApplicationError);
    });

    it('deletes the product and its inventory ledger rows', async () => {
      seedRecords(ctx.db.query as any, PRODUCT_MODEL_UID, [
        { id: 3, name: 'Cap', status: 'draft' },
      ]);
      await product.delete(3);
      expect(dbQuery(PRODUCT_MODEL_UID).delete).toHaveBeenCalledWith({ where: { id: 3 } });
      expect(dbQuery('plugin::ecommerce-base.inventory-item').deleteMany).toHaveBeenCalledWith({
        where: { product: { id: 3 } },
      });
    });
  });

  describe('listByStatus', () => {
    it('filters products by status', async () => {
      seedRecords(ctx.db.query as any, PRODUCT_MODEL_UID, [
        { id: 1, status: 'draft' },
        { id: 2, status: 'published' },
      ]);
      const drafts = await product.listByStatus('draft');
      expect(drafts).toHaveLength(1);
      expect(dbQuery(PRODUCT_MODEL_UID).findMany).toHaveBeenCalledWith({
        where: { status: 'draft' },
      });
    });
  });
});
