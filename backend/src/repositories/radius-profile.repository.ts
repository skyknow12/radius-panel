import { query } from '../db/pool';

export interface RadiusAttribute {
  id?: number;
  profile_id?: number;
  vendor: string;
  attribute_name: string;
  attribute_type: string;
  op: string;
  value: string;
  created_at?: Date;
}

export interface RadiusProfileRow {
  id: number;
  name: string;
  description: string | null;
  is_active: boolean;
  attributes: RadiusAttribute[];
  created_at: Date;
  updated_at: Date;
}

export interface CreateRadiusProfileInput {
  name: string;
  description?: string;
  is_active?: boolean;
  attributes?: {
    vendor?: string;
    attribute_name: string;
    attribute_type?: string;
    op?: string;
    value: string;
  }[];
}

export interface UpdateRadiusProfileInput {
  name?: string;
  description?: string;
  is_active?: boolean;
  attributes?: {
    vendor?: string;
    attribute_name: string;
    attribute_type?: string;
    op?: string;
    value: string;
  }[];
}

export const radiusProfileRepository = {
  async list(): Promise<RadiusProfileRow[]> {
    const { rows } = await query<any>(
      `SELECT p.id, p.name, p.description, p.is_active, p.created_at, p.updated_at,
              COALESCE(
                json_agg(
                  json_build_object(
                    'id', a.id,
                    'vendor', a.vendor,
                    'attribute_name', a.attribute_name,
                    'attribute_type', a.attribute_type,
                    'op', a.op,
                    'value', a.value
                  ) ORDER BY a.id ASC
                ) FILTER (WHERE a.id IS NOT NULL), '[]'::json
              ) AS attributes
         FROM radius_profiles p
         LEFT JOIN radius_attributes a ON a.profile_id = p.id
        GROUP BY p.id
        ORDER BY p.name ASC`,
    );
    return rows;
  },

  async findById(id: number): Promise<RadiusProfileRow | null> {
    const { rows } = await query<any>(
      `SELECT p.id, p.name, p.description, p.is_active, p.created_at, p.updated_at,
              COALESCE(
                json_agg(
                  json_build_object(
                    'id', a.id,
                    'vendor', a.vendor,
                    'attribute_name', a.attribute_name,
                    'attribute_type', a.attribute_type,
                    'op', a.op,
                    'value', a.value
                  ) ORDER BY a.id ASC
                ) FILTER (WHERE a.id IS NOT NULL), '[]'::json
              ) AS attributes
         FROM radius_profiles p
         LEFT JOIN radius_attributes a ON a.profile_id = p.id
        WHERE p.id = $1
        GROUP BY p.id`,
      [id],
    );
    return rows[0] ?? null;
  },

  async create(input: CreateRadiusProfileInput): Promise<RadiusProfileRow> {
    const { rows } = await query<any>(
      `INSERT INTO radius_profiles (name, description, is_active)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [input.name.trim(), input.description ?? null, input.is_active ?? true],
    );
    const profile = rows[0];

    if (input.attributes && input.attributes.length > 0) {
      for (const attr of input.attributes) {
        await query(
          `INSERT INTO radius_attributes (profile_id, vendor, attribute_name, attribute_type, op, value)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            profile.id,
            attr.vendor || 'Standard',
            attr.attribute_name.trim(),
            attr.attribute_type || 'string',
            attr.op || ':=',
            attr.value.trim(),
          ],
        );
      }
    }

    return (await this.findById(profile.id))!;
  },

  async update(id: number, input: UpdateRadiusProfileInput): Promise<RadiusProfileRow | null> {
    const existing = await this.findById(id);
    if (!existing) return null;

    const name = input.name !== undefined ? input.name.trim() : existing.name;
    const description = input.description !== undefined ? input.description : existing.description;
    const is_active = input.is_active !== undefined ? input.is_active : existing.is_active;

    await query(
      `UPDATE radius_profiles
          SET name = $1, description = $2, is_active = $3, updated_at = NOW()
        WHERE id = $4`,
      [name, description, is_active, id],
    );

    if (input.attributes !== undefined) {
      await query(`DELETE FROM radius_attributes WHERE profile_id = $1`, [id]);
      for (const attr of input.attributes) {
        await query(
          `INSERT INTO radius_attributes (profile_id, vendor, attribute_name, attribute_type, op, value)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            id,
            attr.vendor || 'Standard',
            attr.attribute_name.trim(),
            attr.attribute_type || 'string',
            attr.op || ':=',
            attr.value.trim(),
          ],
        );
      }
    }

    return await this.findById(id);
  },

  async delete(id: number): Promise<boolean> {
    const { rowCount } = await query(`DELETE FROM radius_profiles WHERE id = $1`, [id]);
    return (rowCount ?? 0) > 0;
  },

  async addAttribute(profileId: number, attr: Omit<RadiusAttribute, 'id' | 'profile_id'>): Promise<RadiusAttribute> {
    const { rows } = await query<RadiusAttribute>(
      `INSERT INTO radius_attributes (profile_id, vendor, attribute_name, attribute_type, op, value)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [profileId, attr.vendor || 'Standard', attr.attribute_name.trim(), attr.attribute_type || 'string', attr.op || ':=', attr.value.trim()],
    );
    return rows[0];
  },

  async deleteAttribute(attrId: number): Promise<boolean> {
    const { rowCount } = await query(`DELETE FROM radius_attributes WHERE id = $1`, [attrId]);
    return (rowCount ?? 0) > 0;
  },
};
