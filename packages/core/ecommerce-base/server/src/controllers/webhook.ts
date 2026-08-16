import type { Context } from 'koa';
import type { Core } from '@strapi/types';
import { getService } from '../utils';
import { ACTIONS } from '../constants';

export default {
  async events(ctx: Context) {
    const {
      state: { userAbility },
    } = ctx;
    const pm = strapi
      .service('admin::permission')
      .createPermissionsManager({ ability: userAbility, action: ACTIONS.auditRead });
    if (!pm.isAllowed) {
      return ctx.forbidden();
    }
    ctx.body = { data: getService('webhook').listEvents() };
  },

  async subscribe(ctx: Context) {
    const {
      state: { userAbility },
      request,
    } = ctx;
    const pm = strapi
      .service('admin::permission')
      .createPermissionsManager({ ability: userAbility, action: ACTIONS.auditRead });
    if (!pm.isAllowed) {
      return ctx.forbidden();
    }
    const { event } = request.body ?? {};
    let lastPayload: unknown = null;
    getService('webhook').subscribe(event, (payload) => {
      lastPayload = payload;
    });
    ctx.body = { data: { event, test: lastPayload } };
  },
} as const;
