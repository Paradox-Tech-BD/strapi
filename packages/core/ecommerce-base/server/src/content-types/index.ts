import product from './product';
import inventoryItem from './inventory-item';
import order from './order';
import orderLine from './order-line';
import customer from './customer';
import cart from './cart';
import cartItem from './cart-item';
import promotion from './promotion';
import taxRule from './tax-rule';

export const contentTypes = {
  product,
  'inventory-item': inventoryItem,
  order,
  'order-line': orderLine,
  customer,
  cart,
  'cart-item': cartItem,
  promotion,
  'tax-rule': taxRule,
};
