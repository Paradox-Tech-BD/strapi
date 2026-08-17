const baseUrl = process.env.STRAPI_URL ?? 'http://127.0.0.1:1337';
const email = process.env.STRAPI_ADMIN_EMAIL ?? 'test@testing.com';
const password = process.env.STRAPI_ADMIN_PASSWORD ?? 'Testing123!';

const results = [];

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

function pass(name, detail) {
  results.push({ name, detail, status: 'passed' });
}

try {
  const login = await request('/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const headers = { Authorization: `Bearer ${login.data.token}` };
  pass('Admin authentication', 'Super-admin token issued by the running sandbox.');

  const dashboard = await request('/ecommerce-base/dashboard/stats', { headers });
  if (typeof dashboard.lowStockCount !== 'number') {
    throw new Error('Dashboard stats did not return lowStockCount.');
  }
  pass(
    'Dashboard low-stock query',
    `Dashboard returned HTTP 200 with ${dashboard.lowStockCount} low-stock items.`
  );

  const adminProducts = await request('/ecommerce-base/products?page=1&pageSize=12', { headers });
  const adminInventory = await request('/ecommerce-base/inventory?page=1&pageSize=12', { headers });
  if (!adminProducts.results.length || !adminInventory.results.length) {
    throw new Error('Starter catalog or inventory is missing. Run the demo seeder first.');
  }
  pass(
    'Admin catalog and inventory',
    `${adminProducts.results.length} products and ${adminInventory.results.length} inventory rows returned.`
  );

  const publicProducts = await request('/api/ecommerce-base/products?page=1&pageSize=12');
  if (!publicProducts.results?.length) {
    throw new Error('Public product API returned no products.');
  }
  const firstProduct = publicProducts.results[0];
  pass(
    'Public storefront catalog',
    `Published product ${firstProduct.id} is delivered from the content API.`
  );

  const preview = await request('/api/ecommerce-base/checkout/preview', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      items: [{ productId: firstProduct.id, quantity: 2 }],
      region: 'BD',
      currency: 'BDT',
      shippingCost: 120,
    }),
  });
  if (preview.currency !== 'BDT' || preview.tax?.currency !== 'BDT' || preview.taxAmount <= 0) {
    throw new Error(`BDT preview contract failed: ${JSON.stringify(preview)}`);
  }
  pass(
    'BDT checkout preview',
    `Converted subtotal ${preview.subtotal} BDT, tax ${preview.taxAmount} BDT, total ${preview.total} BDT.`
  );

  const taxRules = await request('/ecommerce-base/tax-rules?page=1&pageSize=12', { headers });
  if (!taxRules.results.some((rule) => rule.region === 'BD' && rule.currency === 'BDT')) {
    throw new Error('BDT tax rule is missing.');
  }
  pass('BDT tax policy', 'At least one active Bangladesh Taka tax rule is present.');

  console.table(results);
  console.log(
    `Live ecommerce integration passed: ${results.length}/${results.length} checks at ${baseUrl}.`
  );
} catch (error) {
  console.error('Live ecommerce integration failed:', error);
  process.exitCode = 1;
}
