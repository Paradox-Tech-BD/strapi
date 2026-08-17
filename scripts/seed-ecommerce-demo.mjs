const baseUrl = process.env.STRAPI_URL ?? 'http://127.0.0.1:1337';
const email = process.env.STRAPI_ADMIN_EMAIL ?? 'test@testing.com';
const password = process.env.STRAPI_ADMIN_PASSWORD ?? 'Testing123!';

if (process.env.NODE_ENV === 'production') {
  throw new Error('The ecommerce demo seeder is disabled in production.');
}

const products = [
  {
    name: 'Indigo Handloom Throw',
    sku: 'NCS-THROW-INDIGO',
    price: 46,
    compareAtPrice: 52,
    currency: 'USD',
    category: 'Textiles',
    description: 'A breathable handloom cotton throw with a soft, relaxed drape.',
    tags: ['handloom', 'textile', 'indigo'],
    stock: 28,
  },
  {
    name: 'Brass Tea Canister',
    sku: 'NCS-TEA-BRASS',
    price: 24,
    compareAtPrice: 29,
    currency: 'USD',
    category: 'Tableware',
    description: 'A brushed brass storage canister designed for loose-leaf tea and dry goods.',
    tags: ['brass', 'tea', 'tableware'],
    stock: 18,
  },
  {
    name: 'Terracotta Pouring Vessel',
    sku: 'NCS-VESSEL-TERRA',
    price: 31,
    currency: 'USD',
    category: 'Homeware',
    description: 'A quietly sculptural clay vessel for water, flowers, or a shelf ritual.',
    tags: ['terracotta', 'homeware', 'handmade'],
    stock: 12,
  },
  {
    name: 'Walnut Serving Board',
    sku: 'NCS-BOARD-WALNUT',
    price: 39,
    currency: 'USD',
    category: 'Tableware',
    description: 'A solid walnut board with softened edges for everyday serving.',
    tags: ['wood', 'tableware', 'kitchen'],
    stock: 16,
  },
];

async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, options);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      `${options.method ?? 'GET'} ${path} failed (${response.status}): ${JSON.stringify(body)}`
    );
  }
  return body;
}

const login = await request('/admin/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password }),
});
const headers = {
  Authorization: `Bearer ${login.data.token}`,
  'Content-Type': 'application/json',
};

const existing = await request('/ecommerce-base/products?page=1&pageSize=100', { headers });
const productsBySku = new Map(existing.results.map((product) => [product.sku, product]));

for (const product of products) {
  let record = productsBySku.get(product.sku);
  if (!record) {
    record = await request('/ecommerce-base/products', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        name: product.name,
        sku: product.sku,
        price: product.price,
        compareAtPrice: product.compareAtPrice,
        currency: product.currency,
        category: product.category,
        description: product.description,
        tags: product.tags,
        status: 'published',
      }),
    });
  }
  await request(`/ecommerce-base/products/${record.id}/publish`, { method: 'POST', headers });
}

const inventory = await request('/ecommerce-base/inventory?page=1&pageSize=100', { headers });
for (const product of products) {
  const item = inventory.results.find((record) => record.sku === product.sku);
  if (item && Number(item.quantity) === 0) {
    await request(`/ecommerce-base/inventory/${item.id}/adjust`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ delta: product.stock, reason: 'Development starter catalog' }),
    });
  }
}

const taxRules = await request('/ecommerce-base/tax-rules?page=1&pageSize=100', { headers });
if (!taxRules.results.some((rule) => rule.name === 'Bangladesh VAT')) {
  await request('/ecommerce-base/tax-rules', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      name: 'Bangladesh VAT',
      region: 'BD',
      currency: 'BDT',
      rate: 0.15,
      type: 'exclusive',
      active: true,
      appliesTo: 'all',
    }),
  });
}

console.log(`Seeded or verified ${products.length} starter products at ${baseUrl}.`);
