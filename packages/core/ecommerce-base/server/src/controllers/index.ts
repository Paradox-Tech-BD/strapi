import dashboard from './dashboard';
import product from './product';
import inventory from './inventory';
import order from './order';
import customer from './customer';
import cart from './cart';
import promotion from './promotion';
import payment from './payment';
import webhook from './webhook';
import audit from './audit';
import contentApiController from './content-api';

export const controllers = {
  dashboard,
  product,
  inventory,
  order,
  customer,
  cart,
  promotion,
  payment,
  webhook,
  audit,
  'content-api': contentApiController,
};
