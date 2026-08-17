import { errors } from '@strapi/utils';
import { TAX_EXEMPTION_RULE_MODEL_UID, TAX_RULE_MODEL_UID } from '../constants';
import { roundMoney } from '../utils';

type TaxRule = {
  id: number | string;
  name: string;
  region: string;
  currency?: string;
  rate: number | string;
  type: 'inclusive' | 'exclusive';
  active: boolean;
  appliesTo: 'all' | 'physical' | 'digital';
  [key: string]: unknown;
};

type TaxExemptionRule = {
  id: number | string;
  name: string;
  code?: string;
  region?: string;
  currency?: string;
  customer?: number | string | { id?: number | string } | null;
  customerTags?: unknown;
  emailDomains?: unknown;
  minimumSubtotal?: number | string;
  exemptionPercentage?: number | string;
  active?: boolean;
  startsAt?: string | Date | null;
  endsAt?: string | Date | null;
  [key: string]: unknown;
};

type TaxContext = {
  currency?: string;
  customerId?: number | string;
  customer?: Record<string, any> | null;
  exemptionCode?: string;
  now?: Date | string;
};

type TaxConfig = {
  baseCurrency?: string;
  supportedCurrencies?: string[];
  exchangeRates?: Record<string, number>;
};

type TaxRuleInput = Omit<Partial<TaxRule>, 'id'> & {
  name: string;
  region: string;
  rate: number;
};

const { ValidationError } = errors;

function normalizeCurrency(value: unknown, fallback = 'USD') {
  const currency = String(value ?? fallback)
    .trim()
    .toUpperCase();
  return currency || fallback;
}

function asList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String).map((item) => item.trim().toLowerCase());
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean);
  }
  return [];
}

function asDate(value: unknown) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
}

export default ({ strapi }: { strapi: any }) => {
  function getTaxConfig(): Required<Pick<TaxConfig, 'baseCurrency' | 'supportedCurrencies'>> & {
    exchangeRates: Record<string, number>;
  } {
    const nested = strapi.config?.get?.('plugin::ecommerce-base.tax');
    const pluginConfig = strapi.config?.get?.('plugin::ecommerce-base');
    const configured = (nested && typeof nested === 'object' ? nested : pluginConfig?.tax) ?? {};
    const baseCurrency = normalizeCurrency(configured.baseCurrency, 'USD');
    const exchangeRates = Object.fromEntries(
      Object.entries(configured.exchangeRates ?? { [baseCurrency]: 1 }).map(([currency, rate]) => [
        normalizeCurrency(currency),
        Number(rate),
      ])
    );
    exchangeRates[baseCurrency] = Number(exchangeRates[baseCurrency] ?? 1);
    const configuredCurrencies = Array.isArray(configured.supportedCurrencies)
      ? configured.supportedCurrencies.map((currency: unknown) => normalizeCurrency(currency))
      : Object.keys(exchangeRates);
    const supportedCurrencies = Array.from(
      new Set([baseCurrency, ...configuredCurrencies, ...Object.keys(exchangeRates)])
    );

    return { baseCurrency, supportedCurrencies, exchangeRates };
  }

  function assertSupportedCurrency(value: unknown, fallback?: string) {
    const config = getTaxConfig();
    const currency = normalizeCurrency(value, fallback ?? config.baseCurrency);
    if (
      !config.supportedCurrencies.includes(currency) ||
      !Number.isFinite(config.exchangeRates[currency])
    ) {
      throw new ValidationError(`Unsupported currency "${currency}".`);
    }
    return currency;
  }

  function convert(amount: number, fromCurrency?: string, toCurrency?: string) {
    const config = getTaxConfig();
    const from = assertSupportedCurrency(fromCurrency, config.baseCurrency);
    const to = assertSupportedCurrency(toCurrency, from);
    const fromRate = Number(config.exchangeRates[from]);
    const toRate = Number(config.exchangeRates[to]);
    const rate = toRate / fromRate;

    return {
      amount: roundMoney(Number(amount) * rate),
      rate,
      from,
      to,
    };
  }

  function getCustomerId(context: TaxContext) {
    return context.customer?.id ?? context.customerId;
  }

  function getCustomerTags(context: TaxContext) {
    const customer = context.customer ?? {};
    const metadataTags = customer.metadata?.tags;
    return new Set([...asList(customer.tags), ...asList(metadataTags)]);
  }

  function matchesExemption(
    rule: TaxExemptionRule,
    subtotal: number,
    region: string,
    currency: string,
    context: TaxContext
  ) {
    if (rule.active === false) return false;
    if (
      rule.region &&
      rule.region !== '*' &&
      String(rule.region).toLowerCase() !== region.toLowerCase()
    ) {
      return false;
    }
    if (rule.currency && normalizeCurrency(rule.currency) !== currency) return false;

    const customerId = getCustomerId(context);
    if (rule.customer) {
      const ruleCustomerId = typeof rule.customer === 'object' ? rule.customer.id : rule.customer;
      if (String(ruleCustomerId) !== String(customerId ?? '')) return false;
    }

    const requiredTags = asList(rule.customerTags);
    if (requiredTags.length) {
      const customerTags = getCustomerTags(context);
      if (!requiredTags.every((tag) => customerTags.has(tag))) return false;
    }

    const emailDomains = asList(rule.emailDomains);
    if (emailDomains.length) {
      const email = String(context.customer?.email ?? '').toLowerCase();
      if (!email || !emailDomains.some((domain) => email.endsWith(`@${domain}`))) return false;
    }

    if (Number(rule.minimumSubtotal ?? 0) > Number(subtotal)) return false;

    const now = asDate(context.now) ?? new Date();
    const startsAt = asDate(rule.startsAt);
    const endsAt = asDate(rule.endsAt);
    if (startsAt && now < startsAt) return false;
    if (endsAt && now > endsAt) return false;

    if (rule.code && String(rule.code) !== String(context.exemptionCode ?? '')) return false;
    return true;
  }

  return {
    normalizeCurrency,

    convert,

    getCurrencyConfig() {
      return getTaxConfig();
    },

    isSupportedCurrency(value: unknown) {
      try {
        assertSupportedCurrency(value);
        return true;
      } catch {
        return false;
      }
    },

    async findAll() {
      return strapi.db.query(TAX_RULE_MODEL_UID).findMany({
        where: { active: true },
        orderBy: { region: 'asc', name: 'asc' },
      });
    },

    async findForRegion(region: string, currency?: string) {
      const rules = (await strapi.db.query(TAX_RULE_MODEL_UID).findMany({
        where: { active: true, region },
        orderBy: { name: 'asc' },
      })) as TaxRule[];
      if (!currency) return rules;
      const normalized = normalizeCurrency(currency);
      const currencySpecific = rules.filter(
        (rule) => rule.currency && normalizeCurrency(rule.currency) === normalized
      );
      return currencySpecific.length ? currencySpecific : rules.filter((rule) => !rule.currency);
    },

    async findOne(id: number | string) {
      return strapi.db.query(TAX_RULE_MODEL_UID).findOne({ where: { id } });
    },

    async findExemptions() {
      return strapi.db.query(TAX_EXEMPTION_RULE_MODEL_UID).findMany({
        where: { active: true },
        populate: { customer: true },
        orderBy: { name: 'asc' },
      });
    },

    async compute(subtotal: number, region: string, context: TaxContext = {}) {
      const currency = assertSupportedCurrency(context.currency);
      const rules = (await this.findForRegion(region, currency)) as TaxRule[];
      const effectiveRate = roundMoney(
        rules
          .filter((rule) => rule.type === 'exclusive')
          .reduce((sum, rule) => sum + Number(rule.rate), 0)
      );
      const grossTaxAmount = roundMoney(Number(subtotal) * effectiveRate);
      const exemptions = (await this.findExemptions()) as TaxExemptionRule[];
      const matchedExemptions = exemptions
        .filter((rule) => matchesExemption(rule, Number(subtotal), region, currency, context))
        .sort(
          (left, right) =>
            Number(right.exemptionPercentage ?? 100) - Number(left.exemptionPercentage ?? 100)
        );
      const matchedExemption = matchedExemptions[0] ?? null;
      const exemptionPercentage = Math.min(
        100,
        Math.max(0, Number(matchedExemption?.exemptionPercentage ?? 0))
      );
      const exemptAmount = roundMoney((grossTaxAmount * exemptionPercentage) / 100);
      const taxAmount = roundMoney(grossTaxAmount - exemptAmount);

      const legacyResult = {
        taxAmount,
        effectiveRate: roundMoney(effectiveRate * (1 - exemptionPercentage / 100)),
        rules,
      };
      if (!Object.keys(context).length) return legacyResult;

      return {
        ...legacyResult,
        grossTaxAmount,
        exemptAmount,
        exemptionPercentage,
        exemption: matchedExemption
          ? {
              id: matchedExemption.id,
              name: matchedExemption.name,
              code: matchedExemption.code,
              exemptionPercentage,
            }
          : null,
        currency,
      };
    },

    async create(data: TaxRuleInput) {
      const currency = data.currency ? assertSupportedCurrency(data.currency) : undefined;
      return strapi.db.query(TAX_RULE_MODEL_UID).create({
        data: { ...data, currency },
      });
    },

    async update(id: number | string, data: Partial<TaxRuleInput>) {
      const currency = data.currency ? assertSupportedCurrency(data.currency) : undefined;
      return strapi.db.query(TAX_RULE_MODEL_UID).update({
        where: { id },
        data: { ...data, ...(currency ? { currency } : {}) },
      });
    },

    async delete(id: number | string) {
      return strapi.db.query(TAX_RULE_MODEL_UID).delete({ where: { id } });
    },
  };
};
