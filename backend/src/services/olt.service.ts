import { oltRepository, OltItem, OnuItem } from '../repositories/olt.repository';
import { huaweiDriver } from './olt/huawei-driver';
import { DiscoveredOnt, OpticalInfo } from './olt/huawei-parser';
import { HttpError } from '../lib/http-error';
import { isSuperAdmin, isIspAdmin, isBranchUser } from '../lib/access-control';
import type { AuthSession } from './auth.service';
import { query } from '../db/pool';
import { logger } from '../lib/logger';

export interface ProvisionOnuInput {
  slot: number;
  port: number;
  serialNumber: string;
  lineProfileId: number;
  serviceProfileId: number;
  description?: string;
  vlanId: number;
  userVlanId: number;
  gemPort?: number;
  tagTransform?: string;
  customerId?: number;
}

export const oltService = {
  /**
   * Test CLI connectivity to OLT
   */
  async testConnection(oltId: number, actor?: AuthSession) {
    const creds = await oltRepository.getDecryptedCredentials(oltId);
    if (!creds) throw HttpError.notFound('OLT not found');

    if (isBranchUser(actor) && creds.branchId && creds.branchId !== actor?.branchId) {
      throw HttpError.forbidden('Access denied to OLT belonging to another branch');
    }

    const result = await huaweiDriver.testConnection(creds);

    await oltRepository.updateConnectionStatus(
      oltId,
      result.success ? 'online' : 'error',
      result.success ? null : result.message
    );

    await oltRepository.logOperation(
      oltId,
      'test_connection',
      `CLI connectivity test: ${result.message}`,
      result.success ? 'success' : 'failed',
      result.rawOutput,
      actor
    );

    return result;
  },

  /**
   * Complete inventory synchronization across OLT GPON boards & PON ports
   */
  async syncOlt(oltId: number, actor?: AuthSession) {
    const creds = await oltRepository.getDecryptedCredentials(oltId);
    if (!creds) throw HttpError.notFound('OLT not found');

    if (isBranchUser(actor) && creds.branchId && creds.branchId !== actor?.branchId) {
      throw HttpError.forbidden('Access denied to OLT belonging to another branch');
    }

    const opId = await oltRepository.logOperation(
      oltId,
      'sync_inventory',
      'Started full OLT hardware inventory synchronization',
      'started',
      undefined,
      actor
    );

    try {
      // 1. Fetch all registered ONUs from OLT
      const liveOnus = await huaweiDriver.getRegisteredOnus(creds);

      let onlineCount = 0;
      let offlineCount = 0;
      const seenSerials = new Set<string>();

      // 2. Idempotently update / insert each ONU
      for (const onu of liveOnus) {
        seenSerials.add(onu.serialNumber.toUpperCase());
        if (onu.runState === 'online') onlineCount++;
        else offlineCount++;

        await oltRepository.upsertOnu({
          olt_id: oltId,
          serial_number: onu.serialNumber,
          frame: onu.frame,
          slot: onu.slot,
          pon_port: onu.ponPort,
          ont_id: onu.ontId,
          description: onu.description,
          run_state: onu.runState,
          config_state: onu.configState,
          match_state: onu.matchState,
          line_profile_id: onu.lineProfileId,
          line_profile_name: onu.lineProfileName,
          service_profile_id: onu.serviceProfileId,
          service_profile_name: onu.serviceProfileName,
          last_up_time: onu.lastUpTime,
          last_down_time: onu.lastDownTime,
          last_down_cause: onu.lastDownCause,
        });
      }

      // 3. Mark missing ONUs that were previously registered but not returned
      if (seenSerials.size > 0) {
        const { rows: existingRows } = await query<{ serial_number: string }>(
          'SELECT serial_number FROM onus WHERE olt_id = $1 AND registration_state = \'registered\'',
          [oltId]
        );

        for (const er of existingRows) {
          if (!seenSerials.has(er.serial_number.toUpperCase())) {
            await query(
              'UPDATE onus SET run_state = \'missing\', registration_state = \'missing\', updated_at = NOW() WHERE olt_id = $1 AND serial_number = $2',
              [oltId, er.serial_number]
            );
          }
        }
      }

      // 4. Update OLT status and timestamp
      await query(
        `UPDATE olts
            SET connection_status = 'online',
                last_seen_at = NOW(),
                last_sync_at = NOW(),
                last_error = NULL,
                updated_at = NOW()
          WHERE id = $1`,
        [oltId]
      );

      const summary = `Synchronized ${liveOnus.length} ONUs (${onlineCount} online, ${offlineCount} offline)`;
      await query(
        'UPDATE olt_operation_history SET status = \'success\', sanitized_result = $1, completed_at = NOW() WHERE id = $2',
        [summary, opId]
      );

      return {
        success: true,
        total: liveOnus.length,
        online: onlineCount,
        offline: offlineCount,
        message: summary,
      };
    } catch (err: any) {
      await oltRepository.updateConnectionStatus(oltId, 'error', err.message);
      await query(
        'UPDATE olt_operation_history SET status = \'failed\', sanitized_result = $1, completed_at = NOW() WHERE id = $2',
        [`Sync failed: ${err.message}`, opId]
      );
      throw err;
    }
  },

  /**
   * Discover unregistered ONUs (autofind)
   */
  async discoverUnregistered(
    oltId: number,
    options?: { slot?: number; port?: number },
    actor?: AuthSession
  ): Promise<DiscoveredOnt[]> {
    const creds = await oltRepository.getDecryptedCredentials(oltId);
    if (!creds) throw HttpError.notFound('OLT not found');

    if (isBranchUser(actor) && creds.branchId && creds.branchId !== actor?.branchId) {
      throw HttpError.forbidden('Access denied to OLT belonging to another branch');
    }

    const discovered = await huaweiDriver.discoverUnregisteredOnus(creds, options);

    await oltRepository.logOperation(
      oltId,
      'discover_onus',
      `Autofind query returned ${discovered.length} unregistered ONUs`,
      'success',
      undefined,
      actor
    );

    return discovered;
  },

  /**
   * Read optical power for an ONU
   */
  async getOpticalPower(oltId: number, onuId: number, actor?: AuthSession): Promise<OpticalInfo> {
    const creds = await oltRepository.getDecryptedCredentials(oltId);
    if (!creds) throw HttpError.notFound('OLT not found');

    const onuRes = await query<{
      serial_number: string;
      frame: number;
      slot: number;
      pon_port: number;
      ont_id: number;
    }>('SELECT serial_number, frame, slot, pon_port, ont_id FROM onus WHERE id = $1 AND olt_id = $2', [
      onuId,
      oltId,
    ]);

    if (!onuRes.rows[0]) throw HttpError.notFound('ONU not found');
    const onu = onuRes.rows[0];

    const reading = await huaweiDriver.getOpticalInfo(creds, onu.slot, onu.pon_port, onu.ont_id);

    await oltRepository.saveOpticalReading({
      olt_id: oltId,
      onu_id: onuId,
      serial_number: onu.serial_number,
      frame: onu.frame,
      slot: onu.slot,
      pon_port: onu.pon_port,
      ont_id: onu.ont_id,
      rx_power: reading.rxPower,
      tx_power: reading.txPower,
      olt_rx_power: reading.oltRxPower,
      temperature: reading.temperature,
      voltage: reading.voltage,
      bias_current: reading.biasCurrent,
      source: 'cli',
      collection_status: reading.isAvailable ? 'success' : 'failed',
      error_message: reading.isAvailable ? undefined : 'Optical reading unavailable',
    });

    return reading;
  },

  /**
   * Provision new ONU and create service port
   */
  async provisionOnu(oltId: number, input: ProvisionOnuInput, actor?: AuthSession) {
    const creds = await oltRepository.getDecryptedCredentials(oltId);
    if (!creds) throw HttpError.notFound('OLT not found');

    if (isBranchUser(actor) && creds.branchId && creds.branchId !== actor?.branchId) {
      throw HttpError.forbidden('Access denied to OLT belonging to another branch');
    }

    // 1. Verify serial number is not already registered on this OLT
    const existing = await query(
      'SELECT id FROM onus WHERE olt_id = $1 AND lower(serial_number) = lower($2) AND registration_state = \'registered\'',
      [oltId, input.serialNumber.trim()]
    );
    if (existing.rows.length > 0) {
      throw HttpError.badRequest(`Serial number ${input.serialNumber} is already registered on this OLT`);
    }

    const opSummary = `Provision ONU ${input.serialNumber} on 0/${input.slot}/${input.port} (VLAN ${input.vlanId}, LineProfile ${input.lineProfileId}, SrvProfile ${input.serviceProfileId})`;
    const opId = await oltRepository.logOperation(oltId, 'provision_onu', opSummary, 'started', undefined, actor);

    const result = await huaweiDriver.provisionOnu(creds, input);

    if (!result.success && !result.servicePortCreated && result.assignedOntId === -1) {
      await query(
        'UPDATE olt_operation_history SET status = \'failed\', sanitized_result = $1, completed_at = NOW() WHERE id = $2',
        [`Provisioning failed at ${result.errorStep}: ${result.errorMessage}`, opId]
      );
      throw HttpError.badRequest(`OLT provisioning failed: ${result.errorMessage || 'Unknown error'}`);
    }

    // Save registered ONU to DB
    const onuDbId = await oltRepository.upsertOnu({
      olt_id: oltId,
      serial_number: input.serialNumber,
      frame: 0,
      slot: input.slot,
      pon_port: input.port,
      ont_id: result.assignedOntId,
      description: input.description,
      run_state: 'offline',
      config_state: result.servicePortCreated ? 'normal' : 'initial',
      match_state: 'match',
      line_profile_id: input.lineProfileId,
      service_profile_id: input.serviceProfileId,
    });

    // Save service port if created
    if (result.servicePortCreated && result.servicePortIndex) {
      await query(
        `INSERT INTO olt_service_ports (
           olt_id, service_port_id, vlan_id, user_vlan_id, frame, slot, pon_port, ont_id, gemport, tag_transform, status
         ) VALUES ($1, $2, $3, $4, 0, $5, $6, $7, $8, $9, 'active')`,
        [
          oltId,
          result.servicePortIndex,
          input.vlanId,
          input.userVlanId,
          input.slot,
          input.port,
          result.assignedOntId,
          input.gemPort || 10,
          input.tagTransform || 'translate',
        ]
      );
    }

    // Customer association if specified
    if (input.customerId) {
      await oltRepository.associateCustomer(input.customerId, onuDbId, actor, 'manual');
    }

    const finalStatus = result.servicePortCreated ? 'success' : 'partial_success';
    await query(
      'UPDATE olt_operation_history SET status = $1, sanitized_result = $2, completed_at = NOW() WHERE id = $3',
      [
        finalStatus,
        result.servicePortCreated
          ? `Successfully provisioned ONT ID ${result.assignedOntId} with Service Port ${result.servicePortIndex}`
          : `ONT registered (ID: ${result.assignedOntId}) but service-port failed: ${result.errorMessage}`,
        opId,
      ]
    );

    return {
      ...result,
      onuId: onuDbId,
    };
  },

  /**
   * Delete ONU from OLT and database
   */
  async deleteOnu(oltId: number, onuId: number, actor?: AuthSession) {
    const creds = await oltRepository.getDecryptedCredentials(oltId);
    if (!creds) throw HttpError.notFound('OLT not found');

    if (isBranchUser(actor) && creds.branchId && creds.branchId !== actor?.branchId) {
      throw HttpError.forbidden('Access denied to OLT belonging to another branch');
    }

    const onuRes = await query<{
      serial_number: string;
      slot: number;
      pon_port: number;
      ont_id: number;
    }>('SELECT serial_number, slot, pon_port, ont_id FROM onus WHERE id = $1 AND olt_id = $2', [
      onuId,
      oltId,
    ]);

    if (!onuRes.rows[0]) throw HttpError.notFound('ONU not found');
    const onu = onuRes.rows[0];

    const delRes = await huaweiDriver.deleteOnu(creds, {
      slot: onu.slot,
      port: onu.pon_port,
      ontId: onu.ont_id,
    });

    if (!delRes.success) {
      throw HttpError.badRequest(`Failed to delete ONU from OLT: ${delRes.errorMessage || 'Hardware command error'}`);
    }

    // Remove from DB
    await query('DELETE FROM onus WHERE id = $1', [onuId]);

    await oltRepository.logOperation(
      oltId,
      'delete_onu',
      `Deleted ONU SN ${onu.serial_number} (ONT ID ${onu.ont_id} on 0/${onu.slot}/${onu.pon_port})`,
      'success',
      undefined,
      actor
    );

    return { success: true };
  },

  /**
   * Search matching customer by ONU serial number, description, or MAC
   */
  async findMatchingCustomer(serialNumber: string, description?: string, macAddress?: string): Promise<any | null> {
    // 1. Match by exact serial number in subscribers (e.g. notes or mac)
    if (macAddress) {
      const macClean = macAddress.toLowerCase().replace(/[^a-f0-9]/g, '');
      const macRes = await query(
        'SELECT id, username, full_name, branch_id FROM subscribers WHERE replace(lower(COALESCE(mac_address, \'\')), \':\', \'\') = $1',
        [macClean]
      );
      if (macRes.rows.length === 1) {
        return { customer: macRes.rows[0], matchType: 'mac_match' };
      }
    }

    // 2. Match by customer phone or username in description
    if (description && description.trim().length >= 4) {
      const cleanDesc = description.trim();
      const descRes = await query(
        'SELECT id, username, full_name, branch_id FROM subscribers WHERE username = $1 OR phone = $1',
        [cleanDesc]
      );
      if (descRes.rows.length === 1) {
        return { customer: descRes.rows[0], matchType: 'description_match' };
      }
    }

    return null;
  },
};
