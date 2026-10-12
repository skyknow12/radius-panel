import { query } from '../db/pool';
import { HttpError } from '../lib/http-error';
import { isBranchUser } from '../lib/access-control';
import type { AuthSession } from '../services/auth.service';
import { credentialService } from '../services/onu/credential.service';
import type {
  OnuCredentialItem,
  OnuModelProfileItem,
} from '../services/onu/types';

export const onuRepository = {
  /**
   * Get high-level summary overview for ONU Web Management
   */
  async getOverview(actor?: AuthSession) {
    const isBranch = isBranchUser(actor);
    const branchId = actor?.branchId;

    let branchFilter = '';
    const params: any[] = [];
    if (isBranch && branchId) {
      params.push(branchId);
      branchFilter = 'WHERE o.branch_id = $1';
    }

    const { rows } = await query<any>(
      `SELECT
         COUNT(onu.id)::int AS total_onus,
         COUNT(coa.id)::int AS linked_to_customers,
         COUNT(onu.id) FILTER (WHERE onu.management_status = 'configured')::int AS configured_profiles,
         COUNT(onu.id) FILTER (WHERE onu.management_status = 'pending_profile')::int AS pending_model_config,
         COUNT(onu.id) FILTER (WHERE onu.web_status = 'reachable')::int AS web_reachable,
         COUNT(onu.id) FILTER (WHERE onu.web_status = 'unreachable')::int AS web_unreachable
       FROM onus onu
       JOIN olts o ON o.id = onu.olt_id
       LEFT JOIN customer_onu_associations coa ON coa.onu_id = onu.id
       ${branchFilter}`,
      params
    );

    const pendingRequestsRes = await query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM onu_model_requests WHERE status = 'pending'`
    );

    const failedLogsRes = await query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM onu_management_activity_logs WHERE status = 'failed'`
    );

    const topVendorsRes = await query<{ vendor: string; count: number }>(
      `SELECT COALESCE(onu.vendor_id, 'Unknown') AS vendor, COUNT(onu.id)::int AS count
       FROM onus onu
       JOIN olts o ON o.id = onu.olt_id
       ${branchFilter}
       GROUP BY 1 ORDER BY 2 DESC LIMIT 5`,
      params
    );

    const topModelsRes = await query<{ model: string; count: number }>(
      `SELECT COALESCE(onu.model, 'Unknown') AS model, COUNT(onu.id)::int AS count
       FROM onus onu
       JOIN olts o ON o.id = onu.olt_id
       ${branchFilter}
       GROUP BY 1 ORDER BY 2 DESC LIMIT 5`,
      params
    );

    const stats = rows[0] || {};

    return {
      totalOnus: stats.total_onus || 0,
      linkedToCustomers: stats.linked_to_customers || 0,
      configuredProfiles: stats.configured_profiles || 0,
      pendingModelConfig: stats.pending_model_config || 0,
      pendingNewModelsCount: parseInt(pendingRequestsRes.rows[0]?.count || '0', 10),
      webReachable: stats.web_reachable || 0,
      webUnreachable: stats.web_unreachable || 0,
      failedOperations: parseInt(failedLogsRes.rows[0]?.count || '0', 10),
      topVendors: topVendorsRes.rows || [],
      topModels: topModelsRes.rows || [],
    };
  },

  /**
   * List detected ONUs with filters and customer mappings
   */
  async listDetectedOnus(
    params: {
      page?: number;
      limit?: number;
      search?: string;
      olt_id?: number;
      branch_id?: number;
      vendor?: string;
      model?: string;
      management_status?: string;
      web_status?: string;
      linked?: boolean;
    },
    actor?: AuthSession
  ) {
    const page = Math.max(1, params.page || 1);
    const limit = Math.min(100, Math.max(1, params.limit || 25));
    const offset = (page - 1) * limit;

    const conditions: string[] = [];
    const values: any[] = [];
    let idx = 1;

    // Branch isolation
    if (isBranchUser(actor) && actor?.branchId) {
      conditions.push(`o.branch_id = $${idx++}`);
      values.push(actor.branchId);
    } else if (params.branch_id) {
      conditions.push(`o.branch_id = $${idx++}`);
      values.push(params.branch_id);
    }

    if (params.olt_id) {
      conditions.push(`onu.olt_id = $${idx++}`);
      values.push(params.olt_id);
    }

    if (params.vendor) {
      conditions.push(`LOWER(COALESCE(onu.vendor_id, '')) = LOWER($${idx++})`);
      values.push(params.vendor);
    }

    if (params.model) {
      conditions.push(`LOWER(COALESCE(onu.model, '')) = LOWER($${idx++})`);
      values.push(params.model);
    }

    if (params.management_status) {
      conditions.push(`onu.management_status = $${idx++}`);
      values.push(params.management_status);
    }

    if (params.web_status) {
      conditions.push(`onu.web_status = $${idx++}`);
      values.push(params.web_status);
    }

    if (params.linked === true) {
      conditions.push(`coa.id IS NOT NULL`);
    } else if (params.linked === false) {
      conditions.push(`coa.id IS NULL`);
    }

    if (params.search?.trim()) {
      const q = `%${params.search.trim()}%`;
      conditions.push(`(
        onu.serial_number ILIKE $${idx} OR
        onu.model ILIKE $${idx} OR
        onu.vendor_id ILIKE $${idx} OR
        s.username ILIKE $${idx} OR
        s.full_name ILIKE $${idx} OR
        host(onu.management_ip) ILIKE $${idx}
      )`);
      values.push(q);
      idx++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countRes = await query<{ count: string }>(
      `SELECT COUNT(onu.id)::text AS count
         FROM onus onu
         JOIN olts o ON o.id = onu.olt_id
    LEFT JOIN customer_onu_associations coa ON coa.onu_id = onu.id
    LEFT JOIN subscribers s ON s.id = coa.customer_id
       ${whereClause}`,
      values
    );
    const total = parseInt(countRes.rows[0]?.count || '0', 10);

    const { rows } = await query<any>(
      `SELECT onu.id, onu.olt_id, o.name AS olt_name, o.branch_id, b.name AS branch_name,
              onu.serial_number, onu.frame, onu.slot, onu.pon_port, onu.ont_id,
              COALESCE(onu.vendor_id, 'Other') AS vendor,
              COALESCE(onu.model, 'Unknown model') AS model,
              onu.firmware_version, onu.hardware_version,
              host(onu.management_ip) AS management_ip,
              onu.web_port, onu.web_protocol, onu.web_status, onu.management_status,
              onu.run_state, onu.profile_id, p.name AS profile_name, p.adapter_type,
              onu.wifi_ssid_2g, onu.wifi_ssid_5g, onu.wifi_last_status,
              coa.id AS association_id, s.id AS customer_id, s.username AS customer_username, s.full_name AS customer_name,
              onu.last_seen_at, onu.last_web_seen_at, onu.created_at
         FROM onus onu
         JOIN olts o ON o.id = onu.olt_id
    LEFT JOIN branches b ON b.id = o.branch_id
    LEFT JOIN onu_model_profiles p ON p.id = onu.profile_id
    LEFT JOIN customer_onu_associations coa ON coa.onu_id = onu.id
    LEFT JOIN subscribers s ON s.id = coa.customer_id
       ${whereClause}
       ORDER BY onu.slot ASC, onu.pon_port ASC, onu.ont_id ASC
       LIMIT $${idx++} OFFSET $${idx++}`,
      [...values, limit, offset]
    );

    return {
      onus: rows,
      total,
      page,
      limit,
    };
  },

  /**
   * List pending model requests
   */
  async listModelRequests(params: { status?: string }) {
    const status = params.status || 'pending';
    const { rows } = await query<any>(
      `SELECT r.id, r.vendor, r.model, r.firmware, r.detected_on_olt_id, o.name AS olt_name,
              r.detected_on_branch_id, b.name AS branch_name,
              r.sample_onu_id, r.sample_serial_number, host(r.sample_management_ip) AS sample_management_ip,
              r.web_status, r.device_count, r.status, r.resolved_profile_id,
              r.first_detected_at, r.last_detected_at, r.created_at
         FROM onu_model_requests r
    LEFT JOIN olts o ON o.id = r.detected_on_olt_id
    LEFT JOIN branches b ON b.id = r.detected_on_branch_id
        WHERE r.status = $1
        ORDER BY r.last_detected_at DESC`,
      [status]
    );
    return rows;
  },

  /**
   * List reusable ONU model profiles
   */
  async listModelProfiles(params?: { search?: string; vendor?: string; status?: string }): Promise<OnuModelProfileItem[]> {
    const conditions: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (params?.vendor) {
      conditions.push(`LOWER(vendor) = LOWER($${idx++})`);
      values.push(params.vendor);
    }

    if (params?.status) {
      conditions.push(`status = $${idx++}`);
      values.push(params.status);
    }

    if (params?.search?.trim()) {
      const q = `%${params.search.trim()}%`;
      conditions.push(`(name ILIKE $${idx} OR vendor ILIKE $${idx} OR model ILIKE $${idx})`);
      values.push(q);
      idx++;
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const { rows } = await query<any>(
      `SELECT id, name, vendor, model, firmware_pattern, adapter_type,
              default_protocol, default_port, login_path, default_username,
              wifi_bands, capabilities, status, tested_capabilities, notes,
              created_at, updated_at
         FROM onu_model_profiles
       ${where}
       ORDER BY vendor ASC, model ASC`,
      values
    );

    return rows.map((r) => ({
      ...r,
      default_password_masked: '••••••••',
      created_at: new Date(r.created_at).toISOString(),
      updated_at: new Date(r.updated_at).toISOString(),
    }));
  },

  /**
   * Get single model profile
   */
  async getModelProfile(id: number): Promise<OnuModelProfileItem | null> {
    const { rows } = await query<any>(
      `SELECT id, name, vendor, model, firmware_pattern, adapter_type,
              default_protocol, default_port, login_path, default_username,
              wifi_bands, capabilities, status, tested_capabilities, notes,
              created_at, updated_at
         FROM onu_model_profiles
        WHERE id = $1`,
      [id]
    );
    if (!rows[0]) return null;
    const r = rows[0];
    return {
      ...r,
      default_password_masked: '••••••••',
      created_at: new Date(r.created_at).toISOString(),
      updated_at: new Date(r.updated_at).toISOString(),
    };
  },

  /**
   * Create new reusable model profile
   */
  async createModelProfile(
    input: {
      name: string;
      vendor: string;
      model: string;
      firmware_pattern?: string;
      adapter_type?: 'huawei_web' | 'zte_web' | 'generic_web' | 'unsupported';
      default_protocol?: 'http' | 'https';
      default_port?: number;
      login_path?: string;
      default_username: string;
      default_password?: string;
      wifi_bands?: string[];
      capabilities?: any;
      status?: 'active' | 'disabled' | 'needs_testing';
      notes?: string;
      resolve_request_id?: number;
    },
    actor?: AuthSession
  ): Promise<number> {
    const pwdEnc = input.default_password ? credentialService.encryptPassword(input.default_password) : null;

    const { rows } = await query<{ id: number }>(
      `INSERT INTO onu_model_profiles (
         name, vendor, model, firmware_pattern, adapter_type,
         default_protocol, default_port, login_path, default_username,
         default_password_encrypted, wifi_bands, capabilities, status,
         notes, created_by
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
       RETURNING id`,
      [
        input.name.trim(),
        input.vendor.trim(),
        input.model.trim(),
        input.firmware_pattern || null,
        input.adapter_type || 'generic_web',
        input.default_protocol || 'http',
        input.default_port || 80,
        input.login_path || '/',
        input.default_username.trim(),
        pwdEnc,
        input.wifi_bands || ['2.4GHz', '5GHz'],
        JSON.stringify(input.capabilities || { change_ssid: true, change_password: true, read_wifi: true, verify_changes: true }),
        input.status || 'needs_testing',
        input.notes || null,
        actor?.userId || null,
      ]
    );

    const profileId = rows[0].id;

    // Automatically resolve pending model request if provided
    if (input.resolve_request_id) {
      await query(
        `UPDATE onu_model_requests
            SET status = 'resolved',
                resolved_profile_id = $2,
                updated_at = NOW()
          WHERE id = $1`,
        [input.resolve_request_id, profileId]
      );
    }

    // Associate unconfigured matching ONUs to this new profile
    await query(
      `UPDATE onus
          SET profile_id = $3,
              management_status = 'configured',
              updated_at = NOW()
        WHERE LOWER(vendor_id) = LOWER($1) AND LOWER(model) = LOWER($2) AND profile_id IS NULL`,
      [input.vendor.trim(), input.model.trim(), profileId]
    );

    return profileId;
  },

  /**
   * Update existing model profile
   */
  async updateModelProfile(
    id: number,
    input: Partial<{
      name: string;
      adapter_type: 'huawei_web' | 'zte_web' | 'generic_web' | 'unsupported';
      default_protocol: 'http' | 'https';
      default_port: number;
      login_path: string;
      default_username: string;
      default_password: string;
      wifi_bands: string[];
      capabilities: any;
      status: 'active' | 'disabled' | 'needs_testing';
      notes: string;
    }>,
    _actor?: AuthSession
  ): Promise<void> {
    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (input.name !== undefined) {
      fields.push(`name = $${idx++}`);
      values.push(input.name.trim());
    }
    if (input.adapter_type !== undefined) {
      fields.push(`adapter_type = $${idx++}`);
      values.push(input.adapter_type);
    }
    if (input.default_protocol !== undefined) {
      fields.push(`default_protocol = $${idx++}`);
      values.push(input.default_protocol);
    }
    if (input.default_port !== undefined) {
      fields.push(`default_port = $${idx++}`);
      values.push(input.default_port);
    }
    if (input.login_path !== undefined) {
      fields.push(`login_path = $${idx++}`);
      values.push(input.login_path);
    }
    if (input.default_username !== undefined) {
      fields.push(`default_username = $${idx++}`);
      values.push(input.default_username.trim());
    }
    if (input.default_password !== undefined && input.default_password.trim() && !input.default_password.includes('•')) {
      fields.push(`default_password_encrypted = $${idx++}`);
      values.push(credentialService.encryptPassword(input.default_password));
    }
    if (input.wifi_bands !== undefined) {
      fields.push(`wifi_bands = $${idx++}`);
      values.push(input.wifi_bands);
    }
    if (input.capabilities !== undefined) {
      fields.push(`capabilities = $${idx++}`);
      values.push(JSON.stringify(input.capabilities));
    }
    if (input.status !== undefined) {
      fields.push(`status = $${idx++}`);
      values.push(input.status);
    }
    if (input.notes !== undefined) {
      fields.push(`notes = $${idx++}`);
      values.push(input.notes);
    }

    if (fields.length === 0) return;

    values.push(id);
    await query(
      `UPDATE onu_model_profiles
          SET ${fields.join(', ')}, updated_at = NOW()
        WHERE id = $${idx}`,
      values
    );
  },

  /**
   * List scoped management credentials
   */
  async listCredentials(params?: { scope?: string; branch_id?: number }, actor?: AuthSession): Promise<OnuCredentialItem[]> {
    const conditions: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (isBranchUser(actor) && actor?.branchId) {
      conditions.push(`(c.branch_id = $${idx++} OR c.scope = 'global' OR c.scope = 'model')`);
      values.push(actor.branchId);
    } else if (params?.branch_id) {
      conditions.push(`c.branch_id = $${idx++}`);
      values.push(params.branch_id);
    }

    if (params?.scope) {
      conditions.push(`c.scope = $${idx++}`);
      values.push(params.scope);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const { rows } = await query<any>(
      `SELECT c.id, c.name, c.scope, c.profile_id, p.name AS profile_name,
              c.branch_id, b.name AS branch_name, c.onu_id, onu.serial_number AS onu_serial,
              c.username, c.notes, c.created_at, c.updated_at
         FROM onu_credential_profiles c
    LEFT JOIN onu_model_profiles p ON p.id = c.profile_id
    LEFT JOIN branches b ON b.id = c.branch_id
    LEFT JOIN onus onu ON onu.id = c.onu_id
       ${where}
       ORDER BY c.scope ASC, c.id DESC`,
      values
    );

    return rows.map((r) => ({
      ...r,
      password_masked: '••••••••',
      created_at: new Date(r.created_at).toISOString(),
      updated_at: new Date(r.updated_at).toISOString(),
    }));
  },

  /**
   * Create scoped credential
   */
  async createCredential(
    input: {
      name: string;
      scope: 'global' | 'model' | 'branch' | 'device';
      profile_id?: number;
      branch_id?: number;
      onu_id?: number;
      username: string;
      password: string;
      notes?: string;
    },
    actor?: AuthSession
  ): Promise<number> {
    if (isBranchUser(actor) && input.branch_id && input.branch_id !== actor?.branchId) {
      throw HttpError.forbidden('Cannot configure credentials for another branch');
    }

    const pwdEnc = credentialService.encryptPassword(input.password);

    const { rows } = await query<{ id: number }>(
      `INSERT INTO onu_credential_profiles (
         name, scope, profile_id, branch_id, onu_id, username, password_encrypted, notes, created_by
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id`,
      [
        input.name.trim(),
        input.scope,
        input.profile_id || null,
        input.branch_id || (isBranchUser(actor) ? actor?.branchId : null),
        input.onu_id || null,
        input.username.trim(),
        pwdEnc,
        input.notes || null,
        actor?.userId || null,
      ]
    );

    return rows[0].id;
  },

  /**
   * Delete scoped credential
   */
  async deleteCredential(id: number, actor?: AuthSession): Promise<void> {
    if (isBranchUser(actor)) {
      const existing = await query<{ branch_id: number | null }>(
        `SELECT branch_id FROM onu_credential_profiles WHERE id = $1`,
        [id]
      );
      if (!existing.rows[0] || existing.rows[0].branch_id !== actor?.branchId) {
        throw HttpError.forbidden('Access denied');
      }
    }

    await query(`DELETE FROM onu_credential_profiles WHERE id = $1`, [id]);
  },

  /**
   * List management activity logs
   */
  async listActivityLogs(
    params: {
      onu_id?: number;
      customer_id?: number;
      branch_id?: number;
      status?: string;
      limit?: number;
    },
    actor?: AuthSession
  ) {
    const limit = Math.min(100, Math.max(1, params.limit || 50));
    const conditions: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (isBranchUser(actor) && actor?.branchId) {
      conditions.push(`l.branch_id = $${idx++}`);
      values.push(actor.branchId);
    } else if (params.branch_id) {
      conditions.push(`l.branch_id = $${idx++}`);
      values.push(params.branch_id);
    }

    if (params.onu_id) {
      conditions.push(`l.onu_id = $${idx++}`);
      values.push(params.onu_id);
    }

    if (params.customer_id) {
      conditions.push(`l.customer_id = $${idx++}`);
      values.push(params.customer_id);
    }

    if (params.status) {
      conditions.push(`l.status = $${idx++}`);
      values.push(params.status);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const { rows } = await query<any>(
      `SELECT l.id, l.onu_id, onu.serial_number AS onu_serial,
              l.customer_id, s.username AS customer_username,
              l.branch_id, b.name AS branch_name,
              l.operator_id, l.operator_username,
              l.operation_type, l.vendor, l.model, host(l.target_ip) AS target_ip,
              l.status, l.verification_status, l.sanitized_details, l.error_message,
              l.duration_ms, l.created_at
         FROM onu_management_activity_logs l
    LEFT JOIN onus onu ON onu.id = l.onu_id
    LEFT JOIN subscribers s ON s.id = l.customer_id
    LEFT JOIN branches b ON b.id = l.branch_id
       ${where}
       ORDER BY l.created_at DESC
       LIMIT $${idx++}`,
      [...values, limit]
    );

    return rows.map((r) => ({
      ...r,
      created_at: new Date(r.created_at).toISOString(),
    }));
  },
};
