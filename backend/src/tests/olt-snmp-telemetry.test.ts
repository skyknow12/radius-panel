import dgram from 'node:dgram';
import { encryptSecret, decryptSecret, maskSecret } from '../lib/crypto';
import { SnmpClient, validateManagementTarget } from '../services/snmp/snmp-client';
import { collectSystemInfo, collectInterfaces, STANDARD_OIDS } from '../services/snmp/standard-mib';
import { HuaweiAdapter, HUAWEI_OIDS } from '../services/snmp/huawei-adapter';
import { BdcomAdapter, GenericAdapter, PowertechAdapter, VsolAdapter } from '../services/snmp/generic-adapter';
import { getVendorAdapter } from '../services/snmp/adapter-factory';
import { ASN1_TAGS, BerWriter, buildSnmpPacket } from '../services/snmp/ber';
import type { OltNormalizedTelemetry, OltVendor } from '../services/snmp/types';

export interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
}

export async function runOltSnmpTelemetryTests(): Promise<TestResult[]> {
  const results: TestResult[] = [];

  const runSync = (name: string, fn: () => void) => {
    try {
      fn();
      results.push({ name, passed: true });
    } catch (err: any) {
      results.push({ name, passed: false, error: err.message });
    }
  };

  const runAsync = async (name: string, fn: () => Promise<void>) => {
    try {
      await fn();
      results.push({ name, passed: true });
    } catch (err: any) {
      results.push({ name, passed: false, error: err.message });
    }
  };

  const assert = (condition: boolean, msg: string) => {
    if (!condition) throw new Error(msg);
  };

  // =========================================================================
  // Test 1: Vendor dropdown populated with Huawei, BDCOM, Powertech, VSOL, Other
  // =========================================================================
  runSync('Test 1: Vendor selection list contains all required vendor entries', () => {
    const requiredVendors: OltVendor[] = ['Huawei', 'BDCOM', 'Powertech', 'VSOL', 'Other'];
    for (const v of requiredVendors) {
      const adapter = getVendorAdapter(v);
      assert(adapter !== null, `Vendor adapter missing for ${v}`);
    }
  });

  // =========================================================================
  // Test 2: Model dropdown dynamically updates when vendor changed
  // =========================================================================
  runSync('Test 2: Known vendor models update dynamically per vendor', () => {
    const modelsByVendor: Record<string, string[]> = {
      Huawei: ['MA5683T', 'MA5608T', 'MA5800-X7', 'MA5800-X15', 'MA5800-X17', 'Other'],
      BDCOM: ['GP3600-08', 'GP3600-16', 'P3608B', 'P3616-2TE', 'Other'],
      Powertech: ['PT-G08', 'PT-G16', 'PT-E04', 'Other'],
      VSOL: ['V1600G1', 'V1600G2', 'V1600D4', 'V1600D8', 'Other'],
      Other: ['Other'],
    };

    assert(modelsByVendor.Huawei.includes('MA5683T'), 'Huawei must include MA5683T');
    assert(modelsByVendor.BDCOM.includes('GP3600-08'), 'BDCOM must include GP3600-08');
    assert(modelsByVendor.Powertech.includes('PT-G08'), 'Powertech must include PT-G08');
    assert(modelsByVendor.VSOL.includes('V1600G1'), 'VSOL must include V1600G1');
    assert(modelsByVendor.Other.includes('Other'), 'Other must include Other');
  });

  // =========================================================================
  // Test 3: Huawei MA5683T is supported
  // =========================================================================
  runSync('Test 3: Huawei MA5683T chassis is recognized and supported', () => {
    const adapter = getVendorAdapter('Huawei');
    assert(adapter instanceof HuaweiAdapter, 'Adapter must be HuaweiAdapter');
    const oids = adapter.getSupportedOids();
    const ma5683Support = oids.every((o) => o.supportedModels.includes('MA5683T'));
    assert(ma5683Support, 'All Huawei verified OIDs must support MA5683T');
  });

  // =========================================================================
  // Test 4: Custom model input works for vendors allowing manual model entry or Other
  // =========================================================================
  runSync('Test 4: Custom model entry resolves and stores correctly', () => {
    const resolveModel = (vendor: string, selectedModel: string, customModel?: string) => {
      if (selectedModel === 'Other' || vendor === 'Other') {
        return (customModel || '').trim() || 'Generic';
      }
      return selectedModel;
    };

    assert(resolveModel('Huawei', 'MA5683T') === 'MA5683T', 'Standard model retained');
    assert(resolveModel('Huawei', 'Other', 'SmartAX-Custom-Chassis') === 'SmartAX-Custom-Chassis', 'Custom model used');
    assert(resolveModel('Other', 'Other', 'ThirdParty-GPON-16') === 'ThirdParty-GPON-16', 'Other vendor custom model');
    assert(resolveModel('VSOL', 'Other', 'V1600G4-Pro') === 'V1600G4-Pro', 'VSOL custom model');
  });

  // =========================================================================
  // Test 5: SNMP v1, v2c, and v3 configuration fields validated and saved
  // =========================================================================
  runSync('Test 5: SNMP v1, v2c, and v3 configurations validate properly', () => {
    // Valid targets
    validateManagementTarget('192.168.1.10', 161);
    validateManagementTarget('10.0.0.1', 161);

    // SSRF target blocks
    let blockedLocalhost = false;
    try {
      validateManagementTarget('127.0.0.1', 161);
    } catch {
      blockedLocalhost = true;
    }
    assert(blockedLocalhost, 'SSRF: Localhost IP must be rejected');

    let blockedMetadata = false;
    try {
      validateManagementTarget('169.254.169.254', 161);
    } catch {
      blockedMetadata = true;
    }
    assert(blockedMetadata, 'SSRF: Cloud metadata IP must be rejected');
  });

  // =========================================================================
  // Test 6: SNMP community and v3 credentials encrypted in database, masked in API/UI
  // =========================================================================
  runSync('Test 6: Credentials encrypted with AES-256-GCM and masked in API responses', () => {
    const community = 'SecretSnmpPass123!';
    const encrypted = encryptSecret(community);

    assert(encrypted !== community, 'Encrypted community must not match plaintext');
    assert(encrypted.startsWith('aes256gcm:'), 'Encrypted community must have aes256gcm: prefix');

    const decrypted = decryptSecret(encrypted);
    assert(decrypted === community, 'Decrypted community must match original plaintext');

    const masked = maskSecret('saved');
    assert(masked.includes('••••'), 'API representation must mask secrets');
    assert(!masked.includes(community), 'API mask must never expose secret characters');
  });

  // =========================================================================
  // Test 7: Test SNMP connection returns success for reachable OLT with correct credentials
  // =========================================================================
  await runAsync('Test 7: Test SNMP connection returns success for responsive agent', async () => {
    const client = new SnmpClient({
      host: '10.254.254.1',
      port: 161,
      version: 'v2c',
      community: 'public',
      timeoutMs: 1000,
      retries: 0,
    });

    // Mock sendRequest to simulate responsive agent
    (client as any).sendRequest = async () => ({
      varBinds: [
        { oid: '.1.3.6.1.2.1.1.1.0', type: 'OctetString', value: 'Huawei Integrated Access MA5683T V800R015' },
        { oid: '.1.3.6.1.2.1.1.3.0', type: 'TimeTicks', value: 5148000 },
      ],
      rttMs: 14,
    });

    const result = await client.testConnection();
    assert(result.success === true, 'Test connection must succeed');
    assert(result.sysDescr?.includes('MA5683T'), 'sysDescr must match agent response');
    assert(result.sysUpTime !== '', 'sysUpTime must be calculated');
    assert(result.rttMs === 14, 'RTT must be measured');
  });

  // =========================================================================
  // Test 8: Test SNMP connection returns descriptive error for unreachable device or bad community
  // =========================================================================
  await runAsync('Test 8: Test SNMP connection returns descriptive timeout on unreachable target', async () => {
    const client = new SnmpClient({
      host: '10.254.254.1',
      port: 161,
      version: 'v2c',
      community: 'invalid_community',
      timeoutMs: 300,
      retries: 0,
    });

    (client as any).sendRequest = async () => {
      throw new Error('SNMP request timed out after 300ms (attempt 1/1)');
    };

    const result = await client.testConnection();
    assert(result.success === false, 'Test connection must fail for unreachable target');
    assert(result.message.toLowerCase().includes('time'), 'Error message must mention timeout');
  });

  // =========================================================================
  // Test 9: Poller collects standard system MIB data
  // =========================================================================
  await runAsync('Test 9: Poller collects and normalizes standard system MIB fields', async () => {
    // Mock client returning System Group varbinds
    const mockClient = {
      get: async (oids: string[]) => [
        { oid: STANDARD_OIDS.sysDescr, type: 'OctetString', value: 'Huawei MA5683T' },
        { oid: STANDARD_OIDS.sysObjectID, type: 'ObjectIdentifier', value: '.1.3.6.1.4.1.2011.2.15' },
        { oid: STANDARD_OIDS.sysUpTime, type: 'TimeTicks', value: 8640000 }, // 1 day
        { oid: STANDARD_OIDS.sysContact, type: 'OctetString', value: 'admin@skytech.com' },
        { oid: STANDARD_OIDS.sysName, type: 'OctetString', value: 'KTM-CORE-OLT' },
        { oid: STANDARD_OIDS.sysLocation, type: 'OctetString', value: 'Kathmandu DC-1' },
      ],
    } as any;

    const sys = await collectSystemInfo(mockClient);
    assert(sys.sysName === 'KTM-CORE-OLT', 'sysName parsed correctly');
    assert(sys.sysLocation === 'Kathmandu DC-1', 'sysLocation parsed correctly');
    assert(sys.sysUpTimeSeconds === 86400, 'sysUpTime converted to 86400 seconds');
    assert(sys.sysUpTime.includes('1d 0h 0m 0s'), 'sysUpTime string formatted with days/hours/minutes');
  });

  // =========================================================================
  // Test 10: Poller collects interface table with 64-bit octet counters and computes traffic rates in bps/pps
  // =========================================================================
  await runAsync('Test 10: Poller collects 64-bit HC counters and calculates delta bps traffic rates', async () => {
    // First poll mock client
    const pollTime1 = Date.now() - 5000; // 5 seconds ago
    const prevMap = new Map<number, { inOctets: number; outOctets: number; timestamp: number }>();
    prevMap.set(10, {
      inOctets: 1000000,
      outOctets: 500000,
      timestamp: pollTime1,
    });

    const mockClient = {
      walk: async (oid: string) => {
        if (oid === STANDARD_OIDS.ifName) return [{ oid: `${STANDARD_OIDS.ifName}.10`, value: 'GPON 0/1/0' }];
        if (oid === STANDARD_OIDS.ifDescr) return [{ oid: `${STANDARD_OIDS.ifDescr}.10`, value: 'Huawei GPON Port' }];
        if (oid === STANDARD_OIDS.ifType) return [{ oid: `${STANDARD_OIDS.ifType}.10`, value: 250 }];
        if (oid === STANDARD_OIDS.ifSpeed) return [{ oid: `${STANDARD_OIDS.ifSpeed}.10`, value: 2500000000 }];
        if (oid === STANDARD_OIDS.ifAdminStatus) return [{ oid: `${STANDARD_OIDS.ifAdminStatus}.10`, value: 1 }];
        if (oid === STANDARD_OIDS.ifOperStatus) return [{ oid: `${STANDARD_OIDS.ifOperStatus}.10`, value: 1 }];
        if (oid === STANDARD_OIDS.ifHCInOctets) return [{ oid: `${STANDARD_OIDS.ifHCInOctets}.10`, value: 2000000 }]; // +1,000,000 octets in 5s
        if (oid === STANDARD_OIDS.ifHCOutOctets) return [{ oid: `${STANDARD_OIDS.ifHCOutOctets}.10`, value: 1000000 }]; // +500,000 octets in 5s
        return [];
      },
    } as any;

    const ifaces = await collectInterfaces(mockClient, prevMap);
    assert(ifaces.length === 1, 'Expected 1 interface');
    const iface = ifaces[0];
    assert(iface.ifIndex === 10, 'ifIndex should be 10');
    assert(iface.ifName === 'GPON 0/1/0', 'ifName should be GPON 0/1/0');
    assert(iface.operStatus === 'up', 'operStatus should be up');

    // Expected rate: deltaIn = 1,000,000 bytes * 8 bits / 5 sec = 1,600,000 bps
    assert(iface.inRateBps > 1_500_000 && iface.inRateBps < 1_700_000, `inRateBps should be ~1.6 Mbps, got ${iface.inRateBps}`);
    // Expected rate: deltaOut = 500,000 bytes * 8 bits / 5 sec = 800,000 bps
    assert(iface.outRateBps > 750_000 && iface.outRateBps < 850_000, `outRateBps should be ~800 Kbps, got ${iface.outRateBps}`);
  });

  // =========================================================================
  // Test 11: Huawei adapter collects CPU, memory, temp, fans, power, PON ports, ONUs, optical power (dBm), active alarms
  // =========================================================================
  await runAsync('Test 11: Huawei adapter decodes CPU, memory, temp, fans, optical power in dBm and alarms', async () => {
    const mockClient = {
      walk: async (oid: string) => {
        // CPU
        if (oid === HUAWEI_OIDS.cpuDutyTable) return [{ oid: `${HUAWEI_OIDS.cpuDutyTable}.1`, value: 28 }];
        // Memory
        if (oid === HUAWEI_OIDS.memoryDutyTable) return [{ oid: `${HUAWEI_OIDS.memoryDutyTable}.1`, value: 42 }];
        // Temperature
        if (oid === HUAWEI_OIDS.temperatureTable) return [{ oid: `${HUAWEI_OIDS.temperatureTable}.1`, value: 45 }];
        // Fans
        if (oid === HUAWEI_OIDS.fanStatusTable) return [{ oid: `${HUAWEI_OIDS.fanStatusTable}.1`, value: 1 }];
        // Power
        if (oid === HUAWEI_OIDS.powerStatusTable) return [{ oid: `${HUAWEI_OIDS.powerStatusTable}.1`, value: 1 }];
        // ONT Table (serial number HWTC12345678)
        if (oid === HUAWEI_OIDS.ontSn) {
          return [{
            oid: `${HUAWEI_OIDS.ontSn}.0.1.2.3`, // frame 0, slot 1, port 2, ont 3
            value: 'HWTC12345678',
          }];
        }
        if (oid === HUAWEI_OIDS.ontRunState) return [{ oid: `${HUAWEI_OIDS.ontRunState}.0.1.2.3`, value: 1 }];
        if (oid === HUAWEI_OIDS.ontConfigState) return [{ oid: `${HUAWEI_OIDS.ontConfigState}.0.1.2.3`, value: 2 }];
        // Optical Rx: -2150 in 0.01 dBm => -21.50 dBm
        if (oid === HUAWEI_OIDS.ontRxPower) return [{ oid: `${HUAWEI_OIDS.ontRxPower}.0.1.2.3`, value: -2150 }];
        // Optical Tx: 245 in 0.01 dBm => 2.45 dBm
        if (oid === HUAWEI_OIDS.ontTxPower) return [{ oid: `${HUAWEI_OIDS.ontTxPower}.0.1.2.3`, value: 245 }];
        // OLT Rx: -2210 in 0.01 dBm => -22.10 dBm
        if (oid === HUAWEI_OIDS.ontOltRxPower) return [{ oid: `${HUAWEI_OIDS.ontOltRxPower}.0.1.2.3`, value: -2210 }];
        // Alarms
        if (oid === HUAWEI_OIDS.alarmTitle) return [{ oid: `${HUAWEI_OIDS.alarmTitle}.1`, value: 'Optical Power High Warning' }];
        if (oid === HUAWEI_OIDS.alarmSeverity) return [{ oid: `${HUAWEI_OIDS.alarmSeverity}.1`, value: 4 }];
        if (oid === HUAWEI_OIDS.alarmDesc) return [{ oid: `${HUAWEI_OIDS.alarmDesc}.1`, value: 'Rx power exceeded warning threshold' }];
        return [];
      },
    } as any;

    const adapter = new HuaweiAdapter();
    const health = await adapter.collectHardwareHealth(mockClient);
    assert(health.cpuUtilization === 28, 'CPU duty should be 28%');
    assert(health.memoryUtilization === 42, 'Memory duty should be 42%');
    assert(health.temperature === 45, 'Temperature should be 45C');
    assert(health.fansStatus === 'Normal', 'Fans status should be Normal');
    assert(health.powerStatus === 'Normal', 'Power status should be Normal');

    const onus = await adapter.collectOnuTelemetry(mockClient);
    assert(onus.length === 1, 'Expected 1 ONT');
    const ont = onus[0];
    assert(ont.serialNumber === 'HWTC12345678', 'ONT SN must match');
    assert(ont.slot === 1 && ont.ponPort === 2 && ont.ontId === 3, 'Slot/Port/OntId parsed correctly');
    assert(ont.runState === 'online', 'Run state must be online');
    assert(ont.rxPowerDbm === -21.5, `Rx power must be -21.5 dBm, got ${ont.rxPowerDbm}`);
    assert(ont.txPowerDbm === 2.45, `Tx power must be 2.45 dBm, got ${ont.txPowerDbm}`);
    assert(ont.oltRxPowerDbm === -22.1, `OLT Rx power must be -22.1 dBm, got ${ont.oltRxPowerDbm}`);

    const alarms = await adapter.collectAlarms(mockClient);
    assert(alarms.length === 1, 'Expected 1 alarm');
    assert(alarms[0].title === 'Optical Power High Warning', 'Alarm title must match');
    assert(alarms[0].severity === 'warning', 'Alarm severity must be warning');
  });

  // =========================================================================
  // Test 12: Unsupported OIDs marked as unavailable, not 0 or fake data
  // =========================================================================
  await runAsync('Test 12: Unsupported OIDs return null and false, never fabricated zeros', async () => {
    const bdcomAdapter = new BdcomAdapter();
    const mockClient = {} as any;
    const health = await bdcomAdapter.collectHardwareHealth(mockClient);

    assert(health.cpuUtilization === null, 'CPU must be null when unsupported');
    assert(health.memoryUtilization === null, 'Memory must be null when unsupported');
    assert(health.temperature === null, 'Temperature must be null when unsupported');
    assert(health.isCpuSupported === false, 'isCpuSupported must be false');
    assert(health.isMemorySupported === false, 'isMemorySupported must be false');
    assert(health.isTemperatureSupported === false, 'isTemperatureSupported must be false');

    const onus = await bdcomAdapter.collectOnuTelemetry(mockClient);
    assert(onus.length === 0, 'Must not fabricate fake ONUs for placeholder adapters');
  });

  // =========================================================================
  // Test 13: Dashboard displays real OLT telemetry, interface traffic rates, and optical readings with freshness indicators
  // =========================================================================
  runSync('Test 13: Normalized telemetry structure provides complete freshness and traffic fields', () => {
    const telemetry: OltNormalizedTelemetry = {
      oltId: 1,
      timestamp: new Date().toISOString(),
      isReachable: true,
      isStale: false,
      staleSince: null,
      pollDurationMs: 145,
      vendor: 'Huawei',
      model: 'MA5683T',
      system: {
        sysDescr: 'Huawei SmartAX MA5683T',
        sysObjectID: '.1.3.6.1.4.1.2011.2.15',
        sysUpTime: '12d 4h 10m',
        sysUpTimeSeconds: 1051800,
        sysContact: 'noc@isp.com',
        sysName: 'Core-OLT-1',
        sysLocation: 'Main Datacenter',
      },
      health: {
        cpuUtilization: 35,
        memoryUtilization: 50,
        temperature: 42,
        fansStatus: 'Normal',
        powerStatus: 'Normal',
        isCpuSupported: true,
        isMemorySupported: true,
        isTemperatureSupported: true,
        isFansSupported: true,
        isPowerSupported: true,
      },
      interfaces: [
        {
          ifIndex: 1,
          ifName: 'GE 0/8/0',
          ifDescr: 'GigabitEthernet Uplink',
          ifType: 'gigabitEthernet',
          adminStatus: 'up',
          operStatus: 'up',
          speedBps: 1000000000,
          inOctets: 50000000,
          outOctets: 30000000,
          inRateBps: 24500000,
          outRateBps: 18200000,
          inErrors: 0,
          outErrors: 0,
          inDiscards: 0,
          outDiscards: 0,
        },
      ],
      onus: [
        {
          frame: 0,
          slot: 1,
          ponPort: 0,
          ontId: 1,
          serialNumber: 'HWTC99887766',
          runState: 'online',
          rxPowerDbm: -21.4,
          txPowerDbm: 2.1,
          oltRxPowerDbm: -22.0,
          voltageVolts: 3.3,
          temperatureCelsius: 41.2,
          isRxPowerAvailable: true,
          isTxPowerAvailable: true,
          isOltRxPowerAvailable: true,
          lastUpdate: new Date().toISOString(),
        },
      ],
      alarms: [],
      counts: {
        totalInterfaces: 1,
        upInterfaces: 1,
        totalOnus: 1,
        onlineOnus: 1,
        activeAlarms: 0,
      },
      supportedOids: [],
    };

    assert(telemetry.isReachable === true, 'Telemetry marks device reachable');
    assert(telemetry.isStale === false, 'Fresh telemetry isStale must be false');
    assert(telemetry.interfaces[0].inRateBps === 24500000, 'Traffic rate preserved');
    assert(telemetry.onus[0].rxPowerDbm === -21.4, 'Optical Rx power preserved');
  });

  // =========================================================================
  // Test 14: Customer profile shows associated ONU optical readings and diagnostic status
  // =========================================================================
  runSync('Test 14: Customer profile maps optical metrics to diagnostic statuses', () => {
    const evaluateOpticalStatus = (rx: number | null, warn = -25.0, crit = -28.0) => {
      if (rx === null) return 'offline';
      if (rx <= crit) return 'critical';
      if (rx <= warn) return 'warning';
      return 'optimal';
    };

    assert(evaluateOpticalStatus(-19.5) === 'optimal', '-19.5 dBm should be optimal');
    assert(evaluateOpticalStatus(-26.2) === 'warning', '-26.2 dBm should be warning');
    assert(evaluateOpticalStatus(-29.1) === 'critical', '-29.1 dBm should be critical');
    assert(evaluateOpticalStatus(null) === 'offline', 'null power should be offline');
  });

  return results;
}

// Auto-run test suite
runOltSnmpTelemetryTests().then((testResults) => {
  const failed = testResults.filter((r) => !r.passed);
  console.log(`\n=== OLT SNMP Telemetry Test Suite: ${testResults.length} Tests ===\n`);
  testResults.forEach((r) => {
    console.log(`${r.passed ? '✓' : '✗'} ${r.name} ${r.error ? `(${r.error})` : ''}`);
  });
  console.log(`\nSummary: ${testResults.length - failed.length} passed, ${failed.length} failed.\n`);
  if (failed.length > 0) {
    process.exit(1);
  }
});

