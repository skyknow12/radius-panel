import { query } from '../db/pool';

export interface NetworkEventRecord {
  id: number;
  event_type: string;
  severity: 'info' | 'warning' | 'critical';
  actor: string;
  target: string | null;
  description: string;
  metadata: any;
  created_at: Date;
}

export const networkEventRepository = {
  async list(options: { severity?: string; limit?: number; offset?: number } = {}): Promise<{ items: NetworkEventRecord[]; total: number }> {
    const { severity, limit = 50, offset = 0 } = options;
    const conditions: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (severity) {
      conditions.push(`severity = $${idx++}`);
      values.push(severity);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const countRes = await query<{ count: string }>(`SELECT count(*) as count FROM network_events ${whereClause}`, values);
    const total = parseInt(countRes.rows[0]?.count || '0', 10);

    const listSql = `
      SELECT id, event_type, severity, actor, target, description, metadata, created_at
        FROM network_events
       ${whereClause}
       ORDER BY created_at DESC
       LIMIT $${idx++} OFFSET $${idx++}
    `;
    values.push(limit, offset);

    const { rows } = await query<NetworkEventRecord>(listSql, values);
    return { items: rows, total };
  },

  async insert(data: {
    event_type: string;
    severity?: 'info' | 'warning' | 'critical';
    actor?: string;
    target?: string;
    description: string;
    metadata?: any;
  }): Promise<NetworkEventRecord> {
    const { event_type, severity = 'info', actor = 'system', target, description, metadata } = data;
    const { rows } = await query<NetworkEventRecord>(
      `INSERT INTO network_events (event_type, severity, actor, target, description, metadata)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, event_type, severity, actor, target, description, metadata, created_at`,
      [event_type, severity, actor, target || null, description, metadata ? JSON.stringify(metadata) : null],
    );
    return rows[0];
  },
};
