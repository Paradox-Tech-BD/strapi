import { errors } from '@strapi/utils';
import { CUSTOMER_MODEL_UID, ORDER_MODEL_UID, WEBHOOK_EVENTS } from '../constants';
import { getService } from '../utils';

const { ApplicationError, ValidationError } = errors;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default ({ strapi }: { strapi: any }) => ({
  async findPage(query: Record<string, unknown> = {}) {
    return strapi.db.query(CUSTOMER_MODEL_UID).findPage(query);
  },

  async find(params: Record<string, unknown> = {}) {
    return strapi.db.query(CUSTOMER_MODEL_UID).findMany({ params });
  },

  async findOne(id: number | string) {
    const customer = await strapi.db.query(CUSTOMER_MODEL_UID).findOne({ where: { id } });
    if (!customer) throw new ApplicationError('Customer not found');
    return customer;
  },

  async findByEmail(email: string) {
    return strapi.db.query(CUSTOMER_MODEL_UID).findOne({ where: { email } });
  },

  async findByUserId(userId: number | string) {
    return strapi.db.query(CUSTOMER_MODEL_UID).findOne({
      where: { user: userId },
      populate: { user: true },
    });
  },

  async create(data: {
    firstName: string;
    lastName?: string;
    email: string;
    phone?: string;
    addresses?: unknown;
    metadata?: unknown;
    marketingOptIn?: boolean;
    preferredCurrency?: string;
  }) {
    if (!data.firstName?.trim()) {
      throw new ValidationError('Customer requires a firstName.');
    }
    if (!data.email || !EMAIL_REGEX.test(data.email)) {
      throw new ValidationError('A valid email address is required.');
    }
    const duplicate = await this.findByEmail(data.email);
    if (duplicate) {
      throw new ApplicationError(`A customer with email "${data.email}" already exists.`);
    }
    const customer = await strapi.db.query(CUSTOMER_MODEL_UID).create({ data });
    const emit = strapi.config?.get?.('plugin::ecommerce-base.webhooks.emitEvents');
    if (emit !== false) {
      strapi.eventHub.emit(WEBHOOK_EVENTS.customerCreated, { customer });
    }
    return customer;
  },

  async update(id: number | string, data: Record<string, unknown>) {
    await this.findOne(id);
    if (data.email !== undefined && !EMAIL_REGEX.test(String(data.email))) {
      throw new ValidationError('A valid email address is required.');
    }
    if (data.preferredCurrency !== undefined) {
      const tax = getService('tax') as { isSupportedCurrency?: (currency: unknown) => boolean };
      if (tax.isSupportedCurrency && !tax.isSupportedCurrency(data.preferredCurrency)) {
        throw new ValidationError(`Unsupported currency "${data.preferredCurrency}".`);
      }
      data.preferredCurrency = String(data.preferredCurrency).toUpperCase();
    }
    const customer = await strapi.db.query(CUSTOMER_MODEL_UID).update({ where: { id }, data });
    const emit = strapi.config?.get?.('plugin::ecommerce-base.webhooks.emitEvents');
    if (emit !== false) {
      strapi.eventHub.emit(WEBHOOK_EVENTS.customerUpdated, { customer });
    }
    return customer;
  },

  async delete(id: number | string) {
    const customer = await this.findOne(id);
    await strapi.db.query(CUSTOMER_MODEL_UID).delete({ where: { id } });
    return customer;
  },

  /**
   * Called by the order service after a successful order creation to keep the
   * customer's lifetime value and order counters in sync.
   */
  async dashboard(customerId: number | string, currency?: string) {
    const customer = await this.findOne(customerId);
    const orders = await strapi.db.query(ORDER_MODEL_UID).findMany({
      where: { customer: customerId },
      populate: { lines: true },
      orderBy: { createdAt: 'desc' },
      limit: 20,
    });
    return {
      customer,
      currency: currency ?? customer.preferredCurrency ?? 'USD',
      summary: {
        lifetimeValue: Number(customer.lifetimeValue ?? 0),
        orderCount: Number(customer.orderCount ?? 0),
        lastOrderAt: customer.lastOrderAt ?? null,
      },
      orders,
    };
  },

  async recordOrder(customerId: number | string, orderTotal: number) {
    const customer = await this.findOne(customerId);
    return strapi.db.query(CUSTOMER_MODEL_UID).update({
      where: { id: customerId },
      data: {
        lifetimeValue: Number(customer.lifetimeValue ?? 0) + Number(orderTotal),
        orderCount: (customer.orderCount ?? 0) + 1,
        lastOrderAt: new Date().toISOString(),
      },
    });
  },
});
