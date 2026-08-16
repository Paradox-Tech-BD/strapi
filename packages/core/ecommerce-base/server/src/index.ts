import type {} from 'koa-body';
import type {} from '@strapi/types';

import { register } from './register';
import { bootstrap } from './bootstrap';
import { config } from './config';
import { contentTypes } from './content-types';
import { services } from './services';
import { controllers } from './controllers';
import { routes } from './routes';

export default () => ({
  register,
  bootstrap,
  config,
  contentTypes,
  services,
  controllers,
  routes,
});
