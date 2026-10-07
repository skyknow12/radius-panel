import { query } from '../db/pool';

export interface SubscriberRow {
  id: number;
  customer_id: string;
  username: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  status: 'enabled' | 'disabled' | 'suspended';
  current_package_id: number | null;
  package_name: string | null;
  package_speed: string | null;
  static_ip: string | null;
  mac_address: string | null;
  vlan_id: number | null;
  nas_restriction_id: number | null;
  nas_name: string | null;
  expiry_date: Date | null;
  is_expired: boolean;
  is_online: boolean;
  current_ip: string | null;
  current_nas_ip: string | null;
  current_session_id: string | null;
  session_start_time: Date | null;
  notes: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface SubscriberListQuery {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  package_id?: number;
  is_online?: boolean;
  nas_id?: number;
  sort_by?: string;
  sort_dir?: 'asc' | 'desc';
}

export interface CreateSubscriberInput {
  customer_id: string;
  username: string;
  password: string;
  full_name: string;
  email?: string;
  phone?: string;
  status?: 'enabled' | 'disabled' | 'suspended';
  current_package_id?: number;
  static_ip?: string;
  mac_address?: string;
  vlan_id?: number;
  nas_restriction_id?: number;
  expiry_date?: string | Date;
  notes?: string;
}

export interface UpdateSubscriberInput {
  customer_id?: string;
  password?: string;
  full_name?: string;
  email?: string;
  phone?: string;
  status?: 'enabled' | 'disabled' | 'suspended';
  current_package_id?: number | null;
  static_ip?: string | null;
  mac_address?: string | null;
  vlan_id?: number | null;
  nas_restriction_id?: number | null;
  expiry_date?: string | Date | null;
  notes?: string | null;
}

export const subscriberRepository = {
  async list(params: SubscriberListQuery) {
    const page = Math.max(1, params.page || 1);
    const limit = Math.min(100, Math.max(1, params.limit || 20));
    const offset = (page - 1) * limit;

    const conditions: string[] = ['1=1'];
    const values: any[] = [];
    let idx = 1;

    if (params.search) {
      conditions.push(`(
        s.username ILIKE $${idx} OR
        s.customer_id ILIKE $${idx} OR
        s.full_name ILIKE $${idx} OR
        host(s.static_ip) ILIKE $${idx}
      )`);
      values.push(`%${params.search}%`);
      idx++;
    }

    if (params.status && params.status !== 'all') {
      conditions.push(`s.status = $${idx}`);
      values.push(params.status);
      idx++;
    }

    if (params.package_id) {
      conditions.push(`s.current_package_id = $${idx}`);
      values.push(params.package_id);
      idx++;
    }

    if (params.nas_id) {
      conditions.push(`s.nas_restriction_id = $${idx}`);
      values.push(params.nas_id);
      idx++;
    }

    if (params.is_online !== undefined) {
      if (params.is_online) {
        conditions.push(`active_sess.session_id IS NOT NULL`);
      } else {
        conditions.push(`active_sess.session_id IS NULL`);
      }
    }

    const whereClause = conditions.join(' AND ');

    // Sort mapping
    const sortFieldMap: Record<string, string> = {
      customer_id: 's.customer_id',
      username: 's.username',
      full_name: 's.full_name',
      status: 's.status',
      expiry_date: 's.expiry_date',
      created_at: 's.created_at',
    };
    const sortCol = sortFieldMap[params.sort_by || ''] || 's.created_at';
    const sortOrder = params.sort_dir === 'asc' ? 'ASC' : 'DESC';

    // Count query
    const countSql = `
      SELECT COUNT(*) AS total
        FROM subscribers s
        LEFT JOIN LATERAL (
          SELECT AcctSessionId AS session_id
            FROM radacct
           WHERE lower(UserName) = lower(s.username) AND AcctStopTime IS NULL
           ORDER BY AcctStartTime DESC LIMIT 1
        ) active_sess ON true
       WHERE ${whereClause}
    `;
    const countRes = await query<{ total: string }>(countSql, values);
    const total = Number(countRes.rows[0]?.total || 0);

    // Data query
    const dataSql = `
      SELECT s.id, s.customer_id, s.username, s.full_name, s.email, s.phone,
             s.status, s.current_package_id, p.name AS package_name, p.rate_limit AS package_speed,
             host(s.static_ip) AS static_ip, s.mac_address, s.vlan_id,
             s.nas_restriction_id, nd.name AS nas_name,
             s.expiry_date,
             (s.expiry_date IS NOT NULL AND s.expiry_date < NOW()) AS is_expired,
             (active_sess.session_id IS NOT NULL) AS is_online,
             active_sess.framed_ip AS current_ip,
             active_sess.nas_ip AS current_nas_ip,
             active_sess.session_id AS current_session_id,
             active_sess.start_time AS session_start_time,
             s.notes, s.created_at, s.updated_at
        FROM subscribers s
        LEFT JOIN packages p ON p.id = s.current_package_id
        LEFT JOIN nas_devices nd ON nd.id = s.nas_restriction_id
        LEFT JOIN LATERAL (
          SELECT AcctSessionId AS session_id,
                 host(FramedIPAddress) AS framed_ip,
                 host(NASIPAddress) AS nas_ip,
                 AcctStartTime AS start_time
            FROM radacct
           WHERE lower(UserName) = lower(s.username) AND AcctStopTime IS NULL
           ORDER BY AcctStartTime DESC LIMIT 1
        ) active_sess ON true
       WHERE ${whereClause}
       ORDER BY ${sortCol} ${sortOrder}
       LIMIT $${idx} OFFSET $${idx + 1}
    `;
    values.push(limit, offset);

    const { rows } = await query<SubscriberRow>(dataSql, values);

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

  async findById(id: number): Promise<SubscriberRow | null> {
    const { rows } = await query<SubscriberRow>(
      `SELECT s.id, s.customer_id, s.username, s.full_name, s.email, s.phone,
              s.status, s.current_package_id, p.name AS package_name, p.rate_limit AS package_speed,
              host(s.static_ip) AS static_ip, s.mac_address, s.vlan_id,
              s.nas_restriction_id, nd.name AS nas_name,
              s.expiry_date,
              (s.expiry_date IS NOT NULL AND s.expiry_date < NOW()) AS is_expired,
              (active_sess.session_id IS NOT NULL) AS is_online,
              active_sess.framed_ip AS current_ip,
              active_sess.nas_ip AS current_nas_ip,
              active_sess.session_id AS current_session_id,
              active_sess.start_time AS session_start_time,
              s.notes, s.created_at, s.updated_at
         FROM subscribers s
         LEFT JOIN packages p ON p.id = s.current_package_id
         LEFT JOIN nas_devices nd ON nd.id = s.nas_restriction_id
         LEFT JOIN LATERAL (
           SELECT AcctSessionId AS session_id,
                  host(FramedIPAddress) AS framed_ip,
                  host(NASIPAddress) AS nas_ip,
                  AcctStartTime AS start_time
             FROM radacct
            WHERE lower(UserName) = lower(s.username) AND AcctStopTime IS NULL
            ORDER BY AcctStartTime DESC LIMIT 1
         ) active_sess ON true
        WHERE s.id = $1`,
      [id],
    );
    return rows[0] ?? null;
  },

  async findByUsername(username: string): Promise<(SubscriberRow & { password_cleartext: string }) | null> {
    const { rows } = await query<any>(
      `SELECT s.*, host(s.static_ip) AS static_ip,
              p.name AS package_name, p.rate_limit AS package_speed
         FROM subscribers s
         LEFT JOIN packages p ON p.id = s.current_package_id
        WHERE lower(s.username) = lower($1)`,
      [username],
    );
    return rows[0] ?? null;
  },

  async create(input: CreateSubscriberInput): Promise<SubscriberRow> {
    const expiry = input.expiry_date ? new Date(input.expiry_date) : null;

    // 1. Insert into subscribers table
    const { rows } = await query<{ id: number }>(
      `INSERT INTO subscribers (
         customer_id, username, password_cleartext, full_name, email, phone,
         status, current_package_id, static_ip, mac_address, vlan_id,
         nas_restriction_id, expiry_date, notes
       ) VALUES (
         $1, $2, $3, $4, $5, $6, $7, $8,
         $9::inet, $10, $11, $12, $13, $14
       ) RETURNING id`,
      [
        input.customer_id.trim(),
        input.username.trim(),
        input.password,
        input.full_name.trim(),
        input.email?.trim() || null,
        input.phone?.trim() || null,
        input.status || 'enabled',
        input.current_package_id || null,
        input.static_ip?.trim() || null,
        input.mac_address?.trim() || null,
        input.vlan_id || null,
        input.nas_restriction_id || null,
        expiry,
        input.notes?.trim() || null,
      ],
    );
    const subscriberId = rows[0].id;

    // 2. Synchronize into FreeRADIUS SQL
    await this.syncToRadius(input.username.trim(), {
      password: input.password,
      status: input.status || 'enabled',
      packageId: input.current_package_id,
      staticIp: input.static_ip,
      macAddress: input.mac_address,
      expiryDate: expiry,
    });

    return (await this.findById(subscriberId))!;
  },

  async update(id: number, input: UpdateSubscriberInput): Promise<SubscriberRow | null> {
    const existing = await query<any>('SELECT * FROM subscribers WHERE id = $1', [id]);
    if (!existing.rows.length) return null;
    const old = existing.rows[0];

    const customerId = input.customer_id ?? old.customer_id;
    const fullName = input.full_name ?? old.full_name;
    const email = input.email !== undefined ? input.email : old.email;
    const phone = input.phone !== undefined ? input.phone : old.phone;
    const status = input.status ?? old.status;
    const packageId = input.current_package_id !== undefined ? input.current_package_id : old.current_package_id;
    const staticIp = input.static_ip !== undefined ? input.static_ip : old.static_ip;
    const mac = input.mac_address !== undefined ? input.mac_address : old.mac_address;
    const vlan = input.vlan_id !== undefined ? input.vlan_id : old.vlan_id;
    const nasId = input.nas_restriction_id !== undefined ? input.nas_restriction_id : old.nas_restriction_id;
    const expiry = input.expiry_date !== undefined ? (input.expiry_date ? new Date(input.expiry_date) : null) : old.expiry_date;
    const notes = input.notes !== undefined ? input.notes : old.notes;
    const password = input.password ? input.password : old.password_cleartext;

    await query(
      `UPDATE subscribers
          SET customer_id = $1, full_name = $2, email = $3, phone = $4,
              status = $5, current_package_id = $6, static_ip = $7::inet,
              mac_address = $8, vlan_id = $9, nas_restriction_id = $10,
              expiry_date = $11, notes = $12, password_cleartext = $13,
              updated_at = NOW()
        WHERE id = $14`,
      [
        customerId, fullName, email, phone, status, packageId,
        staticIp || null, mac || null, vlan || null, nasId || null,
        expiry, notes, password, id,
      ],
    );

    // Re-sync to FreeRADIUS SQL
    await this.syncToRadius(old.username, {
      password,
      status,
      packageId,
      staticIp,
      macAddress: mac,
      expiryDate: expiry,
    });

    return await this.findById(id);
  },

  async updateStatus(id: number, status: 'enabled' | 'disabled' | 'suspended') {
    const existing = await query<any>('SELECT * FROM subscribers WHERE id = $1', [id]);
    if (!existing.rows.length) return null;
    const old = existing.rows[0];

    await query('UPDATE subscribers SET status = $1, updated_at = NOW() WHERE id = $2', [status, id]);

    // Update radcheck status
    if (status === 'suspended' || status === 'disabled') {
      await query(
        `INSERT INTO radcheck (username, attribute, op, value)
         VALUES ($1, 'Auth-Type', ':=', 'Reject')
         ON CONFLICT DO NOTHING`,
        [old.username],
      );
    } else {
      await query(
        `DELETE FROM radcheck WHERE username = $1 AND attribute = 'Auth-Type' AND value = 'Reject'`,
        [old.username],
      );
    }

    return await this.findById(id);
  },

  async delete(id: number): Promise<boolean> {
    const existing = await query<any>('SELECT username FROM subscribers WHERE id = $1', [id]);
    if (!existing.rows.length) return false;
    const username = existing.rows[0].username;

    // Clear FreeRADIUS tables
    await query('DELETE FROM radcheck WHERE username = $1', [username]);
    await query('DELETE FROM radreply WHERE username = $1', [username]);
    await query('DELETE FROM radusergroup WHERE username = $1', [username]);

    const { rowCount } = await query('DELETE FROM subscribers WHERE id = $1', [id]);
    return (rowCount ?? 0) > 0;
  },

  /** Synchronizes subscriber configuration into FreeRADIUS standard tables */
  async syncToRadius(
    username: string,
    opts: {
      password?: string;
      status: 'enabled' | 'disabled' | 'suspended';
      packageId?: number | null;
      staticIp?: string | null;
      macAddress?: string | null;
      expiryDate?: Date | null;
    },
  ) {
    // 1. Password in radcheck
    if (opts.password) {
      await query(`DELETE FROM radcheck WHERE username = $1 AND attribute = 'Cleartext-Password'`, [username]);
      await query(
        `INSERT INTO radcheck (username, attribute, op, value)
         VALUES ($1, 'Cleartext-Password', ':=', $2)`,
        [username, opts.password],
      );
    }

    // 2. Status in radcheck (Reject if disabled or suspended)
    await query(`DELETE FROM radcheck WHERE username = $1 AND attribute = 'Auth-Type'`, [username]);
    if (opts.status === 'suspended' || opts.status === 'disabled') {
      await query(
        `INSERT INTO radcheck (username, attribute, op, value)
         VALUES ($1, 'Auth-Type', ':=', 'Reject')`,
        [username],
      );
    }

    // 3. Expiration in radcheck (FreeRADIUS expiration module)
    await query(`DELETE FROM radcheck WHERE username = $1 AND attribute = 'Expiration'`, [username]);
    if (opts.expiryDate) {
      // Format: "DD Mon YYYY HH:MI:SS"
      const dateStr = formatRadiusDate(opts.expiryDate);
      await query(
        `INSERT INTO radcheck (username, attribute, op, value)
         VALUES ($1, 'Expiration', ':=', $2)`,
        [username, dateStr],
      );
    }

    // 4. Calling-Station-Id (MAC address restriction) in radcheck
    await query(`DELETE FROM radcheck WHERE username = $1 AND attribute = 'Calling-Station-Id'`, [username]);
    if (opts.macAddress) {
      await query(
        `INSERT INTO radcheck (username, attribute, op, value)
         VALUES ($1, 'Calling-Station-Id', '==', $2)`,
        [username, opts.macAddress],
      );
    }

    // 5. Static IP in radreply
    await query(`DELETE FROM radreply WHERE username = $1 AND attribute = 'Framed-IP-Address'`, [username]);
    if (opts.staticIp) {
      await query(
        `INSERT INTO radreply (username, attribute, op, value)
         VALUES ($1, 'Framed-IP-Address', '=', $2)`,
        [username, opts.staticIp],
      );
    }

    // 6. Package mapping in radusergroup
    await query('DELETE FROM radusergroup WHERE username = $1', [username]);
    if (opts.packageId) {
      const pkg = await query<{ name: string }>('SELECT name FROM packages WHERE id = $1', [opts.packageId]);
      if (pkg.rows.length) {
        await query(
          `INSERT INTO radusergroup (username, groupname, priority)
           VALUES ($1, $2, 1)`,
          [username, pkg.rows[0].name],
        );
      }
    }
  },

  async countSubscribers(): Promise<number> {
    const { rows } = await query<{ count: string }>('SELECT COUNT(*) FROM subscribers');
    return Number(rows[0]?.count ?? 0);
  },

  async countOnline(): Promise<number> {
    const { rows } = await query<{ count: string }>(
      `SELECT COUNT(DISTINCT lower(username)) FROM radacct WHERE acctstoptime IS NULL`,
    );
    return Number(rows[0]?.count ?? 0);
  },
};

function formatRadiusDate(d: Date): string {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const day = String(d.getDate()).padStart(2, '0');
  const month = months[d.getMonth()];
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const seconds = String(d.getSeconds()).padStart(2, '0');
  return `${day} ${month} ${year} ${hours}:${minutes}:${seconds}`;
}
