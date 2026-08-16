import type { Context } from 'koa';
import type { Core } from '@strapi/types';
import { getService } from '../utils';
import { ACTIONS, CUSTOMER_MODEL_UID } from '../constants';

export default {
  async find(ctx: Context) {
    const {
      state: { userAbility },
    } = ctx;
    const pm = strapi
      .service('admin::permission')
      .createPermissionsManager({
        ability: userAbility,
        action: ACTIONS.customersRead,
        model: CUSTOMER_MODEL_UID,
      });
    if (!pm.isAllowed) {
      return ctx.forbidden();
    }
    await pm.validateQuery(ctx.query);
    const query = pm.sanitizeQuery(ctx.query);
    const data = await getService('customer').findPage(query);
    ctx.body = {
      results: await pm.sanitizeOutput(data.results),
      pagination: data.pagination,
    };
  },

  async findOne(ctx: Context) {
    const {
      state: { userAbility },
      params: { id },
    } = ctx;
    const pm = strapi
      .service('admin::permission')
      .createPermissionsManager({
        ability: userAbility,
        action: ACTIONS.customersRead,
        model: CUSTOMER_MODEL_UID,
      });
    if (!pm.isAllowed) {
      return ctx.forbidden();
    }
    ctx.body = await pm.sanitizeOutput(await getService('customer').findOne(id));
  },

  async create(ctx: Context) {
    const {
      state: { userAbility },
      request,
    } = ctx;
    const pm = strapi
      .service('admin::permission')
      .createPermissionsManager({
        ability: userAbility,
        action: ACTIONS.customersManage,
        model: CUSTOMER_MODEL_UID,
      });
    if (!pm.isAllowed) {
      return ctx.forbidden();
    }
    const body = await pm.sanitizeInput(request.body);
    ctx.body = await getService('customer').create(body);
  },

  async update(ctx: Context) {
    const {
      state: { userAbility },
      params: { id },
      request,
    } = ctx;
    const pm = strapi
      .service('admin::permission')
      .createPermissionsManager({
        ability: userAbility,
        action: ACTIONS.customersManage,
        model: CUSTOMER_MODEL_UID,
      });
    if (!pm.isAllowed) {
      return ctx.forbidden();
    }
    const body = await pm.sanitizeInput(request.body);
    ctx.body = await getService('customer').update(id, body);
  },

  async delete(ctx: Context) {
    const {
      state: { userAbility },
      params: { id },
    } = ctx;
    const pm = strapi
      .service('admin::permission')
      .createPermissionsManager({
        ability: userAbility,
        action: ACTIONS.customersManage,
        model: CUSTOMER_MODEL_UID,
      });
    if (!pm.isAllowed) {
      return ctx.forbidden();
    }
    ctx.body = await getService('customer').delete(id);
  },
} as const;
