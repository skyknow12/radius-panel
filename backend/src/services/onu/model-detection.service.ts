import { query } from '../../db/pool';
import { deviceIdentityService } from './device-identity.service';
import type { OnuIdentity } from './types';

export class ModelDetectionService {
  /**
   * Process a discovered or synchronized ONU to match an existing profile
   * or register a pending model request deduplicated by vendor/model/firmware.
   */
  async processDetectedOnu(params: {
    onuId: number;
    oltId: number;
    branchId?: number | null;
    serialNumber: string;
    vendorId?: string | null;
    equipmentId?: string | null;
    description?: string | null;
    managementIp?: string | null;
  }): Promise<OnuIdentity> {
    const { onuId, oltId, branchId, serialNumber, vendorId, equipmentId, description, managementIp } = params;

    // 1. Identify device
    const identity = deviceIdentityService.identifyOnu({
      serialNumber,
      vendorId,
      equipmentId,
      description,
      managementIp,
    });

    // 2. Search for matching active model profile
    let matchedProfileId: number | null = null;
    let managementStatus = identity.managementStatus;

    if (identity.vendor !== 'Other' && identity.model !== 'Unknown model') {
      const { rows: profiles } = await query<{ id: number; status: string }>(
        `SELECT id, status
           FROM onu_model_profiles
          WHERE LOWER(vendor) = LOWER($1)
            AND LOWER(model) = LOWER($2)
            AND status != 'disabled'
          ORDER BY (status = 'active') DESC, id ASC
          LIMIT 1`,
        [identity.vendor, identity.model]
      );

      if (profiles[0]) {
        matchedProfileId = profiles[0].id;
        managementStatus = profiles[0].status === 'active' ? 'configured' : 'unconfigured';
      }
    }

    // 3. If no matching profile exists, upsert into onu_model_requests
    if (!matchedProfileId && identity.vendor && identity.model) {
      await query(
        `INSERT INTO onu_model_requests (
           vendor, model, firmware, detected_on_olt_id, detected_on_branch_id,
           sample_onu_id, sample_serial_number, sample_management_ip,
           web_status, device_count, status, first_detected_at, last_detected_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 1, 'pending', NOW(), NOW())
         ON CONFLICT (vendor, model, firmware) DO UPDATE SET
           device_count = onu_model_requests.device_count + 1,
           last_detected_at = NOW(),
           sample_management_ip = COALESCE(EXCLUDED.sample_management_ip, onu_model_requests.sample_management_ip),
           web_status = COALESCE(EXCLUDED.web_status, onu_model_requests.web_status),
           updated_at = NOW()`,
        [
          identity.vendor,
          identity.model,
          identity.firmwareVersion || '',
          oltId,
          branchId || null,
          onuId,
          serialNumber,
          managementIp || null,
          identity.webStatus,
        ]
      ).catch(() => {});

      managementStatus = 'pending_profile';
    }

    // 4. Update the ONU record with detected metadata and linked profile
    await query(
      `UPDATE onus
          SET vendor_id = COALESCE($2, vendor_id),
              model = COALESCE($3, model),
              management_ip = COALESCE($4, management_ip),
              profile_id = COALESCE($5, profile_id),
              management_status = $6,
              updated_at = NOW()
        WHERE id = $1`,
      [
        onuId,
        identity.vendor !== 'Other' ? identity.vendor : null,
        identity.model !== 'Unknown model' ? identity.model : null,
        managementIp || null,
        matchedProfileId,
        managementStatus,
      ]
    ).catch(() => {});

    return {
      ...identity,
      matchedProfileId,
      managementStatus,
    };
  }
}

export const modelDetectionService = new ModelDetectionService();
