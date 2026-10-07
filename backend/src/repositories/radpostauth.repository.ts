import { query } from '../db/pool';

export interface PostAuthRow {
  id: string;
  username: string;
  reply: string | null;
  authdate: Date;
  calledstationid: string | null;
  callingstationid: string | null;
}

export interface PostAuthSeriesRow {
  bucket: Date;
  accepted: number;
  rejected: number;
}

/**
 * Read access to FreeRADIUS `radpostauth` (authentication log).
 * FreeRADIUS writes this table; the panel only reads it.
 */
export const radPostAuthRepository = {
  async recent(limit: number): Promise<PostAuthRow[]> {
    const { rows } = await query<PostAuthRow>(
      `SELECT id::text, username, reply, authdate, calledstationid, callingstationid
         FROM radpostauth
        ORDER BY authdate DESC
        LIMIT $1`,
      [limit],
    );
    return rows;
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

  /** Accept / reject counts per time bucket (bucketSeconds wide) since `since`. */
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
