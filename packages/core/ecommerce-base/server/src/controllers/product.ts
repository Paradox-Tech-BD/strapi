import type { Context } from 'koa';
import type { Core } from '@strapi/types';
import { getService } from '../utils';
import { ACTIONS, PRODUCT_MODEL_UID } from '../constants';

export default {
  async find(ctx: Context) {
    const {
      state: { userAbility },
    } = ctx;
    const pm = strapi
      .service('admin::permission')
      .createPermissionsManager({
        ability: userAbility,
        action: ACTIONS.catalogRead,
        model: PRODUCT_MODEL_UID,
      });
    if (!pm.isAllowed) {
      return ctx.forbidden();
    }
    await pm.validateQuery(ctx.query);
    const query = pm.sanitizeQuery(ctx.query);
    const data = await getService('product').findPage(query);
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
        action: ACTIONS.catalogRead,
        model: PRODUCT_MODEL_UID,
      });
    if (!pm.isAllowed) {
      return ctx.forbidden();
    }
    ctx.body = await pm.sanitizeOutput(await getService('product').findOne(id));
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
        action: ACTIONS.catalogManage,
        model: PRODUCT_MODEL_UID,
      });
    if (!pm.isAllowed) {
      return ctx.forbidden();
    }
    await pm.validateInput(request.body);
    const data = await pm.sanitizeInput(request.body);
    ctx.body = await getService('product').create(data);
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
        action: ACTIONS.catalogManage,
        model: PRODUCT_MODEL_UID,
      });
    if (!pm.isAllowed) {
      return ctx.forbidden();
    }
    await pm.validateInput(request.body);
    const data = await pm.sanitizeInput(request.body);
    ctx.body = await getService('product').update(id, data);
  },

  async publish(ctx: Context) {
    const {
      state: { userAbility },
      params: { id },
    } = ctx;
    const pm = strapi
      .service('admin::permission')
      .createPermissionsManager({
        ability: userAbility,
        action: ACTIONS.catalogPublish,
        model: PRODUCT_MODEL_UID,
      });
    if (!pm.isAllowed) {
      return ctx.forbidden();
    }
    ctx.body = await getService('product').publish(id);
  },

  async unpublish(ctx: Context) {
    const {
      state: { userAbility },
      params: { id },
    } = ctx;
    const pm = strapi
      .service('admin::permission')
      .createPermissionsManager({
        ability: userAbility,
        action: ACTIONS.catalogPublish,
        model: PRODUCT_MODEL_UID,
      });
    if (!pm.isAllowed) {
      return ctx.forbidden();
    }
    ctx.body = await getService('product').unpublish(id);
  },

  async archive(ctx: Context) {
    const {
      state: { userAbility },
      params: { id },
    } = ctx;
    const pm = strapi
      .service('admin::permission')
      .createPermissionsManager({
        ability: userAbility,
        action: ACTIONS.catalogManage,
        model: PRODUCT_MODEL_UID,
      });
    if (!pm.isAllowed) {
      return ctx.forbidden();
    }
    ctx.body = await getService('product').archive(id);
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
        action: ACTIONS.catalogManage,
        model: PRODUCT_MODEL_UID,
      });
    if (!pm.isAllowed) {
      return ctx.forbidden();
    }
    ctx.body = await getService('product').delete(id);
  },
} as const;
