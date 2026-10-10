import { query } from '../db/pool';

export interface RadiusCatalogItem {
  id: number;
  vendor: string;
  vendor_id: number | null;
  attribute_code: number;
  attribute_name: string;
  data_type: 'string' | 'integer' | 'ipaddr' | 'ipv6addr' | 'ipv6prefix';
  has_tag: boolean;
  coa_supported: boolean;
  dynamic_profile_var: string | null;
  description: string | null;
  default_op: string;
  sample_value: string | null;
  is_common: boolean;
  created_at: Date;
}

export const radiusCatalogRepository = {
  async list(vendor?: string, search?: string): Promise<RadiusCatalogItem[]> {
    const conditions: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (vendor && vendor !== 'all') {
      conditions.push(`vendor = $${idx}`);
      values.push(vendor.toLowerCase());
      idx++;
    }

    if (search && search.trim()) {
      conditions.push(`(
        attribute_name ILIKE $${idx} OR
        COALESCE(description, '') ILIKE $${idx} OR
        COALESCE(dynamic_profile_var, '') ILIKE $${idx}
      )`);
      values.push(`%${search.trim()}%`);
      idx++;
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const sql = `
      SELECT id, vendor, vendor_id, attribute_code, attribute_name,
             data_type, has_tag, coa_supported, dynamic_profile_var,
             description, default_op, sample_value, is_common, created_at
        FROM radius_attribute_catalog
       ${where}
       ORDER BY vendor ASC, is_common DESC, attribute_code ASC
    `;

    const { rows } = await query<RadiusCatalogItem>(sql, values);
    return rows;
  },

  async findByName(attributeName: string): Promise<RadiusCatalogItem | null> {
    const { rows } = await query<RadiusCatalogItem>(
      `SELECT * FROM radius_attribute_catalog WHERE lower(attribute_name) = lower($1) LIMIT 1`,
      [attributeName],
    );
    return rows[0] ?? null;
  },

  validateAttributeValue(
    catalogItem: RadiusCatalogItem,
    value: string,
  ): { valid: boolean; error?: string } {
    const val = value.trim();
    if (!val) {
      return { valid: false, error: 'Attribute value cannot be empty' };
    }

    switch (catalogItem.data_type) {
      case 'integer': {
        const num = Number(val);
        if (isNaN(num) || !Number.isInteger(num) || num < 0) {
          return { valid: false, error: `${catalogItem.attribute_name} requires a non-negative integer` };
        }
        return { valid: true };
      }
      case 'ipaddr': {
        const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
        if (!ipv4Regex.test(val)) {
          return { valid: false, error: `${catalogItem.attribute_name} requires a valid IPv4 address (e.g. 10.10.1.1)` };
        }
        return { valid: true };
      }
      case 'ipv6addr': {
        const ipv6Regex = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$|^::$|^([0-9a-fA-F]{1,4}:){1,7}:$|^:((:[0-9a-fA-F]{1,4}){1,7})$|^([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}$/;
        if (!ipv6Regex.test(val) && !val.includes('::')) {
          return { valid: false, error: `${catalogItem.attribute_name} requires a valid IPv6 address` };
        }
        return { valid: true };
      }
      case 'ipv6prefix': {
        if (!val.includes('/')) {
          return { valid: false, error: `${catalogItem.attribute_name} requires CIDR prefix format (e.g. 2001:db8::/56)` };
        }
        return { valid: true };
      }
      case 'string':
      default: {
        if (Buffer.byteLength(val, 'utf8') > 253) {
          return { valid: false, error: `Attribute string length exceeds RADIUS limit of 253 bytes` };
        }
        return { valid: true };
      }
    }
  },
};
