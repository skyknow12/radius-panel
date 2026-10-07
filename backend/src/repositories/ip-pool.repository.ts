import { query } from '../db/pool';

export interface IpPoolRow {
  id: number;
  name: string;
  network: string;
  gateway: string;
  start_ip: string;
  end_ip: string;
  subnet: string;
  description: string | null;
  status: 'active' | 'inactive' | 'exhausted';
  total_ips: number;
  used_ips: number;
  utilization_percent: number;
  created_at: Date;
  updated_at: Date;
}

export interface CreateIpPoolInput {
  name: string;
  network: string;
  gateway: string;
  start_ip: string;
  end_ip: string;
  subnet?: string;
  description?: string;
  total_ips?: number;
  status?: 'active' | 'inactive';
}

export interface UpdateIpPoolInput {
  name?: string;
  network?: string;
  gateway?: string;
  start_ip?: string;
  end_ip?: string;
  subnet?: string;
  description?: string;
  total_ips?: number;
  status?: 'active' | 'inactive';
}

export interface IpAddressRow {
  id: number;
  pool_id: number | null;
  pool_name: string | null;
  ip_address: string;
  subscriber_id: number | null;
  customer_id: string | null;
  username: string | null;
  subscriber_name: string | null;
  status: 'available' | 'assigned' | 'reserved' | 'blocked';
  allocation_date: Date | null;
  last_seen: Date | null;
  notes: string | null;
  created_at: Date;
  updated_at: Date;
}

export const ipPoolRepository = {
  async list(): Promise<IpPoolRow[]> {
    const { rows } = await query<any>(
      `SELECT p.id, p.name, p.network::text AS network, p.gateway::text AS gateway,
              p.start_ip::text AS start_ip, p.end_ip::text AS end_ip, p.subnet,
              p.description, p.status, p.total_ips,
              COALESCE(sub.assigned_count, p.used_ips, 0)::integer AS used_ips,
              p.created_at, p.updated_at
         FROM ip_pools p
         LEFT JOIN (
           SELECT pool_id, COUNT(*) AS assigned_count
             FROM ip_addresses
            WHERE status = 'assigned'
            GROUP BY pool_id
         ) sub ON sub.pool_id = p.id
        ORDER BY p.name ASC`,
    );

    return rows.map((r) => {
      const total = Number(r.total_ips) || 1;
      const used = Number(r.used_ips) || 0;
      const pct = Math.min(100, Math.round((used / total) * 100));
      return {
        ...r,
        total_ips: total,
        used_ips: used,
        utilization_percent: pct,
      };
    });
  },

  async findById(id: number): Promise<IpPoolRow | null> {
    const { rows } = await query<any>(
      `SELECT p.id, p.name, p.network::text AS network, p.gateway::text AS gateway,
              p.start_ip::text AS start_ip, p.end_ip::text AS end_ip, p.subnet,
              p.description, p.status, p.total_ips,
              COALESCE(sub.assigned_count, p.used_ips, 0)::integer AS used_ips,
              p.created_at, p.updated_at
         FROM ip_pools p
         LEFT JOIN (
           SELECT pool_id, COUNT(*) AS assigned_count
             FROM ip_addresses
            WHERE status = 'assigned'
            GROUP BY pool_id
         ) sub ON sub.pool_id = p.id
        WHERE p.id = $1`,
      [id],
    );
    if (!rows[0]) return null;
    const r = rows[0];
    const total = Number(r.total_ips) || 1;
    const used = Number(r.used_ips) || 0;
    return {
      ...r,
      total_ips: total,
      used_ips: used,
      utilization_percent: Math.min(100, Math.round((used / total) * 100)),
    };
  },

  async create(input: CreateIpPoolInput): Promise<IpPoolRow> {
    const { rows } = await query<any>(
      `INSERT INTO ip_pools (name, network, gateway, start_ip, end_ip, subnet, description, total_ips, status)
       VALUES ($1, $2::cidr, $3::inet, $4::inet, $5::inet, $6, $7, $8, $9)
       RETURNING id`,
      [
        input.name.trim(),
        input.network.trim(),
        input.gateway.trim(),
        input.start_ip.trim(),
        input.end_ip.trim(),
        input.subnet || '255.255.0.0',
        input.description ?? null,
        input.total_ips ?? 250,
        input.status ?? 'active',
      ],
    );
    return (await this.findById(rows[0].id))!;
  },

  async update(id: number, input: UpdateIpPoolInput): Promise<IpPoolRow | null> {
    const existing = await this.findById(id);
    if (!existing) return null;

    await query(
      `UPDATE ip_pools
          SET name = COALESCE($1, name),
              network = COALESCE($2::cidr, network),
              gateway = COALESCE($3::inet, gateway),
              start_ip = COALESCE($4::inet, start_ip),
              end_ip = COALESCE($5::inet, end_ip),
              subnet = COALESCE($6, subnet),
              description = COALESCE($7, description),
              total_ips = COALESCE($8, total_ips),
              status = COALESCE($9, status),
              updated_at = NOW()
        WHERE id = $10`,
      [
        input.name ? input.name.trim() : null,
        input.network ? input.network.trim() : null,
        input.gateway ? input.gateway.trim() : null,
        input.start_ip ? input.start_ip.trim() : null,
        input.end_ip ? input.end_ip.trim() : null,
        input.subnet ?? null,
        input.description ?? null,
        input.total_ips ?? null,
        input.status ?? null,
        id,
      ],
    );
    return await this.findById(id);
  },

  async delete(id: number): Promise<boolean> {
    const { rowCount } = await query(`DELETE FROM ip_pools WHERE id = $1`, [id]);
    return (rowCount ?? 0) > 0;
  },

  async listAddresses(filter?: { pool_id?: number; status?: string; search?: string }): Promise<IpAddressRow[]> {
    const conditions: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (filter?.pool_id) {
      conditions.push(`a.pool_id = $${idx++}`);
      values.push(filter.pool_id);
    }
    if (filter?.status && filter.status !== 'all') {
      conditions.push(`a.status = $${idx++}`);
      values.push(filter.status);
    }
    if (filter?.search) {
      conditions.push(
        `(a.ip_address::text ILIKE $${idx} OR s.username ILIKE $${idx} OR s.customer_id ILIKE $${idx} OR s.full_name ILIKE $${idx})`,
      );
      values.push(`%${filter.search.trim()}%`);
      idx++;
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const { rows } = await query<any>(
      `SELECT a.id, a.pool_id, p.name AS pool_name,
              a.ip_address::text AS ip_address, a.subscriber_id,
              s.customer_id, s.username, s.full_name AS subscriber_name,
              a.status, a.allocation_date, a.last_seen, a.notes,
              a.created_at, a.updated_at
         FROM ip_addresses a
         LEFT JOIN ip_pools p ON p.id = a.pool_id
         LEFT JOIN subscribers s ON s.id = a.subscriber_id
         ${whereClause}
        ORDER BY a.ip_address ASC`,
      values,
    );
    return rows;
  },

  async isStaticIpAvailable(ip: string, excludeSubscriberId?: number): Promise<boolean> {
    // Check subscribers table
    let subQuery = `SELECT id FROM subscribers WHERE static_ip = $1::inet AND status IN ('active', 'enabled')`;
    const params: any[] = [ip.trim()];
    if (excludeSubscriberId) {
      subQuery += ` AND id != $2`;
      params.push(excludeSubscriberId);
    }
    const { rows: subRows } = await query(subQuery, params);
    if (subRows.length > 0) return false;

    // Check ip_addresses table
    let ipQuery = `SELECT id FROM ip_addresses WHERE ip_address = $1::inet AND status IN ('assigned', 'reserved', 'blocked')`;
    const ipParams: any[] = [ip.trim()];
    if (excludeSubscriberId) {
      ipQuery += ` AND subscriber_id != $2`;
      ipParams.push(excludeSubscriberId);
    }
    const { rows: ipRows } = await query(ipQuery, ipParams);
    return ipRows.length === 0;
  },

  async allocateStaticIp(ip: string, subscriberId: number, poolId?: number): Promise<void> {
    await query(
      `INSERT INTO ip_addresses (pool_id, ip_address, subscriber_id, status, allocation_date, last_seen)
       VALUES ($1, $2::inet, $3, 'assigned', NOW(), NOW())
       ON CONFLICT (ip_address)
       DO UPDATE SET subscriber_id = EXCLUDED.subscriber_id,
                     status = 'assigned',
                     allocation_date = NOW(),
                     updated_at = NOW()`,
      [poolId ?? null, ip.trim(), subscriberId],
    );
  },

  async releaseStaticIp(subscriberId: number): Promise<void> {
    await query(
      `UPDATE ip_addresses
          SET subscriber_id = NULL, status = 'available', updated_at = NOW()
        WHERE subscriber_id = $1`,
      [subscriberId],
    );
  },
};
