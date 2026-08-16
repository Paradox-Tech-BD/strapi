import { errors } from '@strapi/utils';
import {
  ORDER_MODEL_UID,
  ORDER_LINE_MODEL_UID,
  PRODUCT_MODEL_UID,
  WEBHOOK_EVENTS,
} from '../constants';
import { generateOrderNumber, getService, roundMoney } from '../utils';

const { ApplicationError, ValidationError } = errors;

const VALID_TRANSITIONS: Record<string, string[]> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['processing', 'cancelled'],
  processing: ['shipped', 'cancelled', 'refunded'],
  shipped: ['delivered', 'refunded'],
  delivered: ['refunded'],
  cancelled: [],
  refunded: [],
};

export default ({ strapi }: { strapi: any }) => ({
  async findPage(query: Record<string, unknown> = {}) {
    return strapi.db.query(ORDER_MODEL_UID).findPage({
      populate: { customer: true, lines: true },
      ...query,
    });
  },

  async find(params: Record<string, unknown> = {}) {
    return strapi.db.query(ORDER_MODEL_UID).findMany({
      populate: { customer: true, lines: true },
      params,
    });
  },

  async findOne(id: number | string) {
    const order = await strapi.db.query(ORDER_MODEL_UID).findOne({
      where: { id },
      populate: { customer: true, lines: true },
    });
    if (!order) throw new ApplicationError('Order not found');
    return order;
  },

  async findByNumber(orderNumber: string) {
    const order = await strapi.db.query(ORDER_MODEL_UID).findOne({
      where: { orderNumber },
      populate: { customer: true, lines: true },
    });
    if (!order) throw new ApplicationError('Order not found');
    return order;
  },

  /**
   * Compute order totals from its lines and an optional promotion.
   */
  async computeTotals({
    lines,
    promotion,
    currency,
    shippingCost,
    taxRate,
  }: {
    lines: { unitPrice: number; quantity: number }[];
    promotion?: { type: string; value: number } | null;
    currency?: string;
    shippingCost?: number;
    taxRate?: number;
  }) {
    const subtotal = roundMoney(
      lines.reduce((sum, line) => sum + roundMoney(line.unitPrice) * line.quantity, 0)
    );
    let discount = 0;
    if (promotion) {
      discount =
        promotion.type === 'percentage'
          ? roundMoney((subtotal * Number(promotion.value)) / 100)
          : promotion.type === 'fixed'
            ? Math.min(Number(promotion.value), subtotal)
            : 0;
    }
    const taxAmount = roundMoney((subtotal - discount) * (taxRate ?? 0));
    const total = roundMoney(subtotal - discount + taxAmount + (shippingCost ?? 0));
    return { subtotal, discountAmount: discount, taxAmount, total, currency: currency ?? 'USD' };
  },

  /**
   * Create an order from cart items or raw line input. Reserves inventory and
   * emits the order.created webhook event.
   */
  async create({
    customerId,
    items,
    promotionCode,
    shippingAddress,
    billingAddress,
    paymentMethod,
    shippingCost,
    taxRate,
    notes,
  }: {
    customerId?: number | string;
    items: { productId: number | string; quantity: number; unitPrice?: number }[];
    promotionCode?: string;
    shippingAddress?: unknown;
    billingAddress?: unknown;
    paymentMethod?: string;
    shippingCost?: number;
    taxRate?: number;
    notes?: string;
  }) {
    if (!items.length) throw new ValidationError('An order needs at least one line item.');

    // Resolve products and current prices (price snapshot).
    const productIds = items.map((i) => Number(i.productId));
    const products = (await strapi.db.query(PRODUCT_MODEL_UID).findMany({
      where: { id: { $in: productIds } },
    })) as { id: number; name: string; sku?: string; price: number; stockTracking?: boolean }[];
    if (products.length !== productIds.length) {
      throw new ValidationError('One or more products could not be found.');
    }
    const productById = new Map(products.map((p) => [p.id, p]));

    const lines = items.map((item) => {
      const product = productById.get(Number(item.productId));
      if (!product) throw new ValidationError('One or more products could not be found.');
      const unitPrice = item.unitPrice ?? product.price;
      return {
        product: product.id,
        quantity: item.quantity,
        unitPrice,
        totalPrice: roundMoney(unitPrice * item.quantity),
        sku: product.sku ?? undefined,
        productSnapshot: {
          name: product.name,
          sku: product.sku,
          priceAtOrder: product.price,
        },
      };
    });

    // Optional promotion validation.
    let promotion = null;
    if (promotionCode) {
      promotion = await (getService('promotion') as any).findByCode(promotionCode, {
        orderTotal: roundMoney(lines.reduce((s, l) => s + l.totalPrice, 0)),
      });
    }

    // Reserve stock for tracked products.
    for (const line of lines) {
      const inv = await strapi.db.query('plugin::ecommerce-base.inventory-item').findOne({
        where: { product: { id: line.product } },
      });
      if (inv && (productById.get(line.product)?.stockTracking ?? true) !== false) {
        await (getService('inventory') as any).reserve({ id: inv.id, quantity: line.quantity });
      }
    }

    const totals = await this.computeTotals({
      lines,
      promotion,
      shippingCost,
      taxRate,
    });

    const order = await strapi.db.query(ORDER_MODEL_UID).create({
      data: {
        orderNumber: generateOrderNumber(),
        customer: customerId ? Number(customerId) : null,
        status: 'pending',
        paymentStatus: 'pending',
        paymentMethod: paymentMethod ?? null,
        promotionCode: promotionCode ?? null,
        shippingAddress: shippingAddress ?? null,
        billingAddress: billingAddress ?? null,
        notes: notes ?? null,
        ...totals,
      },
    });

    for (const line of lines) {
      await strapi.db.query(ORDER_LINE_MODEL_UID).create({
        data: { ...line, order: order.id },
      });
    }

    // Mark the promotion as used once.
    if (promotion) {
      await (getService('promotion') as any).incrementUsage(promotion.id);
    }

    const withLines = await this.findOne(order.id);
    await this.emitEvent(WEBHOOK_EVENTS.orderCreated, { order: withLines });

    if (customerId) {
      await (getService('customer') as any).recordOrder(customerId, totals.total);
    }

    return withLines;
  },

  /**
   * Advance the order through the allowed state machine.
   */
  async transition(id: number | string, nextStatus: string) {
    const order = await this.findOne(id);
    const allowed = VALID_TRANSITIONS[order.status];
    if (!allowed || !allowed.includes(nextStatus)) {
      throw new ApplicationError(
        `Cannot transition order ${order.orderNumber} from "${order.status}" to "${nextStatus}".`
      );
    }

    const data: Record<string, unknown> = { status: nextStatus };

    if (nextStatus === 'cancelled') {
      data.paymentStatus = 'failed';
      await this.releaseLineReservations(order);
      await this.emitEvent(WEBHOOK_EVENTS.orderCancelled, { order });
    } else if (nextStatus === 'refunded') {
      data.paymentStatus = 'refunded';
    } else {
      await this.emitEvent(WEBHOOK_EVENTS.orderUpdated, { order: { ...order, ...data } });
    }

    return strapi.db.query(ORDER_MODEL_UID).update({ where: { id }, data });
  },

  /**
   * Release inventory reservations held by an order's lines.
   */
  async releaseLineReservations(order: any) {
    for (const line of order.lines ?? []) {
      if (!line.product) continue;
      const inv = await strapi.db.query('plugin::ecommerce-base.inventory-item').findOne({
        where: { product: { id: line.product.id } },
      });
      if (inv) {
        await (getService('inventory') as any).releaseReservation({
          id: inv.id,
          quantity: line.quantity,
        });
      }
    }
  },

  /**
   * Mark an order as paid via a payment gateway reference.
   */
  async markPaid({
    id,
    paymentMethod,
    paymentReference,
    paymentGateway,
  }: {
    id: number | string;
    paymentMethod: string;
    paymentReference: string;
    paymentGateway?: string;
  }) {
    const order = await this.findOne(id);
    if (order.status === 'cancelled' || order.status === 'refunded') {
      throw new ApplicationError('A cancelled/refunded order cannot be marked as paid.');
    }
    const updated = await strapi.db.query(ORDER_MODEL_UID).update({
      where: { id },
      data: {
        paymentStatus: 'paid',
        paymentMethod,
        paymentReference,
        paymentGateway: paymentGateway ?? null,
      },
    });
    await this.emitEvent(WEBHOOK_EVENTS.orderUpdated, { order: updated });
    return updated;
  },

  /**
   * Aggregate order statistics for the dashboard / finance views.
   */
  async stats({ from, to }: { from?: string; to?: string } = {}) {
    const where: Record<string, unknown> = {};
    if (from || to) {
      where.createdAt = {};
      if (from) (where.createdAt as Record<string, unknown>).$gte = from;
      if (to) (where.createdAt as Record<string, unknown>).$lte = to;
    }
    const all = await strapi.db.query(ORDER_MODEL_UID).findMany({ where });
    const revenue = all
      .filter((o: any) => o.paymentStatus === 'paid')
      .reduce((sum: number, o: any) => sum + Number(o.total), 0);
    const byStatus = all.reduce((acc: Record<string, number>, o: any) => {
      acc[o.status] = (acc[o.status] ?? 0) + 1;
      return acc;
    }, {});
    return {
      totalOrders: all.length,
      paidOrders: all.filter((o: any) => o.paymentStatus === 'paid').length,
      revenue: roundMoney(revenue),
      byStatus,
    };
  },

  async emitEvent(event: string, payload: Record<string, unknown>) {
    const emit = strapi.config?.get?.('plugin::ecommerce-base.webhooks.emitEvents');
    if (emit !== false) {
      strapi.eventHub.emit(event, payload);
    }
  },
});
