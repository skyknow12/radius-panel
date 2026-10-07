import { query } from '../db/pool';

export interface PostAuthRow {
  id: string;
  username: string;
  reply: string | null;
  authdate: Date;
  calledstationid: string | null;
  callingstationid: string | null;
  nas_name?: string | null;
  nas_ip?: string | null;
  reason?: string;
}

export interface PostAuthListQuery {
  page?: number;
  limit?: number;
  search?: string;
  reply?: string;
  username?: string;
}

export interface PostAuthSeriesRow {
  bucket: Date;
  accepted: number;
  rejected: number;
}

export const radPostAuthRepository = {
  async listLogs(params: PostAuthListQuery) {
    const page = Math.max(1, params.page || 1);
    const limit = Math.min(100, Math.max(1, params.limit || 25));
    const offset = (page - 1) * limit;

    const conditions: string[] = ['1=1'];
    const values: any[] = [];
    let idx = 1;

    if (params.search) {
      conditions.push(`(
        p.username ILIKE $${idx} OR
        p.calledstationid ILIKE $${idx} OR
        p.callingstationid ILIKE $${idx}
      )`);
      values.push(`%${params.search}%`);
      idx++;
    }

    if (params.reply && params.reply !== 'all') {
      conditions.push(`p.reply = $${idx}`);
      values.push(params.reply);
      idx++;
    }

    if (params.username) {
      conditions.push(`lower(p.username) = lower($${idx})`);
      values.push(params.username);
      idx++;
    }

    const whereClause = conditions.join(' AND ');

    const countSql = `SELECT COUNT(*) AS total FROM radpostauth p WHERE ${whereClause}`;
    const countRes = await query<{ total: string }>(countSql, values);
    const total = Number(countRes.rows[0]?.total || 0);

    const dataSql = `
      SELECT p.id::text,
             p.username,
             p.reply,
             p.authdate,
             p.calledstationid,
             p.callingstationid,
             COALESCE(nd.name, p.calledstationid) AS nas_name,
             host(nd.ip_address) AS nas_ip,
             CASE
               WHEN p.reply = 'Access-Accept' THEN 'Successful authentication'
               WHEN p.reply = 'Access-Reject' THEN 'Invalid password or user suspended/expired'
               ELSE p.reply
             END AS reason
        FROM radpostauth p
        LEFT JOIN nas_devices nd ON (nd.name = p.calledstationid OR host(nd.ip_address) = p.calledstationid)
       WHERE ${whereClause}
       ORDER BY p.authdate DESC
       LIMIT $${idx} OFFSET $${idx + 1}
    `;
    values.push(limit, offset);

    const { rows } = await query<PostAuthRow>(dataSql, values);

    return {
      data: rows,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  },

  async recent(limit: number): Promise<PostAuthRow[]> {
    const res = await this.listLogs({ page: 1, limit });
    return res.data;
  },

  async userAuthHistory(username: string, limit = 10): Promise<PostAuthRow[]> {
    const res = await this.listLogs({ username, limit, page: 1 });
    return res.data;
  },

  async hasRowsSince(since: Date): Promise<boolean> {
    const { rows } = await query<{ exists: boolean }>(
      'SELECT EXISTS (SELECT 1 FROM radpostauth WHERE authdate >= $1) AS exists',
      [since],
    );
    return rows[0]?.exists ?? false;
  },

  async hasAnyRows(): Promise<boolean> {
    const { rows } = await query<{ exists: boolean }>('SELECT EXISTS (SELECT 1 FROM radpostauth) AS exists');
    return rows[0]?.exists ?? false;
  },

  async countsSince(since: Date, until: Date = new Date()): Promise<{ accepted: number; rejected: number }> {
    const { rows } = await query<{ accepted: string; rejected: string }>(
      `SELECT COUNT(*) FILTER (WHERE reply = 'Access-Accept') AS accepted,
              COUNT(*) FILTER (WHERE reply = 'Access-Reject') AS rejected
         FROM radpostauth
        WHERE authdate >= $1 AND authdate < $2`,
      [since, until],
    );
    return { accepted: Number(rows[0]?.accepted ?? 0), rejected: Number(rows[0]?.rejected ?? 0) };
  },

  async series(since: Date, bucketSeconds: number): Promise<PostAuthSeriesRow[]> {
    const { rows } = await query<{ bucket: Date; accepted: string; rejected: string }>(
      `WITH buckets AS (
         SELECT generate_series(
                  to_timestamp(floor(extract(epoch FROM $1::timestamptz) / $2) * $2),
                  now(),
                  make_interval(secs => $2)
                ) AS bucket
       )
       SELECT b.bucket,
              COUNT(p.id) FILTER (WHERE p.reply = 'Access-Accept') AS accepted,
              COUNT(p.id) FILTER (WHERE p.reply = 'Access-Reject') AS rejected
         FROM buckets b
         LEFT JOIN radpostauth p
           ON p.authdate >= b.bucket AND p.authdate < b.bucket + make_interval(secs => $2)
        GROUP BY b.bucket
        ORDER BY b.bucket`,
      [since, bucketSeconds],
    );
    return rows.map((r) => ({ bucket: r.bucket, accepted: Number(r.accepted), rejected: Number(r.rejected) }));
  },
};
