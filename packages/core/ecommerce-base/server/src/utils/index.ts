import type product from '../services/product';
import type inventory from '../services/inventory';
import type order from '../services/order';
import type customer from '../services/customer';
import type cart from '../services/cart';
import type promotion from '../services/promotion';
import type payment from '../services/payment';
import type webhook from '../services/webhook';
import type audit from '../services/audit';

type Services = {
  product: ReturnType<typeof product>;
  inventory: ReturnType<typeof inventory>;
  order: ReturnType<typeof order>;
  customer: ReturnType<typeof customer>;
  cart: ReturnType<typeof cart>;
  promotion: ReturnType<typeof promotion>;
  payment: ReturnType<typeof payment>;
  webhook: ReturnType<typeof webhook>;
  audit: ReturnType<typeof audit>;
};

export const getService = <TName extends keyof Services>(name: TName): Services[TName] => {
  return strapi.plugin('ecommerce-base').service<Services[TName]>(name);
};

/**
 * Round a monetary value to 2 decimal places.
 */
export const roundMoney = (value: number): number =>
  Math.round((value + Number.EPSILON) * 100) / 100;

/**
 * Generate a human-friendly order number like `EC-260816-4821`.
 */
export const generateOrderNumber = (): string => {
  const now = new Date();
  const yymmdd = [now.getFullYear() % 100, now.getMonth() + 1, now.getDate()]
    .map((n) => String(n).padStart(2, '0'))
    .join('');
  const rand = Math.floor(Math.random() * 10000)
    .toString()
    .padStart(4, '0');
  return `EC-${yymmdd}-${rand}`;
};
