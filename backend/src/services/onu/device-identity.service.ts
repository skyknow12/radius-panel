import type { OnuIdentity, OnuVendor } from './types';

/**
 * Standard GPON Vendor ID 4-character prefixes (ITU-T G.984.3)
 */
const VENDOR_PREFIX_MAP: Record<string, OnuVendor> = {
  HWTC: 'Huawei',
  HWTZ: 'Huawei',
  ZTEG: 'ZTE',
  FHTT: 'Fiberhome',
  BDCM: 'BDCOM',
  VSOL: 'VSOL',
  PTCH: 'Powertech',
  PWRT: 'Powertech',
};

/**
 * Common Model Patterns detected via OLT OMCI Equipment ID or Description
 */
const MODEL_PATTERNS: Array<{ pattern: RegExp; vendor: OnuVendor; model: string }> = [
  // Huawei
  { pattern: /HG8145V5/i, vendor: 'Huawei', model: 'HG8145V5' },
  { pattern: /EG8145V5/i, vendor: 'Huawei', model: 'EG8145V5' },
  { pattern: /HG8245H/i, vendor: 'Huawei', model: 'HG8245H' },
  { pattern: /HG8546M/i, vendor: 'Huawei', model: 'HG8546M' },
  { pattern: /EG8247H/i, vendor: 'Huawei', model: 'EG8247H' },
  { pattern: /EG8141A5/i, vendor: 'Huawei', model: 'EG8141A5' },

  // ZTE
  { pattern: /F670L/i, vendor: 'ZTE', model: 'F670L' },
  { pattern: /F660/i, vendor: 'ZTE', model: 'F660' },
  { pattern: /F609/i, vendor: 'ZTE', model: 'F609' },
  { pattern: /ZXHN\s*F670/i, vendor: 'ZTE', model: 'F670L' },

  // FiberHome
  { pattern: /AN5506-02/i, vendor: 'Fiberhome', model: 'AN5506-02' },
  { pattern: /AN5506-04/i, vendor: 'Fiberhome', model: 'AN5506-04' },
  { pattern: /HG6821M/i, vendor: 'Fiberhome', model: 'HG6821M' },

  // BDCOM
  { pattern: /GP1704/i, vendor: 'BDCOM', model: 'GP1704' },
  { pattern: /GP1702/i, vendor: 'BDCOM', model: 'GP1702' },

  // VSOL
  { pattern: /V2804/i, vendor: 'VSOL', model: 'V2804' },
  { pattern: /V2801/i, vendor: 'VSOL', model: 'V2801' },
];

export class DeviceIdentityService {
  /**
   * Normalize and identify ONU vendor and model from multiple inputs
   */
  identifyOnu(input: {
    serialNumber: string;
    vendorId?: string | null;
    equipmentId?: string | null;
    description?: string | null;
    oltVendor?: string | null;
    managementIp?: string | null;
    webTitle?: string | null;
    serverHeader?: string | null;
  }): OnuIdentity {
    const rawSn = (input.serialNumber || '').trim().toUpperCase();
    const rawVendorId = (input.vendorId || '').trim().toUpperCase();
    const rawEquipmentId = (input.equipmentId || '').trim();
    const rawDesc = (input.description || '').trim();

    const evidenceList: string[] = [];

    // 1. Identify Vendor by Serial Prefix or Vendor ID
    let detectedVendor: OnuVendor = 'Other';
    const snPrefix = rawSn.slice(0, 4);

    if (rawVendorId && VENDOR_PREFIX_MAP[rawVendorId]) {
      detectedVendor = VENDOR_PREFIX_MAP[rawVendorId];
      evidenceList.push(`OLT Vendor ID: ${rawVendorId} (${detectedVendor})`);
    } else if (VENDOR_PREFIX_MAP[snPrefix]) {
      detectedVendor = VENDOR_PREFIX_MAP[snPrefix];
      evidenceList.push(`Serial Prefix: ${snPrefix} (${detectedVendor})`);
    } else if (/^48575443/i.test(rawSn)) {
      // Hex representation of 'HWTC'
      detectedVendor = 'Huawei';
      evidenceList.push(`Hex Serial Prefix: 48575443 (Huawei)`);
    } else if (/^5A544547/i.test(rawSn)) {
      // Hex representation of 'ZTEG'
      detectedVendor = 'ZTE';
      evidenceList.push(`Hex Serial Prefix: 5A544547 (ZTE)`);
    }

    // 2. Identify Model from Equipment ID or Description
    let detectedModel = 'Unknown model';
    let confidence: 'high' | 'medium' | 'low' = 'low';

    // Check Equipment ID first (preferred)
    if (rawEquipmentId) {
      evidenceList.push(`OLT Equipment ID: "${rawEquipmentId}"`);
      for (const entry of MODEL_PATTERNS) {
        if (entry.pattern.test(rawEquipmentId)) {
          detectedModel = entry.model;
          if (detectedVendor === 'Other') detectedVendor = entry.vendor;
          confidence = 'high';
          evidenceList.push(`Matched known pattern: ${entry.model}`);
          break;
        }
      }

      // If not in standard pattern list, but equipment ID is clean alphanumeric string
      if (detectedModel === 'Unknown model' && /^[a-zA-Z0-9_-]{3,24}$/.test(rawEquipmentId)) {
        detectedModel = rawEquipmentId;
        confidence = detectedVendor !== 'Other' ? 'medium' : 'low';
        evidenceList.push(`Direct Equipment ID fallback: ${rawEquipmentId}`);
      }
    }

    // If still unknown, check Description
    if (detectedModel === 'Unknown model' && rawDesc) {
      for (const entry of MODEL_PATTERNS) {
        if (entry.pattern.test(rawDesc)) {
          detectedModel = entry.model;
          if (detectedVendor === 'Other') detectedVendor = entry.vendor;
          confidence = 'medium';
          evidenceList.push(`Found in Description: ${entry.model}`);
          break;
        }
      }
    }

    // 3. Web Login Page Evidence (secondary, only if reachable)
    if (input.webTitle || input.serverHeader) {
      evidenceList.push(`Web signature: title="${input.webTitle || ''}", server="${input.serverHeader || ''}"`);
      if (detectedVendor === 'Other') {
        if (/huawei/i.test(input.webTitle || '') || /huawei/i.test(input.serverHeader || '')) {
          detectedVendor = 'Huawei';
        } else if (/zte/i.test(input.webTitle || '') || /zte/i.test(input.serverHeader || '')) {
          detectedVendor = 'ZTE';
        }
      }
    }

    const managementStatus =
      detectedModel === 'Unknown model' || detectedVendor === 'Other'
        ? 'pending_profile'
        : 'unconfigured';

    return {
      vendor: detectedVendor,
      model: detectedModel,
      serialNumber: rawSn,
      managementIp: input.managementIp || null,
      webPort: 80,
      webProtocol: 'http',
      webStatus: input.managementIp ? 'unknown' : 'unreachable',
      managementStatus,
      identificationConfidence: confidence,
      evidenceSummary: evidenceList.join('; ') || 'No identifiable device evidence available',
    };
  }
}

export const deviceIdentityService = new DeviceIdentityService();
