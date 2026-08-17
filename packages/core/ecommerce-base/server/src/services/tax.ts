import { TAX_RULE_MODEL_UID } from '../constants';
import { roundMoney } from '../utils';

type TaxRule = {
  id: number | string;
  name: string;
  region: string;
  rate: number | string;
  type: 'inclusive' | 'exclusive';
  active: boolean;
  appliesTo: 'all' | 'physical' | 'digital';
  [key: string]: unknown;
};

type TaxRuleInput = Omit<Partial<TaxRule>, 'id'> & {
  name: string;
  region: string;
  rate: number;
};

export default ({ strapi }: { strapi: any }) => ({
  async findAll() {
    return strapi.db.query(TAX_RULE_MODEL_UID).findMany({
      where: { active: true },
      orderBy: { region: 'asc', name: 'asc' },
    });
  },

  async findForRegion(region: string) {
    return strapi.db.query(TAX_RULE_MODEL_UID).findMany({
      where: { active: true, region },
      orderBy: { name: 'asc' },
    });
  },

  async findOne(id: number | string) {
    return strapi.db.query(TAX_RULE_MODEL_UID).findOne({ where: { id } });
  },

  async compute(subtotal: number, region: string) {
    const rules = (await this.findForRegion(region)) as TaxRule[];
    const effectiveRate = roundMoney(
      rules
        .filter((rule) => rule.type === 'exclusive')
        .reduce((sum, rule) => sum + Number(rule.rate), 0)
    );
    const taxAmount = roundMoney(Number(subtotal) * effectiveRate);

    return {
      taxAmount,
      effectiveRate,
      rules,
    };
  },

  async create(data: TaxRuleInput) {
    return strapi.db.query(TAX_RULE_MODEL_UID).create({ data });
  },

  async update(id: number | string, data: Partial<TaxRuleInput>) {
    return strapi.db.query(TAX_RULE_MODEL_UID).update({ where: { id }, data });
  },

  async delete(id: number | string) {
    return strapi.db.query(TAX_RULE_MODEL_UID).delete({ where: { id } });
  },
});
