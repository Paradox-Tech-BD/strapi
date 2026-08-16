import { errors } from '@strapi/utils';
import { PRODUCT_MODEL_UID } from '../constants';
import { getService } from '../utils';

const { ApplicationError, ValidationError } = errors;

export interface ProductInput {
  name: string;
  price: number;
  description?: string;
  compareAtPrice?: number;
  sku?: string;
  barcode?: string;
  status?: 'draft' | 'published' | 'archived';
  category?: string;
  weightKg?: number;
  images?: unknown;
  metadata?: unknown;
  tags?: unknown;
  currency?: string;
  stockTracking?: boolean;
  publishedAt?: string | null;
}

export default ({ strapi }: { strapi: any }) => ({
  async findPage(query: Record<string, unknown> = {}) {
    return strapi.db.query(PRODUCT_MODEL_UID).findPage(query);
  },

  async find(params: Record<string, unknown> = {}) {
    return strapi.db.query(PRODUCT_MODEL_UID).findMany({ params });
  },

  async findOne(id: number | string) {
    const product = await strapi.db.query(PRODUCT_MODEL_UID).findOne({ where: { id } });
    if (!product) throw new ApplicationError('Product not found');
    return product;
  },

  async create(data: ProductInput) {
    if (!data.name || typeof data.price !== 'number' || data.price < 0) {
      throw new ValidationError('Product requires a name and a non-negative price.');
    }
    if (data.compareAtPrice !== undefined && data.compareAtPrice < data.price) {
      throw new ValidationError('compareAtPrice must be greater than or equal to price.');
    }

    const product = await strapi.db.query(PRODUCT_MODEL_UID).create({ data });

    // Auto-create an inventory ledger row for stock-tracked products.
    if (data.stockTracking !== false) {
      await (getService('inventory') as any).createForProduct({
        productId: product.id,
        sku: data.sku ?? `SKU-${product.id}`,
      });
    }
    return product;
  },

  async update(id: number | string, data: Partial<ProductInput>) {
    await this.findOne(id); // ensure exists
    if (data.price !== undefined && data.price < 0) {
      throw new ValidationError('Price cannot be negative.');
    }
    return strapi.db.query(PRODUCT_MODEL_UID).update({ where: { id }, data });
  },

  async archive(id: number | string) {
    return strapi.db.query(PRODUCT_MODEL_UID).update({
      where: { id },
      data: { status: 'archived' },
    });
  },

  async publish(id: number | string) {
    const product = await this.findOne(id);
    if (product.status === 'archived') {
      throw new ApplicationError('An archived product cannot be published.');
    }
    return strapi.db.query(PRODUCT_MODEL_UID).update({
      where: { id },
      data: { status: 'published', publishedAt: new Date().toISOString() },
    });
  },

  async unpublish(id: number | string) {
    await this.findOne(id);
    return strapi.db.query(PRODUCT_MODEL_UID).update({
      where: { id },
      data: { status: 'draft', publishedAt: null },
    });
  },

  async delete(id: number | string) {
    const product = await this.findOne(id);
    await strapi.db.query(PRODUCT_MODEL_UID).delete({ where: { id } });
    await strapi.db.query('plugin::ecommerce-base.inventory-item').deleteMany({
      where: { product: { id } },
    });
    return product;
  },

  async listByStatus(status: string) {
    return strapi.db.query(PRODUCT_MODEL_UID).findMany({
      where: { status },
    });
  },
});
