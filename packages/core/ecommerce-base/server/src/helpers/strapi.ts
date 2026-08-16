/**
 * Shared strapi mock used across the plugin's unit test suite. Mirrors the
 * approach used by the official core plugins (see
 * `packages/core/upload/server/src/__tests__/bootstrap.test.ts`): a plain
 * object assigned to `global.strapi` whose `db.query` and `plugin().service()`
 * surfaces are replaced per test.
 */

function matchesWhere(record: Record<string, unknown>, where: Record<string, unknown>): boolean {
  return Object.entries(where).every(([key, value]) => {
    const recordValue = record[key as string];
    if (value && typeof value === 'object' && !Array.isArray(value) && value !== null) {
      const operators = value as Record<string, unknown>;
      if ('$in' in operators) {
        return Array.isArray(operators.$in) && (operators.$in as unknown[]).includes(recordValue);
      }
      if ('$eq' in operators) return recordValue === operators.$eq;
      if ('$gt' in operators) return Number(recordValue) > Number(operators.$gt);
      if ('$gte' in operators) return Number(recordValue) >= Number(operators.$gte);
      if ('$lt' in operators) return Number(recordValue) < Number(operators.$lt);
      if ('$lte' in operators) return Number(recordValue) <= Number(operators.$lte);
      if ('$ne' in operators) return recordValue !== operators.$ne;
      if ('$contains' in operators) {
        const needle = String(operators.$contains);
        return (
          typeof recordValue === 'string' &&
          recordValue.toLowerCase().includes(needle.toLowerCase())
        );
      }
      return typeof recordValue === 'object' && recordValue !== null && !Array.isArray(recordValue)
        ? matchesWhere(recordValue as Record<string, unknown>, operators)
        : false;
    }
    return recordValue === value;
  });
}

export function createDbQueryMock(data: Record<string, unknown[]> = {}) {
  const perUid: Record<string, Record<string, jest.Mock>> = {};
  const query = jest.fn((uid: string) => {
    // Return a stable query object per uid so tests can assert against the
    // same mock that the service under test receives.
    if (perUid[uid]) return perUid[uid] as unknown;
    const store = (query as unknown as { store: Record<string, unknown[]> }).store ?? data;
    const queryObj = {
      create: jest.fn(async (args: any) => {
        const record = { id: 1, ...args.data };
        if (!data[uid]) data[uid] = [];
        data[uid].push(record);
        return record;
      }),
      findOne: jest.fn(async (args?: any) => {
        const records = data[uid] as unknown[];
        if (!args?.where) return records[0] ?? null;
        return (
          (records.find((record: any) => matchesWhere(record, args.where)) as Record<
            string,
            unknown
          >) ?? null
        );
      }),
      findMany: jest.fn(async (args?: any) => {
        const records = (data[uid] as unknown[]) ?? [];
        if (!args?.where) return records;
        return records.filter((record: any) => matchesWhere(record, args.where));
      }),
      findPage: jest.fn(async (args?: any) => {
        const records = ((data[uid] as unknown[]) ?? []).slice();
        const pageSize = args?.limit ?? 10;
        const page = args?.offset ? Math.floor(args.offset / pageSize) + 1 : 1;
        return {
          results: records.slice((page - 1) * pageSize, page * pageSize),
          pagination: { page, pageSize, pageCount: 1, total: records.length },
        };
      }),
      count: jest.fn(async () => {
        return ((data[uid] as unknown[]) ?? []).length;
      }),
      update: jest.fn(async (args: any) => {
        const record = (data[uid] as any[])?.find((r: any) => r.id === args.where.id);
        if (record) Object.assign(record, args.data);
        return record ?? null;
      }),
      updateMany: jest.fn(async () => 0),
      delete: jest.fn(async (args: any) => {
        const index = (data[uid] as any[])?.findIndex((r: any) => r.id === args.where.id);
        if (index > -1) return (data[uid] as any[]).splice(index, 1)[0];
        return null;
      }),
      deleteMany: jest.fn(async () => 0),
      reserve: jest.fn(async (args?: any) => {
        const id = args?.id ?? args?.where?.id;
        const records = (store[uid] as any[] | undefined) ?? [];
        const record = records.find((r: any) => r.id === id) ?? null;
        if (record && typeof args?.quantity === 'number') {
          record.reservedQuantity = Number(record.reservedQuantity ?? 0) + args.quantity;
        }
        return record ?? { id: id ?? 1, reservedQuantity: args?.quantity ?? 0 };
      }),
      releaseReservation: jest.fn(async (args?: any) => {
        const id = args?.id ?? args?.where?.id;
        const records = (store[uid] as any[] | undefined) ?? [];
        const record = records.find((r: any) => r.id === id) ?? null;
        if (record && typeof args?.quantity === 'number') {
          record.reservedQuantity = Math.max(
            0,
            Number(record.reservedQuantity ?? 0) - args.quantity
          );
        }
        return record ?? { id: id ?? 1, reservedQuantity: 0 };
      }),
    } as Record<string, jest.Mock>;
    perUid[uid] = queryObj;
    return queryObj;
  }) as unknown as jest.Mock & { store: Record<string, unknown[]> };
  (query as unknown as { store: Record<string, unknown[]> }).store = data;

  return { query, store: data };
}

export function createStrapiMock(overrides: Partial<Record<string, unknown>> = {}) {
  const db: any = overrides.db ?? createDbQueryMock();
  const eventHub = { emit: jest.fn(), on: jest.fn() } as any;
  const config = {
    get: jest.fn(() => null),
  } as any;
  const log = { info: jest.fn(), error: jest.fn(), debug: jest.fn(), warn: jest.fn() } as any;
  const serviceMocks: Record<string, unknown> = {};
  const plugins: Record<string, { services: Record<string, unknown> }> = {
    'ecommerce-base': {
      services: serviceMocks as Record<string, unknown>,
    } as { services: Record<string, unknown> },
  };

  const strapi = {
    db,
    eventHub,
    config,
    log,
    admin: {
      services: {
        permission: {
          createPermissionsManager: jest.fn(() => ({
            isAllowed: true,
            validateQuery: jest.fn(async () => {}),
            sanitizeQuery: jest.fn((q) => q),
            validateInput: jest.fn(async () => {}),
            sanitizeInput: jest.fn((input) => input),
            sanitizeOutput: jest.fn(async (output) => output),
            addPermissionsQueryTo: jest.fn((q) => q),
          })),
          actionProvider: { registerMany: jest.fn(async () => {}) },
          conditionProvider: { register: jest.fn(async () => {}) },
        },
      },
    },
    plugin(name: string) {
      return (plugins[name] ?? null) as any;
    },
    plugins,
    get(name: string) {
      if (name === 'webhookStore') {
        return { addAllowedEvent: jest.fn() };
      }
      return null;
    },
    service() {
      return {};
    },
    store() {
      return {
        get: jest.fn(async () => null),
        set: jest.fn(async () => {}),
      };
    },
    ...overrides,
  } as any;

  return { strapi, db, eventHub, log, serviceMocks, plugins };
}

/**
 * Attach service implementations to the strapi mock so that
 * `strapi.plugin('ecommerce-base').service(name)` resolves them (same surface
 * the real plugin container exposes).
 */
export function mountServices(
  ctx: ReturnType<typeof createStrapiMock>,
  services: Record<string, unknown>
) {
  Object.assign(ctx.serviceMocks, services);
}

export function seedRecords(db: any, uid: string, records: Record<string, unknown>[]) {
  (db.store ?? db)[uid] = records;
}
