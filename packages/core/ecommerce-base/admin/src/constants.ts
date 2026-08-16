export const PERMISSIONS = {
  main: [
    { action: 'plugin::ecommerce-base.orders.read', subject: null },
    { action: 'plugin::ecommerce-base.catalog.read', subject: null },
    { action: 'plugin::ecommerce-base.inventory.read', subject: null },
    { action: 'plugin::ecommerce-base.customers.read', subject: null },
    { action: 'plugin::ecommerce-base.finance.read', subject: null },
    { action: 'plugin::ecommerce-base.audit.read', subject: null },
  ],
};

export const pluginId = 'ecommerce-base';
