import taxFactory from '../../services/tax';
import { createStrapiMock } from '../../helpers/strapi';
import { TAX_RULE_MODEL_UID } from '../../constants';

describe('ecommerce-base tax service', () => {
  let ctx: ReturnType<typeof createStrapiMock>;
  let tax: ReturnType<typeof taxFactory>;

  beforeEach(() => {
    ctx = createStrapiMock();
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
