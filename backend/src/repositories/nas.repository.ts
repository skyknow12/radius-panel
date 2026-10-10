import { query } from '../db/pool';

export interface NasDeviceRow {
  id: number;
  name: string;
  ip_address: string;
  nas_type: string;
  vendor?: string | null;
  model?: string | null;
  os_version?: string | null;
  dynamic_profile_name?: string | null;
  coa_enabled?: boolean;
  location?: string | null;
  description?: string | null;
  coa_port: number;
  status: 'online' | 'warning' | 'offline' | 'unknown';
  last_seen_at: Date | null;
  sessions: number;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface CreateNasInput {
  name: string;
  ip_address: string;
  nas_type: string;
  vendor?: string;
  model?: string;
  os_version?: string;
  dynamic_profile_name?: string;
  coa_enabled?: boolean;
  secret: string;
  description?: string;
  location?: string;
  coa_port?: number;
  status?: 'online' | 'warning' | 'offline' | 'unknown';
}

export interface UpdateNasInput {
  name?: string;
  ip_address?: string;
  nas_type?: string;
  vendor?: string;
  model?: string;
  os_version?: string;
  dynamic_profile_name?: string;
  coa_enabled?: boolean;
  secret?: string;
  description?: string;
  location?: string;
  coa_port?: number;
  status?: 'online' | 'warning' | 'offline' | 'unknown';
  is_active?: boolean;
}

export const nasRepository = {
  async listWithSessions(): Promise<NasDeviceRow[]> {
    const { rows } = await query<any>(
      `SELECT nd.id, nd.name, host(nd.ip_address) AS ip_address, nd.nas_type,
              nd.vendor, nd.model, nd.os_version, nd.dynamic_profile_name, nd.coa_enabled,
              nd.location, nd.description, nd.coa_port,
              nd.status, nd.last_seen_at, nd.is_active, nd.created_at, nd.updated_at,
              COALESCE(s.sessions, 0)::integer AS sessions
         FROM nas_devices nd
         LEFT JOIN (
           SELECT nasipaddress, COUNT(*) AS sessions
             FROM radacct WHERE acctstoptime IS NULL
            GROUP BY nasipaddress
         ) s ON s.nasipaddress = nd.ip_address
        ORDER BY sessions DESC, nd.name`,
    );
    return rows;
  },

  async findById(id: number): Promise<(NasDeviceRow & { secret?: string }) | null> {
    const { rows } = await query<any>(
      `SELECT nd.id, nd.name, host(nd.ip_address) AS ip_address, nd.nas_type,
              nd.vendor, nd.model, nd.os_version, nd.dynamic_profile_name, nd.coa_enabled,
              nd.location, nd.description, nd.coa_port,
              nd.status, nd.last_seen_at, nd.is_active, nd.created_at, nd.updated_at,
              nd.secret,
              COALESCE(s.sessions, 0)::integer AS sessions
         FROM nas_devices nd
         LEFT JOIN (
           SELECT nasipaddress, COUNT(*) AS sessions
             FROM radacct WHERE acctstoptime IS NULL
            GROUP BY nasipaddress
         ) s ON s.nasipaddress = nd.ip_address
        WHERE nd.id = $1`,
      [id],
    );
    return rows[0] ?? null;
  },

  async findByIp(ip: string): Promise<NasDeviceRow | null> {
    const { rows } = await query<any>(
      `SELECT nd.id, nd.name, host(nd.ip_address) AS ip_address, nd.nas_type,
              nd.vendor, nd.model, nd.os_version, nd.dynamic_profile_name, nd.coa_enabled,
              nd.description, nd.coa_port, nd.status, nd.last_seen_at, nd.is_active
         FROM nas_devices nd WHERE nd.ip_address = $1::inet`,
      [ip],
    );
    return rows[0] ?? null;
  },

  async create(input: CreateNasInput): Promise<NasDeviceRow> {
    // 1. Insert/upsert into FreeRADIUS standard "nas" table
    const nasResult = await query<{ id: number }>(
      `INSERT INTO nas (nasname, shortname, type, ports, secret, description)
       VALUES ($1, $2, $3, 1812, $4, $5)
       ON CONFLICT (nasname) DO UPDATE
         SET shortname = EXCLUDED.shortname,
             secret = EXCLUDED.secret,
             type = EXCLUDED.type,
             description = EXCLUDED.description
       RETURNING id`,
      [input.ip_address, input.name, input.nas_type || 'other', input.secret, input.description || ''],
    );
    const radiusNasId = nasResult.rows[0]?.id;

    const vendor = input.vendor || (input.nas_type?.toLowerCase().includes('juniper') ? 'juniper' : input.nas_type?.toLowerCase().includes('mikrotik') ? 'mikrotik' : 'generic');

    // 2. Insert into application inventory nas_devices
    const { rows } = await query<any>(
      `INSERT INTO nas_devices (
         name, ip_address, nas_type, vendor, model, os_version, dynamic_profile_name, coa_enabled,
         description, location, secret, coa_port, status, radius_nas_id, is_active, last_seen_at
       ) VALUES ($1, $2::inet, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, TRUE, NOW())
       RETURNING id, name, host(ip_address) AS ip_address, nas_type, vendor, model, os_version, dynamic_profile_name, coa_enabled,
                 location, description, coa_port, status, last_seen_at, is_active,
                 created_at, updated_at`,
      [
        input.name,
        input.ip_address,
        input.nas_type || 'other',
        vendor,
        input.model || null,
        input.os_version || null,
        input.dynamic_profile_name || null,
        input.coa_enabled ?? true,
        input.description || null,
        input.location || null,
        input.secret,
        input.coa_port || 3799,
        input.status || 'online',
        radiusNasId,
      ],
    );

    return { ...rows[0], sessions: 0 };
  },

  async update(id: number, input: UpdateNasInput): Promise<NasDeviceRow | null> {
    const existing = await this.findById(id);
    if (!existing) return null;

    const name = input.name ?? existing.name;
    const ip = input.ip_address ?? existing.ip_address;
    const nasType = input.nas_type ?? existing.nas_type;
    const vendor = input.vendor ?? existing.vendor ?? 'generic';
    const model = input.model !== undefined ? input.model : existing.model;
    const osVersion = input.os_version !== undefined ? input.os_version : existing.os_version;
    const dynProfile = input.dynamic_profile_name !== undefined ? input.dynamic_profile_name : existing.dynamic_profile_name;
    const coaEnabled = input.coa_enabled !== undefined ? input.coa_enabled : (existing.coa_enabled ?? true);
    const desc = input.description ?? existing.description;
    const loc = input.location ?? existing.location;
    const coaPort = input.coa_port ?? existing.coa_port;
    const status = input.status ?? existing.status;
    const isActive = input.is_active ?? existing.is_active;
    const secret = input.secret || (existing as any).secret || 'testing123';

    // 1. Update FreeRADIUS nas table
    await query(
      `INSERT INTO nas (nasname, shortname, type, ports, secret, description)
       VALUES ($1, $2, $3, 1812, $4, $5)
       ON CONFLICT (nasname) DO UPDATE
         SET shortname = EXCLUDED.shortname,
             type = EXCLUDED.type,
             secret = CASE WHEN $4 <> '' THEN $4 ELSE nas.secret END,
             description = EXCLUDED.description`,
      [ip, name, nasType, secret, desc || ''],
    );

    // 2. Update nas_devices
    const { rows } = await query<any>(
      `UPDATE nas_devices
          SET name = $1, ip_address = $2::inet, nas_type = $3, vendor = $4, model = $5,
              os_version = $6, dynamic_profile_name = $7, coa_enabled = $8,
              description = $9, location = $10, coa_port = $11, status = $12, is_active = $13,
              secret = CASE WHEN $14 <> '' THEN $14 ELSE secret END,
              updated_at = NOW()
        WHERE id = $15
        RETURNING id, name, host(ip_address) AS ip_address, nas_type, vendor, model, os_version, dynamic_profile_name, coa_enabled,
                  location, description, coa_port, status, last_seen_at, is_active,
                  created_at, updated_at`,
      [name, ip, nasType, vendor, model, osVersion, dynProfile, coaEnabled, desc, loc, coaPort, status, isActive, secret, id],
    );

    return { ...rows[0], sessions: existing.sessions };
  },

  async delete(id: number): Promise<boolean> {
    const existing = await this.findById(id);
    if (!existing) return false;

    // Delete from FreeRADIUS nas table
    await query('DELETE FROM nas WHERE nasname = $1', [existing.ip_address]);

    // Delete from nas_devices
    const { rowCount } = await query('DELETE FROM nas_devices WHERE id = $1', [id]);
    return (rowCount ?? 0) > 0;
  },

  async countDevices(): Promise<number> {
    const { rows } = await query<{ count: string }>('SELECT COUNT(*) FROM nas_devices WHERE is_active');
    return Number(rows[0]?.count ?? 0);
  },

  async countRadiusClients(): Promise<number> {
    const { rows } = await query<{ count: string }>('SELECT COUNT(*) FROM nas');
    return Number(rows[0]?.count ?? 0);
  },
};

export const radiusUserRepository = {
  async countUsers(): Promise<number> {
    const { rows } = await query<{ count: string }>('SELECT COUNT(DISTINCT username) FROM radcheck');
    return Number(rows[0]?.count ?? 0);
  },

  async countGroups(): Promise<number> {
    const { rows } = await query<{ count: string }>(
      `SELECT COUNT(DISTINCT groupname) FROM (
         SELECT groupname FROM radgroupreply UNION SELECT groupname FROM radgroupcheck
       ) g`,
    );
    return Number(rows[0]?.count ?? 0);
  },
};
