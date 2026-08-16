import type { Context } from 'koa';
import type { Core } from '@strapi/types';
import { getService } from '../utils';
import { PRODUCT_MODEL_UID } from '../constants';

/**
 * Content-API (public storefront) controller. No admin authentication is
 * applied here — callers are authenticated through the standard content-API
 * pipeline (users-permissions JWT or API token) via route policies.
 */
export default {
  async listProducts(ctx: Context) {
    const query = { ...ctx.query };
    const { results, pagination } = await getService('product').findPage(query);
    ctx.body = { results, pagination };
  },

  async getProduct(ctx: Context) {
    const product = await getService('product').findOne(ctx.params.id);
    ctx.body = product;
  },

  async createOrder(ctx: Context) {
    const { items, promotionCode, customerId } = ctx.request.body ?? {};
    const order = await getService('order').create({
      items: items ?? [],
      promotionCode,
      customerId,
    });
    ctx.body = order;
  },

  async applyPromotion(ctx: Context) {
    const { code, orderTotal } = ctx.request.body ?? {};
    const promotion = await getService('promotion').findByCode(code, { orderTotal });
    ctx.body = promotion;
  },
} as const;
