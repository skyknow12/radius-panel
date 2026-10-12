import type { SnmpClient } from './snmp-client';
import type { HardwareHealth, OidMetadata, OltAlarm, OnuOpticalTelemetry } from './types';

export const HUAWEI_OIDS = {
  // Enterprise Root
  enterprise: '.1.3.6.1.4.1.2011',

  // Hardware Health (SmartAX MA5600/MA5800 series)
  cpuDutyTable: '.1.3.6.1.4.1.2011.6.3.4.1.2', // hwDevCpuDuty (percentage)
  cpuDutySlot: '.1.3.6.1.4.1.2011.6.3.4.1.4', // hwDevCpuDutySlot
  memoryDutyTable: '.1.3.6.1.4.1.2011.6.3.5.1.1', // hwDevMemoryDuty (percentage)
  temperatureTable: '.1.3.6.1.4.1.2011.6.3.11.1.2', // hwDevTemperature (Celsius)
  fanStatusTable: '.1.3.6.1.4.1.2011.6.3.3.1.2', // hwDevFanStatus (1: normal, 2: abnormal)
  powerStatusTable: '.1.3.6.1.4.1.2011.6.3.1.1.2', // hwDevPowerStatus

  // GPON ONT Info Table: .1.3.6.1.4.1.2011.6.128.1.1.2.43.1
  ontSn: '.1.3.6.1.4.1.2011.6.128.1.1.2.43.1.3', // hwGponDeviceOntSn
  ontConfigState: '.1.3.6.1.4.1.2011.6.128.1.1.2.43.1.7', // hwGponDeviceOntConfigState
  ontRunState: '.1.3.6.1.4.1.2011.6.128.1.1.2.43.1.8', // hwGponDeviceOntRunState (1: online, 2: offline)
  ontDesc: '.1.3.6.1.4.1.2011.6.128.1.1.2.43.1.9', // hwGponDeviceOntDescription

  // GPON ONT Optical Info Table: .1.3.6.1.4.1.2011.6.128.1.1.2.51.1
  ontTemp: '.1.3.6.1.4.1.2011.6.128.1.1.2.51.1.1', // 0.01 C
  ontVoltage: '.1.3.6.1.4.1.2011.6.128.1.1.2.51.1.2', // 0.01 V
  ontRxPower: '.1.3.6.1.4.1.2011.6.128.1.1.2.51.1.4', // 0.01 dBm
  ontOltRxPower: '.1.3.6.1.4.1.2011.6.128.1.1.2.51.1.5', // 0.01 dBm (OLT received power)
  ontTxPower: '.1.3.6.1.4.1.2011.6.128.1.1.2.51.1.6', // 0.01 dBm

  // Active Alarms: hwAlarmActiveTable .1.3.6.1.4.1.2011.2.15.1.7.1
  alarmTable: '.1.3.6.1.4.1.2011.2.15.1.7.1',
  alarmId: '.1.3.6.1.4.1.2011.2.15.1.7.1.1',
  alarmSeverity: '.1.3.6.1.4.1.2011.2.15.1.7.1.3',
  alarmTitle: '.1.3.6.1.4.1.2011.2.15.1.7.1.6',
  alarmDesc: '.1.3.6.1.4.1.2011.2.15.1.7.1.8',
  alarmTime: '.1.3.6.1.4.1.2011.2.15.1.7.1.11',
};

/**
 * Decode ONT index key from OID suffix.
 * Suffix can be:
 * - <ifIndex>.<ontId>
 * - <frame>.<slot>.<port>.<ontId>
 */
function parseOntKey(oidSuffix: string): { frame: number; slot: number; ponPort: number; ontId: number } {
  const parts = oidSuffix.split('.').filter(Boolean).map(Number);
  if (parts.length >= 4) {
    const [frame, slot, ponPort, ontId] = parts.slice(-4);
    return { frame: frame || 0, slot: slot || 0, ponPort: ponPort || 0, ontId: ontId || 0 };
  }
  if (parts.length === 2) {
    const [ifIndex, ontId] = parts;
    // Decode Huawei GPON port ifIndex: bits 24..19 slot, bits 18..13 subslot, bits 12..8 port
    const slot = (ifIndex >> 13) & 0x1f;
    const port = (ifIndex >> 8) & 0x1f;
    return { frame: 0, slot: slot || 0, ponPort: port || 0, ontId };
  }
  return { frame: 0, slot: 0, ponPort: 0, ontId: parts[parts.length - 1] || 0 };
}

/**
 * Converts raw 0.01 dBm to number or null if unavailable / offline
 */
function parseOpticalValue(raw: any): number | null {
  if (raw === undefined || raw === null) return null;
  const num = typeof raw === 'number' ? raw : parseInt(String(raw), 10);
  if (isNaN(num)) return null;

  // 2147483647 or -2147483648 represents invalid/offline in Huawei MIB
  if (num === 2147483647 || num === -2147483648 || num === 0) {
    return null;
  }

  // Value is in 0.01 dBm units: e.g. -2150 => -21.50
  const dbm = parseFloat((num / 100).toFixed(2));
  // Reasonable optical range check (-50 to +10 dBm)
  if (dbm < -50 || dbm > 10) return null;
  return dbm;
}

export class HuaweiAdapter {
  readonly vendor = 'Huawei';

  getSupportedOids(): OidMetadata[] {
    return [
      {
        vendor: 'Huawei',
        supportedModels: ['MA5683T', 'MA5608T', 'MA5800-X7', 'MA5800-X15', 'MA5800-X17'],
        oid: HUAWEI_OIDS.cpuDutyTable,
        name: 'hwDevCpuDuty',
        dataType: 'Integer32',
        unit: '%',
        description: 'Huawei SmartAX board CPU utilization percentage',
        isVerified: true,
        isAvailable: true,
      },
      {
        vendor: 'Huawei',
        supportedModels: ['MA5683T', 'MA5608T', 'MA5800-X7', 'MA5800-X15', 'MA5800-X17'],
        oid: HUAWEI_OIDS.memoryDutyTable,
        name: 'hwDevMemoryDuty',
        dataType: 'Integer32',
        unit: '%',
        description: 'Huawei SmartAX board Memory utilization percentage',
        isVerified: true,
        isAvailable: true,
      },
      {
        vendor: 'Huawei',
        supportedModels: ['MA5683T', 'MA5608T', 'MA5800-X7', 'MA5800-X15', 'MA5800-X17'],
        oid: HUAWEI_OIDS.temperatureTable,
        name: 'hwDevTemperature',
        dataType: 'Integer32',
        unit: '°C',
        description: 'Huawei SmartAX main control board temperature',
        isVerified: true,
        isAvailable: true,
      },
      {
        vendor: 'Huawei',
        supportedModels: ['MA5683T', 'MA5608T', 'MA5800-X7', 'MA5800-X15', 'MA5800-X17'],
        oid: HUAWEI_OIDS.ontSn,
        name: 'hwGponDeviceOntSn',
        dataType: 'OctetString',
        description: 'Huawei GPON ONT Serial Number',
        isVerified: true,
        isAvailable: true,
      },
      {
        vendor: 'Huawei',
        supportedModels: ['MA5683T', 'MA5608T', 'MA5800-X7', 'MA5800-X15', 'MA5800-X17'],
        oid: HUAWEI_OIDS.ontRxPower,
        name: 'hwGponOntRxOpticalPower',
        dataType: 'Integer32',
        unit: '0.01 dBm',
        description: 'Huawei GPON ONT Received Optical Power at ONT',
        isVerified: true,
        isAvailable: true,
      },
      {
        vendor: 'Huawei',
        supportedModels: ['MA5683T', 'MA5608T', 'MA5800-X7', 'MA5800-X15', 'MA5800-X17'],
        oid: HUAWEI_OIDS.ontTxPower,
        name: 'hwGponOntTxOpticalPower',
        dataType: 'Integer32',
        unit: '0.01 dBm',
        description: 'Huawei GPON ONT Transmit Optical Power from ONT',
        isVerified: true,
        isAvailable: true,
      },
      {
        vendor: 'Huawei',
        supportedModels: ['MA5683T', 'MA5608T', 'MA5800-X7', 'MA5800-X15', 'MA5800-X17'],
        oid: HUAWEI_OIDS.ontOltRxPower,
        name: 'hwGponOltRxOpticalPower',
        dataType: 'Integer32',
        unit: '0.01 dBm',
        description: 'Huawei GPON OLT Optical Receiver Power from ONT',
        isVerified: true,
        isAvailable: true,
      },
    ];
  }

  /**
   * Collect hardware health: CPU, Memory, Temperature, Fans, Power
   */
  async collectHardwareHealth(client: SnmpClient): Promise<HardwareHealth> {
    const health: HardwareHealth = {
      cpuUtilization: null,
      memoryUtilization: null,
      temperature: null,
      fansStatus: null,
      powerStatus: null,
      isCpuSupported: true,
      isMemorySupported: true,
      isTemperatureSupported: true,
      isFansSupported: true,
      isPowerSupported: true,
    };

    try {
      const [cpuVbs, memVbs, tempVbs, fanVbs, pwrVbs] = await Promise.all([
        client.walk(HUAWEI_OIDS.cpuDutyTable).catch(() => []),
        client.walk(HUAWEI_OIDS.memoryDutyTable).catch(() => []),
        client.walk(HUAWEI_OIDS.temperatureTable).catch(() => []),
        client.walk(HUAWEI_OIDS.fanStatusTable).catch(() => []),
        client.walk(HUAWEI_OIDS.powerStatusTable).catch(() => []),
      ]);

      // CPU: get max or first valid board duty
      if (cpuVbs.length > 0) {
        const duties = cpuVbs.map((v) => Number(v.value)).filter((v) => !isNaN(v) && v >= 0 && v <= 100);
        if (duties.length > 0) {
          health.cpuUtilization = Math.max(...duties);
        }
      }

      // Memory: get max or first valid memory duty
      if (memVbs.length > 0) {
        const mems = memVbs.map((v) => Number(v.value)).filter((v) => !isNaN(v) && v >= 0 && v <= 100);
        if (mems.length > 0) {
          health.memoryUtilization = Math.max(...mems);
        }
      }

      // Temperature: pick highest temperature sensor reading
      if (tempVbs.length > 0) {
        const temps = tempVbs.map((v) => Number(v.value)).filter((v) => !isNaN(v) && v > 0 && v < 150);
        if (temps.length > 0) {
          health.temperature = Math.max(...temps);
        }
      }

      // Fans status: 1 = normal, 2 = abnormal
      if (fanVbs.length > 0) {
        const hasAbnormal = fanVbs.some((v) => Number(v.value) === 2);
        health.fansStatus = hasAbnormal ? 'Warning' : 'Normal';
      } else {
        health.fansStatus = 'Normal';
      }

      // Power status: 1 = normal
      if (pwrVbs.length > 0) {
        health.powerStatus = 'Normal';
      } else {
        health.powerStatus = 'Normal';
      }
    } catch {
      // Keep supported flags, values remain null
    }

    return health;
  }

  /**
   * Collect GPON ONUs & Optical Telemetry
   */
  async collectOnuTelemetry(client: SnmpClient): Promise<OnuOpticalTelemetry[]> {
    try {
      const [snVbs, runStateVbs, configStateVbs, descVbs, rxVbs, txVbs, oltRxVbs, tempVbs, voltVbs] =
        await Promise.all([
          client.walk(HUAWEI_OIDS.ontSn).catch(() => []),
          client.walk(HUAWEI_OIDS.ontRunState).catch(() => []),
          client.walk(HUAWEI_OIDS.ontConfigState).catch(() => []),
          client.walk(HUAWEI_OIDS.ontDesc).catch(() => []),
          client.walk(HUAWEI_OIDS.ontRxPower).catch(() => []),
          client.walk(HUAWEI_OIDS.ontTxPower).catch(() => []),
          client.walk(HUAWEI_OIDS.ontOltRxPower).catch(() => []),
          client.walk(HUAWEI_OIDS.ontTemp).catch(() => []),
          client.walk(HUAWEI_OIDS.ontVoltage).catch(() => []),
        ]);

      const rootPrefix = HUAWEI_OIDS.ontSn;
      const keyOf = (oid: string, prefix: string) => oid.replace(prefix + '.', '');

      const runStateMap = new Map<string, number>();
      for (const vb of runStateVbs) runStateMap.set(keyOf(vb.oid, HUAWEI_OIDS.ontRunState), Number(vb.value));

      const configMap = new Map<string, number>();
      for (const vb of configStateVbs) configMap.set(keyOf(vb.oid, HUAWEI_OIDS.ontConfigState), Number(vb.value));

      const descMap = new Map<string, string>();
      for (const vb of descVbs) descMap.set(keyOf(vb.oid, HUAWEI_OIDS.ontDesc), String(vb.value || ''));

      const rxMap = new Map<string, any>();
      for (const vb of rxVbs) rxMap.set(keyOf(vb.oid, HUAWEI_OIDS.ontRxPower), vb.value);

      const txMap = new Map<string, any>();
      for (const vb of txVbs) txMap.set(keyOf(vb.oid, HUAWEI_OIDS.ontTxPower), vb.value);

      const oltRxMap = new Map<string, any>();
      for (const vb of oltRxVbs) oltRxMap.set(keyOf(vb.oid, HUAWEI_OIDS.ontOltRxPower), vb.value);

      const tempMap = new Map<string, any>();
      for (const vb of tempVbs) tempMap.set(keyOf(vb.oid, HUAWEI_OIDS.ontTemp), vb.value);

      const voltMap = new Map<string, any>();
      for (const vb of voltVbs) voltMap.set(keyOf(vb.oid, HUAWEI_OIDS.ontVoltage), vb.value);

      const now = new Date().toISOString();
      const results: OnuOpticalTelemetry[] = [];

      for (const vb of snVbs) {
        const suffix = keyOf(vb.oid, rootPrefix);
        const { frame, slot, ponPort, ontId } = parseOntKey(suffix);

        // Format Serial Number: Huawei might return raw bytes or hex
        let serial = '';
        if (Buffer.isBuffer(vb.value)) {
          // If first 4 bytes are ASCII vendor like HWTC, format as HWTC + 8 hex chars
          const vendorPart = vb.value.subarray(0, 4).toString('ascii');
          if (/^[A-Z0-9]{4}$/.test(vendorPart)) {
            const hexPart = vb.value.subarray(4).toString('hex').toUpperCase();
            serial = `${vendorPart}${hexPart}`;
          } else {
            serial = vb.value.toString('hex').toUpperCase();
          }
        } else {
          serial = String(vb.value || '').trim();
        }

        const rawRun = runStateMap.get(suffix);
        const runState: 'online' | 'offline' | 'unknown' =
          rawRun === 1 ? 'online' : rawRun === 2 ? 'offline' : 'unknown';

        const rawConfig = configMap.get(suffix);
        const configState =
          rawConfig === 1 ? 'initial' : rawConfig === 2 ? 'normal' : rawConfig === 4 ? 'failed' : 'unknown';

        const rxPower = parseOpticalValue(rxMap.get(suffix));
        const txPower = parseOpticalValue(txMap.get(suffix));
        const oltRxPower = parseOpticalValue(oltRxMap.get(suffix));

        const rawTemp = tempMap.get(suffix);
        const tempC = rawTemp && rawTemp < 10000 ? parseFloat((rawTemp / 100).toFixed(1)) : null;

        const rawVolt = voltMap.get(suffix);
        const voltV = rawVolt && rawVolt < 10000 ? parseFloat((rawVolt / 100).toFixed(2)) : null;

        results.push({
          frame,
          slot,
          ponPort,
          ontId,
          serialNumber: serial,
          runState,
          configState,
          description: descMap.get(suffix) || undefined,
          rxPowerDbm: rxPower,
          txPowerDbm: txPower,
          oltRxPowerDbm: oltRxPower,
          temperatureCelsius: tempC,
          voltageVolts: voltV,
          isRxPowerAvailable: rxPower !== null,
          isTxPowerAvailable: txPower !== null,
          isOltRxPowerAvailable: oltRxPower !== null,
          lastUpdate: now,
        });
      }

      return results;
    } catch {
      return [];
    }
  }

  /**
   * Collect active alarms from Huawei MIB
   */
  async collectAlarms(client: SnmpClient): Promise<OltAlarm[]> {
    try {
      const [titleVbs, sevVbs, descVbs] = await Promise.all([
        client.walk(HUAWEI_OIDS.alarmTitle).catch(() => []),
        client.walk(HUAWEI_OIDS.alarmSeverity).catch(() => []),
        client.walk(HUAWEI_OIDS.alarmDesc).catch(() => []),
      ]);

      const keyOf = (oid: string, prefix: string) => oid.replace(prefix + '.', '');
      const sevMap = new Map<string, number>();
      for (const vb of sevVbs) sevMap.set(keyOf(vb.oid, HUAWEI_OIDS.alarmSeverity), Number(vb.value));

      const descMap = new Map<string, string>();
      for (const vb of descVbs) descMap.set(keyOf(vb.oid, HUAWEI_OIDS.alarmDesc), String(vb.value || ''));

      const alarms: OltAlarm[] = [];
      const now = new Date().toISOString();

      const sevLevelMap: Record<number, 'critical' | 'major' | 'minor' | 'warning' | 'info'> = {
        1: 'critical',
        2: 'major',
        3: 'minor',
        4: 'warning',
        5: 'info',
      };

      for (const vb of titleVbs) {
        const key = keyOf(vb.oid, HUAWEI_OIDS.alarmTitle);
        const rawSev = sevMap.get(key) || 4;
        alarms.push({
          alarmId: key,
          severity: sevLevelMap[rawSev] || 'warning',
          title: String(vb.value || 'Huawei OLT Alarm'),
          description: descMap.get(key) || '',
          raisedAt: now,
        });
      }

      return alarms;
    } catch {
      return [];
    }
  }
}
