import { errors } from '@strapi/utils';

const { ValidationError } = errors;

export type CheckoutItemInput = {
  productId: number | string;
  quantity: number;
  currency?: string;
};

export type CheckoutInput = {
  items: CheckoutItemInput[];
  promotionCode?: string;
  shippingCost?: number;
  region: string;
  currency?: string;
  exemptionCode?: string;
};

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ValidationError('Checkout payload must be an object.');
  }
  return value as Record<string, unknown>;
}

function normalizeText(value: unknown, field: string): string | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value !== 'string' || !value.trim()) {
    throw new ValidationError(`${field} must be a non-empty string.`);
  }
  return value.trim();
}

function normalizePositiveNumber(value: unknown, field: string): number | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const number = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(number) || number < 0) {
    throw new ValidationError(`${field} must be a non-negative number.`);
  }
  return number;
}

function normalizeItems(
  value: unknown,
  isSupportedCurrency: (currency: string) => boolean
): CheckoutItemInput[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new ValidationError('An order needs at least one line item.');
  }

  return value.map((rawItem, index) => {
    const item = asRecord(rawItem);
    const productId = item.productId;
    const numericProductId = Number(productId);
    if (
      (typeof productId !== 'number' && typeof productId !== 'string') ||
      !Number.isInteger(numericProductId) ||
      numericProductId <= 0
    ) {
      throw new ValidationError(`items[${index}].productId must be a positive integer.`);
    }

    const quantity = Number(item.quantity);
    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw new ValidationError(`items[${index}].quantity must be a positive integer.`);
    }

    const currency = normalizeText(item.currency, `items[${index}].currency`)?.toUpperCase();
    if (currency && !isSupportedCurrency(currency)) {
      throw new ValidationError(`Unsupported currency "${currency}" for items[${index}].currency.`);
    }
    return {
      productId,
      quantity,
      ...(currency ? { currency } : {}),
    };
  });
}

export function normalizeCheckoutInput(
  value: unknown,
  isSupportedCurrency: (currency: string) => boolean
): CheckoutInput {
  const body = asRecord(value);
  const currency = normalizeText(body.currency, 'currency')?.toUpperCase();
  if (currency && !isSupportedCurrency(currency)) {
    throw new ValidationError(`Unsupported currency "${currency}".`);
  }

  const region =
    normalizeText(body.region ?? (body.shippingAddress as any)?.region, 'region') ?? 'default';
  const shippingCost = normalizePositiveNumber(body.shippingCost, 'shippingCost');
  const promotionCode = normalizeText(body.promotionCode, 'promotionCode');
  const exemptionCode = normalizeText(body.exemptionCode, 'exemptionCode');

  return {
    items: normalizeItems(body.items, isSupportedCurrency),
    ...(promotionCode ? { promotionCode } : {}),
    ...(shippingCost !== undefined ? { shippingCost } : {}),
    region,
    ...(currency ? { currency } : {}),
    ...(exemptionCode ? { exemptionCode } : {}),
  };
}
