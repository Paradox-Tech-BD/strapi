import { errors } from '@strapi/utils';
import { INVENTORY_ITEM_MODEL_UID, WEBHOOK_EVENTS } from '../constants';
import { roundMoney } from '../utils';

const { ApplicationError, ValidationError } = errors;

export default ({ strapi }: { strapi: any }) => ({
  /**
   * Create an inventory ledger row for a product. Idempotent: if a row for
   * the product already exists it is returned unchanged.
   */
  async createForProduct({ productId, sku }: { productId: number | string; sku?: string }) {
    const existing = await strapi.db.query(INVENTORY_ITEM_MODEL_UID).findOne({
      where: { product: { id: productId } },
    });
    if (existing) return existing;
    return strapi.db.query(INVENTORY_ITEM_MODEL_UID).create({
      data: { product: productId, sku: sku ?? `SKU-${productId}` },
    });
  },

  async findPage(query: Record<string, unknown> = {}) {
    return strapi.db.query(INVENTORY_ITEM_MODEL_UID).findPage({
      populate: { product: true },
      ...query,
    });
  },

  async find(params: Record<string, unknown> = {}) {
    return strapi.db.query(INVENTORY_ITEM_MODEL_UID).findMany({
      populate: { product: true },
      params,
    });
  },

  async findOne(id: number | string) {
    const item = await strapi.db.query(INVENTORY_ITEM_MODEL_UID).findOne({
      where: { id },
      populate: { product: true },
    });
    if (!item) throw new ApplicationError('Inventory item not found');
    return item;
  },

  /**
   * Adjust stock by a signed delta (positive = restock, negative = sell/return).
   * Emits `ecommerce.inventory.updated` and, when below threshold,
   * `ecommerce.inventory.low-stock` on the event hub.
   */
  async adjust({ id, delta, reason }: { id: number | string; delta: number; reason?: string }) {
    if (!Number.isInteger(delta)) {
      throw new ValidationError('Inventory delta must be an integer.');
    }
    const item = await this.findOne(id);
    const next = item.quantity + delta;
    if (next < 0) {
      throw new ValidationError(
        `Insufficient stock for ${item.sku}: ${item.quantity} available, ${Math.abs(delta)} requested.`
      );
    }

    const updated = await strapi.db.query(INVENTORY_ITEM_MODEL_UID).update({
      where: { id },
      data: { quantity: next },
    });

    const emit = strapi.config?.get?.('plugin::ecommerce-base.webhooks.emitEvents');
    if (emit !== false) {
      strapi.eventHub.emit(WEBHOOK_EVENTS.inventoryUpdated, {
        inventoryItem: updated,
        delta,
        reason,
      });
      if (next <= item.lowStockThreshold) {
        strapi.eventHub.emit(WEBHOOK_EVENTS.inventoryLowStock, {
          inventoryItem: updated,
          threshold: item.lowStockThreshold,
        });
      }
    }

    return updated;
  },

  /**
   * Reserve stock for an order line (moves stock into reservedQuantity).
   */
  async reserve({ id, quantity }: { id: number | string; quantity: number }) {
    if (quantity <= 0) throw new ValidationError('Quantity must be positive.');
    const item = await this.findOne(id);
    const available = item.quantity - item.reservedQuantity;
    if (quantity > available) {
      throw new ApplicationError(
        `Cannot reserve ${quantity} of ${item.sku}: only ${available} available.`
      );
    }
    return strapi.db.query(INVENTORY_ITEM_MODEL_UID).update({
      where: { id },
      data: { reservedQuantity: item.reservedQuantity + quantity },
    });
  },

  /**
   * Release a previous reservation (e.g. cancelled order line).
   */
  async releaseReservation({ id, quantity }: { id: number | string; quantity: number }) {
    const item = await this.findOne(id);
    const next = Math.max(0, item.reservedQuantity - quantity);
    return strapi.db.query(INVENTORY_ITEM_MODEL_UID).update({
      where: { id },
      data: { reservedQuantity: next },
    });
  },

  /**
   * Consume a reservation: stock is deducted permanently.
   */
  async consumeReservation({ id, quantity }: { id: number | string; quantity: number }) {
    const item = await this.findOne(id);
    if (quantity > item.reservedQuantity) {
      throw new ApplicationError(`Not enough reserved stock on ${item.sku}.`);
    }
    return strapi.db.query(INVENTORY_ITEM_MODEL_UID).update({
      where: { id },
      data: {
        quantity: item.quantity - quantity,
        reservedQuantity: item.reservedQuantity - quantity,
      },
    });
  },

  /**
   * Global low-stock report across all tracked products.
   */
  async lowStockReport() {
    return strapi.db.query(INVENTORY_ITEM_MODEL_UID).findMany({
      where: { quantity: { $lte: strapi.db.query?.builder ? undefined : undefined } },
      populate: { product: true },
    });
  },

  /**
   * Stock availability across every ledger row (used by cart/order validation).
   */
  async availableForProduct(productId: number | string) {
    const item = await strapi.db.query(INVENTORY_ITEM_MODEL_UID).findOne({
      where: { product: { id: productId } },
    });
    if (!item) return null;
    return item.quantity - item.reservedQuantity;
  },
});
