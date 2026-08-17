import { expect, test, type Page } from '@playwright/test';
import { sharedSetup } from '../../../utils/setup';

const openTaxRules = async (page: Page) => {
  await page.goto('/admin/plugins/ecommerce-base/tax-rules');
  await page.waitForLoadState('networkidle');
  await expect(page.getByRole('heading', { name: 'Tax Rules' }).first()).toBeVisible();
};

const createTaxRule = async (
  page: Page,
  values: { name: string; region: string; currency: string; rate: string }
) => {
  await page.getByRole('button', { name: 'Create tax rule' }).click();
  const dialog = page.getByRole('alertdialog');
  await expect(dialog).toBeVisible();
  await page.locator('#tax-rule-name').fill(values.name);
  await page.locator('#tax-rule-region').fill(values.region);
  await page.locator('#tax-rule-currency').fill(values.currency);
  await page.locator('#tax-rule-rate').fill(values.rate);
  await dialog.getByRole('button', { name: 'Save tax rule' }).click();
  await expect(page.getByText(values.name, { exact: true })).toBeVisible();
};

test.describe('Ecommerce Tax Rules', () => {
  test.beforeEach(async ({ page }) => {
    await sharedSetup('ecommerce-tax-rules', page, {
      login: true,
      resetFiles: true,
      importData: 'with-admin',
      resyncSuperAdminPermissions: true,
    });
  });

  test('opens the Tax Rules page with an empty state and create action', async ({ page }) => {
    await openTaxRules(page);
    await expect(page.getByRole('heading', { name: 'Tax Rules' }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Create tax rule' })).toBeVisible();
    await expect(page.getByText('No tax rules yet.')).toBeVisible();
  });

  test('creates and lists a BDT-specific tax rule', async ({ page }) => {
    await openTaxRules(page);
    await createTaxRule(page, {
      name: 'BDT VAT E2E',
      region: 'BD',
      currency: 'BDT',
      rate: '0.15',
    });

    const row = page.getByRole('row').filter({ hasText: 'BDT VAT E2E' });
    await expect(row).toContainText('BD');
    await expect(row).toContainText('BDT');
    await expect(row).toContainText('15.00%');
  });

  test('deletes a tax rule after confirmation', async ({ page }) => {
    await openTaxRules(page);
    await createTaxRule(page, {
      name: 'Delete Tax Rule E2E',
      region: 'BD',
      currency: 'BDT',
      rate: '0.05',
    });

    const row = page.getByRole('row').filter({ hasText: 'Delete Tax Rule E2E' });
    await row.getByRole('button', { name: 'Delete tax rule' }).click();
    const dialog = page.getByRole('alertdialog');
    await expect(dialog).toContainText('Delete tax rule?');
    await dialog.getByRole('button', { name: 'Delete', exact: true }).click();
    await expect(row).not.toBeVisible();
  });
});
