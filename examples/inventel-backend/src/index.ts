import type { Core } from '@strapi/types';

const imagePool = [
  'https://images.unsplash.com/photo-1606220945770-b5b6c2c55bf1?auto=format&fit=crop&w=900&q=85',
  'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=900&q=85',
  'https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?auto=format&fit=crop&w=900&q=85',
  'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?auto=format&fit=crop&w=900&q=85',
];

const starterProducts = [
  {
    name: 'WH-1000XM4 Wireless Headphones High Quality',
    description: 'A comfortable noise-cancelling listening experience for work and travel.',
    price: 59,
    compareAtPrice: 69,
    category: 'Audio',
    sku: 'INV-AUD-WH1000',
    currency: 'USD',
    status: 'published' as const,
    publishedAt: new Date().toISOString(),
    images: [imagePool[0]],
    stockTracking: true,
  },
  {
    name: 'iPhone 13 High Quality Value Buy',
    description: 'A reliable everyday smartphone with a bright display and excellent camera.',
    price: 79,
    compareAtPrice: 89,
    category: 'Phone',
    sku: 'INV-PHN-IP13',
    currency: 'USD',
    status: 'published' as const,
    publishedAt: new Date().toISOString(),
    images: [imagePool[1]],
    stockTracking: true,
  },
  {
    name: 'iPad Pro 13 High Quality Value Buy Best Camera',
    description: 'A versatile tablet for work, creativity, and entertainment on the move.',
    price: 199,
    compareAtPrice: 239,
    category: 'Laptop & Tablet',
    sku: 'INV-TAB-PRO13',
    currency: 'USD',
    status: 'published' as const,
    publishedAt: new Date().toISOString(),
    images: [imagePool[2]],
    stockTracking: true,
  },
  {
    name: 'Mini Polaroid Camera with Flash',
    description: 'A playful instant camera for capturing sharp memories wherever you go.',
    price: 79,
    compareAtPrice: 95,
    category: 'Camera',
    sku: 'INV-CAM-MINI',
    currency: 'USD',
    status: 'published' as const,
    publishedAt: new Date().toISOString(),
    images: [imagePool[3]],
    stockTracking: true,
  },
];

export default {
  register() {},

  async bootstrap({ strapi }: { strapi: Core.Strapi }) {
    const productQuery = strapi.db.query('plugin::ecommerce-base.product');
    const existing = await productQuery.findMany({ limit: 1 });

    if (existing.length) {
      strapi.log.info(
        '[inventel-backend] Existing catalog found; leaving admin-managed data unchanged.'
      );
      return;
    }

    const productService = strapi.plugin('ecommerce-base').service('product');
    for (const product of starterProducts) {
      await productService.create(product);
    }

    strapi.log.info(`[inventel-backend] Seeded ${starterProducts.length} editable products.`);
  },
};
