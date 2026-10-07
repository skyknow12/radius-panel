import { query } from '../db/pool';

export interface ActiveSessionRow {
  radacctid: string;
  username: string | null;
  framedipaddress: string | null;
  nasipaddress: string;
  nas_name: string | null;
  acctstarttime: Date | null;
  session_seconds: string;
  acctinputoctets: string | null;
  acctoutputoctets: string | null;
  callingstationid: string | null;
}

/**
 * Read access to FreeRADIUS `radacct` (accounting sessions).
 * A session is "online" while AcctStopTime IS NULL.
 */
export const radAcctRepository = {
  async hasAnyRows(): Promise<boolean> {
    const { rows } = await query<{ exists: boolean }>('SELECT EXISTS (SELECT 1 FROM radacct) AS exists');
    return rows[0]?.exists ?? false;
  },

  async countActive(): Promise<number> {
    const { rows } = await query<{ count: string }>('SELECT COUNT(*) FROM radacct WHERE acctstoptime IS NULL');
    return Number(rows[0]?.count ?? 0);
  },

  async activeSessions(limit: number, offset = 0): Promise<ActiveSessionRow[]> {
    const { rows } = await query<ActiveSessionRow>(
      `SELECT r.radacctid::text,
              r.username,
              host(r.framedipaddress) AS framedipaddress,
              host(r.nasipaddress)    AS nasipaddress,
              nd.name                 AS nas_name,
              r.acctstarttime,
              GREATEST(0, EXTRACT(EPOCH FROM (now() - r.acctstarttime)))::bigint AS session_seconds,
              r.acctinputoctets,
              r.acctoutputoctets,
              r.callingstationid
         FROM radacct r
         LEFT JOIN nas_devices nd ON nd.ip_address = r.nasipaddress
        WHERE r.acctstoptime IS NULL
        ORDER BY r.acctstarttime DESC NULLS LAST
        LIMIT $1 OFFSET $2`,
      [limit, offset],
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
