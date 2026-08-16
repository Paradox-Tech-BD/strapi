import type { Context } from 'koa';
import type { Core } from '@strapi/types';
import { getService } from '../utils';
import { ACTIONS } from '../constants';

export default {
  async find(ctx: Context) {
    const {
      state: { userAbility },
    } = ctx;
    const pm = strapi
      .service('admin::permission')
      .createPermissionsManager({ ability: userAbility, action: ACTIONS.auditRead });
    if (!pm.isAllowed) {
      return ctx.forbidden();
    }
    ctx.body = await getService('audit').findPage(ctx.query);
  },

  async clear(ctx: Context) {
    const {
      state: { userAbility },
    } = ctx;
    const pm = strapi
      .service('admin::permission')
      .createPermissionsManager({ ability: userAbility, action: ACTIONS.auditRead });
    if (!pm.isAllowed) {
      return ctx.forbidden();
    }
    await getService('audit').clear();
    ctx.body = { ok: true };
  },
} as const;
