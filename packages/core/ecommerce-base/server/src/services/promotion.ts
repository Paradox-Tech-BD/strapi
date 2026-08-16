import { errors } from '@strapi/utils';
import { PROMOTION_MODEL_UID, WEBHOOK_EVENTS } from '../constants';

const { ApplicationError, ValidationError } = errors;

export default ({ strapi }: { strapi: any }) => ({
  async findPage(query: Record<string, unknown> = {}) {
    return strapi.db.query(PROMOTION_MODEL_UID).findPage(query);
  },

  async find(params: Record<string, unknown> = {}) {
    return strapi.db.query(PROMOTION_MODEL_UID).findMany({ params });
  },

  async findOne(id: number | string) {
    const promotion = await strapi.db.query(PROMOTION_MODEL_UID).findOne({ where: { id } });
    if (!promotion) throw new ApplicationError('Promotion not found');
    return promotion;
  },

  /**
   * Resolve a code for use at checkout. Validates availability windows,
   * activation flag, usage caps and minimum order amount.
   */
  async findByCode(code: string, ctx: { orderTotal?: number } = {}) {
    const promotion = await strapi.db.query(PROMOTION_MODEL_UID).findOne({
      where: { code: code.toUpperCase() },
    });
    if (!promotion) throw new ApplicationError('Promotion code not found.');

    if (!promotion.isActive) throw new ApplicationError('This promotion is no longer active.');
    const now = Date.now();
    if (promotion.startsAt && new Date(promotion.startsAt).getTime() > now) {
      throw new ApplicationError('This promotion has not started yet.');
    }
    if (promotion.expiresAt && new Date(promotion.expiresAt).getTime() < now) {
      throw new ApplicationError('This promotion has expired.');
    }
    if (
      promotion.maxUses !== null &&
      promotion.maxUses !== undefined &&
      promotion.usedCount >= promotion.maxUses
    ) {
      throw new ApplicationError('This promotion has reached its maximum usage.');
    }
    const minOrder = Number(promotion.minOrderAmount ?? 0);
    if (ctx.orderTotal !== undefined && minOrder > 0 && ctx.orderTotal < minOrder) {
      throw new ApplicationError(`A minimum order of ${minOrder} is required to use this code.`);
    }
    return promotion;
  },

  async create(data: {
    name: string;
    code: string;
    type: 'percentage' | 'fixed' | 'freeShipping';
    value: number;
    minOrderAmount?: number;
    maxUses?: number;
    maxUsesPerCustomer?: number;
    startsAt?: string;
    expiresAt?: string;
    appliesTo?: string;
    conditions?: unknown;
  }) {
    if (!data.name || !data.code) {
      throw new ValidationError('A promotion requires a name and a code.');
    }
    if (!['percentage', 'fixed', 'freeShipping'].includes(data.type)) {
      throw new ValidationError('type must be percentage, fixed or freeShipping.');
    }
    if (data.type === 'percentage' && (data.value < 0 || data.value > 100)) {
      throw new ValidationError('Percentage value must be between 0 and 100.');
    }
    if (data.type === 'fixed' && data.value < 0) {
      throw new ValidationError('Fixed value must be non-negative.');
    }
    const duplicate = await strapi.db.query(PROMOTION_MODEL_UID).findOne({
      where: { code: data.code.toUpperCase() },
    });
    if (duplicate) {
      throw new ApplicationError(`Promotion code "${data.code}" already exists.`);
    }
    return strapi.db.query(PROMOTION_MODEL_UID).create({
      data: { ...data, code: data.code.toUpperCase() },
    });
  },

  async update(id: number | string, data: Record<string, unknown>) {
    await this.findOne(id);
    return strapi.db.query(PROMOTION_MODEL_UID).update({ where: { id }, data });
  },

  async toggle(id: number | string) {
    const promotion = await this.findOne(id);
    return strapi.db.query(PROMOTION_MODEL_UID).update({
      where: { id },
      data: { isActive: !promotion.isActive },
    });
  },

  /**
   * Increment the usage counter and emit the promotion.used event.
   */
  async incrementUsage(id: number | string) {
    const promotion = await this.findOne(id);
    const updated = await strapi.db.query(PROMOTION_MODEL_UID).update({
      where: { id },
      data: { usedCount: (promotion.usedCount ?? 0) + 1 },
    });
    const emit = strapi.config?.get?.('plugin::ecommerce-base.webhooks.emitEvents');
    if (emit !== false) {
      strapi.eventHub.emit(WEBHOOK_EVENTS.promotionUsed, { promotion: updated });
    }
    return updated;
  },

  async delete(id: number | string) {
    const promotion = await this.findOne(id);
    await strapi.db.query(PROMOTION_MODEL_UID).delete({ where: { id } });
    return promotion;
  },
});
