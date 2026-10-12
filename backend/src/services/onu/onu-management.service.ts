import { query } from '../../db/pool';
import { HttpError } from '../../lib/http-error';
import { isBranchUser } from '../../lib/access-control';
import type { AuthSession } from '../auth.service';
import { getOnuAdapter } from './adapters/adapter-factory';
import { credentialService } from './credential.service';
import { OnuHttpClient } from './onu-http-client';
import type { OnuOperationResult, OnuTestResult, OnuWifiConfiguration } from './types';

export class OnuManagementService {
  /**
   * Helper to fetch an ONU with its associated OLT and profile metadata
   */
  async getOnuWithContext(onuId: number, actor?: AuthSession) {
    const { rows } = await query<any>(
      `SELECT onu.id, onu.olt_id, onu.serial_number, onu.frame, onu.slot, onu.pon_port, onu.ont_id,
              onu.description, onu.vendor_id, onu.equipment_id, onu.model, onu.mac_address,
              onu.run_state, onu.management_ip, onu.web_port, onu.web_protocol, onu.web_status,
              onu.management_status, onu.profile_id, onu.wifi_ssid_2g, onu.wifi_ssid_5g, onu.wifi_last_status,
              o.name AS olt_name, o.branch_id, b.name AS branch_name,
              p.name AS profile_name, p.adapter_type, p.status AS profile_status, p.capabilities,
              p.default_username, p.default_password_encrypted, p.wifi_bands
         FROM onus onu
         JOIN olts o ON o.id = onu.olt_id
    LEFT JOIN branches b ON b.id = o.branch_id
    LEFT JOIN onu_model_profiles p ON p.id = onu.profile_id
        WHERE onu.id = $1`,
      [onuId]
    );

    if (!rows[0]) throw HttpError.notFound('ONU not found');
    const onu = rows[0];

    // Branch isolation check
    if (isBranchUser(actor) && onu.branch_id && onu.branch_id !== actor?.branchId) {
      throw HttpError.forbidden('Access denied to ONU belonging to another branch');
    }

    return onu;
  }

  /**
   * Resolve an authorized management IP for the target ONU
   */
  private resolveManagementIp(onu: any): string {
    const targetIp = onu.management_ip || onu.description?.match(/10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+/)?.[0];
    if (!targetIp) {
      throw HttpError.badRequest(
        `ONU #${onu.serial_number} does not have a configured management IP address. Please configure its management IP.`
      );
    }
    return targetIp;
  }

  /**
   * Test web connectivity to an ONU
   */
  async testConnection(onuId: number, actor?: AuthSession): Promise<{ reachable: boolean; message: string; durationMs: number }> {
    const onu = await this.getOnuWithContext(onuId, actor);
    const targetIp = this.resolveManagementIp(onu);
    const client = new OnuHttpClient(targetIp, onu.web_port || 80, onu.web_protocol || 'http');
    const adapter = getOnuAdapter(onu.adapter_type || 'generic_web');

    const result = await adapter.testConnection(client);

    // Update web reachability on ONU record
    await query(
      `UPDATE onus
          SET web_status = $2,
              last_web_seen_at = CASE WHEN $2 = 'reachable' THEN NOW() ELSE last_web_seen_at END,
              updated_at = NOW()
        WHERE id = $1`,
      [onuId, result.reachable ? 'reachable' : 'unreachable']
    );

    // Log operational event (no secrets)
    await this.logActivity({
      onuId,
      branchId: onu.branch_id,
      operator: actor,
      operationType: 'test_connection',
      vendor: onu.vendor_id || onu.model || 'Unknown',
      model: onu.model || 'Unknown',
      targetIp,
      status: result.reachable ? 'success' : 'failed',
      sanitizedDetails: { status: result.status, message: result.message },
      durationMs: result.durationMs,
    });

    return result;
  }

  /**
   * Test login authentication against an ONU
   */
  async testLogin(onuId: number, actor?: AuthSession): Promise<OnuTestResult> {
    const onu = await this.getOnuWithContext(onuId, actor);
    const targetIp = this.resolveManagementIp(onu);

    // Resolve scoped credentials
    const creds = await credentialService.resolveCredentials({
      onuId,
      profileId: onu.profile_id,
      branchId: onu.branch_id,
    });

    if (!creds) {
      throw HttpError.badRequest('No management credentials configured for this ONU or its model profile');
    }

    const client = new OnuHttpClient(targetIp, onu.web_port || 80, onu.web_protocol || 'http');
    const adapter = getOnuAdapter(onu.adapter_type || 'generic_web');

    const result = await adapter.testProfile(client, creds.username, creds.passwordDecrypted);

    await this.logActivity({
      onuId,
      branchId: onu.branch_id,
      operator: actor,
      operationType: 'test_login',
      vendor: onu.vendor_id || onu.model,
      model: onu.model,
      targetIp,
      status: result.auth ? 'success' : 'failed',
      sanitizedDetails: {
        username: creds.username,
        sourceScope: creds.sourceScope,
        supportedBands: result.supportedBands,
      },
      durationMs: result.durationMs,
    });

    return result;
  }

  /**
   * Retrieve current Wi-Fi configuration from ONU
   */
  async getWifiSettings(onuId: number, actor?: AuthSession): Promise<OnuWifiConfiguration> {
    const onu = await this.getOnuWithContext(onuId, actor);
    const targetIp = this.resolveManagementIp(onu);

    const creds = await credentialService.resolveCredentials({
      onuId,
      profileId: onu.profile_id,
      branchId: onu.branch_id,
    });

    if (!creds) {
      throw HttpError.badRequest('No management credentials configured for this ONU');
    }

    const client = new OnuHttpClient(targetIp, onu.web_port || 80, onu.web_protocol || 'http');
    const adapter = getOnuAdapter(onu.adapter_type || 'generic_web');

    const session = await adapter.authenticate(client, creds.username, creds.passwordDecrypted);
    try {
      const config = await adapter.getWifiConfiguration(session);

      // Save detected SSIDs on ONU record
      const band2g = config.bands.find((b) => b.band === '2.4GHz')?.ssid;
      const band5g = config.bands.find((b) => b.band === '5GHz')?.ssid;

      await query(
        `UPDATE onus
            SET wifi_ssid_2g = COALESCE($2, wifi_ssid_2g),
                wifi_ssid_5g = COALESCE($3, wifi_ssid_5g),
                updated_at = NOW()
          WHERE id = $1`,
        [onuId, band2g || null, band5g || null]
      );

      return config;
    } finally {
      await adapter.closeSession(session);
    }
  }

  /**
   * Apply Wi-Fi SSID and/or password changes with strict verification
   */
  async updateWifiSettings(
    onuId: number,
    params: {
      band: '2.4GHz' | '5GHz';
      ssid?: string;
      password?: string;
      customerId?: number;
    },
    actor?: AuthSession
  ): Promise<OnuOperationResult> {
    const onu = await this.getOnuWithContext(onuId, actor);
    const targetIp = this.resolveManagementIp(onu);

    const creds = await credentialService.resolveCredentials({
      onuId,
      profileId: onu.profile_id,
      branchId: onu.branch_id,
    });

    if (!creds) {
      throw HttpError.badRequest('No management credentials configured for this ONU or its model profile');
    }

    const client = new OnuHttpClient(targetIp, onu.web_port || 80, onu.web_protocol || 'http');
    const adapter = getOnuAdapter(onu.adapter_type || 'generic_web');

    const session = await adapter.authenticate(client, creds.username, creds.passwordDecrypted);

    try {
      const result = await adapter.applyWifiConfiguration(session, {
        band: params.band,
        ssid: params.ssid,
        password: params.password,
      });

      // Update ONU record with result
      const newSsidCol = params.band === '5GHz' ? 'wifi_ssid_5g' : 'wifi_ssid_2g';
      await query(
        `UPDATE onus
            SET ${newSsidCol} = COALESCE($2, ${newSsidCol}),
                last_wifi_configured_at = NOW(),
                wifi_last_status = $3,
                updated_at = NOW()
          WHERE id = $1`,
        [onuId, params.ssid ? params.ssid.trim() : null, result.verified ? 'verified' : 'unverified']
      );

      // Audit Log: Record operation without EVER logging passwords
      await this.logActivity({
        onuId,
        customerId: params.customerId,
        branchId: onu.branch_id,
        operator: actor,
        operationType: params.ssid && params.password ? 'change_both' : params.ssid ? 'change_ssid' : 'change_password',
        vendor: onu.vendor_id || onu.model,
        model: onu.model,
        targetIp,
        status: result.success ? 'success' : 'failed',
        verificationStatus: result.verificationStatus,
        sanitizedDetails: {
          band: params.band,
          newSsid: params.ssid || undefined,
          passwordUpdated: !!params.password,
          verified: result.verified,
        },
        durationMs: result.durationMs,
      });

      return result;
    } finally {
      await adapter.closeSession(session);
    }
  }

  /**
   * Log an activity without leaking any passwords, keys, or tokens
   */
  private async logActivity(data: {
    onuId?: number;
    customerId?: number;
    branchId?: number | null;
    operator?: AuthSession;
    operationType: string;
    vendor?: string;
    model?: string;
    targetIp?: string;
    status: 'started' | 'success' | 'failed' | 'unsupported' | 'unverified';
    verificationStatus?: 'verified' | 'unverified' | 'failed' | 'not_applicable';
    sanitizedDetails?: Record<string, any>;
    errorMessage?: string;
    durationMs?: number;
  }): Promise<void> {
    try {
      await query(
        `INSERT INTO onu_management_activity_logs (
           onu_id, customer_id, branch_id, operator_id, operator_username,
           operation_type, vendor, model, target_ip, status, verification_status,
           sanitized_details, error_message, duration_ms, created_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW())`,
        [
          data.onuId || null,
          data.customerId || null,
          data.branchId || null,
          data.operator?.userId || null,
          data.operator?.username || null,
          data.operationType,
          data.vendor || null,
          data.model || null,
          data.targetIp || null,
          data.status,
          data.verificationStatus || 'not_applicable',
          JSON.stringify(data.sanitizedDetails || {}),
          data.errorMessage || null,
          data.durationMs || 0,
        ]
      );
    } catch (e: any) {
      console.warn('[ONU Log] Failed to insert activity log:', e.message);
    }
  }
}

export const onuManagementService = new OnuManagementService();
