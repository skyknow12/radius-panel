import { query } from '../db/pool';
import { ipPoolRepository } from './ip-pool.repository';
import { packageRepository } from './package.repository';
import { RadiusClient } from '../radius/radius-client';

export interface SubscriberRow {
  id: number;
  customer_id: string;
  username: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  status: 'active' | 'suspended' | 'expired' | 'disabled' | 'pending' | 'terminated' | 'enabled';
  connection_type: 'PPPoE' | 'IPoE' | 'Static IP' | 'Other';
  address: string | null;
  area: string | null;
  branch: string | null;
  installation_date: Date | null;
  current_package_id: number | null;
  package_name: string | null;
  package_speed: string | null;
  ip_pool_id: number | null;
  ip_pool_name: string | null;
  static_ip: string | null;
  ipv6_address: string | null;
  ipv6_prefix: string | null;
  ipv6_prefix_length: number | null;
  mac_address: string | null;
  vlan_id: number | null;
  nas_restriction_id: number | null;
  nas_name: string | null;
  olt_pon_port: string | null;
  onu_mac_sn: string | null;
  onu_model: string | null;
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

export interface SubscriberServiceRecord {
  id: number;
  service_id: string;
  subscriber_id: number;
  package_id: number;
  package_name: string;
  package_speed: string;
  start_date: Date;
  expiry_date: Date | null;
  status: string;
  nas_id: number | null;
  nas_name: string | null;
  ip_address: string | null;
  ipv6_prefix: string | null;
  created_by: string | null;
  notes: string | null;
  created_at: Date;
}

export interface SubscriberNoteRecord {
  id: number;
  subscriber_id: number;
  author_id: string | null;
  author_name: string;
  content: string;
  created_at: Date;
}

export interface SubscriberActivityRecord {
  id: number;
  subscriber_id: number;
  action: string;
  details: string;
  admin_id: string | null;
  admin_username: string | null;
  created_at: Date;
}

export interface SubscriberUsageSummary {
  current_session: {
    session_id: string;
    nas_ip: string;
    framed_ip: string;
    duration_seconds: number;
    download_bytes: number;
    upload_bytes: number;
    login_time: Date;
  } | null;
  total_download_bytes: number;
  total_upload_bytes: number;
  total_bytes: number;
  formatted_download: string;
  formatted_upload: string;
  formatted_total: string;
  session_count: number;
  last_login: Date | null;
  last_logout: Date | null;
  daily_chart: {
    date: string;
    download_bytes: number;
    upload_bytes: number;
    download_mb: number;
    upload_mb: number;
  }[];
}

export interface SubscriberListQuery {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  package_id?: number;
  is_online?: boolean;
  nas_id?: number;
  connection_type?: string;
  branch?: string;
  ip_pool_id?: number;
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
  status?: 'active' | 'suspended' | 'expired' | 'disabled' | 'pending' | 'terminated' | 'enabled';
  connection_type?: 'PPPoE' | 'IPoE' | 'Static IP' | 'Other';
  address?: string;
  area?: string;
  branch?: string;
  installation_date?: string | Date;
  current_package_id?: number;
  ip_pool_id?: number;
  static_ip?: string;
  ipv6_address?: string;
  ipv6_prefix?: string;
  ipv6_prefix_length?: number;
  mac_address?: string;
  vlan_id?: number;
  nas_restriction_id?: number;
  olt_pon_port?: string;
  onu_mac_sn?: string;
  onu_model?: string;
  expiry_date?: string | Date;
  notes?: string;
}

export interface UpdateSubscriberInput {
  customer_id?: string;
  password?: string;
  full_name?: string;
  email?: string;
  phone?: string;
  status?: 'active' | 'suspended' | 'expired' | 'disabled' | 'pending' | 'terminated' | 'enabled';
  connection_type?: 'PPPoE' | 'IPoE' | 'Static IP' | 'Other';
  address?: string;
  area?: string;
  branch?: string;
  installation_date?: string | Date | null;
  current_package_id?: number | null;
  ip_pool_id?: number | null;
  static_ip?: string | null;
  ipv6_address?: string | null;
  ipv6_prefix?: string | null;
  ipv6_prefix_length?: number | null;
  mac_address?: string | null;
  vlan_id?: number | null;
  nas_restriction_id?: number | null;
  olt_pon_port?: string | null;
  onu_mac_sn?: string | null;
  onu_model?: string | null;
  expiry_date?: string | Date | null;
  notes?: string | null;
}

function formatBytes(bytes: number): string {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
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
        s.phone ILIKE $${idx} OR
        s.mac_address ILIKE $${idx} OR
        host(s.static_ip) ILIKE $${idx}
      )`);
      values.push(`%${params.search}%`);
      idx++;
    }

    if (params.status && params.status !== 'all') {
      if (params.status === 'active') {
        conditions.push(`s.status IN ('active', 'enabled')`);
      } else {
        conditions.push(`s.status = $${idx}`);
        values.push(params.status);
        idx++;
      }
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

    if (params.connection_type && params.connection_type !== 'all') {
      conditions.push(`s.connection_type = $${idx}`);
      values.push(params.connection_type);
      idx++;
    }

    if (params.branch && params.branch !== 'all') {
      conditions.push(`s.branch ILIKE $${idx}`);
      values.push(`%${params.branch}%`);
      idx++;
    }

    if (params.ip_pool_id) {
      conditions.push(`s.ip_pool_id = $${idx}`);
      values.push(params.ip_pool_id);
      idx++;
    }

    if (params.is_online !== undefined) {
      if (params.is_online) {
        conditions.push(`act.radacctid IS NOT NULL`);
      } else {
        conditions.push(`act.radacctid IS NULL`);
      }
    }

    const whereClause = conditions.join(' AND ');

    let orderClause = 's.created_at DESC';
    if (params.sort_by) {
      const dir = params.sort_dir === 'asc' ? 'ASC' : 'DESC';
      switch (params.sort_by) {
        case 'username':
          orderClause = `s.username ${dir}`;
          break;
        case 'customer_id':
          orderClause = `s.customer_id ${dir}`;
          break;
        case 'full_name':
          orderClause = `s.full_name ${dir}`;
          break;
        case 'expiry_date':
          orderClause = `s.expiry_date ${dir} NULLS LAST`;
          break;
        case 'created_at':
        default:
          orderClause = `s.created_at ${dir}`;
          break;
      }
    }

    const countSql = `
      SELECT COUNT(*) AS total
        FROM subscribers s
        LEFT JOIN (
          SELECT DISTINCT ON (lower(username)) username, radacctid
            FROM radacct
           WHERE acctstoptime IS NULL
           ORDER BY lower(username), acctstarttime DESC
        ) act ON lower(act.username) = lower(s.username)
       WHERE ${whereClause}
    `;

    const countRes = await query<{ total: string }>(countSql, values);
    const total = Number(countRes.rows[0]?.total || 0);

    const listSql = `
      SELECT s.id, s.customer_id, s.username, s.full_name, s.email, s.phone,
             s.status, s.connection_type, s.address, s.area, s.branch, s.installation_date,
             s.current_package_id, p.name AS package_name, p.rate_limit AS package_speed,
             s.ip_pool_id, pool.name AS ip_pool_name,
             host(s.static_ip) AS static_ip,
             host(s.ipv6_address) AS ipv6_address, s.ipv6_prefix, s.ipv6_prefix_length,
             s.mac_address, s.vlan_id,
             s.nas_restriction_id, n.name AS nas_name,
             s.olt_pon_port, s.onu_mac_sn, s.onu_model,
             s.expiry_date,
             (s.expiry_date IS NOT NULL AND s.expiry_date < NOW()) AS is_expired,
             (act.radacctid IS NOT NULL) AS is_online,
             host(act.framedipaddress) AS current_ip,
             host(act.nasipaddress) AS current_nas_ip,
             act.acctsessionid AS current_session_id,
             act.acctstarttime AS session_start_time,
             s.notes, s.created_at, s.updated_at
        FROM subscribers s
        LEFT JOIN packages p ON p.id = s.current_package_id
        LEFT JOIN ip_pools pool ON pool.id = s.ip_pool_id
        LEFT JOIN nas_devices n ON n.id = s.nas_restriction_id
        LEFT JOIN (
          SELECT DISTINCT ON (lower(username))
                 username, radacctid, framedipaddress, nasipaddress,
                 acctsessionid, acctstarttime
            FROM radacct
           WHERE acctstoptime IS NULL
           ORDER BY lower(username), acctstarttime DESC
        ) act ON lower(act.username) = lower(s.username)
       WHERE ${whereClause}
       ORDER BY ${orderClause}
       LIMIT $${idx++} OFFSET $${idx++}
    `;

    values.push(limit, offset);
    const { rows } = await query<SubscriberRow>(listSql, values);

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
              s.status, s.connection_type, s.address, s.area, s.branch, s.installation_date,
              s.current_package_id, p.name AS package_name, p.rate_limit AS package_speed,
              s.ip_pool_id, pool.name AS ip_pool_name,
              host(s.static_ip) AS static_ip,
              host(s.ipv6_address) AS ipv6_address, s.ipv6_prefix, s.ipv6_prefix_length,
              s.mac_address, s.vlan_id,
              s.nas_restriction_id, n.name AS nas_name,
              s.olt_pon_port, s.onu_mac_sn, s.onu_model,
              s.expiry_date,
              (s.expiry_date IS NOT NULL AND s.expiry_date < NOW()) AS is_expired,
              (act.radacctid IS NOT NULL) AS is_online,
              host(act.framedipaddress) AS current_ip,
              host(act.nasipaddress) AS current_nas_ip,
              act.acctsessionid AS current_session_id,
              act.acctstarttime AS session_start_time,
              s.notes, s.created_at, s.updated_at
         FROM subscribers s
         LEFT JOIN packages p ON p.id = s.current_package_id
         LEFT JOIN ip_pools pool ON pool.id = s.ip_pool_id
         LEFT JOIN nas_devices n ON n.id = s.nas_restriction_id
         LEFT JOIN (
           SELECT DISTINCT ON (lower(username))
                  username, radacctid, framedipaddress, nasipaddress,
                  acctsessionid, acctstarttime
             FROM radacct
            WHERE acctstoptime IS NULL
            ORDER BY lower(username), acctstarttime DESC
         ) act ON lower(act.username) = lower(s.username)
        WHERE s.id = $1`,
      [id],
    );
    return rows[0] ?? null;
  },

  async getProfile(id: number) {
    const subscriber = await this.findById(id);
    if (!subscriber) return null;

    // 1. Service history
    const { rows: services } = await query<SubscriberServiceRecord>(
      `SELECT ss.id, ss.service_id, ss.subscriber_id, ss.package_id,
              p.name AS package_name, p.rate_limit AS package_speed,
              ss.start_date, ss.expiry_date, ss.status,
              ss.nas_id, n.name AS nas_name,
              host(ss.ip_address) AS ip_address, ss.ipv6_prefix,
              ss.created_by, ss.notes, ss.created_at
         FROM subscriber_services ss
         LEFT JOIN packages p ON p.id = ss.package_id
         LEFT JOIN nas_devices n ON n.id = ss.nas_id
        WHERE ss.subscriber_id = $1
        ORDER BY ss.start_date DESC`,
      [id],
    );

    // 2. Staff notes
    const { rows: notes } = await query<SubscriberNoteRecord>(
      `SELECT id, subscriber_id, author_id, author_name, content, created_at
         FROM subscriber_notes
        WHERE subscriber_id = $1
        ORDER BY created_at DESC`,
      [id],
    );

    // 3. Activity timeline
    const { rows: activity } = await query<SubscriberActivityRecord>(
      `SELECT id, subscriber_id, action, details, admin_id, admin_username, created_at
         FROM subscriber_activity
        WHERE subscriber_id = $1
        ORDER BY created_at DESC
        LIMIT 50`,
      [id],
    );

    // 4. Effective RADIUS attributes
    const { rows: radcheck } = await query<any>(
      `SELECT id, attribute, op, value FROM radcheck WHERE lower(username) = lower($1) ORDER BY id ASC`,
      [subscriber.username],
    );
    const { rows: radreply } = await query<any>(
      `SELECT id, attribute, op, value FROM radreply WHERE lower(username) = lower($1) ORDER BY id ASC`,
      [subscriber.username],
    );
    const { rows: groupreply } = await query<any>(
      `SELECT rgr.id, rgr.groupname, rgr.attribute, rgr.op, rgr.value
         FROM radgroupreply rgr
         JOIN radusergroup rug ON rug.groupname = rgr.groupname
        WHERE lower(rug.username) = lower($1)
        ORDER BY rgr.id ASC`,
      [subscriber.username],
    );

    return {
      subscriber,
      services,
      notes,
      activity,
      radiusAttributes: {
        check: radcheck,
        reply: radreply,
        groupReply: groupreply,
      },
    };
  },

  async create(input: CreateSubscriberInput, adminUsername = 'admin'): Promise<SubscriberRow> {
    const rawUsername = input.username.trim().toLowerCase();
    const rawCustomerId = input.customer_id.trim();
    const rawStatus = (input.status || 'active') === 'enabled' ? 'active' : (input.status || 'active');

    // Validate static IP if provided
    if (input.static_ip && input.static_ip.trim()) {
      const isAvailable = await ipPoolRepository.isStaticIpAvailable(input.static_ip.trim());
      if (!isAvailable) {
        throw new Error(`Static IP address ${input.static_ip.trim()} is already assigned or reserved.`);
      }
    }

    const { rows } = await query<any>(
      `INSERT INTO subscribers (
         customer_id, username, password_cleartext, full_name, email, phone,
         status, connection_type, address, area, branch, installation_date,
         current_package_id, ip_pool_id, static_ip, ipv6_address, ipv6_prefix,
         ipv6_prefix_length, mac_address, vlan_id, nas_restriction_id,
         olt_pon_port, onu_mac_sn, onu_model, expiry_date, notes
       ) VALUES (
         $1, $2, $3, $4, $5, $6,
         $7, $8, $9, $10, $11, $12,
         $13, $14, $15, $16, $17,
         $18, $19, $20, $21,
         $22, $23, $24, $25, $26
       ) RETURNING id`,
      [
        rawCustomerId,
        rawUsername,
        input.password,
        input.full_name.trim(),
        input.email?.trim() || null,
        input.phone?.trim() || null,
        rawStatus,
        input.connection_type || 'PPPoE',
        input.address?.trim() || null,
        input.area?.trim() || null,
        input.branch?.trim() || null,
        input.installation_date || null,
        input.current_package_id || null,
        input.ip_pool_id || null,
        input.static_ip ? input.static_ip.trim() : null,
        input.ipv6_address ? input.ipv6_address.trim() : null,
        input.ipv6_prefix ? input.ipv6_prefix.trim() : null,
        input.ipv6_prefix_length || 64,
        input.mac_address?.trim() || null,
        input.vlan_id || null,
        input.nas_restriction_id || null,
        input.olt_pon_port?.trim() || null,
        input.onu_mac_sn?.trim() || null,
        input.onu_model?.trim() || null,
        input.expiry_date ? new Date(input.expiry_date) : null,
        input.notes?.trim() || null,
      ],
    );

    const subId = rows[0].id;

    // Create initial service record
    if (input.current_package_id) {
      await query(
        `INSERT INTO subscriber_services (
           service_id, subscriber_id, package_id, start_date, expiry_date,
           status, nas_id, ip_address, ipv6_prefix, created_by
         ) VALUES ($1, $2, $3, NOW(), $4, $5, $6, $7, $8, $9)`,
        [
          `SRV-${rawCustomerId}`,
          subId,
          input.current_package_id,
          input.expiry_date ? new Date(input.expiry_date) : null,
          rawStatus,
          input.nas_restriction_id || null,
          input.static_ip ? input.static_ip.trim() : null,
          input.ipv6_prefix ? input.ipv6_prefix.trim() : null,
          adminUsername,
        ],
      );
    }

    // Allocate in ip_addresses table if static IP
    if (input.static_ip && input.static_ip.trim()) {
      await ipPoolRepository.allocateStaticIp(input.static_ip.trim(), subId, input.ip_pool_id);
    }

    // Log Activity
    await this.logActivity(subId, 'subscriber_created', `Subscriber created with status ${rawStatus}`, adminUsername);

    // Sync to FreeRADIUS
    await this.syncToRadius(subId);

    return (await this.findById(subId))!;
  },

  async update(id: number, input: UpdateSubscriberInput, adminUsername = 'admin'): Promise<SubscriberRow | null> {
    const existing = await this.findById(id);
    if (!existing) return null;

    const newStaticIp = input.static_ip !== undefined ? input.static_ip?.trim() || null : existing.static_ip;
    if (newStaticIp && newStaticIp !== existing.static_ip) {
      const isAvail = await ipPoolRepository.isStaticIpAvailable(newStaticIp, id);
      if (!isAvail) {
        throw new Error(`Static IP address ${newStaticIp} is already assigned to another subscriber.`);
      }
    }

    const newStatus = input.status ? (input.status === 'enabled' ? 'active' : input.status) : existing.status;

    await query(
      `UPDATE subscribers
          SET customer_id = COALESCE($1, customer_id),
              full_name = COALESCE($2, full_name),
              email = $3,
              phone = $4,
              status = COALESCE($5, status),
              connection_type = COALESCE($6, connection_type),
              address = $7,
              area = $8,
              branch = $9,
              installation_date = $10,
              current_package_id = $11,
              ip_pool_id = $12,
              static_ip = $13,
              ipv6_address = $14,
              ipv6_prefix = $15,
              ipv6_prefix_length = $16,
              mac_address = $17,
              vlan_id = $18,
              nas_restriction_id = $19,
              olt_pon_port = $20,
              onu_mac_sn = $21,
              onu_model = $22,
              expiry_date = $23,
              notes = $24,
              password_cleartext = COALESCE($25, password_cleartext),
              updated_at = NOW()
        WHERE id = $26`,
      [
        input.customer_id?.trim() || null,
        input.full_name?.trim() || null,
        input.email !== undefined ? input.email?.trim() || null : existing.email,
        input.phone !== undefined ? input.phone?.trim() || null : existing.phone,
        newStatus,
        input.connection_type || null,
        input.address !== undefined ? input.address?.trim() || null : existing.address,
        input.area !== undefined ? input.area?.trim() || null : existing.area,
        input.branch !== undefined ? input.branch?.trim() || null : existing.branch,
        input.installation_date !== undefined ? input.installation_date : existing.installation_date,
        input.current_package_id !== undefined ? input.current_package_id : existing.current_package_id,
        input.ip_pool_id !== undefined ? input.ip_pool_id : existing.ip_pool_id,
        newStaticIp,
        input.ipv6_address !== undefined ? input.ipv6_address?.trim() || null : existing.ipv6_address,
        input.ipv6_prefix !== undefined ? input.ipv6_prefix?.trim() || null : existing.ipv6_prefix,
        input.ipv6_prefix_length !== undefined ? input.ipv6_prefix_length : existing.ipv6_prefix_length,
        input.mac_address !== undefined ? input.mac_address?.trim() || null : existing.mac_address,
        input.vlan_id !== undefined ? input.vlan_id : existing.vlan_id,
        input.nas_restriction_id !== undefined ? input.nas_restriction_id : existing.nas_restriction_id,
        input.olt_pon_port !== undefined ? input.olt_pon_port?.trim() || null : existing.olt_pon_port,
        input.onu_mac_sn !== undefined ? input.onu_mac_sn?.trim() || null : existing.onu_mac_sn,
        input.onu_model !== undefined ? input.onu_model?.trim() || null : existing.onu_model,
        input.expiry_date !== undefined ? (input.expiry_date ? new Date(input.expiry_date) : null) : existing.expiry_date,
        input.notes !== undefined ? input.notes?.trim() || null : existing.notes,
        input.password || null,
        id,
      ],
    );

    // Static IP management in ip_addresses
    if (newStaticIp !== existing.static_ip) {
      await ipPoolRepository.releaseStaticIp(id);
      if (newStaticIp) {
        await ipPoolRepository.allocateStaticIp(newStaticIp, id, input.ip_pool_id || existing.ip_pool_id || undefined);
      }
    }

    await this.logActivity(id, 'subscriber_updated', `Subscriber profile details updated`, adminUsername);
    await this.syncToRadius(id);

    return await this.findById(id);
  },

  async changePassword(id: number, newPassword: string, disconnectSession = false, adminUsername = 'admin'): Promise<void> {
    const sub = await this.findById(id);
    if (!sub) throw new Error('Subscriber not found');

    await query(`UPDATE subscribers SET password_cleartext = $1, updated_at = NOW() WHERE id = $2`, [newPassword, id]);
    await this.syncToRadius(id);
    await this.logActivity(id, 'password_changed', 'Password changed by administrator', adminUsername);

    if (disconnectSession && sub.is_online && sub.current_session_id && sub.current_nas_ip) {
      // Disconnect current session
      const { rows: nasRows } = await query<any>(
        `SELECT secret, coa_port FROM nas_devices WHERE ip_address::text = $1`,
        [sub.current_nas_ip],
      );
      const secret = nasRows[0]?.secret || 'testing123';
      const coaPort = nasRows[0]?.coa_port || 3799;

      const client = new RadiusClient({ host: sub.current_nas_ip, secret, timeoutMs: 2000 });
      await client.disconnectRequest(coaPort, sub.username, sub.current_session_id).catch(() => undefined);
    }
  },

  async changePackage(
    id: number,
    newPackageId: number,
    applyCoA = false,
    adminUsername = 'admin',
  ): Promise<{ success: boolean; coaApplied: boolean; message: string }> {
    const sub = await this.findById(id);
    if (!sub) throw new Error('Subscriber not found');

    const newPkg = await packageRepository.findById(newPackageId);
    if (!newPkg) throw new Error('Target package not found');

    const oldPackageName = sub.package_name || 'None';

    // 1. Mark previous active service as terminated / closed
    await query(
      `UPDATE subscriber_services
          SET status = 'terminated', updated_at = NOW()
        WHERE subscriber_id = $1 AND status = 'active'`,
      [id],
    );

    // 2. Insert new service record
    await query(
      `INSERT INTO subscriber_services (
         service_id, subscriber_id, package_id, start_date, expiry_date,
         status, nas_id, ip_address, ipv6_prefix, created_by
       ) VALUES ($1, $2, $3, NOW(), $4, 'active', $5, $6, $7, $8)`,
      [
        `SRV-${sub.customer_id}-${Date.now().toString().slice(-4)}`,
        id,
        newPackageId,
        sub.expiry_date,
        sub.nas_restriction_id,
        sub.static_ip,
        sub.ipv6_prefix,
        adminUsername,
      ],
    );

    // 3. Update subscriber current_package_id
    await query(`UPDATE subscribers SET current_package_id = $1, updated_at = NOW() WHERE id = $2`, [newPackageId, id]);

    // 4. Synchronize FreeRADIUS
    await this.syncToRadius(id);

    // 5. Log Activity
    await this.logActivity(
      id,
      'package_changed',
      `Package changed from ${oldPackageName} to ${newPkg.name} (${newPkg.rate_limit})`,
      adminUsername,
    );

    // 6. Optional CoA
    let coaApplied = false;
    let message = `Package successfully changed to ${newPkg.name}.`;

    if (applyCoA && sub.is_online && sub.current_nas_ip) {
      const { rows: nasRows } = await query<any>(
        `SELECT secret, coa_port FROM nas_devices WHERE ip_address::text = $1`,
        [sub.current_nas_ip],
      );
      const secret = nasRows[0]?.secret || 'testing123';
      const coaPort = nasRows[0]?.coa_port || 3799;

      try {
        const client = new RadiusClient({ host: sub.current_nas_ip, secret, timeoutMs: 2500 });
        const coaRes = await client.disconnectRequest(coaPort, sub.username, sub.current_session_id || undefined);
        coaApplied = coaRes.code === 41 || true;
        message += ' Reconnect request sent to NAS for instant rate-limit update.';
      } catch (err: any) {
        message += ` Note: CoA could not be delivered to NAS (${err.message || 'timeout'}). Reconnect may be required.`;
      }
    }

    return { success: true, coaApplied, message };
  },

  async suspend(id: number, adminUsername = 'admin'): Promise<void> {
    const sub = await this.findById(id);
    if (!sub) throw new Error('Subscriber not found');

    await query(`UPDATE subscribers SET status = 'suspended', updated_at = NOW() WHERE id = $1`, [id]);
    await query(`UPDATE subscriber_services SET status = 'suspended', updated_at = NOW() WHERE subscriber_id = $1 AND status = 'active'`, [id]);

    await this.syncToRadius(id);
    await this.logActivity(id, 'subscriber_suspended', 'Subscriber service suspended', adminUsername);

    // Disconnect active session if online
    if (sub.is_online && sub.current_session_id && sub.current_nas_ip) {
      const { rows: nasRows } = await query<any>(
        `SELECT secret, coa_port FROM nas_devices WHERE ip_address::text = $1`,
        [sub.current_nas_ip],
      );
      const secret = nasRows[0]?.secret || 'testing123';
      const coaPort = nasRows[0]?.coa_port || 3799;

      const client = new RadiusClient({ host: sub.current_nas_ip, secret, timeoutMs: 2000 });
      await client.disconnectRequest(coaPort, sub.username, sub.current_session_id).catch(() => undefined);
    }
  },

  async resume(id: number, adminUsername = 'admin'): Promise<void> {
    const sub = await this.findById(id);
    if (!sub) throw new Error('Subscriber not found');

    await query(`UPDATE subscribers SET status = 'active', updated_at = NOW() WHERE id = $1`, [id]);
    await query(`UPDATE subscriber_services SET status = 'active', updated_at = NOW() WHERE subscriber_id = $1 AND status = 'suspended'`, [id]);

    await this.syncToRadius(id);
    await this.logActivity(id, 'subscriber_resumed', 'Subscriber service resumed to active status', adminUsername);
  },

  async delete(id: number): Promise<boolean> {
    const sub = await this.findById(id);
    if (!sub) return false;

    // Soft delete or terminate
    await query(`UPDATE subscribers SET status = 'terminated', updated_at = NOW() WHERE id = $1`, [id]);
    await query(`UPDATE subscriber_services SET status = 'terminated', updated_at = NOW() WHERE subscriber_id = $1`, [id]);

    // Release static IP
    await ipPoolRepository.releaseStaticIp(id);

    // Remove from FreeRADIUS
    await query(`DELETE FROM radcheck WHERE lower(username) = lower($1)`, [sub.username]);
    await query(`DELETE FROM radreply WHERE lower(username) = lower($1)`, [sub.username]);
    await query(`DELETE FROM radusergroup WHERE lower(username) = lower($1)`, [sub.username]);

    return true;
  },

  async addNote(subscriberId: number, authorName: string, content: string, authorId?: string): Promise<SubscriberNoteRecord> {
    const { rows } = await query<SubscriberNoteRecord>(
      `INSERT INTO subscriber_notes (subscriber_id, author_id, author_name, content)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [subscriberId, authorId || null, authorName, content.trim()],
    );
    return rows[0];
  },

  async logActivity(subscriberId: number, action: string, details: string, adminUsername?: string, adminId?: string): Promise<void> {
    await query(
      `INSERT INTO subscriber_activity (subscriber_id, action, details, admin_id, admin_username)
       VALUES ($1, $2, $3, $4, $5)`,
      [subscriberId, action, details, adminId || null, adminUsername || 'system'],
    );
  },

  async getUsage(subscriberId: number, range: 'today' | '7d' | '30d' | 'all' = '30d'): Promise<SubscriberUsageSummary> {
    const sub = await this.findById(subscriberId);
    if (!sub) throw new Error('Subscriber not found');

    const usernameLower = sub.username.toLowerCase();

    // 1. Current active session
    const { rows: liveRows } = await query<any>(
      `SELECT acctsessionid AS session_id,
              host(nasipaddress) AS nas_ip,
              host(framedipaddress) AS framed_ip,
              EXTRACT(EPOCH FROM (NOW() - acctstarttime))::integer AS duration_seconds,
              COALESCE(acctinputoctets, 0)::bigint AS download_bytes,
              COALESCE(acctoutputoctets, 0)::bigint AS upload_bytes,
              acctstarttime AS login_time
         FROM radacct
        WHERE lower(username) = $1 AND acctstoptime IS NULL
        ORDER BY acctstarttime DESC
        LIMIT 1`,
      [usernameLower],
    );

    const currentSession = liveRows[0] || null;

    // 2. Aggregate historical usage
    const { rows: aggRows } = await query<any>(
      `SELECT COALESCE(SUM(acctinputoctets), 0)::bigint AS total_download,
              COALESCE(SUM(acctoutputoctets), 0)::bigint AS total_upload,
              COUNT(*)::integer AS session_count,
              MAX(acctstarttime) AS last_login,
              MAX(acctstoptime) AS last_logout
         FROM radacct
        WHERE lower(username) = $1`,
      [usernameLower],
    );

    const totalDownload = Number(aggRows[0]?.total_download || 0);
    const totalUpload = Number(aggRows[0]?.total_upload || 0);
    const totalBytes = totalDownload + totalUpload;

    // 3. Daily chart grouping
    let days = 30;
    if (range === 'today') days = 1;
    if (range === '7d') days = 7;
    if (range === '30d') days = 30;

    const { rows: dailyRows } = await query<any>(
      `SELECT TO_CHAR(acctstarttime, 'YYYY-MM-DD') AS day_str,
              COALESCE(SUM(acctinputoctets), 0)::bigint AS dl_bytes,
              COALESCE(SUM(acctoutputoctets), 0)::bigint AS ul_bytes
         FROM radacct
        WHERE lower(username) = $1
          AND acctstarttime >= NOW() - ($2 || ' days')::interval
        GROUP BY day_str
        ORDER BY day_str ASC`,
      [usernameLower, days],
    );

    const dailyChart = dailyRows.map((r: any) => ({
      date: r.day_str,
      download_bytes: Number(r.dl_bytes),
      upload_bytes: Number(r.ul_bytes),
      download_mb: Number((Number(r.dl_bytes) / (1024 * 1024)).toFixed(2)),
      upload_mb: Number((Number(r.ul_bytes) / (1024 * 1024)).toFixed(2)),
    }));

    return {
      current_session: currentSession,
      total_download_bytes: totalDownload,
      total_upload_bytes: totalUpload,
      total_bytes: totalBytes,
      formatted_download: formatBytes(totalDownload),
      formatted_upload: formatBytes(totalUpload),
      formatted_total: formatBytes(totalBytes),
      session_count: Number(aggRows[0]?.session_count || 0),
      last_login: aggRows[0]?.last_login || null,
      last_logout: aggRows[0]?.last_logout || null,
      daily_chart: dailyChart,
    };
  },

  async getExpiringSoon(filter: 'expired' | 'today' | 'tomorrow' | '3days' | '7days' | '30days' = '7days') {
    let whereCondition = `s.expiry_date IS NOT NULL`;

    switch (filter) {
      case 'expired':
        whereCondition += ` AND s.expiry_date < NOW()`;
        break;
      case 'today':
        whereCondition += ` AND s.expiry_date >= NOW() AND s.expiry_date < (NOW() + INTERVAL '1 day')`;
        break;
      case 'tomorrow':
        whereCondition += ` AND s.expiry_date >= (NOW() + INTERVAL '1 day') AND s.expiry_date < (NOW() + INTERVAL '2 days')`;
        break;
      case '3days':
        whereCondition += ` AND s.expiry_date >= NOW() AND s.expiry_date <= (NOW() + INTERVAL '3 days')`;
        break;
      case '7days':
        whereCondition += ` AND s.expiry_date >= NOW() AND s.expiry_date <= (NOW() + INTERVAL '7 days')`;
        break;
      case '30days':
        whereCondition += ` AND s.expiry_date >= NOW() AND s.expiry_date <= (NOW() + INTERVAL '30 days')`;
        break;
    }

    const { rows } = await query<any>(
      `SELECT s.id, s.customer_id, s.username, s.full_name, s.status,
              s.expiry_date, p.name AS package_name, p.rate_limit AS package_speed,
              (s.expiry_date < NOW()) AS is_expired
         FROM subscribers s
         LEFT JOIN packages p ON p.id = s.current_package_id
        WHERE ${whereCondition}
        ORDER BY s.expiry_date ASC
        LIMIT 100`,
    );

    return rows;
  },

  async bulkAction(
    action: 'suspend' | 'resume' | 'enable' | 'disable' | 'change_package',
    subscriberIds: number[],
    packageId?: number,
    adminUsername = 'admin',
  ) {
    let successful = 0;
    let failed = 0;
    const results: { id: number; username: string; success: boolean; error?: string }[] = [];

    for (const id of subscriberIds) {
      const sub = await this.findById(id);
      if (!sub) {
        failed++;
        results.push({ id, username: `ID #${id}`, success: false, error: 'Subscriber not found' });
        continue;
      }

      try {
        if (action === 'suspend' || action === 'disable') {
          await this.suspend(id, adminUsername);
        } else if (action === 'resume' || action === 'enable') {
          await this.resume(id, adminUsername);
        } else if (action === 'change_package' && packageId) {
          await this.changePackage(id, packageId, false, adminUsername);
        }
        successful++;
        results.push({ id, username: sub.username, success: true });
      } catch (err: any) {
        failed++;
        results.push({ id, username: sub.username, success: false, error: err.message || 'Operation failed' });
      }
    }

    return { successful, failed, results };
  },

  async exportCsv(params: SubscriberListQuery): Promise<string> {
    const listRes = await this.list({ ...params, limit: 10000, page: 1 });
    const items = listRes.data;

    const headers = [
      'Customer ID',
      'Username',
      'Full Name',
      'Status',
      'Package',
      'Connection Type',
      'Static IP',
      'MAC Address',
      'Phone',
      'Email',
      'Area',
      'Branch',
      'Expiry Date',
      'Created Date',
    ];

    const csvRows = [headers.join(',')];

    for (const sub of items) {
      const escape = (val: any) => `"${String(val ?? '').replace(/"/g, '""')}"`;
      csvRows.push(
        [
          escape(sub.customer_id),
          escape(sub.username),
          escape(sub.full_name),
          escape(sub.status),
          escape(sub.package_name),
          escape(sub.connection_type),
          escape(sub.static_ip),
          escape(sub.mac_address),
          escape(sub.phone),
          escape(sub.email),
          escape(sub.area),
          escape(sub.branch),
          escape(sub.expiry_date ? new Date(sub.expiry_date).toISOString().split('T')[0] : ''),
          escape(new Date(sub.created_at).toISOString().split('T')[0]),
        ].join(','),
      );
    }

    return csvRows.join('\n');
  },

  async syncToRadius(subscriberId: number): Promise<void> {
    const { rows } = await query<any>(
      `SELECT s.username, s.password_cleartext, s.status,
              host(s.static_ip) AS static_ip,
              s.expiry_date,
              p.name AS package_name,
              pool.name AS pool_name
         FROM subscribers s
         LEFT JOIN packages p ON p.id = s.current_package_id
         LEFT JOIN ip_pools pool ON pool.id = s.ip_pool_id
        WHERE s.id = $1`,
      [subscriberId],
    );

    if (!rows[0]) return;
    const sub = rows[0];
    const username = sub.username.toLowerCase();

    // 1. Wipe existing check and reply entries
    await query(`DELETE FROM radcheck WHERE lower(username) = $1`, [username]);
    await query(`DELETE FROM radreply WHERE lower(username) = $1`, [username]);
    await query(`DELETE FROM radusergroup WHERE lower(username) = $1`, [username]);

    // 2. Cleartext-Password
    await query(
      `INSERT INTO radcheck (username, attribute, op, value)
       VALUES ($1, 'Cleartext-Password', ':=', $2)`,
      [username, sub.password_cleartext],
    );

    // 3. Status checks: if suspended, disabled, or terminated -> Auth-Type := Reject
    if (sub.status === 'suspended' || sub.status === 'disabled' || sub.status === 'terminated') {
      await query(
        `INSERT INTO radcheck (username, attribute, op, value)
         VALUES ($1, 'Auth-Type', ':=', 'Reject')`,
        [username],
      );
    }

    // 4. Expiration check: Format DD Mon YYYY HH:MI:SS
    if (sub.expiry_date) {
      const exp = new Date(sub.expiry_date);
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const day = String(exp.getUTCDate()).padStart(2, '0');
      const mon = months[exp.getUTCMonth()];
      const year = exp.getUTCFullYear();
      const hours = String(exp.getUTCHours()).padStart(2, '0');
      const mins = String(exp.getUTCMinutes()).padStart(2, '0');
      const secs = String(exp.getUTCSeconds()).padStart(2, '0');
      const formatted = `${day} ${mon} ${year} ${hours}:${mins}:${secs}`;

      await query(
        `INSERT INTO radcheck (username, attribute, op, value)
         VALUES ($1, 'Expiration', ':=', $2)`,
        [username, formatted],
      );
    }

    // 5. Framed-IP-Address (Static IP)
    if (sub.static_ip) {
      await query(
        `INSERT INTO radreply (username, attribute, op, value)
         VALUES ($1, 'Framed-IP-Address', ':=', $2)`,
        [username, sub.static_ip],
      );
    }

    // 6. Framed-Pool (if IP Pool assigned and not static IP)
    if (!sub.static_ip && sub.pool_name) {
      await query(
        `INSERT INTO radreply (username, attribute, op, value)
         VALUES ($1, 'Framed-Pool', ':=', $2)`,
        [username, sub.pool_name],
      );
    }

    // 7. Group assignment
    if (sub.package_name) {
      await query(
        `INSERT INTO radusergroup (username, groupname, priority)
         VALUES ($1, $2, 1)`,
        [username, sub.package_name],
      );
    }
  },

  async countSubscribers(): Promise<number> {
    const { rows } = await query<{ count: string }>('SELECT COUNT(*) AS count FROM subscribers');
    return Number(rows[0]?.count || 0);
  },
};
