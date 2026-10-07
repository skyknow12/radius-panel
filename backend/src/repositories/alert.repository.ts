import { query } from '../db/pool';

export interface AlertRecord {
  id: number;
  severity: 'info' | 'warning' | 'critical';
  title: string;
  description: string;
  source: string;
  status: 'active' | 'acknowledged' | 'resolved';
  metadata: any;
  created_at: Date;
  resolved_at: Date | null;
  resolved_by: string | null;
}

export const alertRepository = {
  async list(options: { status?: string; severity?: string; limit?: number; offset?: number } = {}): Promise<{ items: AlertRecord[]; total: number }> {
    const { status, severity, limit = 50, offset = 0 } = options;
    const conditions: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (status) {
      conditions.push(`status = $${idx++}`);
      values.push(status);
    }
    if (severity) {
      conditions.push(`severity = $${idx++}`);
      values.push(severity);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const countRes = await query<{ count: string }>(`SELECT count(*) as count FROM alerts ${whereClause}`, values);
    const total = parseInt(countRes.rows[0]?.count || '0', 10);

    const listSql = `
      SELECT id, severity, title, description, source, status, metadata,
             created_at, resolved_at, resolved_by
        FROM alerts
       ${whereClause}
       ORDER BY CASE status WHEN 'active' THEN 1 WHEN 'acknowledged' THEN 2 ELSE 3 END,
                created_at DESC
       LIMIT $${idx++} OFFSET $${idx++}
    `;
    values.push(limit, offset);

    const { rows } = await query<AlertRecord>(listSql, values);
    return { items: rows, total };
  },

  async create(data: {
    severity: 'info' | 'warning' | 'critical';
    title: string;
    description: string;
    source?: string;
    metadata?: any;
  }): Promise<AlertRecord> {
    const { severity, title, description, source = 'system', metadata } = data;
    const { rows } = await query<AlertRecord>(
      `INSERT INTO alerts (severity, title, description, source, status, metadata)
       VALUES ($1, $2, $3, $4, 'active', $5)
       RETURNING id, severity, title, description, source, status, metadata, created_at, resolved_at, resolved_by`,
      [severity, title, description, source, metadata ? JSON.stringify(metadata) : null],
    );
    return rows[0];
  },

  async updateStatus(id: number, status: 'acknowledged' | 'resolved', username: string): Promise<AlertRecord | null> {
    const resolvedAt = status === 'resolved' ? 'NOW()' : 'NULL';
    const resolvedBy = status === 'resolved' ? '$2' : 'NULL';

    const { rows } = await query<AlertRecord>(
      `UPDATE alerts
          SET status = $1,
              resolved_at = ${resolvedAt},
              resolved_by = ${resolvedBy}
        WHERE id = $3
        RETURNING id, severity, title, description, source, status, metadata, created_at, resolved_at, resolved_by`,
      [status, username, id],
    );
    return rows[0] || null;
  },
};
