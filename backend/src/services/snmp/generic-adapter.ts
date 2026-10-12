import type { SnmpClient } from './snmp-client';
import type { HardwareHealth, OidMetadata, OltAlarm, OltVendor, OnuOpticalTelemetry } from './types';

export interface OltVendorAdapter {
  readonly vendor: OltVendor;
  getSupportedOids(): OidMetadata[];
  collectHardwareHealth(client: SnmpClient): Promise<HardwareHealth>;
  collectOnuTelemetry(client: SnmpClient): Promise<OnuOpticalTelemetry[]>;
  collectAlarms(client: SnmpClient): Promise<OltAlarm[]>;
}

export class GenericAdapter implements OltVendorAdapter {
  readonly vendor: OltVendor;

  constructor(vendor: OltVendor = 'Other') {
    this.vendor = vendor;
  }

  getSupportedOids(): OidMetadata[] {
    return [];
  }

  async collectHardwareHealth(_client: SnmpClient): Promise<HardwareHealth> {
    return {
      cpuUtilization: null,
      memoryUtilization: null,
      temperature: null,
      fansStatus: null,
      powerStatus: null,
      isCpuSupported: false,
      isMemorySupported: false,
      isTemperatureSupported: false,
      isFansSupported: false,
      isPowerSupported: false,
    };
  }

  async collectOnuTelemetry(_client: SnmpClient): Promise<OnuOpticalTelemetry[]> {
    // Unsupported vendor OIDs are not fabricated with fake 0 values
    return [];
  }

  async collectAlarms(_client: SnmpClient): Promise<OltAlarm[]> {
    return [];
  }
}

export class BdcomAdapter extends GenericAdapter {
  constructor() {
    super('BDCOM');
  }
}

export class PowertechAdapter extends GenericAdapter {
  constructor() {
    super('Powertech');
  }
}

export class VsolAdapter extends GenericAdapter {
  constructor() {
    super('VSOL');
  }
}
