import type { Context } from 'koa';
import { getService } from '../utils';
import { ACTIONS, TAX_RULE_MODEL_UID } from '../constants';

function permissionsManager(ctx: Context, action: string) {
  return strapi.service('admin::permission').createPermissionsManager({
    ability: ctx.state.userAbility,
    action,
    model: TAX_RULE_MODEL_UID,
  });
}

function requireNumber(value: unknown, field: string) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    throw new Error(`${field} must be a finite number`);
  }
  return number;
}

export default {
  async find(ctx: Context) {
    const pm = permissionsManager(ctx, ACTIONS.catalogRead);
    if (!pm.isAllowed) return ctx.forbidden();
    const page = Math.max(Number(ctx.query.page ?? 1), 1);
    const pageSize = Math.max(Number(ctx.query.pageSize ?? 10), 1);
    const rules = await getService('tax').findAll();
    const total = rules.length;
    const results = rules.slice((page - 1) * pageSize, page * pageSize);
    ctx.body = {
      results: await pm.sanitizeOutput(results),
      pagination: {
        page,
        pageSize,
        pageCount: Math.max(Math.ceil(total / pageSize), 1),
        total,
      },
    };
  },

  async findOne(ctx: Context) {
    const pm = permissionsManager(ctx, ACTIONS.catalogRead);
    if (!pm.isAllowed) return ctx.forbidden();
    const rule = await getService('tax').findOne(ctx.params.id);
    if (!rule) return ctx.notFound('Tax rule not found');
    ctx.body = await pm.sanitizeOutput(rule);
  },

  async create(ctx: Context) {
    const pm = permissionsManager(ctx, ACTIONS.catalogManage);
    if (!pm.isAllowed) return ctx.forbidden();
    try {
      await pm.validateInput(ctx.request.body);
      const data = await pm.sanitizeInput(ctx.request.body);
      ctx.body = await getService('tax').create(data);
    } catch (error) {
      return ctx.badRequest(error instanceof Error ? error.message : 'Unable to create tax rule');
    }
  },

  async update(ctx: Context) {
    const pm = permissionsManager(ctx, ACTIONS.catalogManage);
    if (!pm.isAllowed) return ctx.forbidden();
    const existing = await getService('tax').findOne(ctx.params.id);
    if (!existing) return ctx.notFound('Tax rule not found');
    try {
      await pm.validateInput(ctx.request.body);
      const data = await pm.sanitizeInput(ctx.request.body);
      ctx.body = await getService('tax').update(ctx.params.id, data);
    } catch (error) {
      return ctx.badRequest(error instanceof Error ? error.message : 'Unable to update tax rule');
    }
  },

  async delete(ctx: Context) {
    const pm = permissionsManager(ctx, ACTIONS.catalogManage);
    if (!pm.isAllowed) return ctx.forbidden();
    const existing = await getService('tax').findOne(ctx.params.id);
    if (!existing) return ctx.notFound('Tax rule not found');
    ctx.body = await getService('tax').delete(ctx.params.id);
  },

  async compute(ctx: Context) {
    const body = (ctx.request.body ?? {}) as { subtotal?: unknown; region?: unknown };
    if (typeof body.region !== 'string' || !body.region.trim()) {
      return ctx.badRequest('region is required');
    }
    try {
      const subtotal = requireNumber(body.subtotal, 'subtotal');
      if (subtotal < 0) return ctx.badRequest('subtotal must be non-negative');
      ctx.body = await getService('tax').compute(subtotal, body.region);
    } catch (error) {
      return ctx.badRequest(error instanceof Error ? error.message : 'Unable to compute tax');
    }
  },
} as const;
