import { query } from '../db/pool';

export interface AuditEntry {
  userId?: string | null;
  username?: string | null;
  action: string;
  entityType?: string | null;
  entityId?: string | null;
  status?: 'success' | 'failure';
  ipAddress?: string | null;
  userAgent?: string | null;
  metadata?: Record<string, unknown>;
}

export const auditRepository = {
  async insert(entry: AuditEntry): Promise<void> {
    await query(
      `INSERT INTO audit_logs (user_id, username, action, entity_type, entity_id, status, ip_address, user_agent, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        entry.userId ?? null,
        entry.username ?? null,
        entry.action,
        entry.entityType ?? null,
        entry.entityId ?? null,
        entry.status ?? 'success',
        entry.ipAddress ?? null,
        entry.userAgent ?? null,
        JSON.stringify(entry.metadata ?? {}),
      ],
    );
  },

  async recent(limit = 50): Promise<any[]> {
    const { rows } = await query(
      `SELECT id, user_id, username, action, entity_type, entity_id, status,
              host(ip_address) AS ip_address, user_agent, metadata, created_at
         FROM audit_logs
        ORDER BY created_at DESC
        LIMIT $1`,
      [limit],
    );
    return rows;
  },
};
