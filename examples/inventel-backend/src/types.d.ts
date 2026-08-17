declare module '@strapi/strapi' {
  export namespace Core {
    type Strapi = any;
    namespace Config {
      namespace Shared {
        type ConfigParams = any;
      }
      type Admin = any;
      type Api = any;
      type Middlewares = any;
      type Plugin = any;
      type Server = any;
      interface Database {
        connection?: any;
      }
      namespace Database {
        type ClientKind = 'sqlite' | 'mysql' | 'postgres';
      }
    }
  }
}

declare module '@strapi/types' {
  export namespace Core {
    type Strapi = any;
  }
}

declare module '@strapi/database' {
  export function isDatabaseClientKind(value: string): boolean;
}
