import { query } from '../db/pool';

export interface PackageAttribute {
  id?: number;
  package_id?: number;
  attribute: string;
  op: string;
  value: string;
}

export interface PackageRow {
  id: number;
  name: string;
  download_speed_mbps: number;
  upload_speed_mbps: number;
  rate_limit: string;
  burst_download_mbps?: number | null;
  burst_upload_mbps?: number | null;
  burst_threshold_dl_mbps?: number | null;
  burst_threshold_ul_mbps?: number | null;
  burst_time_seconds?: number | null;
  radius_profile_id?: number | null;
  radius_profile_name?: string | null;
  validity_days: number;
  price: number;
  currency: string;
  description: string | null;
  is_active: boolean;
  subscribers_count: number;
  attributes: PackageAttribute[];
  created_at: Date;
  updated_at: Date;
}

export interface CreatePackageInput {
  name: string;
  download_speed_mbps: number;
  upload_speed_mbps: number;
  rate_limit?: string;
  burst_download_mbps?: number;
  burst_upload_mbps?: number;
  burst_threshold_dl_mbps?: number;
  burst_threshold_ul_mbps?: number;
  burst_time_seconds?: number;
  radius_profile_id?: number;
  validity_days?: number;
  price?: number;
  currency?: string;
  description?: string;
  attributes?: { attribute: string; op?: string; value: string }[];
}

export interface UpdatePackageInput {
  name?: string;
  download_speed_mbps?: number;
  upload_speed_mbps?: number;
  rate_limit?: string;
  burst_download_mbps?: number | null;
  burst_upload_mbps?: number | null;
  burst_threshold_dl_mbps?: number | null;
  burst_threshold_ul_mbps?: number | null;
  burst_time_seconds?: number | null;
  radius_profile_id?: number | null;
  validity_days?: number;
  price?: number;
  currency?: string;
  description?: string;
  is_active?: boolean;
  attributes?: { attribute: string; op?: string; value: string }[];
}

function calculateRateLimit(
  dl: number,
  ul: number,
  burstDl?: number | null,
  burstUl?: number | null,
  threshDl?: number | null,
  threshUl?: number | null,
  burstTime?: number | null,
): string {
  const base = `${dl}M/${ul}M`;
  if (burstDl && burstUl) {
    const burstStr = `${burstDl}M/${burstUl}M`;
    const threshStr = `${threshDl || Math.round(dl * 0.8)}M/${threshUl || Math.round(ul * 0.8)}M`;
    const timeStr = `${burstTime || 10}/${burstTime || 10}`;
    return `${base} ${burstStr} ${threshStr} ${timeStr}`;
  }
  return base;
}

export const packageRepository = {
  async list(): Promise<PackageRow[]> {
    const { rows } = await query<any>(
      `SELECT p.id, p.name, p.download_speed_mbps, p.upload_speed_mbps, p.rate_limit,
              p.burst_download_mbps, p.burst_upload_mbps, p.burst_threshold_dl_mbps,
              p.burst_threshold_ul_mbps, p.burst_time_seconds, p.radius_profile_id,
              rp.name AS radius_profile_name,
              p.validity_days, p.price, p.currency, p.description, p.is_active,
              p.created_at, p.updated_at,
              COALESCE(s.sub_count, 0)::integer AS subscribers_count,
              COALESCE(
                json_agg(
                  json_build_object('id', pa.id, 'attribute', pa.attribute, 'op', pa.op, 'value', pa.value)
                ) FILTER (WHERE pa.id IS NOT NULL), '[]'::json
              ) AS attributes
         FROM packages p
         LEFT JOIN radius_profiles rp ON rp.id = p.radius_profile_id
         LEFT JOIN (
           SELECT current_package_id, COUNT(*) AS sub_count
             FROM subscribers
            GROUP BY current_package_id
         ) s ON s.current_package_id = p.id
         LEFT JOIN package_attributes pa ON pa.package_id = p.id
        GROUP BY p.id, rp.name, s.sub_count
        ORDER BY p.download_speed_mbps DESC, p.name ASC`,
    );
    return rows;
  },

  async findById(id: number): Promise<PackageRow | null> {
    const { rows } = await query<any>(
      `SELECT p.id, p.name, p.download_speed_mbps, p.upload_speed_mbps, p.rate_limit,
              p.burst_download_mbps, p.burst_upload_mbps, p.burst_threshold_dl_mbps,
              p.burst_threshold_ul_mbps, p.burst_time_seconds, p.radius_profile_id,
              rp.name AS radius_profile_name,
              p.validity_days, p.price, p.currency, p.description, p.is_active,
              p.created_at, p.updated_at,
              COALESCE(s.sub_count, 0)::integer AS subscribers_count,
              COALESCE(
                json_agg(
                  json_build_object('id', pa.id, 'attribute', pa.attribute, 'op', pa.op, 'value', pa.value)
                ) FILTER (WHERE pa.id IS NOT NULL), '[]'::json
              ) AS attributes
         FROM packages p
         LEFT JOIN radius_profiles rp ON rp.id = p.radius_profile_id
         LEFT JOIN (
           SELECT current_package_id, COUNT(*) AS sub_count
             FROM subscribers
            GROUP BY current_package_id
         ) s ON s.current_package_id = p.id
         LEFT JOIN package_attributes pa ON pa.package_id = p.id
        WHERE p.id = $1
        GROUP BY p.id, rp.name, s.sub_count`,
      [id],
    );
    return rows[0] ?? null;
  },

  async findByName(name: string): Promise<PackageRow | null> {
    const { rows } = await query<any>(
      `SELECT p.id, p.name, p.download_speed_mbps, p.upload_speed_mbps, p.rate_limit,
              p.burst_download_mbps, p.burst_upload_mbps, p.burst_threshold_dl_mbps,
              p.burst_threshold_ul_mbps, p.burst_time_seconds, p.radius_profile_id,
              p.validity_days, p.price, p.currency, p.description, p.is_active,
              p.created_at, p.updated_at
         FROM packages p WHERE lower(p.name) = lower($1)`,
      [name],
    );
    return rows[0] ?? null;
  },

  async create(input: CreatePackageInput): Promise<PackageRow> {
    const rateLimit =
      input.rate_limit ||
      calculateRateLimit(
        input.download_speed_mbps,
        input.upload_speed_mbps,
        input.burst_download_mbps,
        input.burst_upload_mbps,
        input.burst_threshold_dl_mbps,
        input.burst_threshold_ul_mbps,
        input.burst_time_seconds,
      );

    // 1. Insert package
    const { rows } = await query<any>(
      `INSERT INTO packages (
         name, download_speed_mbps, upload_speed_mbps, rate_limit,
         burst_download_mbps, burst_upload_mbps, burst_threshold_dl_mbps,
         burst_threshold_ul_mbps, burst_time_seconds, radius_profile_id,
         validity_days, price, currency, description, is_active
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, TRUE)
       RETURNING id`,
      [
        input.name.trim(),
        input.download_speed_mbps,
        input.upload_speed_mbps,
        rateLimit,
        input.burst_download_mbps ?? null,
        input.burst_upload_mbps ?? null,
        input.burst_threshold_dl_mbps ?? null,
        input.burst_threshold_ul_mbps ?? null,
        input.burst_time_seconds ?? null,
        input.radius_profile_id ?? null,
        input.validity_days || 30,
        input.price || 0.0,
        input.currency || 'NPR',
        input.description || null,
      ],
    );
    const createdId = rows[0].id;

    // 2. Insert attributes
    const attrs = input.attributes ? [...input.attributes] : [];

    // If profile is chosen, copy attributes from profile
    if (input.radius_profile_id) {
      const { rows: profileAttrs } = await query<any>(
        `SELECT attribute_name, op, value FROM radius_attributes WHERE profile_id = $1`,
        [input.radius_profile_id],
      );
      for (const pa of profileAttrs) {
        if (!attrs.some((a) => a.attribute === pa.attribute_name)) {
          attrs.push({ attribute: pa.attribute_name, op: pa.op, value: pa.value });
        }
      }
    }

    if (!attrs.some((a) => a.attribute === 'Mikrotik-Rate-Limit')) {
      attrs.push({ attribute: 'Mikrotik-Rate-Limit', op: ':=', value: rateLimit });
    }
    if (!attrs.some((a) => a.attribute === 'Acct-Interim-Interval')) {
      attrs.push({ attribute: 'Acct-Interim-Interval', op: ':=', value: '300' });
    }

    for (const a of attrs) {
      await query(
        `INSERT INTO package_attributes (package_id, attribute, op, value)
         VALUES ($1, $2, $3, $4)`,
        [createdId, a.attribute, a.op || ':=', a.value],
      );
    }

    // 3. Synchronize into FreeRADIUS radgroupreply
    await this.syncToRadius(input.name.trim(), attrs);

    return (await this.findById(createdId))!;
  },

  async update(id: number, input: UpdatePackageInput): Promise<PackageRow | null> {
    const existing = await this.findById(id);
    if (!existing) return null;

    const name = input.name !== undefined ? input.name.trim() : existing.name;
    const dl = input.download_speed_mbps !== undefined ? input.download_speed_mbps : existing.download_speed_mbps;
    const ul = input.upload_speed_mbps !== undefined ? input.upload_speed_mbps : existing.upload_speed_mbps;
    const burstDl = input.burst_download_mbps !== undefined ? input.burst_download_mbps : existing.burst_download_mbps;
    const burstUl = input.burst_upload_mbps !== undefined ? input.burst_upload_mbps : existing.burst_upload_mbps;
    const threshDl = input.burst_threshold_dl_mbps !== undefined ? input.burst_threshold_dl_mbps : existing.burst_threshold_dl_mbps;
    const threshUl = input.burst_threshold_ul_mbps !== undefined ? input.burst_threshold_ul_mbps : existing.burst_threshold_ul_mbps;
    const burstTime = input.burst_time_seconds !== undefined ? input.burst_time_seconds : existing.burst_time_seconds;
    const profileId = input.radius_profile_id !== undefined ? input.radius_profile_id : existing.radius_profile_id;
    const rateLimit = input.rate_limit || calculateRateLimit(dl, ul, burstDl, burstUl, threshDl, threshUl, burstTime);
    const validity = input.validity_days !== undefined ? input.validity_days : existing.validity_days;
    const price = input.price !== undefined ? input.price : existing.price;
    const currency = input.currency !== undefined ? input.currency : existing.currency;
    const desc = input.description !== undefined ? input.description : existing.description;
    const isActive = input.is_active !== undefined ? input.is_active : existing.is_active;

    await query(
      `UPDATE packages
          SET name = $1, download_speed_mbps = $2, upload_speed_mbps = $3,
              rate_limit = $4, burst_download_mbps = $5, burst_upload_mbps = $6,
              burst_threshold_dl_mbps = $7, burst_threshold_ul_mbps = $8,
              burst_time_seconds = $9, radius_profile_id = $10,
              validity_days = $11, price = $12, currency = $13,
              description = $14, is_active = $15, updated_at = NOW()
        WHERE id = $16`,
      [
        name,
        dl,
        ul,
        rateLimit,
        burstDl,
        burstUl,
        threshDl,
        threshUl,
        burstTime,
        profileId,
        validity,
        price,
        currency,
        desc,
        isActive,
        id,
      ],
    );

    if (input.attributes) {
      await query('DELETE FROM package_attributes WHERE package_id = $1', [id]);
      for (const a of input.attributes) {
        await query(
          `INSERT INTO package_attributes (package_id, attribute, op, value)
           VALUES ($1, $2, $3, $4)`,
          [id, a.attribute, a.op || ':=', a.value],
        );
      }
    } else {
      await query(
        `UPDATE package_attributes SET value = $1
          WHERE package_id = $2 AND attribute = 'Mikrotik-Rate-Limit'`,
        [rateLimit, id],
      );
    }

    if (existing.name !== name) {
      await query('UPDATE radusergroup SET groupname = $1 WHERE groupname = $2', [name, existing.name]);
      await query('DELETE FROM radgroupreply WHERE groupname = $1', [existing.name]);
    }

    const updated = await this.findById(id);
    if (updated) {
      await this.syncToRadius(name, updated.attributes);
    }

    return updated;
  },

  async delete(id: number): Promise<boolean> {
    const existing = await this.findById(id);
    if (!existing) return false;

    await query('DELETE FROM radgroupreply WHERE groupname = $1', [existing.name]);
    await query('DELETE FROM radgroupcheck WHERE groupname = $1', [existing.name]);
    await query('DELETE FROM radusergroup WHERE groupname = $1', [existing.name]);

    const { rowCount } = await query('DELETE FROM packages WHERE id = $1', [id]);
    return (rowCount ?? 0) > 0;
  },

  async syncToRadius(groupName: string, attributes: { attribute: string; op?: string; value: string }[]) {
    await query('DELETE FROM radgroupreply WHERE groupname = $1', [groupName]);

    for (const attr of attributes) {
      await query(
        `INSERT INTO radgroupreply (groupname, attribute, op, value)
         VALUES ($1, $2, $3, $4)`,
        [groupName, attr.attribute, attr.op || ':=', attr.value],
      );
    }
  },
};
