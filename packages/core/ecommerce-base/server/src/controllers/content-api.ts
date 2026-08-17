import { errors } from '@strapi/utils';
import type { Context } from 'koa';
import { getService } from '../utils';
import { normalizeCheckoutInput } from '../utils/checkout';

const { ApplicationError, ValidationError } = errors;

async function resolveAuthenticatedCustomer(ctx: Context) {
  const userId = ctx.state.user?.id;
  if (!userId) {
    ctx.unauthorized('Authentication is required for this customer endpoint.');
    return null;
  }
  const customer = await (getService('customer') as any).findByUserId(userId);
  if (!customer) {
    ctx.notFound('Customer profile not found.');
    return null;
  }
  return customer;
}

function checkoutInput(ctx: Context) {
  return normalizeCheckoutInput(ctx.request.body, (currency) =>
    (getService('tax') as any).isSupportedCurrency(currency)
  );
}

function handleCheckoutError(ctx: Context, error: unknown) {
  if (error instanceof ValidationError || error instanceof ApplicationError) {
    return ctx.badRequest(error.message);
  }
  throw error;
}

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
    try {
      const body = (ctx.request.body ?? {}) as Record<string, any>;
      const authenticatedCustomer = ctx.state.user
        ? await (getService('customer') as any).findByUserId(ctx.state.user.id)
        : null;
      const input = checkoutInput(ctx);
      const order = await (getService('order') as any).create({
        ...input,
        customerId: authenticatedCustomer?.id ?? body.customerId,
        shippingAddress: body.shippingAddress,
        billingAddress: body.billingAddress,
        paymentMethod: body.paymentMethod,
        metadata: body.metadata,
        notes: body.notes,
      });
      ctx.body = order;
    } catch (error) {
      return handleCheckoutError(ctx, error);
    }
  },

  async previewCheckout(ctx: Context) {
    try {
      const body = (ctx.request.body ?? {}) as Record<string, any>;
      const authenticatedCustomer = ctx.state.user
        ? await (getService('customer') as any).findByUserId(ctx.state.user.id)
        : null;
      ctx.body = await (getService('order') as any).preview({
        ...checkoutInput(ctx),
        customerId: authenticatedCustomer?.id ?? body.customerId,
      });
    } catch (error) {
      return handleCheckoutError(ctx, error);
    }
  },

  async createCheckoutOrder(ctx: Context) {
    return this.createOrder(ctx);
  },

  async getCustomerDashboard(ctx: Context) {
    const customer = await resolveAuthenticatedCustomer(ctx);
    if (!customer) return;
    const requestedCurrency = (ctx.query.currency as string | undefined)?.toUpperCase();
    if (requestedCurrency) {
      const tax = getService('tax') as any;
      if (!tax.isSupportedCurrency(requestedCurrency)) {
        return ctx.badRequest(`Unsupported currency "${requestedCurrency}".`);
      }
    }
    ctx.body = await (getService('customer') as any).dashboard(
      customer.id,
      requestedCurrency ?? customer.preferredCurrency
    );
  },

  async updateCustomerPreferences(ctx: Context) {
    const customer = await resolveAuthenticatedCustomer(ctx);
    if (!customer) return;
    const body = (ctx.request.body ?? {}) as Record<string, any>;
    const preferredCurrency = String(body.preferredCurrency ?? '')
      .trim()
      .toUpperCase();
    if (!preferredCurrency) {
      return ctx.badRequest('preferredCurrency is required.');
    }
    const tax = getService('tax') as any;
    if (!tax.isSupportedCurrency(preferredCurrency)) {
      return ctx.badRequest(`Unsupported currency "${preferredCurrency}".`);
    }
    ctx.body = await (getService('customer') as any).update(customer.id, {
      preferredCurrency,
    });
  },

  async applyPromotion(ctx: Context) {
    const { code, orderTotal } = ctx.request.body ?? {};
    const promotion = await getService('promotion').findByCode(code, { orderTotal });
    ctx.body = promotion;
  },
} as const;
