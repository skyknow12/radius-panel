import { query } from '../db/pool';
import { HttpError } from '../lib/http-error';
import { isBranchUser } from '../lib/access-control';
import type { AuthSession } from '../services/auth.service';
import { encryptSecret, decryptSecret, maskSecret, sanitizeLogOutput } from '../lib/crypto';
import { modelDetectionService } from '../services/onu/model-detection.service';

export interface OltItem {
  id: number;
  name: string;
  description?: string | null;
  vendor: string;
  model: string;
  hardware_version?: string;
  software_version?: string;
  patch_version?: string;
  management_ip: string;
  management_port: number;
  branch_id?: number | null;
  branch_name?: string | null;
  organization_id?: number | null;
  snmp_enabled: boolean;
  snmp_version: string;
  snmp_port: number;
  snmp_community_masked?: string;
  snmp_write_community_masked?: string;
  snmp_timeout_ms: number;
  snmp_retries: number;
  cli_protocol: 'telnet' | 'ssh';
  cli_username: string;
  cli_password_masked: string;
  connection_timeout: number;
  polling_interval: number;
  enabled: boolean;
  connection_status: 'online' | 'offline' | 'error' | 'unknown';
  last_seen_at?: string | null;
  last_sync_at?: string | null;
  last_error?: string | null;
  last_poll_at?: string | null;
  last_poll_status?: 'success' | 'error' | 'timeout' | 'unknown' | null;
  last_poll_error?: string | null;
  next_poll_at?: string | null;
  sys_uptime?: string | null;
  sys_descr?: string | null;
  sys_name?: string | null;
  sys_location?: string | null;
  sys_contact?: string | null;
  cpu_utilization?: number | null;
  memory_utilization?: number | null;
  temperature?: number | null;
  fans_status?: string | null;
  power_status?: string | null;
  active_alarms_count?: number;
  registered_onus_count?: number;
  online_onus_count?: number;
  optical_warning_threshold: number;
  optical_critical_threshold: number;
  total_onus?: number;
  online_onus?: number;
  offline_onus?: number;
  created_at: string;
  updated_at: string;
}

export interface OnuItem {
  id: number;
  olt_id: number;
  olt_name?: string;
  serial_number: string;
  frame: number;
  slot: number;
  pon_port: number;
  ont_id: number;
  description?: string | null;
  vendor_id?: string | null;
  equipment_id?: string | null;
  model?: string | null;
  mac_address?: string | null;
  control_flag?: string;
  run_state: 'online' | 'offline' | 'missing' | 'unknown';
  config_state: 'initial' | 'normal' | 'failed' | 'unknown';
  match_state: 'match' | 'mismatch' | 'unknown';
  protection_state?: string;
  auth_type?: string;
  management_mode?: string;
  line_profile_id?: number;
  line_profile_name?: string;
  service_profile_id?: number;
  service_profile_name?: string;
  last_up_time?: string | null;
  last_down_time?: string | null;
  last_down_cause?: string | null;
  registration_state: 'registered' | 'unregistered' | 'missing';
  last_rx_power?: number | null;
  last_tx_power?: number | null;
  last_olt_rx_power?: number | null;
  last_optical_reading_at?: string | null;
  customer_id?: number | null;
  customer_username?: string | null;
  customer_name?: string | null;
  created_at: string;
  updated_at: string;
}

export interface OltOperationHistoryItem {
  id: number;
  olt_id: number;
  olt_name?: string;
  operation_type: string;
  operator_id?: string | null;
  operator_username?: string | null;
  sanitized_command_summary: string;
  status: 'started' | 'success' | 'partial_success' | 'failed';
  sanitized_result?: string | null;
  started_at: string;
  completed_at?: string | null;
}

export const oltRepository = {
  /**
   * List OLTs with aggregated ONU stats, branch-scoped
   */
  async listOlts(actor?: AuthSession, filters?: { branch_id?: number; search?: string }): Promise<OltItem[]> {
    const conditions: string[] = ['1=1'];
    const values: any[] = [];
    let idx = 1;

    // Branch scoping
    if (isBranchUser(actor)) {
      conditions.push(`o.branch_id = $${idx}`);
      values.push(actor?.branchId || -1);
      idx++;
    } else if (filters?.branch_id) {
      conditions.push(`o.branch_id = $${idx}`);
      values.push(filters.branch_id);
      idx++;
    }

    if (filters?.search && filters.search.trim()) {
      const q = `%${filters.search.trim()}%`;
      conditions.push(`(o.name ILIKE $${idx} OR host(o.management_ip) ILIKE $${idx} OR o.vendor ILIKE $${idx} OR o.model ILIKE $${idx})`);
      values.push(q);
      idx++;
    }

    const sql = `
      SELECT o.id, o.name, o.description, o.vendor, o.model, o.hardware_version, o.software_version, o.patch_version,
             host(o.management_ip) AS management_ip, o.management_port,
             o.branch_id, b.name AS branch_name, o.organization_id,
             COALESCE(o.snmp_enabled, TRUE) AS snmp_enabled,
             o.snmp_version, o.snmp_port, o.snmp_write_community_encrypted,
             COALESCE(o.snmp_timeout_ms, 3000) AS snmp_timeout_ms,
             COALESCE(o.snmp_retries, 2) AS snmp_retries,
             o.cli_protocol, o.cli_username,
             o.connection_timeout, o.polling_interval, o.enabled,
             o.connection_status, o.last_seen_at, o.last_sync_at, o.last_error,
             o.last_poll_at, o.last_poll_status, o.last_poll_error, o.next_poll_at,
             o.sys_uptime, o.sys_descr, o.sys_name, o.sys_location, o.sys_contact,
             o.cpu_utilization, o.memory_utilization, o.temperature, o.fans_status, o.power_status,
             COALESCE(o.active_alarms_count, 0) AS active_alarms_count,
             COALESCE(o.registered_onus_count, 0) AS registered_onus_count,
             COALESCE(o.online_onus_count, 0) AS online_onus_count,
             o.optical_warning_threshold, o.optical_critical_threshold,
             o.created_at, o.updated_at,
             COALESCE(s.total_onus, 0)::int AS total_onus,
             COALESCE(s.online_onus, 0)::int AS online_onus,
             COALESCE(s.offline_onus, 0)::int AS offline_onus
        FROM olts o
   LEFT JOIN branches b ON b.id = o.branch_id
   LEFT JOIN (
     SELECT olt_id,
            COUNT(*) AS total_onus,
            COUNT(*) FILTER (WHERE run_state = 'online') AS online_onus,
            COUNT(*) FILTER (WHERE run_state = 'offline') AS offline_onus
       FROM onus
      GROUP BY olt_id
   ) s ON s.olt_id = o.id
       WHERE ${conditions.join(' AND ')}
    ORDER BY o.name ASC
    `;

    const { rows } = await query<any>(sql, values);

    return rows.map((r) => ({
      ...r,
      snmp_enabled: r.snmp_enabled ?? true,
      snmp_timeout_ms: Number(r.snmp_timeout_ms || 3000),
      snmp_retries: Number(r.snmp_retries || 2),
      cli_password_masked: maskSecret('saved'),
      snmp_community_masked: maskSecret('saved'),
      snmp_write_community_masked: r.snmp_write_community_encrypted ? maskSecret('saved') : undefined,
      cpu_utilization: r.cpu_utilization !== null ? Number(r.cpu_utilization) : null,
      memory_utilization: r.memory_utilization !== null ? Number(r.memory_utilization) : null,
      temperature: r.temperature !== null ? Number(r.temperature) : null,
      optical_warning_threshold: Number(r.optical_warning_threshold),
      optical_critical_threshold: Number(r.optical_critical_threshold),
      created_at: new Date(r.created_at).toISOString(),
      updated_at: new Date(r.updated_at).toISOString(),
      last_seen_at: r.last_seen_at ? new Date(r.last_seen_at).toISOString() : null,
      last_sync_at: r.last_sync_at ? new Date(r.last_sync_at).toISOString() : null,
      last_poll_at: r.last_poll_at ? new Date(r.last_poll_at).toISOString() : null,
    }));
  },

  /**
   * Find single OLT by ID with branch security check
   */
  async findById(id: number, actor?: AuthSession): Promise<OltItem | null> {
    const { rows } = await query<any>(
      `SELECT o.id, o.name, o.description, o.vendor, o.model, o.hardware_version, o.software_version, o.patch_version,
              host(o.management_ip) AS management_ip, o.management_port,
              o.branch_id, b.name AS branch_name, o.organization_id,
              COALESCE(o.snmp_enabled, TRUE) AS snmp_enabled,
              o.snmp_version, o.snmp_port, o.snmp_write_community_encrypted,
              COALESCE(o.snmp_timeout_ms, 3000) AS snmp_timeout_ms,
              COALESCE(o.snmp_retries, 2) AS snmp_retries,
              o.cli_protocol, o.cli_username,
              o.connection_timeout, o.polling_interval, o.enabled,
              o.connection_status, o.last_seen_at, o.last_sync_at, o.last_error,
              o.last_poll_at, o.last_poll_status, o.last_poll_error, o.next_poll_at,
              o.sys_uptime, o.sys_descr, o.sys_name, o.sys_location, o.sys_contact,
              o.cpu_utilization, o.memory_utilization, o.temperature, o.fans_status, o.power_status,
              COALESCE(o.active_alarms_count, 0) AS active_alarms_count,
              COALESCE(o.registered_onus_count, 0) AS registered_onus_count,
              COALESCE(o.online_onus_count, 0) AS online_onus_count,
              o.optical_warning_threshold, o.optical_critical_threshold,
              o.created_at, o.updated_at,
              COALESCE(s.total_onus, 0)::int AS total_onus,
              COALESCE(s.online_onus, 0)::int AS online_onus,
              COALESCE(s.offline_onus, 0)::int AS offline_onus
         FROM olts o
    LEFT JOIN branches b ON b.id = o.branch_id
    LEFT JOIN (
      SELECT olt_id,
             COUNT(*) AS total_onus,
             COUNT(*) FILTER (WHERE run_state = 'online') AS online_onus,
             COUNT(*) FILTER (WHERE run_state = 'offline') AS offline_onus
        FROM onus
       GROUP BY olt_id
    ) s ON s.olt_id = o.id
        WHERE o.id = $1`,
      [id]
    );

    if (!rows[0]) return null;
    const r = rows[0];

    // Branch authorization check
    if (isBranchUser(actor) && r.branch_id && r.branch_id !== actor?.branchId) {
      throw HttpError.forbidden('Access denied to OLT belonging to another branch');
    }

    return {
      ...r,
      snmp_enabled: r.snmp_enabled ?? true,
      snmp_timeout_ms: Number(r.snmp_timeout_ms || 3000),
      snmp_retries: Number(r.snmp_retries || 2),
      cli_password_masked: maskSecret('saved'),
      snmp_community_masked: maskSecret('saved'),
      snmp_write_community_masked: r.snmp_write_community_encrypted ? maskSecret('saved') : undefined,
      cpu_utilization: r.cpu_utilization !== null ? Number(r.cpu_utilization) : null,
      memory_utilization: r.memory_utilization !== null ? Number(r.memory_utilization) : null,
      temperature: r.temperature !== null ? Number(r.temperature) : null,
      optical_warning_threshold: Number(r.optical_warning_threshold),
      optical_critical_threshold: Number(r.optical_critical_threshold),
      created_at: new Date(r.created_at).toISOString(),
      updated_at: new Date(r.updated_at).toISOString(),
      last_seen_at: r.last_seen_at ? new Date(r.last_seen_at).toISOString() : null,
      last_sync_at: r.last_sync_at ? new Date(r.last_sync_at).toISOString() : null,
      last_poll_at: r.last_poll_at ? new Date(r.last_poll_at).toISOString() : null,
    };
  },

  /**
   * Internal method to retrieve decrypted CLI and SNMP credentials for drivers
   */
  async getDecryptedCredentials(id: number): Promise<{
    host: string;
    port: number;
    protocol: 'telnet' | 'ssh';
    username: string;
    passwordDecrypted: string;
    snmpVersion: string;
    snmpPort: number;
    snmpCommunityDecrypted?: string;
    snmpWriteCommunityDecrypted?: string;
    snmpTimeoutMs: number;
    snmpRetries: number;
    timeoutMs: number;
    branchId?: number | null;
  } | null> {
    const { rows } = await query<any>(
      `SELECT host(management_ip) AS host, management_port AS port, cli_protocol,
              cli_username, cli_password_encrypted,
              snmp_version, snmp_port, snmp_community_encrypted, snmp_write_community_encrypted,
              snmp_timeout_ms, snmp_retries,
              connection_timeout, branch_id
         FROM olts WHERE id = $1`,
      [id]
    );
    if (!rows[0]) return null;
    const r = rows[0];

    return {
      host: r.host,
      port: r.port,
      protocol: r.cli_protocol,
      username: r.cli_username,
      passwordDecrypted: decryptSecret(r.cli_password_encrypted),
      snmpVersion: r.snmp_version || 'v2c',
      snmpPort: r.snmp_port || 161,
      snmpCommunityDecrypted: r.snmp_community_encrypted ? decryptSecret(r.snmp_community_encrypted) : undefined,
      snmpWriteCommunityDecrypted: r.snmp_write_community_encrypted ? decryptSecret(r.snmp_write_community_encrypted) : undefined,
      snmpTimeoutMs: r.snmp_timeout_ms || 3000,
      snmpRetries: r.snmp_retries ?? 2,
      timeoutMs: r.connection_timeout || 8000,
      branchId: r.branch_id,
    };
  },

  /**
   * Create new OLT record
   */
  async createOlt(
    input: {
      name: string;
      description?: string;
      vendor?: string;
      model?: string;
      management_ip: string;
      management_port?: number;
      branch_id?: number | null;
      snmp_enabled?: boolean;
      snmp_version?: string;
      snmp_port?: number;
      snmp_community?: string;
      snmp_write_community?: string;
      snmp_timeout_ms?: number;
      snmp_retries?: number;
      cli_protocol?: 'telnet' | 'ssh';
      cli_username: string;
      cli_password: string;
      connection_timeout?: number;
      polling_interval?: number;
      enabled?: boolean;
      optical_warning_threshold?: number;
      optical_critical_threshold?: number;
    },
    actor?: AuthSession
  ): Promise<number> {
    if (isBranchUser(actor) && input.branch_id && input.branch_id !== actor?.branchId) {
      throw HttpError.forbidden('Branch managers can only create OLTs in their own branch');
    }

    const cliPasswordEnc = encryptSecret(input.cli_password);
    const snmpCommunityEnc = input.snmp_community ? encryptSecret(input.snmp_community) : null;
    const snmpWriteCommunityEnc = input.snmp_write_community ? encryptSecret(input.snmp_write_community) : null;

    const { rows } = await query<{ id: number }>(
      `INSERT INTO olts (
         name, description, vendor, model, management_ip, management_port, branch_id,
         snmp_enabled, snmp_version, snmp_port, snmp_community_encrypted, snmp_write_community_encrypted,
         snmp_timeout_ms, snmp_retries, cli_protocol,
         cli_username, cli_password_encrypted, connection_timeout, polling_interval,
         enabled, optical_warning_threshold, optical_critical_threshold, created_by
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23)
       RETURNING id`,
      [
        input.name.trim(),
        input.description?.trim() || null,
        input.vendor || 'Huawei',
        input.model || 'MA5683T',
        input.management_ip.trim(),
        input.management_port || 23,
        input.branch_id || (isBranchUser(actor) ? actor?.branchId : null),
        input.snmp_enabled ?? true,
        input.snmp_version || 'v2c',
        input.snmp_port || 161,
        snmpCommunityEnc,
        snmpWriteCommunityEnc,
        input.snmp_timeout_ms || 3000,
        input.snmp_retries ?? 2,
        input.cli_protocol || 'telnet',
        input.cli_username.trim(),
        cliPasswordEnc,
        input.connection_timeout || 5000,
        input.polling_interval || 300,
        input.enabled ?? true,
        input.optical_warning_threshold ?? -25.0,
        input.optical_critical_threshold ?? -28.0,
        actor?.userId || null,
      ]
    );

    return rows[0].id;
  },

  /**
   * Update OLT record
   */
  async updateOlt(
    id: number,
    input: Partial<{
      name: string;
      description: string;
      vendor: string;
      model: string;
      management_ip: string;
      management_port: number;
      branch_id: number | null;
      snmp_enabled: boolean;
      snmp_version: string;
      snmp_port: number;
      snmp_community: string;
      snmp_write_community: string;
      snmp_timeout_ms: number;
      snmp_retries: number;
      cli_protocol: 'telnet' | 'ssh';
      cli_username: string;
      cli_password: string;
      connection_timeout: number;
      polling_interval: number;
      enabled: boolean;
      optical_warning_threshold: number;
      optical_critical_threshold: number;
    }>,
    actor?: AuthSession
  ): Promise<void> {
    const existing = await this.findById(id, actor);
    if (!existing) throw HttpError.notFound('OLT not found');

    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (input.name !== undefined) {
      fields.push(`name = $${idx++}`);
      values.push(input.name.trim());
    }
    if (input.description !== undefined) {
      fields.push(`description = $${idx++}`);
      values.push(input.description ? input.description.trim() : null);
    }
    if (input.vendor !== undefined) {
      fields.push(`vendor = $${idx++}`);
      values.push(input.vendor);
    }
    if (input.model !== undefined) {
      fields.push(`model = $${idx++}`);
      values.push(input.model);
    }
    if (input.management_ip !== undefined) {
      fields.push(`management_ip = $${idx++}`);
      values.push(input.management_ip.trim());
    }
    if (input.management_port !== undefined) {
      fields.push(`management_port = $${idx++}`);
      values.push(input.management_port);
    }
    if (input.branch_id !== undefined && !isBranchUser(actor)) {
      fields.push(`branch_id = $${idx++}`);
      values.push(input.branch_id);
    }
    if (input.snmp_enabled !== undefined) {
      fields.push(`snmp_enabled = $${idx++}`);
      values.push(input.snmp_enabled);
    }
    if (input.snmp_version !== undefined) {
      fields.push(`snmp_version = $${idx++}`);
      values.push(input.snmp_version);
    }
    if (input.snmp_port !== undefined) {
      fields.push(`snmp_port = $${idx++}`);
      values.push(input.snmp_port);
    }
    if (input.snmp_community !== undefined && input.snmp_community.trim() && !input.snmp_community.includes('•')) {
      fields.push(`snmp_community_encrypted = $${idx++}`);
      values.push(encryptSecret(input.snmp_community));
    }
    if (input.snmp_write_community !== undefined && input.snmp_write_community.trim() && !input.snmp_write_community.includes('•')) {
      fields.push(`snmp_write_community_encrypted = $${idx++}`);
      values.push(encryptSecret(input.snmp_write_community));
    }
    if (input.snmp_timeout_ms !== undefined) {
      fields.push(`snmp_timeout_ms = $${idx++}`);
      values.push(input.snmp_timeout_ms);
    }
    if (input.snmp_retries !== undefined) {
      fields.push(`snmp_retries = $${idx++}`);
      values.push(input.snmp_retries);
    }
    if (input.cli_protocol !== undefined) {
      fields.push(`cli_protocol = $${idx++}`);
      values.push(input.cli_protocol);
    }
    if (input.cli_username !== undefined) {
      fields.push(`cli_username = $${idx++}`);
      values.push(input.cli_username.trim());
    }
    if (input.cli_password !== undefined && input.cli_password.trim() && !input.cli_password.includes('•')) {
      fields.push(`cli_password_encrypted = $${idx++}`);
      values.push(encryptSecret(input.cli_password));
    }
    if (input.connection_timeout !== undefined) {
      fields.push(`connection_timeout = $${idx++}`);
      values.push(input.connection_timeout);
    }
    if (input.polling_interval !== undefined) {
      fields.push(`polling_interval = $${idx++}`);
      values.push(input.polling_interval);
    }
    if (input.enabled !== undefined) {
      fields.push(`enabled = $${idx++}`);
      values.push(input.enabled);
    }
    if (input.optical_warning_threshold !== undefined) {
      fields.push(`optical_warning_threshold = $${idx++}`);
      values.push(input.optical_warning_threshold);
    }
    if (input.optical_critical_threshold !== undefined) {
      fields.push(`optical_critical_threshold = $${idx++}`);
      values.push(input.optical_critical_threshold);
    }

    if (fields.length === 0) return;

    values.push(id);
    await query(`UPDATE olts SET ${fields.join(', ')}, updated_at = NOW() WHERE id = $${idx}`, values);
  },

  /**
   * Delete OLT record with dependency checks
   */
  async deleteOlt(id: number, actor?: AuthSession): Promise<void> {
    const existing = await this.findById(id, actor);
    if (!existing) throw HttpError.notFound('OLT not found');

    const subCheck = await query<{ count: string }>(
      'SELECT COUNT(*)::text AS count FROM customer_onu_associations WHERE olt_id = $1',
      [id]
    );
    const linkedCount = parseInt(subCheck.rows[0]?.count || '0', 10);
    if (linkedCount > 0) {
      throw HttpError.badRequest(`Cannot delete OLT: ${linkedCount} customers are currently associated with its ONUs`);
    }

    await query('DELETE FROM olts WHERE id = $1', [id]);
  },

  /**
   * Update live connection state on OLT
   */
  async updateConnectionStatus(
    id: number,
    status: 'online' | 'offline' | 'error' | 'unknown',
    lastError?: string | null
  ): Promise<void> {
    await query(
      `UPDATE olts
          SET connection_status = $1,
              last_seen_at = CASE WHEN $1 = 'online' THEN NOW() ELSE last_seen_at END,
              last_error = $2,
              updated_at = NOW()
        WHERE id = $3`,
      [status, lastError || null, id]
    );
  },

  /**
   * List registered ONUs with customer association and filters
   */
  async listOnus(params: {
    olt_id?: number;
    branch_id?: number;
    run_state?: string;
    search?: string;
    page?: number;
    limit?: number;
  }, actor?: AuthSession): Promise<{ onus: OnuItem[]; total: number; page: number; limit: number }> {
    const page = Math.max(1, params.page || 1);
    const limit = Math.min(100, Math.max(1, params.limit || 25));
    const offset = (page - 1) * limit;

    const conditions: string[] = ['1=1'];
    const values: any[] = [];
    let idx = 1;

    // Branch scoping
    if (isBranchUser(actor)) {
      conditions.push(`o.branch_id = $${idx}`);
      values.push(actor?.branchId || -1);
      idx++;
    } else if (params.branch_id) {
      conditions.push(`o.branch_id = $${idx}`);
      values.push(params.branch_id);
      idx++;
    }

    if (params.olt_id) {
      conditions.push(`onu.olt_id = $${idx}`);
      values.push(params.olt_id);
      idx++;
    }

    if (params.run_state && params.run_state !== 'all') {
      conditions.push(`onu.run_state = $${idx}`);
      values.push(params.run_state);
      idx++;
    }

    if (params.search && params.search.trim()) {
      const q = `%${params.search.trim()}%`;
      conditions.push(`(
        onu.serial_number ILIKE $${idx} OR
        onu.description ILIKE $${idx} OR
        s.username ILIKE $${idx} OR
        s.full_name ILIKE $${idx}
      )`);
      values.push(q);
      idx++;
    }

    const whereClause = conditions.join(' AND ');

    const countRes = await query<{ count: string }>(
      `SELECT COUNT(*)::text AS count
         FROM onus onu
         JOIN olts o ON o.id = onu.olt_id
    LEFT JOIN customer_onu_associations coa ON coa.onu_id = onu.id
    LEFT JOIN subscribers s ON s.id = coa.customer_id
        WHERE ${whereClause}`,
      values
    );
    const total = parseInt(countRes.rows[0]?.count || '0', 10);

    const dataSql = `
      SELECT onu.id, onu.olt_id, o.name AS olt_name, onu.serial_number,
             onu.frame, onu.slot, onu.pon_port, onu.ont_id,
             onu.description, onu.vendor_id, onu.equipment_id, onu.model, onu.mac_address,
             onu.control_flag, onu.run_state, onu.config_state, onu.match_state,
             onu.protection_state, onu.auth_type, onu.management_mode,
             onu.line_profile_id, onu.line_profile_name,
             onu.service_profile_id, onu.service_profile_name,
             onu.last_up_time, onu.last_down_time, onu.last_down_cause,
             onu.registration_state, onu.last_rx_power, onu.last_tx_power, onu.last_olt_rx_power,
             onu.last_optical_reading_at,
             coa.customer_id, s.username AS customer_username, s.full_name AS customer_name,
             onu.created_at, onu.updated_at
        FROM onus onu
        JOIN olts o ON o.id = onu.olt_id
   LEFT JOIN customer_onu_associations coa ON coa.onu_id = onu.id
   LEFT JOIN subscribers s ON s.id = coa.customer_id
       WHERE ${whereClause}
    ORDER BY onu.slot ASC, onu.pon_port ASC, onu.ont_id ASC
       LIMIT $${idx} OFFSET $${idx + 1}
    `;

    values.push(limit, offset);
    const { rows } = await query<any>(dataSql, values);

    const onus: OnuItem[] = rows.map((r) => ({
      ...r,
      last_rx_power: r.last_rx_power !== null ? Number(r.last_rx_power) : null,
      last_tx_power: r.last_tx_power !== null ? Number(r.last_tx_power) : null,
      last_olt_rx_power: r.last_olt_rx_power !== null ? Number(r.last_olt_rx_power) : null,
      created_at: new Date(r.created_at).toISOString(),
      updated_at: new Date(r.updated_at).toISOString(),
      last_up_time: r.last_up_time ? new Date(r.last_up_time).toISOString() : null,
      last_down_time: r.last_down_time ? new Date(r.last_down_time).toISOString() : null,
      last_optical_reading_at: r.last_optical_reading_at ? new Date(r.last_optical_reading_at).toISOString() : null,
    }));

    return { onus, total, page, limit };
  },

  /**
   * Upsert registered ONU record idempotently by (olt_id, serial_number)
   */
  async upsertOnu(input: {
    olt_id: number;
    serial_number: string;
    frame: number;
    slot: number;
    pon_port: number;
    ont_id: number;
    description?: string;
    vendor_id?: string;
    equipment_id?: string;
    run_state?: 'online' | 'offline' | 'missing' | 'unknown';
    config_state?: 'initial' | 'normal' | 'failed' | 'unknown';
    match_state?: 'match' | 'mismatch' | 'unknown';
    line_profile_id?: number;
    line_profile_name?: string;
    service_profile_id?: number;
    service_profile_name?: string;
    last_up_time?: string;
    last_down_time?: string;
    last_down_cause?: string;
  }): Promise<number> {
    const { rows } = await query<{ id: number }>(
      `INSERT INTO onus (
         olt_id, serial_number, frame, slot, pon_port, ont_id,
         description, vendor_id, equipment_id, run_state, config_state, match_state,
         line_profile_id, line_profile_name, service_profile_id, service_profile_name,
         last_up_time, last_down_time, last_down_cause, registration_state, last_seen_at, last_sync_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, 'registered', NOW(), NOW())
       ON CONFLICT (olt_id, serial_number) DO UPDATE SET
         frame = EXCLUDED.frame,
         slot = EXCLUDED.slot,
         pon_port = EXCLUDED.pon_port,
         ont_id = EXCLUDED.ont_id,
         description = COALESCE(EXCLUDED.description, onus.description),
         vendor_id = COALESCE(EXCLUDED.vendor_id, onus.vendor_id),
         equipment_id = COALESCE(EXCLUDED.equipment_id, onus.equipment_id),
         run_state = EXCLUDED.run_state,
         config_state = EXCLUDED.config_state,
         match_state = EXCLUDED.match_state,
         line_profile_id = COALESCE(EXCLUDED.line_profile_id, onus.line_profile_id),
         line_profile_name = COALESCE(EXCLUDED.line_profile_name, onus.line_profile_name),
         service_profile_id = COALESCE(EXCLUDED.service_profile_id, onus.service_profile_id),
         service_profile_name = COALESCE(EXCLUDED.service_profile_name, onus.service_profile_name),
         last_up_time = COALESCE(EXCLUDED.last_up_time, onus.last_up_time),
         last_down_time = COALESCE(EXCLUDED.last_down_time, onus.last_down_time),
         last_down_cause = COALESCE(EXCLUDED.last_down_cause, onus.last_down_cause),
         registration_state = 'registered',
         last_seen_at = NOW(),
         last_sync_at = NOW(),
         updated_at = NOW()
       RETURNING id`,
      [
        input.olt_id,
        input.serial_number.trim(),
        input.frame,
        input.slot,
        input.pon_port,
        input.ont_id,
        input.description || null,
        input.vendor_id || null,
        input.equipment_id || null,
        input.run_state || 'offline',
        input.config_state || 'initial',
        input.match_state || 'match',
        input.line_profile_id || null,
        input.line_profile_name || null,
        input.service_profile_id || null,
        input.service_profile_name || null,
        input.last_up_time ? new Date(input.last_up_time) : null,
        input.last_down_time ? new Date(input.last_down_time) : null,
        input.last_down_cause || null,
      ]
    );

    const onuId = rows[0].id;

    // Trigger automatic ONU vendor/model detection & profile matching asynchronously
    modelDetectionService
      .processDetectedOnu({
        onuId,
        oltId: input.olt_id,
        serialNumber: input.serial_number,
        vendorId: input.vendor_id,
        equipmentId: input.equipment_id,
        description: input.description,
      })
      .catch(() => {});

    return onuId;
  },

  /**
   * Save optical power reading into history and update latest on ONU
   */
  async saveOpticalReading(data: {
    olt_id: number;
    onu_id?: number;
    serial_number: string;
    frame: number;
    slot: number;
    pon_port: number;
    ont_id: number;
    rx_power: number | null;
    tx_power: number | null;
    olt_rx_power: number | null;
    temperature?: number | null;
    voltage?: number | null;
    bias_current?: number | null;
    source?: 'cli' | 'snmp';
    collection_status?: 'success' | 'failed';
    error_message?: string;
  }): Promise<void> {
    await query(
      `INSERT INTO onu_optical_history (
         olt_id, onu_id, serial_number, frame, slot, pon_port, ont_id,
         rx_power, tx_power, olt_rx_power, temperature, voltage, bias_current,
         source, collection_status, error_message
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)`,
      [
        data.olt_id,
        data.onu_id || null,
        data.serial_number,
        data.frame,
        data.slot,
        data.pon_port,
        data.ont_id,
        data.rx_power,
        data.tx_power,
        data.olt_rx_power,
        data.temperature || null,
        data.voltage || null,
        data.bias_current || null,
        data.source || 'cli',
        data.collection_status || 'success',
        data.error_message || null,
      ]
    );

    if (data.onu_id && data.rx_power !== null) {
      await query(
        `UPDATE onus
            SET last_rx_power = $1,
                last_tx_power = $2,
                last_olt_rx_power = $3,
                last_optical_reading_at = NOW(),
                updated_at = NOW()
          WHERE id = $4`,
        [data.rx_power, data.tx_power, data.olt_rx_power, data.onu_id]
      );
    }
  },

  /**
   * Retrieve optical history for an ONU
   */
  async getOpticalHistory(onuId: number, limit = 20): Promise<any[]> {
    const { rows } = await query(
      `SELECT id, rx_power, tx_power, olt_rx_power, temperature, voltage, bias_current,
              source, collection_status, error_message, collected_at
         FROM onu_optical_history
        WHERE onu_id = $1
        ORDER BY collected_at DESC
        LIMIT $2`,
      [onuId, limit]
    );
    return rows.map((r) => ({
      ...r,
      rx_power: r.rx_power !== null ? Number(r.rx_power) : null,
      tx_power: r.tx_power !== null ? Number(r.tx_power) : null,
      olt_rx_power: r.olt_rx_power !== null ? Number(r.olt_rx_power) : null,
      collected_at: new Date(r.collected_at).toISOString(),
    }));
  },

  /**
   * Associate an ONU with a subscriber / customer
   */
  async associateCustomer(
    customerId: number,
    onuId: number,
    actor?: AuthSession,
    source: 'manual' | 'sn_match' | 'description_match' | 'mac_match' = 'manual'
  ): Promise<void> {
    const onuRes = await query<{ olt_id: number }>(
      'SELECT olt_id FROM onus WHERE id = $1',
      [onuId]
    );
    if (!onuRes.rows[0]) throw HttpError.notFound('ONU not found');
    const oltId = onuRes.rows[0].olt_id;

    // Insert or update association
    await query(
      `INSERT INTO customer_onu_associations (customer_id, onu_id, olt_id, association_source, associated_by, associated_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       ON CONFLICT (customer_id) DO UPDATE SET
         onu_id = EXCLUDED.onu_id,
         olt_id = EXCLUDED.olt_id,
         association_source = EXCLUDED.association_source,
         associated_by = EXCLUDED.associated_by,
         associated_at = NOW()`,
      [customerId, onuId, oltId, source, actor?.userId || null]
    );

    // Update subscriber record
    const onuData = await query<{ serial_number: string }>(
      'SELECT serial_number FROM onus WHERE id = $1',
      [onuId]
    );
    if (onuData.rows[0]) {
      await query(
        'UPDATE subscribers SET onu_mac_sn = $1, updated_at = NOW() WHERE id = $2',
        [onuData.rows[0].serial_number, customerId]
      );
    }

    // Audit log
    await this.logOperation(
      oltId,
      'associate_customer',
      `Associated customer #${customerId} with ONU #${onuId} (source: ${source})`,
      'success',
      undefined,
      actor
    );
  },

  /**
   * Helper to associate existing ONU or register by serial number on selected OLT
   */
  async associateOrCreateCustomerOnu(params: {
    customerId: number;
    onuId?: number;
    oltId?: number;
    serialNumber?: string;
    slot?: number;
    port?: number;
    ontId?: number;
    source?: 'manual' | 'sn_match' | 'description_match' | 'mac_match';
    actor?: AuthSession;
  }): Promise<void> {
    let targetOnuId = params.onuId;
    if (!targetOnuId) {
      if (!params.oltId || !params.serialNumber) {
        throw HttpError.badRequest('Either onuId or both oltId and serialNumber are required');
      }
      const existing = await query<{ id: number }>(
        'SELECT id FROM onus WHERE olt_id = $1 AND lower(serial_number) = lower($2)',
        [params.oltId, params.serialNumber.trim()]
      );
      if (existing.rows[0]) {
        targetOnuId = existing.rows[0].id;
      } else {
        targetOnuId = await this.upsertOnu({
          olt_id: params.oltId,
          serial_number: params.serialNumber.trim(),
          frame: 0,
          slot: params.slot ?? 0,
          pon_port: params.port ?? 0,
          ont_id: params.ontId ?? 0,
          run_state: 'online',
        });
      }
    }
    await this.associateCustomer(params.customerId, targetOnuId, params.actor, params.source || 'manual');
  },

  /**
   * Remove customer association without deleting physical ONU
   */
  async dissociateCustomer(customerId: number, actor?: AuthSession): Promise<void> {
    const existing = await query<{ olt_id: number; onu_id: number }>(
      'SELECT olt_id, onu_id FROM customer_onu_associations WHERE customer_id = $1',
      [customerId]
    );
    if (existing.rows[0]) {
      const { olt_id, onu_id } = existing.rows[0];
      await query('DELETE FROM customer_onu_associations WHERE customer_id = $1', [customerId]);
      await query('UPDATE subscribers SET onu_mac_sn = NULL, updated_at = NOW() WHERE id = $1', [customerId]);
      await this.logOperation(
        olt_id,
        'dissociate_customer',
        `Removed ONU #${onu_id} association for customer #${customerId}`,
        'success',
        undefined,
        actor
      );
    }
  },

  /**
   * Get active ONU association details for a customer
   */
  async getCustomerOnu(customerId: number): Promise<any | null> {
    const { rows } = await query(
      `SELECT coa.id AS association_id, coa.association_source, coa.associated_at,
              onu.id AS onu_id, onu.serial_number, onu.frame, onu.slot, onu.pon_port, onu.ont_id,
              onu.description, onu.vendor_id, onu.equipment_id, onu.model,
              onu.run_state, onu.config_state, onu.match_state,
              onu.last_rx_power, onu.last_tx_power, onu.last_olt_rx_power, onu.last_optical_reading_at,
              onu.management_ip, onu.web_port, onu.web_protocol, onu.web_status, onu.management_status,
              onu.profile_id, onu.wifi_ssid_2g, onu.wifi_ssid_5g, onu.wifi_last_status,
              onu.hardware_version, onu.firmware_version,
              omp.name AS profile_name, omp.status AS profile_status,
              o.id AS olt_id, o.name AS olt_name, o.branch_id, b.name AS branch_name,
              o.optical_warning_threshold, o.optical_critical_threshold, o.last_sync_at
         FROM customer_onu_associations coa
         JOIN onus onu ON onu.id = coa.onu_id
         JOIN olts o ON o.id = coa.olt_id
    LEFT JOIN branches b ON b.id = o.branch_id
    LEFT JOIN onu_model_profiles omp ON omp.id = onu.profile_id
        WHERE coa.customer_id = $1`,
      [customerId]
    );

    if (!rows[0]) return null;
    const r = rows[0];
    return {
      ...r,
      last_rx_power: r.last_rx_power !== null ? Number(r.last_rx_power) : null,
      last_tx_power: r.last_tx_power !== null ? Number(r.last_tx_power) : null,
      last_olt_rx_power: r.last_olt_rx_power !== null ? Number(r.last_olt_rx_power) : null,
      optical_warning_threshold: Number(r.optical_warning_threshold),
      optical_critical_threshold: Number(r.optical_critical_threshold),
      associated_at: new Date(r.associated_at).toISOString(),
      last_optical_reading_at: r.last_optical_reading_at ? new Date(r.last_optical_reading_at).toISOString() : null,
      last_sync_at: r.last_sync_at ? new Date(r.last_sync_at).toISOString() : null,
    };
  },

  /**
   * Get active ONU association details for a customer (alias)
   */
  async getCustomerOnuAssociation(customerId: number): Promise<any | null> {
    return this.getCustomerOnu(customerId);
  },

  /**
   * Log an operational event into olt_operation_history
   */
  async logOperation(
    oltId: number,
    opType: string,
    summary: string,
    status: 'started' | 'success' | 'partial_success' | 'failed',
    result?: string,
    actor?: AuthSession
  ): Promise<number> {
    const cleanSummary = sanitizeLogOutput(summary);
    const cleanResult = result ? sanitizeLogOutput(result) : null;

    const { rows } = await query<{ id: number }>(
      `INSERT INTO olt_operation_history (
         olt_id, operation_type, operator_id, operator_username,
         sanitized_command_summary, status, sanitized_result, started_at, completed_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
       RETURNING id`,
      [
        oltId,
        opType,
        actor?.userId || null,
        actor?.username || 'system',
        cleanSummary,
        status,
        cleanResult,
      ]
    );

    return rows[0].id;
  },

  /**
   * List operation audit history
   */
  async listOperationHistory(
    oltId?: number,
    actor?: AuthSession,
    limit = 50
  ): Promise<OltOperationHistoryItem[]> {
    const conditions: string[] = ['1=1'];
    const values: any[] = [];
    let idx = 1;

    if (isBranchUser(actor)) {
      conditions.push(`o.branch_id = $${idx}`);
      values.push(actor?.branchId || -1);
      idx++;
    }

    if (oltId) {
      conditions.push(`h.olt_id = $${idx}`);
      values.push(oltId);
      idx++;
    }

    values.push(limit);
    const sql = `
      SELECT h.id, h.olt_id, o.name AS olt_name, h.operation_type,
             h.operator_id, h.operator_username, h.sanitized_command_summary,
             h.status, h.sanitized_result, h.started_at, h.completed_at
        FROM olt_operation_history h
        JOIN olts o ON o.id = h.olt_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY h.started_at DESC
       LIMIT $${idx}
    `;

    const { rows } = await query<any>(sql, values);
    return rows.map((r) => ({
      ...r,
      started_at: new Date(r.started_at).toISOString(),
      completed_at: r.completed_at ? new Date(r.completed_at).toISOString() : null,
    }));
  },

  /**
   * List configured line and service profiles for an OLT
   */
  async listProfiles(oltId: number): Promise<any[]> {
    const { rows } = await query(
      `SELECT id, olt_id, profile_type, profile_id, profile_name, source, is_verified, verified_at, details
         FROM olt_profiles
        WHERE olt_id = $1
        ORDER BY profile_type ASC, profile_id ASC`,
      [oltId]
    );
    return rows;
  },

  /**
   * Seed or update line/service profiles catalog
   */
  async upsertProfile(
    oltId: number,
    profileType: 'line' | 'service',
    profileId: number,
    profileName: string,
    source: 'olt' | 'local' = 'local'
  ): Promise<void> {
    await query(
      `INSERT INTO olt_profiles (olt_id, profile_type, profile_id, profile_name, source, is_verified, verified_at)
       VALUES ($1, $2, $3, $4, $5, TRUE, NOW())
       ON CONFLICT (olt_id, profile_type, profile_id) DO UPDATE SET
         profile_name = EXCLUDED.profile_name,
         is_verified = TRUE,
         verified_at = NOW(),
         updated_at = NOW()`,
      [oltId, profileType, profileId, profileName, source]
    );
  },

  /**
   * Get physical & logical interfaces with live traffic rates
   */
  async getInterfaces(oltId: number): Promise<any[]> {
    const { rows } = await query(
      `SELECT id, olt_id, if_index, if_name, if_descr, if_type, admin_status, oper_status,
              speed_bps, mac_address, mtu, in_octets, out_octets, in_rate_bps, out_rate_bps,
              in_errors, out_errors, in_discards, out_discards, last_change, updated_at
         FROM olt_interfaces
        WHERE olt_id = $1
        ORDER BY if_index ASC`,
      [oltId]
    );
    return rows.map((r: any) => ({
      ...r,
      speed_bps: Number(r.speed_bps || 0),
      in_octets: Number(r.in_octets || 0),
      out_octets: Number(r.out_octets || 0),
      in_rate_bps: Number(r.in_rate_bps || 0),
      out_rate_bps: Number(r.out_rate_bps || 0),
      in_errors: Number(r.in_errors || 0),
      out_errors: Number(r.out_errors || 0),
      in_discards: Number(r.in_discards || 0),
      out_discards: Number(r.out_discards || 0),
      updated_at: r.updated_at ? new Date(r.updated_at).toISOString() : null,
    }));
  },

  /**
   * Get active and historical alarms for OLT
   */
  async getAlarms(oltId: number): Promise<any[]> {
    const { rows } = await query(
      `SELECT id, olt_id, alarm_id, severity, title, description, entity_type, entity_id, cleared, raised_at, cleared_at
         FROM olt_alarms
        WHERE olt_id = $1
        ORDER BY raised_at DESC
        LIMIT 100`,
      [oltId]
    );
    return rows.map((r: any) => ({
      ...r,
      raised_at: new Date(r.raised_at).toISOString(),
      cleared_at: r.cleared_at ? new Date(r.cleared_at).toISOString() : null,
    }));
  },

  /**
   * Get subscriber ONU optical readings with diagnostic thresholds
   */
  async getSubscriberOnuOptical(subscriberId: number): Promise<any | null> {
    const association = await this.getCustomerOnuAssociation(subscriberId);
    if (!association) return null;

    const rx = association.last_rx_power;
    const warn = association.optical_warning_threshold ?? -25;
    const crit = association.optical_critical_threshold ?? -28;

    let opticalStatus: 'optimal' | 'warning' | 'critical' | 'offline' = 'optimal';
    if (association.run_state !== 'online' || rx === null) {
      opticalStatus = 'offline';
    } else if (rx <= crit) {
      opticalStatus = 'critical';
    } else if (rx <= warn) {
      opticalStatus = 'warning';
    } else {
      opticalStatus = 'optimal';
    }

    return {
      ...association,
      optical_status: opticalStatus,
      is_rx_power_available: rx !== null,
      is_tx_power_available: association.last_tx_power !== null,
      is_olt_rx_power_available: association.last_olt_rx_power !== null,
    };
  },
};
