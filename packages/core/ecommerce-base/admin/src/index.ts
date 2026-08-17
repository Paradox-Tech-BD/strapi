import { ShoppingCart, List, Shirt, PriceTag, PresentationChart, ChartPie } from '@strapi/icons';
import pluginPkg from '../../package.json';
import { PERMISSIONS } from './constants';
import { pluginId } from './pluginId';
import { getTrad, prefixPluginTranslations } from './utils';
import type { StrapiApp } from '@strapi/admin/strapi-admin';
import type { Plugin } from '@strapi/types';

const name = pluginPkg.strapi.name;

const admin: Plugin.Config.AdminInput = {
  register(app: StrapiApp) {
    // Dashboard
    app.addMenuLink({
      to: `plugins/${pluginId}`,
      icon: ShoppingCart,
      intlLabel: {
        id: getTrad('plugin.name'),
        defaultMessage: 'E-commerce',
      },
      permissions: PERMISSIONS.main,
      Component: () =>
        import('./pages/DashboardPage').then((mod) => ({ default: mod.DashboardPage })),
      position: 1,
    });

    // Orders
    app.addMenuLink({
      to: `plugins/${pluginId}/orders`,
      icon: List,
      intlLabel: {
        id: getTrad('plugin.orders'),
        defaultMessage: 'Orders',
      },
      permissions: [{ action: 'plugin::ecommerce-base.orders.read', subject: null }],
      Component: () => import('./pages/OrdersPage').then((mod) => ({ default: mod.OrdersPage })),
      position: 2,
    });

    // Inventory
    app.addMenuLink({
      to: `plugins/${pluginId}/inventory`,
      icon: Shirt,
      intlLabel: {
        id: getTrad('plugin.inventory'),
        defaultMessage: 'Inventory',
      },
      permissions: [{ action: 'plugin::ecommerce-base.inventory.read', subject: null }],
      Component: () =>
        import('./pages/InventoryPage').then((mod) => ({ default: mod.InventoryPage })),
      position: 3,
    });

    // Catalog
    app.addMenuLink({
      to: `plugins/${pluginId}/catalog`,
      icon: PriceTag,
      intlLabel: {
        id: getTrad('plugin.catalog'),
        defaultMessage: 'Catalog',
      },
      permissions: [{ action: 'plugin::ecommerce-base.catalog.read', subject: null }],
      Component: () => import('./pages/CatalogPage').then((mod) => ({ default: mod.CatalogPage })),
      position: 4,
    });

    // Audit Log
    app.addMenuLink({
      to: `plugins/${pluginId}/audit`,
      icon: PresentationChart,
      intlLabel: {
        id: getTrad('plugin.audit'),
        defaultMessage: 'Audit Log',
      },
      permissions: [{ action: 'plugin::ecommerce-base.audit.read', subject: null }],
      Component: () =>
        import('./pages/AuditLogPage').then((mod) => ({ default: mod.AuditLogPage })),
      position: 5,
    });

    // Tax Rules
    app.addMenuLink({
      to: `plugins/${pluginId}/tax-rules`,
      icon: ChartPie,
      intlLabel: {
        id: getTrad('plugin.taxRules'),
        defaultMessage: 'Tax Rules',
      },
      permissions: [{ action: 'plugin::ecommerce-base.catalog.read', subject: null }],
      Component: () =>
        import('./pages/TaxRulesPage').then((mod) => ({ default: mod.TaxRulesPage })),
      position: 6,
    });

    app.registerPlugin({
      id: pluginId,
      name,
    });
  },
  registerTrads({ locales }: { locales: string[] }) {
    const importedTrads = locales.map((locale) => {
      return import(`./translations/${locale}.json`)
        .then(({ default: data }) => ({
          data: prefixPluginTranslations(data, pluginId),
          locale,
        }))
        .catch(() => ({
          data: {},
          locale,
        }));
    });
    return Promise.resolve(importedTrads);
  },
};

export default admin;
