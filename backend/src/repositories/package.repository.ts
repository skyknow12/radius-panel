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
  validity_days?: number;
  price?: number;
  currency?: string;
  description?: string;
  is_active?: boolean;
  attributes?: { attribute: string; op?: string; value: string }[];
}

export const packageRepository = {
  async list(): Promise<PackageRow[]> {
    const { rows } = await query<any>(
      `SELECT p.id, p.name, p.download_speed_mbps, p.upload_speed_mbps, p.rate_limit,
              p.validity_days, p.price, p.currency, p.description, p.is_active,
              p.created_at, p.updated_at,
              COALESCE(s.sub_count, 0)::integer AS subscribers_count,
              COALESCE(
                json_agg(
                  json_build_object('id', pa.id, 'attribute', pa.attribute, 'op', pa.op, 'value', pa.value)
                ) FILTER (WHERE pa.id IS NOT NULL), '[]'::json
              ) AS attributes
         FROM packages p
         LEFT JOIN (
           SELECT current_package_id, COUNT(*) AS sub_count
             FROM subscribers
            GROUP BY current_package_id
         ) s ON s.current_package_id = p.id
         LEFT JOIN package_attributes pa ON pa.package_id = p.id
        GROUP BY p.id, s.sub_count
        ORDER BY p.download_speed_mbps DESC, p.name ASC`,
    );
    return rows;
  },

  async findById(id: number): Promise<PackageRow | null> {
    const { rows } = await query<any>(
      `SELECT p.id, p.name, p.download_speed_mbps, p.upload_speed_mbps, p.rate_limit,
              p.validity_days, p.price, p.currency, p.description, p.is_active,
              p.created_at, p.updated_at,
              COALESCE(s.sub_count, 0)::integer AS subscribers_count,
              COALESCE(
                json_agg(
                  json_build_object('id', pa.id, 'attribute', pa.attribute, 'op', pa.op, 'value', pa.value)
                ) FILTER (WHERE pa.id IS NOT NULL), '[]'::json
              ) AS attributes
         FROM packages p
         LEFT JOIN (
           SELECT current_package_id, COUNT(*) AS sub_count
             FROM subscribers
            GROUP BY current_package_id
         ) s ON s.current_package_id = p.id
         LEFT JOIN package_attributes pa ON pa.package_id = p.id
        WHERE p.id = $1
        GROUP BY p.id, s.sub_count`,
      [id],
    );
    return rows[0] ?? null;
  },

  async findByName(name: string): Promise<PackageRow | null> {
    const { rows } = await query<any>(
      `SELECT p.id, p.name, p.download_speed_mbps, p.upload_speed_mbps, p.rate_limit,
              p.validity_days, p.price, p.currency, p.description, p.is_active,
              p.created_at, p.updated_at
         FROM packages p WHERE lower(p.name) = lower($1)`,
      [name],
    );
    return rows[0] ?? null;
  },

  async create(input: CreatePackageInput): Promise<PackageRow> {
    const rateLimit = input.rate_limit || `${input.download_speed_mbps}M/${input.upload_speed_mbps}M`;

    // 1. Insert package
    const { rows } = await query<any>(
      `INSERT INTO packages (
         name, download_speed_mbps, upload_speed_mbps, rate_limit, validity_days,
         price, currency, description, is_active
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, TRUE)
       RETURNING id, name, download_speed_mbps, upload_speed_mbps, rate_limit,
                 validity_days, price, currency, description, is_active, created_at, updated_at`,
      [
        input.name,
        input.download_speed_mbps,
        input.upload_speed_mbps,
        rateLimit,
        input.validity_days || 30,
        input.price || 0.0,
        input.currency || 'NPR',
        input.description || null,
      ],
    );
    const created = rows[0];

    // 2. Insert attributes
    const attrs = input.attributes || [];
    // Ensure default MikroTik-Rate-Limit and Acct-Interim-Interval exist
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
        [created.id, a.attribute, a.op || ':=', a.value],
      );
    }

    // 3. Synchronize into FreeRADIUS radgroupreply
    await this.syncToRadius(created.name, attrs);

    return (await this.findById(created.id))!;
  },

  async update(id: number, input: UpdatePackageInput): Promise<PackageRow | null> {
    const existing = await this.findById(id);
    if (!existing) return null;

    const name = input.name ?? existing.name;
    const dl = input.download_speed_mbps ?? existing.download_speed_mbps;
    const ul = input.upload_speed_mbps ?? existing.upload_speed_mbps;
    const rateLimit = input.rate_limit ?? `${dl}M/${ul}M`;
    const validity = input.validity_days ?? existing.validity_days;
    const price = input.price ?? existing.price;
    const currency = input.currency ?? existing.currency;
    const desc = input.description ?? existing.description;
    const isActive = input.is_active ?? existing.is_active;

    await query(
      `UPDATE packages
          SET name = $1, download_speed_mbps = $2, upload_speed_mbps = $3,
              rate_limit = $4, validity_days = $5, price = $6, currency = $7,
              description = $8, is_active = $9, updated_at = NOW()
        WHERE id = $10`,
      [name, dl, ul, rateLimit, validity, price, currency, desc, isActive, id],
    );

    // If attributes provided, replace them
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
      // Update MikroTik-Rate-Limit value if rateLimit changed
      await query(
        `UPDATE package_attributes SET value = $1
          WHERE package_id = $2 AND attribute = 'Mikrotik-Rate-Limit'`,
        [rateLimit, id],
      );
    }

    // If package was renamed, update radusergroup references
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

    // Remove group reply attributes in FreeRADIUS
    await query('DELETE FROM radgroupreply WHERE groupname = $1', [existing.name]);
    await query('DELETE FROM radgroupcheck WHERE groupname = $1', [existing.name]);
    await query('DELETE FROM radusergroup WHERE groupname = $1', [existing.name]);

    const { rowCount } = await query('DELETE FROM packages WHERE id = $1', [id]);
    return (rowCount ?? 0) > 0;
  },

  async syncToRadius(groupName: string, attributes: { attribute: string; op?: string; value: string }[]) {
    // Clear and re-populate radgroupreply for this group
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
