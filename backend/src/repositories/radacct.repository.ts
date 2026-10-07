import { query } from '../db/pool';
import { RadiusClient, RadiusCode } from '../radius/radius-client';
import { nasRepository } from './nas.repository';
import { logger } from '../lib/logger';

export interface ActiveSessionRow {
  radacctid: string;
  acctsessionid: string;
  username: string;
  customer_name: string | null;
  customer_id: string | null;
  framedipaddress: string | null;
  nasipaddress: string;
  nas_name: string | null;
  nas_type: string | null;
  acctstarttime: Date | null;
  session_seconds: number;
  acctinputoctets: number;
  acctoutputoctets: number;
  callingstationid: string | null;
  status: 'online' | 'stopped';
}

export interface SessionListQuery {
  page?: number;
  limit?: number;
  search?: string;
  nas_ip?: string;
  username?: string;
}

export const radAcctRepository = {
  async hasAnyRows(): Promise<boolean> {
    const { rows } = await query<{ exists: boolean }>('SELECT EXISTS (SELECT 1 FROM radacct) AS exists');
    return rows[0]?.exists ?? false;
  },

  async countActive(): Promise<number> {
    const { rows } = await query<{ count: string }>('SELECT COUNT(*) FROM radacct WHERE acctstoptime IS NULL');
    return Number(rows[0]?.count ?? 0);
  },

  async listActiveSessions(params: SessionListQuery) {
    const page = Math.max(1, params.page || 1);
    const limit = Math.min(100, Math.max(1, params.limit || 20));
    const offset = (page - 1) * limit;

    const conditions: string[] = ['r.acctstoptime IS NULL'];
    const values: any[] = [];
    let idx = 1;

    if (params.search) {
      conditions.push(`(
        r.username ILIKE $${idx} OR
        host(r.framedipaddress) ILIKE $${idx} OR
        r.acctsessionid ILIKE $${idx} OR
        s.full_name ILIKE $${idx} OR
        s.customer_id ILIKE $${idx}
      )`);
      values.push(`%${params.search}%`);
      idx++;
    }

    if (params.nas_ip) {
      conditions.push(`r.nasipaddress = $${idx}::inet`);
      values.push(params.nas_ip);
      idx++;
    }

    if (params.username) {
      conditions.push(`lower(r.username) = lower($${idx})`);
      values.push(params.username);
      idx++;
    }

    const whereClause = conditions.join(' AND ');

    // Total count
    const countSql = `
      SELECT COUNT(*) AS total
        FROM radacct r
        LEFT JOIN subscribers s ON lower(s.username) = lower(r.username)
       WHERE ${whereClause}
    `;
    const countRes = await query<{ total: string }>(countSql, values);
    const total = Number(countRes.rows[0]?.total || 0);

    // Sessions data
    const dataSql = `
      SELECT r.radacctid::text,
             r.acctsessionid,
             r.username,
             s.full_name AS customer_name,
             s.customer_id,
             host(r.framedipaddress) AS framedipaddress,
             host(r.nasipaddress) AS nasipaddress,
             COALESCE(nd.name, host(r.nasipaddress)) AS nas_name,
             nd.nas_type,
             r.acctstarttime,
             GREATEST(0, EXTRACT(EPOCH FROM (NOW() - r.acctstarttime)))::bigint AS session_seconds,
             COALESCE(r.acctinputoctets, 0)::bigint AS acctinputoctets,
             COALESCE(r.acctoutputoctets, 0)::bigint AS acctoutputoctets,
             r.callingstationid,
             'online' AS status
        FROM radacct r
        LEFT JOIN subscribers s ON lower(s.username) = lower(r.username)
        LEFT JOIN nas_devices nd ON nd.ip_address = r.nasipaddress
       WHERE ${whereClause}
       ORDER BY r.acctstarttime DESC NULLS LAST
       LIMIT $${idx} OFFSET $${idx + 1}
    `;
    values.push(limit, offset);

    const { rows } = await query<ActiveSessionRow>(dataSql, values);

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

  async activeSessions(limit: number, offset = 0): Promise<ActiveSessionRow[]> {
    const res = await this.listActiveSessions({ page: Math.floor(offset / limit) + 1, limit });
    return res.data;
  },

  async getSessionById(id: string): Promise<ActiveSessionRow | null> {
    const { rows } = await query<ActiveSessionRow>(
      `SELECT r.radacctid::text,
              r.acctsessionid,
              r.username,
              s.full_name AS customer_name,
              s.customer_id,
              host(r.framedipaddress) AS framedipaddress,
              host(r.nasipaddress) AS nasipaddress,
              COALESCE(nd.name, host(r.nasipaddress)) AS nas_name,
              nd.nas_type,
              r.acctstarttime,
              GREATEST(0, EXTRACT(EPOCH FROM (NOW() - r.acctstarttime)))::bigint AS session_seconds,
              COALESCE(r.acctinputoctets, 0)::bigint AS acctinputoctets,
              COALESCE(r.acctoutputoctets, 0)::bigint AS acctoutputoctets,
              r.callingstationid,
              CASE WHEN r.acctstoptime IS NULL THEN 'online' ELSE 'stopped' END AS status
         FROM radacct r
         LEFT JOIN subscribers s ON lower(s.username) = lower(r.username)
         LEFT JOIN nas_devices nd ON nd.ip_address = r.nasipaddress
        WHERE r.radacctid = $1::bigint OR r.acctsessionid = $1`,
      [id],
    );
    return rows[0] ?? null;
  },

  async disconnect(identifier: string): Promise<{ success: boolean; message: string; method: string }> {
    // 1. Find session in radacct
    const session = await this.getSessionById(identifier);
    if (!session) {
      throw new Error(`Session ${identifier} not found in accounting table`);
    }

    // 2. Lookup NAS secret & CoA port
    const nas = await nasRepository.findByIp(session.nasipaddress);
    const nasSecret = (nas as any)?.secret || 'testing123';
    const coaPort = nas?.coa_port || 3799;

    let coaSuccess = false;
    let coaMessage = '';

    // 3. Send RFC 3576 Disconnect-Request (PoD)
    try {
      const client = new RadiusClient({
        host: session.nasipaddress,
        secret: nasSecret,
        timeoutMs: 2500,
        retries: 1,
      });

      const resp = await client.disconnectRequest(
        coaPort,
        session.username,
        session.acctsessionid,
        session.framedipaddress || undefined,
      );

      coaSuccess = resp.code === RadiusCode.DisconnectAck;
      coaMessage = resp.code === RadiusCode.DisconnectAck
        ? 'NAS Disconnect-ACK received'
        : `NAS returned ${resp.codeName}`;
    } catch (err: any) {
      logger.warn({ err, nasIp: session.nasipaddress }, 'CoA Disconnect-Request timed out or rejected');
      coaMessage = `CoA probe unconfirmed: ${err.message}`;
    }

    // 4. Update radacct table to close or mark session disconnected
    await query(
      `UPDATE radacct
          SET acctstoptime = NOW(),
              acctsessiontime = GREATEST(0, EXTRACT(EPOCH FROM (NOW() - acctstarttime)))::bigint,
              acctterminatecause = 'Admin-Reset'
        WHERE (radacctid = $1::bigint OR acctsessionid = $1)
          AND acctstoptime IS NULL`,
      [session.radacctid],
    );

    return {
      success: true,
      message: coaSuccess
        ? `Subscriber ${session.username} successfully disconnected from ${session.nas_name || session.nasipaddress}`
        : `Subscriber session closed in database (${coaMessage})`,
      method: coaSuccess ? 'RADIUS CoA/Disconnect' : 'Database Session Reset',
    };
  },

  async userSessionHistory(username: string, limit = 10): Promise<any[]> {
    const { rows } = await query(
      `SELECT r.radacctid::text,
              r.acctsessionid,
              host(r.framedipaddress) AS framed_ip,
              host(r.nasipaddress) AS nas_ip,
              nd.name AS nas_name,
              r.acctstarttime,
              r.acctstoptime,
              r.acctsessiontime,
              r.acctinputoctets,
              r.acctoutputoctets,
              r.acctterminatecause,
              r.callingstationid
         FROM radacct r
         LEFT JOIN nas_devices nd ON nd.ip_address = r.nasipaddress
        WHERE lower(r.username) = lower($1)
        ORDER BY r.acctstarttime DESC NULLS LAST
        LIMIT $2`,
      [username, limit],
    );
    return rows;
  },

  /** Online-session count at the end of each bucket (for the network overview chart). */
  async onlineSeries(since: Date, bucketSeconds: number): Promise<{ bucket: Date; online: number }[]> {
    const { rows } = await query<{ bucket: Date; online: string }>(
      `WITH buckets AS (
         SELECT generate_series(
                  to_timestamp(floor(extract(epoch FROM $1::timestamptz) / $2) * $2),
                  now(),
                  make_interval(secs => $2)
                ) AS bucket
       )
       SELECT b.bucket,
              (SELECT COUNT(*) FROM radacct r
                WHERE r.acctstarttime <= b.bucket + make_interval(secs => $2)
                  AND (r.acctstoptime IS NULL OR r.acctstoptime >= b.bucket + make_interval(secs => $2))
              ) AS online
         FROM buckets b
        ORDER BY b.bucket`,
      [since, bucketSeconds],
    );
    return rows.map((r) => ({ bucket: r.bucket, online: Number(r.online) }));
  },
};
