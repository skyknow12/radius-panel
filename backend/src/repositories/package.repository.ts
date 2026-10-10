import { query } from '../db/pool';

export interface PackageAttribute {
  id?: number;
  package_id?: number;
  attribute: string;
  op: string;
  value: string;
  vendor?: string;
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
  juniper_ingress_policy?: string | null;
  juniper_egress_policy?: string | null;
  juniper_activate_service?: string | null;
  juniper_cos_shaping_rate?: string | null;
  juniper_dynamic_profile?: string | null;
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
  juniper_ingress_policy?: string;
  juniper_egress_policy?: string;
  juniper_activate_service?: string;
  juniper_cos_shaping_rate?: string;
  juniper_dynamic_profile?: string;
  validity_days?: number;
  price?: number;
  currency?: string;
  description?: string;
  attributes?: { attribute: string; op?: string; value: string; vendor?: string }[];
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
  juniper_ingress_policy?: string | null;
  juniper_egress_policy?: string | null;
  juniper_activate_service?: string | null;
  juniper_cos_shaping_rate?: string | null;
  juniper_dynamic_profile?: string | null;
  validity_days?: number;
  price?: number;
  currency?: string;
  description?: string;
  is_active?: boolean;
  attributes?: { attribute: string; op?: string; value: string; vendor?: string }[];
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
              p.juniper_ingress_policy, p.juniper_egress_policy, p.juniper_activate_service,
              p.juniper_cos_shaping_rate, p.juniper_dynamic_profile,
              p.validity_days, p.price, p.currency, p.description, p.is_active,
              p.created_at, p.updated_at,
              COALESCE(s.sub_count, 0)::integer AS subscribers_count,
              COALESCE(
                json_agg(
                  json_build_object('id', pa.id, 'attribute', pa.attribute, 'op', pa.op, 'value', pa.value, 'vendor', pa.vendor)
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
              p.juniper_ingress_policy, p.juniper_egress_policy, p.juniper_activate_service,
              p.juniper_cos_shaping_rate, p.juniper_dynamic_profile,
              p.validity_days, p.price, p.currency, p.description, p.is_active,
              p.created_at, p.updated_at,
              COALESCE(s.sub_count, 0)::integer AS subscribers_count,
              COALESCE(
                json_agg(
                  json_build_object('id', pa.id, 'attribute', pa.attribute, 'op', pa.op, 'value', pa.value, 'vendor', pa.vendor)
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
              p.juniper_ingress_policy, p.juniper_egress_policy, p.juniper_activate_service,
              p.juniper_cos_shaping_rate, p.juniper_dynamic_profile,
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

    const juniperIn = input.juniper_ingress_policy || `${input.download_speed_mbps}M-IN`;
    const juniperOut = input.juniper_egress_policy || `${input.upload_speed_mbps}M-OUT`;

    // 1. Insert package
    const { rows } = await query<any>(
      `INSERT INTO packages (
         name, download_speed_mbps, upload_speed_mbps, rate_limit,
         burst_download_mbps, burst_upload_mbps, burst_threshold_dl_mbps,
         burst_threshold_ul_mbps, burst_time_seconds, radius_profile_id,
         juniper_ingress_policy, juniper_egress_policy, juniper_activate_service,
         juniper_cos_shaping_rate, juniper_dynamic_profile,
         validity_days, price, currency, description, is_active
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, TRUE)
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
        juniperIn,
        juniperOut,
        input.juniper_activate_service ?? null,
        input.juniper_cos_shaping_rate ?? null,
        input.juniper_dynamic_profile ?? null,
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
        `SELECT vendor, attribute_name, op, value FROM radius_attributes WHERE profile_id = $1`,
        [input.radius_profile_id],
      );
      for (const pa of profileAttrs) {
        if (!attrs.some((a) => a.attribute === pa.attribute_name)) {
          attrs.push({ attribute: pa.attribute_name, op: pa.op, value: pa.value, vendor: pa.vendor });
        }
      }
    }

    // Ensure MikroTik vendor rate limit
    if (!attrs.some((a) => a.attribute === 'Mikrotik-Rate-Limit')) {
      attrs.push({ attribute: 'Mikrotik-Rate-Limit', op: ':=', value: rateLimit, vendor: 'mikrotik' });
    }

    // Ensure Juniper vendor ingress & egress filters
    if (!attrs.some((a) => a.attribute === 'Juniper-Ingress-Policy-Name')) {
      attrs.push({ attribute: 'Juniper-Ingress-Policy-Name', op: ':=', value: juniperIn, vendor: 'juniper' });
    }
    if (!attrs.some((a) => a.attribute === 'Juniper-Egress-Policy-Name')) {
      attrs.push({ attribute: 'Juniper-Egress-Policy-Name', op: ':=', value: juniperOut, vendor: 'juniper' });
    }
    if (input.juniper_activate_service && !attrs.some((a) => a.attribute === 'Juniper-Activate-Service')) {
      attrs.push({ attribute: 'Juniper-Activate-Service', op: ':=', value: input.juniper_activate_service, vendor: 'juniper' });
    }
    if (input.juniper_cos_shaping_rate && !attrs.some((a) => a.attribute === 'Juniper-Cos-Shaping-Rate')) {
      attrs.push({ attribute: 'Juniper-Cos-Shaping-Rate', op: ':=', value: input.juniper_cos_shaping_rate, vendor: 'juniper' });
    }
    if (input.juniper_dynamic_profile && !attrs.some((a) => a.attribute === 'Juniper-Client-Profile-Name')) {
      attrs.push({ attribute: 'Juniper-Client-Profile-Name', op: ':=', value: input.juniper_dynamic_profile, vendor: 'juniper' });
    }

    // Standard RFC attributes
    if (!attrs.some((a) => a.attribute === 'Acct-Interim-Interval')) {
      attrs.push({ attribute: 'Acct-Interim-Interval', op: ':=', value: '300', vendor: 'generic' });
    }
    if (!attrs.some((a) => a.attribute === 'Framed-Protocol')) {
      attrs.push({ attribute: 'Framed-Protocol', op: ':=', value: '1', vendor: 'generic' });
    }

    for (const a of attrs) {
      const v = a.vendor || (a.attribute.startsWith('Juniper-') ? 'juniper' : a.attribute.startsWith('Mikrotik-') ? 'mikrotik' : 'generic');
      await query(
        `INSERT INTO package_attributes (package_id, attribute, op, value, vendor)
         VALUES ($1, $2, $3, $4, $5)`,
        [createdId, a.attribute, a.op || ':=', a.value, v],
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

    const juniperIn = input.juniper_ingress_policy !== undefined ? input.juniper_ingress_policy : (existing.juniper_ingress_policy || `${dl}M-IN`);
    const juniperOut = input.juniper_egress_policy !== undefined ? input.juniper_egress_policy : (existing.juniper_egress_policy || `${ul}M-OUT`);
    const juniperAct = input.juniper_activate_service !== undefined ? input.juniper_activate_service : existing.juniper_activate_service;
    const juniperCos = input.juniper_cos_shaping_rate !== undefined ? input.juniper_cos_shaping_rate : existing.juniper_cos_shaping_rate;
    const juniperDyn = input.juniper_dynamic_profile !== undefined ? input.juniper_dynamic_profile : existing.juniper_dynamic_profile;

    await query(
      `UPDATE packages
          SET name = $1, download_speed_mbps = $2, upload_speed_mbps = $3,
              rate_limit = $4, burst_download_mbps = $5, burst_upload_mbps = $6,
              burst_threshold_dl_mbps = $7, burst_threshold_ul_mbps = $8,
              burst_time_seconds = $9, radius_profile_id = $10,
              juniper_ingress_policy = $11, juniper_egress_policy = $12,
              juniper_activate_service = $13, juniper_cos_shaping_rate = $14,
              juniper_dynamic_profile = $15,
              validity_days = $16, price = $17, currency = $18,
              description = $19, is_active = $20, updated_at = NOW()
        WHERE id = $21`,
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
        juniperIn,
        juniperOut,
        juniperAct,
        juniperCos,
        juniperDyn,
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
        const v = a.vendor || (a.attribute.startsWith('Juniper-') ? 'juniper' : a.attribute.startsWith('Mikrotik-') ? 'mikrotik' : 'generic');
        await query(
          `INSERT INTO package_attributes (package_id, attribute, op, value, vendor)
           VALUES ($1, $2, $3, $4, $5)`,
          [id, a.attribute, a.op || ':=', a.value, v],
        );
      }
    } else {
      // Update MikroTik rate limit
      await query(
        `UPDATE package_attributes SET value = $1
          WHERE package_id = $2 AND attribute = 'Mikrotik-Rate-Limit'`,
        [rateLimit, id],
      );

      // Update Juniper ingress/egress policies if set
      if (juniperIn) {
        await query(
          `INSERT INTO package_attributes (package_id, attribute, op, value, vendor)
           VALUES ($1, 'Juniper-Ingress-Policy-Name', ':=', $2, 'juniper')
           ON CONFLICT DO NOTHING`,
          [id, juniperIn],
        );
        await query(
          `UPDATE package_attributes SET value = $1
            WHERE package_id = $2 AND attribute = 'Juniper-Ingress-Policy-Name'`,
          [juniperIn, id],
        );
      }
      if (juniperOut) {
        await query(
          `INSERT INTO package_attributes (package_id, attribute, op, value, vendor)
           VALUES ($1, 'Juniper-Egress-Policy-Name', ':=', $2, 'juniper')
           ON CONFLICT DO NOTHING`,
          [id, juniperOut],
        );
        await query(
          `UPDATE package_attributes SET value = $1
            WHERE package_id = $2 AND attribute = 'Juniper-Egress-Policy-Name'`,
          [juniperOut, id],
        );
      }
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

  async simulateAccessAccept(id: number, vendor: 'mikrotik' | 'juniper' | 'generic' | 'all' = 'all') {
    const pkg = await this.findById(id);
    if (!pkg) return null;

    const allAttrs = pkg.attributes || [];
    let filtered = allAttrs;

    if (vendor === 'mikrotik') {
      filtered = allAttrs.filter((a) => (a.vendor === 'mikrotik' || a.vendor === 'generic' || !a.attribute.startsWith('Juniper-')));
    } else if (vendor === 'juniper') {
      filtered = allAttrs.filter((a) => (a.vendor === 'juniper' || a.vendor === 'generic' || !a.attribute.startsWith('Mikrotik-')));
    } else if (vendor === 'generic') {
      filtered = allAttrs.filter((a) => (a.vendor === 'generic' || (!a.attribute.startsWith('Mikrotik-') && !a.attribute.startsWith('Juniper-'))));
    }

    const previewMap: Record<string, string> = {};
    for (const a of filtered) {
      previewMap[a.attribute] = a.value;
    }

    return {
      package_id: pkg.id,
      package_name: pkg.name,
      vendor,
      attributes: filtered,
      simulated_response: {
        code: 'Access-Accept',
        code_number: 2,
        attributes: previewMap,
      },
    };
  },
};
