/**
 * In-memory audit log for the e-commerce base plugin. Every state-changing
 * admin operation (order transitions, inventory adjustments, role syncs) is
 * appended here and exposed through the admin UI / REST API.
 *
 * Entries are kept in memory and pruned to the last `MAX_ENTRIES` to bound
 * memory usage. For durable auditing, forward the audit.created event to an
 * external system via the webhook layer.
 */

export interface AuditEntry {
  id: number;
  timestamp: string;
  actor?: string;
  action: string;
  resourceType: string;
  resourceId?: string | number;
  detail?: Record<string, unknown>;
}

const MAX_ENTRIES = 1000;

/**
 * Audit entry content type UID. When the database contains the
 * `audit-entry` model (created on bootstrap through the content-type
 * registry), entries are persisted there; otherwise the in-memory store
 * above is used as a graceful fallback (e.g. in unit tests).
 */
const AUDIT_ENTRY_MODEL_UID = 'plugin::ecommerce-base.audit-entry';

export default ({ strapi }: { strapi: any }) => {
  let entries: AuditEntry[] = [];
  let nextId = 1;

  function log(entry: Omit<AuditEntry, 'id' | 'timestamp'>) {
    const auditEnabled = strapi.config?.get?.('plugin::ecommerce-base.audit.enabled');
    if (auditEnabled === false) {
      return { id: 0, timestamp: new Date().toISOString(), ...entry };
    }

    const record: AuditEntry = {
      ...entry,
      id: nextId++,
      timestamp: new Date().toISOString(),
    };
    entries.push(record);
    if (entries.length > MAX_ENTRIES) {
      entries = entries.slice(entries.length - MAX_ENTRIES);
    }
    strapi.eventHub?.emit?.('ecommerce.audit.created', { entry: record });
    return record;
  }

  const hasAuditModel = (): boolean => Boolean(strapi.db?.query?.(AUDIT_ENTRY_MODEL_UID));

  /**
   * Persist an audit entry, preferring the database model when available
   * and falling back to the in-memory store.
   */
  async function persist(entry: Omit<AuditEntry, 'id' | 'timestamp'>): Promise<AuditEntry> {
    if (hasAuditModel()) {
      const dbRecord = await strapi.db.query(AUDIT_ENTRY_MODEL_UID).create({ data: entry });
      return {
        ...entry,
        id: dbRecord.id,
        timestamp: dbRecord.timestamp ?? new Date().toISOString(),
      };
    }
    const record = log(entry);
    if (!record) {
      return { id: 0, timestamp: new Date().toISOString(), ...entry };
    }
    return record;
  }

  return {
    log,

    /**
     * Controller-friendly alias used across the admin controllers to
     * record state-changing actions.
     */
    logAction(entry: Omit<AuditEntry, 'id' | 'timestamp'>) {
      return persist(entry);
    },

    async findPage({ page = 1, pageSize = 25 }: { page?: number; pageSize?: number } = {}) {
      if (hasAuditModel()) {
        const dbQuery = strapi.db.query(AUDIT_ENTRY_MODEL_UID);
        return dbQuery.findPage({ offset: (page - 1) * pageSize, limit: pageSize });
      }
      const start = (page - 1) * pageSize;
      const results = [...entries].reverse().slice(start, start + pageSize);
      return {
        results,
        pagination: {
          page,
          pageSize,
          pageCount: Math.max(1, Math.ceil(entries.length / pageSize)),
          total: entries.length,
        },
      };
    },

    async clear() {
      if (hasAuditModel()) {
        await strapi.db.query(AUDIT_ENTRY_MODEL_UID).deleteMany({});
      }
      entries = [];
      nextId = 1;
    },

    async count() {
      if (hasAuditModel()) {
        return strapi.db.query(AUDIT_ENTRY_MODEL_UID).count();
      }
      return entries.length;
    },
  };
};
