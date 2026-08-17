import taxFactory from '../../services/tax';
import { createStrapiMock } from '../../helpers/strapi';
import { TAX_EXEMPTION_RULE_MODEL_UID, TAX_RULE_MODEL_UID } from '../../constants';

describe('ecommerce-base tax service', () => {
  let ctx: ReturnType<typeof createStrapiMock>;
  let tax: ReturnType<typeof taxFactory>;

  beforeEach(() => {
    ctx = createStrapiMock();
    ctx.strapi.config.get.mockImplementation((key: string) =>
      key === 'plugin::ecommerce-base.tax'
        ? {
            baseCurrency: 'USD',
            supportedCurrencies: ['USD', 'BDT'],
            exchangeRates: { USD: 1, BDT: 120 },
          }
        : null
    );
    tax = taxFactory({ strapi: ctx.strapi });
    (ctx.db.query as any).store[TAX_RULE_MODEL_UID] = [
      {
        id: 1,
        name: 'Bangladesh VAT',
        region: 'BD',
        rate: 0.15,
        type: 'exclusive',
        active: true,
        appliesTo: 'all',
      },
      {
        id: 2,
        name: 'Inactive BD rule',
        region: 'BD',
        rate: 0.05,
        type: 'exclusive',
        active: false,
        appliesTo: 'all',
      },
      {
        id: 3,
        name: 'US state tax',
        region: 'US-CA',
        rate: 0.08,
        type: 'exclusive',
        active: true,
        appliesTo: 'physical',
      },
    ];
  });

  it('findForRegion returns only active rules matching the region', async () => {
    await expect(tax.findForRegion('BD')).resolves.toEqual([
      expect.objectContaining({ id: 1, region: 'BD', active: true }),
    ]);
  });

  it('computes a 15% exclusive rate on 100.00 as 15.00', async () => {
    await expect(tax.compute(100, 'BD')).resolves.toEqual({
      taxAmount: 15,
      effectiveRate: 0.15,
      rules: [expect.objectContaining({ id: 1 })],
    });
  });

  it('sums multiple exclusive rules correctly', async () => {
    (ctx.db.query as any).store[TAX_RULE_MODEL_UID].push({
      id: 4,
      name: 'Municipal surcharge',
      region: 'BD',
      rate: 0.02,
      type: 'exclusive',
      active: true,
      appliesTo: 'all',
    });

    const result = await tax.compute(100, 'BD');
    expect(result.effectiveRate).toBe(0.17);
    expect(result.taxAmount).toBe(17);
    expect(result.rules).toHaveLength(2);
  });

  it('returns zero tax when no active rule matches', async () => {
    await expect(tax.compute(100, 'EU')).resolves.toEqual({
      taxAmount: 0,
      effectiveRate: 0,
      rules: [],
    });
  });

  it('converts USD amounts into BDT using the configured deterministic rate', () => {
    expect(tax.convert(10, 'USD', 'BDT')).toEqual({
      amount: 1200,
      rate: 120,
      from: 'USD',
      to: 'BDT',
    });
  });

  it('applies a matching customer exemption rule to a BDT checkout', async () => {
    (ctx.db.query as any).store[TAX_EXEMPTION_RULE_MODEL_UID] = [
      {
        id: 10,
        name: 'BD reseller exemption',
        region: 'BD',
        currency: 'BDT',
        customerTags: ['reseller'],
        exemptionPercentage: 100,
        active: true,
      },
    ];

    const result = (await tax.compute(1200, 'BD', {
      currency: 'BDT',
      customer: { id: 7, tags: ['reseller'] },
      now: '2026-08-17T00:00:00.000Z',
    })) as any;

    expect(result).toEqual(
      expect.objectContaining({
        currency: 'BDT',
        taxAmount: 0,
        grossTaxAmount: 180,
        exemptAmount: 180,
        exemptionPercentage: 100,
        exemption: expect.objectContaining({ id: 10 }),
      })
    );
  });

  it('does not apply a customer-tag exemption when the tag does not match', async () => {
    (ctx.db.query as any).store[TAX_EXEMPTION_RULE_MODEL_UID] = [
      {
        id: 11,
        name: 'BD reseller exemption',
        region: 'BD',
        customerTags: ['reseller'],
        exemptionPercentage: 100,
        active: true,
      },
    ];

    const result = (await tax.compute(100, 'BD', {
      currency: 'USD',
      customer: { id: 7, tags: ['consumer'] },
    })) as any;

    expect(result.exemption).toBeNull();
    expect(result.taxAmount).toBe(15);
  });

  it('creates a new rule through db.query', async () => {
    const created = await tax.create({
      name: 'EU VAT',
      region: 'EU',
      rate: 0.2,
      type: 'exclusive',
      active: true,
      appliesTo: 'all',
    });
    expect(created).toEqual(expect.objectContaining({ name: 'EU VAT', region: 'EU' }));
    expect((ctx.db.query as any)(TAX_RULE_MODEL_UID).create).toHaveBeenCalledWith({
      data: expect.objectContaining({ name: 'EU VAT' }),
    });
  });

  it('deletes a rule and returns the deleted record', async () => {
    await expect(tax.delete(1)).resolves.toEqual(expect.objectContaining({ id: 1 }));
    expect((ctx.db.query as any).store[TAX_RULE_MODEL_UID]).toEqual(
      expect.not.arrayContaining([expect.objectContaining({ id: 1 })])
    );
  });
});
