import { errors } from '@strapi/utils';
import { CART_ITEM_MODEL_UID, CART_MODEL_UID, PRODUCT_MODEL_UID } from '../constants';
import { getService, roundMoney } from '../utils';

const { ApplicationError, ValidationError } = errors;

export default ({ strapi: strapiRef }: { strapi: any }) => {
  const strapi = strapiRef;

  async function recalcSubtotal(cartId: number | string) {
    const items = await strapi.db.query(CART_ITEM_MODEL_UID).findMany({ where: { cart: cartId } });
    const subtotal = roundMoney(
      items.reduce((sum: number, item: any) => sum + Number(item.unitPrice) * item.quantity, 0)
    );
    await strapi.db.query(CART_MODEL_UID).update({
      where: { id: cartId },
      data: { subtotal },
    });
    return subtotal;
  }

  return {
    async findActive({
      customerId,
      sessionId,
      currency,
    }: {
      customerId?: number;
      sessionId?: string;
      currency?: string;
    }) {
      let cart;
      if (customerId) {
        cart = await strapi.db.query(CART_MODEL_UID).findOne({
          where: { customer: customerId, status: 'active' },
          populate: { items: true },
        });
      }
      if (!cart && sessionId) {
        cart = await strapi.db.query(CART_MODEL_UID).findOne({
          where: { sessionId, status: 'active' },
          populate: { items: true },
        });
      }
      if (!cart) {
        cart = await strapi.db.query(CART_MODEL_UID).create({
          data: {
            customer: customerId ?? null,
            sessionId: sessionId ?? null,
            status: 'active',
            ...(currency ? { currency: String(currency).toUpperCase() } : {}),
          },
        });
      }
      if (!cart.items?.length) {
        cart.items = await strapi.db.query(CART_ITEM_MODEL_UID).findMany({
          where: { cart: cart.id },
          populate: { product: true },
        });
      }
      return cart;
    },

    async addItem({
      cartId,
      productId,
      quantity,
    }: {
      cartId: number | string;
      productId: number | string;
      quantity: number;
    }) {
      if (quantity <= 0) throw new ValidationError('Quantity must be positive.');
      const product = await strapi.db
        .query(PRODUCT_MODEL_UID)
        .findOne({ where: { id: productId } });
      if (!product) throw new ApplicationError('Product not found');

      const existing = await strapi.db.query(CART_ITEM_MODEL_UID).findOne({
        where: { cart: cartId, product: productId },
      });
      if (existing) {
        return strapi.db.query(CART_ITEM_MODEL_UID).update({
          where: { id: existing.id },
          data: { quantity: existing.quantity + quantity },
        });
      }
      const cart = await strapi.db.query(CART_MODEL_UID).findOne({ where: { id: cartId } });
      const sourceCurrency = String(product.currency ?? 'USD').toUpperCase();
      const targetCurrency = String(cart?.currency ?? sourceCurrency).toUpperCase();
      const tax = getService('tax') as {
        convert?: (amount: number, from: string, to: string) => { amount: number };
      };
      const convertedPrice =
        sourceCurrency === targetCurrency || !tax.convert
          ? Number(product.price)
          : tax.convert(Number(product.price), sourceCurrency, targetCurrency).amount;
      const item = await strapi.db.query(CART_ITEM_MODEL_UID).create({
        data: {
          cart: cartId,
          product: productId,
          quantity,
          unitPrice: convertedPrice,
          currency: targetCurrency,
        },
      });
      await recalcSubtotal(cartId);
      return item;
    },

    async updateItemQuantity({ itemId, quantity }: { itemId: number | string; quantity: number }) {
      if (quantity <= 0) {
        const item = await strapi.db.query(CART_ITEM_MODEL_UID).findOne({ where: { id: itemId } });
        if (item) await recalcSubtotal(item.cart);
        return strapi.db.query(CART_ITEM_MODEL_UID).delete({ where: { id: itemId } });
      }
      await strapi.db.query(CART_ITEM_MODEL_UID).update({
        where: { id: itemId },
        data: { quantity },
      });
      const item = await strapi.db.query(CART_ITEM_MODEL_UID).findOne({ where: { id: itemId } });
      if (item) await recalcSubtotal(item.cart);
      return item;
    },

    async removeItem(itemId: number | string) {
      const item = await strapi.db.query(CART_ITEM_MODEL_UID).findOne({ where: { id: itemId } });
      await strapi.db.query(CART_ITEM_MODEL_UID).delete({ where: { id: itemId } });
      if (item) await recalcSubtotal(item.cart);
      return item;
    },

    /**
     * Convert a cart into a placed order and mark the cart as converted.
     */
    async convertToOrder({
      cartId,
      ...orderInput
    }: {
      cartId: number | string;
      [key: string]: unknown;
    }) {
      const cart = await strapi.db.query(CART_MODEL_UID).findOne({
        where: { id: cartId },
        populate: { items: true },
      });
      if (!cart) throw new ApplicationError('Cart not found');
      if (cart.status !== 'active') {
        throw new ApplicationError('Only active carts can be converted into orders.');
      }
      if (!cart.items?.length) {
        throw new ValidationError('The cart is empty.');
      }

      const items = (cart.items as any[]).map((i) => ({
        productId: (i.product as any)?.id ?? i.product,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
      }));

      const order = await (getService('order') as any).create({
        customerId: cart.customer,
        items: items.map((item) => ({ ...item, currency: cart.currency ?? orderInput.currency })),
        currency: cart.currency ?? orderInput.currency,
        ...orderInput,
      });

      await strapi.db.query(CART_MODEL_UID).update({
        where: { id: cartId },
        data: { status: 'converted', convertedOrderId: String(order.id) },
      });

      const emit = strapi.config?.get?.('plugin::ecommerce-base.webhooks.emitEvents');
      if (emit !== false) {
        strapi.eventHub.emit('ecommerce.cart.converted', { cart: { id: cart.id }, order });
      }

      return order;
    },

    async clear(cartId: number | string) {
      await strapi.db.query(CART_ITEM_MODEL_UID).deleteMany({ where: { cart: cartId } });
      return recalcSubtotal(cartId);
    },

    async listAbandoned() {
      return strapi.db.query(CART_MODEL_UID).findMany({
        where: { status: 'abandoned' },
        populate: { customer: true },
      });
    },
  };
};
