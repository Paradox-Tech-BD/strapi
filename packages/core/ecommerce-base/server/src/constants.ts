import type {} from 'koa-body';
import type {} from '@strapi/types';

/**
 * Model UIDs for the ecommerce-base core plugin.
 */
export const PRODUCT_MODEL_UID = 'plugin::ecommerce-base.product';
export const INVENTORY_ITEM_MODEL_UID = 'plugin::ecommerce-base.inventory-item';
export const ORDER_MODEL_UID = 'plugin::ecommerce-base.order';
export const ORDER_LINE_MODEL_UID = 'plugin::ecommerce-base.order-line';
export const CUSTOMER_MODEL_UID = 'plugin::ecommerce-base.customer';
export const CART_MODEL_UID = 'plugin::ecommerce-base.cart';
export const CART_ITEM_MODEL_UID = 'plugin::ecommerce-base.cart-item';
export const PROMOTION_MODEL_UID = 'plugin::ecommerce-base.promotion';

/**
 * Admin section actions (plugin::ecommerce-base.*)
 */
export const ACTIONS = {
  // Catalog
  catalogRead: 'plugin::ecommerce-base.catalog.read',
  catalogManage: 'plugin::ecommerce-base.catalog.manage',
  catalogPublish: 'plugin::ecommerce-base.catalog.publish',
  // Orders
  ordersRead: 'plugin::ecommerce-base.orders.read',
  ordersManage: 'plugin::ecommerce-base.orders.manage',
  ordersCancel: 'plugin::ecommerce-base.orders.cancel',
  // Inventory
  inventoryRead: 'plugin::ecommerce-base.inventory.read',
  inventoryAdjust: 'plugin::ecommerce-base.inventory.adjust',
  // Customers
  customersRead: 'plugin::ecommerce-base.customers.read',
  customersManage: 'plugin::ecommerce-base.customers.manage',
  // Finance & audit
  financeRead: 'plugin::ecommerce-base.finance.read',
  auditRead: 'plugin::ecommerce-base.audit.read',
} as const;

/**
 * PBAC condition names (plugin: 'ecommerce-base')
 */
export const CONDITIONS = {
  isProductOwner: 'is-product-owner',
  isOrderAssigned: 'is-order-assigned',
  isCustomerAssigned: 'is-customer-assigned',
  hasInventoryAccess: 'has-inventory-access',
  isFinanceRole: 'is-finance-role',
  isCatalogManager: 'is-catalog-manager',
  isOrderManager: 'is-order-manager',
  isSupportAgent: 'is-support-agent',
} as const;

/**
 * Custom webhook events emitted on strapi.eventHub.
 * Consumers may subscribe via strapi.webhookStore / external services.
 */
export const WEBHOOK_EVENTS = {
  orderCreated: 'ecommerce.order.created',
  orderUpdated: 'ecommerce.order.updated',
  orderCancelled: 'ecommerce.order.cancelled',
  inventoryUpdated: 'ecommerce.inventory.updated',
  inventoryLowStock: 'ecommerce.inventory.low-stock',
  customerCreated: 'ecommerce.customer.created',
  customerUpdated: 'ecommerce.customer.updated',
  cartConverted: 'ecommerce.cart.converted',
  promotionUsed: 'ecommerce.promotion.used',
} as const;

/**
 * Staff roles seeded at bootstrap time.
 */
export const STAFF_ROLES = [
  {
    name: 'Catalog Manager',
    description: 'Manages the product catalog and promotion campaigns.',
    code: 'catalog-manager',
    actions: [ACTIONS.catalogRead, ACTIONS.catalogManage, ACTIONS.catalogPublish],
  },
  {
    name: 'Order Manager',
    description: 'Reads and manages orders, including cancellations.',
    code: 'order-manager',
    actions: [ACTIONS.ordersRead, ACTIONS.ordersManage, ACTIONS.ordersCancel],
  },
  {
    name: 'Customer Support',
    description: 'Reads customers and orders for support tickets.',
    code: 'customer-support',
    actions: [ACTIONS.customersRead, ACTIONS.ordersRead],
  },
  {
    name: 'Inventory Manager',
    description: 'Reads inventory and performs stock adjustments.',
    code: 'inventory-manager',
    actions: [ACTIONS.inventoryRead, ACTIONS.inventoryAdjust],
  },
  {
    name: 'Finance',
    description: 'Read-only access to orders and financial data, plus audit log.',
    code: 'finance',
    actions: [ACTIONS.financeRead, ACTIONS.ordersRead, ACTIONS.auditRead],
  },
] as const;
