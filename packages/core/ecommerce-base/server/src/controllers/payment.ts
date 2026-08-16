import type { Context } from 'koa';
import type { Core } from '@strapi/types';
import { getService } from '../utils';
import { ACTIONS } from '../constants';

export default {
  async gateways(ctx: Context) {
    const {
      state: { userAbility },
    } = ctx;
    const pm = strapi
      .service('admin::permission')
      .createPermissionsManager({ ability: userAbility, action: ACTIONS.financeRead });
    if (!pm.isAllowed) {
      return ctx.forbidden();
    }
    ctx.body = { data: getService('payment').listGateways() };
  },

  async pay(ctx: Context) {
    const {
      state: { userAbility },
      params: { id },
      request,
    } = ctx;
    const pm = strapi
      .service('admin::permission')
      .createPermissionsManager({ ability: userAbility, action: ACTIONS.ordersManage });
    if (!pm.isAllowed) {
      return ctx.forbidden();
    }
    const { method, gatewayId } = request.body ?? {};
    const order = await getService('payment').processPayment({
      orderId: id,
      method: method ?? 'card',
      gatewayId,
    });
    ctx.body = order;
  },

  async refund(ctx: Context) {
    const {
      state: { userAbility },
      params: { id },
      request,
    } = ctx;
    const pm = strapi
      .service('admin::permission')
      .createPermissionsManager({ ability: userAbility, action: ACTIONS.ordersManage });
    if (!pm.isAllowed) {
      return ctx.forbidden();
    }
    const { amount } = request.body ?? {};
    const order = await getService('payment').refund({
      orderId: id,
      amount: Number(amount),
    });
    ctx.body = order;
  },

  async registerGateway(ctx: Context) {
    const {
      state: { userAbility },
      request,
    } = ctx;
    const pm = strapi
      .service('admin::permission')
      .createPermissionsManager({ ability: userAbility, action: ACTIONS.financeRead });
    if (!pm.isAllowed) {
      return ctx.forbidden();
    }
    // Only admin users with settings scope may register gateways at runtime.
    const settingsPm = strapi
      .service('admin::permission')
      .createPermissionsManager({ ability: userAbility, action: 'admin::marketplace.read' });
    if (!settingsPm.isAllowed) {
      return ctx.forbidden();
    }
    const gateway = getService('payment').registerGateway(request.body);
    ctx.body = { data: { id: gateway.id, name: gateway.name } };
  },
} as const;
