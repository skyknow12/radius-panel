import type { SnmpClient } from './snmp-client';
import type { InterfaceTelemetry, SystemInfo } from './types';

export const STANDARD_OIDS = {
  // System group (RFC 1213 / MIB-II)
  sysDescr: '.1.3.6.1.2.1.1.1.0',
  sysObjectID: '.1.3.6.1.2.1.1.2.0',
  sysUpTime: '.1.3.6.1.2.1.1.3.0',
  sysContact: '.1.3.6.1.2.1.1.4.0',
  sysName: '.1.3.6.1.2.1.1.5.0',
  sysLocation: '.1.3.6.1.2.1.1.6.0',

  // IF-MIB (RFC 2863)
  ifTable: '.1.3.6.1.2.1.2.2.1',
  ifDescr: '.1.3.6.1.2.1.2.2.1.2',
  ifType: '.1.3.6.1.2.1.2.2.1.3',
  ifMtu: '.1.3.6.1.2.1.2.2.1.4',
  ifSpeed: '.1.3.6.1.2.1.2.2.1.5',
  ifPhysAddress: '.1.3.6.1.2.1.2.2.1.6',
  ifAdminStatus: '.1.3.6.1.2.1.2.2.1.7',
  ifOperStatus: '.1.3.6.1.2.1.2.2.1.8',
  ifInOctets: '.1.3.6.1.2.1.2.2.1.10',
  ifInDiscards: '.1.3.6.1.2.1.2.2.1.13',
  ifInErrors: '.1.3.6.1.2.1.2.2.1.14',
  ifOutOctets: '.1.3.6.1.2.1.2.2.1.16',
  ifOutDiscards: '.1.3.6.1.2.1.2.2.1.19',
  ifOutErrors: '.1.3.6.1.2.1.2.2.1.20',

  // IF-X-MIB (64-bit counters & interface names)
  ifXTable: '.1.3.6.1.2.1.31.1.1.1',
  ifName: '.1.3.6.1.2.1.31.1.1.1.1',
  ifHCInOctets: '.1.3.6.1.2.1.31.1.1.1.6',
  ifHCOutOctets: '.1.3.6.1.2.1.31.1.1.1.10',
  ifHighSpeed: '.1.3.6.1.2.1.31.1.1.1.15',
};

const IANA_IF_TYPES: Record<number, string> = {
  1: 'other',
  6: 'ethernetCsmacd',
  24: 'softwareLoopback',
  53: 'propVirtual',
  117: 'gigabitEthernet',
  135: 'l2vlan',
  136: 'l3ipvlan',
  250: 'gpon',
  251: 'epon',
};

const ADMIN_STATUS_MAP: Record<number, 'up' | 'down' | 'testing' | 'unknown'> = {
  1: 'up',
  2: 'down',
  3: 'testing',
};

const OPER_STATUS_MAP: Record<number, 'up' | 'down' | 'testing' | 'unknown' | 'dormant' | 'notPresent' | 'lowerLayerDown'> = {
  1: 'up',
  2: 'down',
  3: 'testing',
  4: 'unknown',
  5: 'dormant',
  6: 'notPresent',
  7: 'lowerLayerDown',
};

/**
 * Collect Standard MIB-II System Group
 */
export async function collectSystemInfo(client: SnmpClient): Promise<SystemInfo> {
  const oids = [
    STANDARD_OIDS.sysDescr,
    STANDARD_OIDS.sysObjectID,
    STANDARD_OIDS.sysUpTime,
    STANDARD_OIDS.sysContact,
    STANDARD_OIDS.sysName,
    STANDARD_OIDS.sysLocation,
  ];

  const varBinds = await client.get(oids);
  const map = new Map<string, any>();
  for (const vb of varBinds) {
    map.set(vb.oid, vb.value);
  }

  const rawUpTime = map.get(STANDARD_OIDS.sysUpTime);
  let upTimeSeconds = 0;
  let upTimeStr = 'Unknown';

  if (typeof rawUpTime === 'number') {
    upTimeSeconds = Math.floor(rawUpTime / 100);
    const days = Math.floor(upTimeSeconds / 86400);
    const hours = Math.floor((upTimeSeconds % 86400) / 3600);
    const mins = Math.floor((upTimeSeconds % 3600) / 60);
    const secs = upTimeSeconds % 60;
    upTimeStr = `${days}d ${hours}h ${mins}m ${secs}s`;
  }

  return {
    sysDescr: String(map.get(STANDARD_OIDS.sysDescr) || ''),
    sysObjectID: String(map.get(STANDARD_OIDS.sysObjectID) || ''),
    sysUpTime: upTimeStr,
    sysUpTimeSeconds: upTimeSeconds,
    sysContact: String(map.get(STANDARD_OIDS.sysContact) || ''),
    sysName: String(map.get(STANDARD_OIDS.sysName) || ''),
    sysLocation: String(map.get(STANDARD_OIDS.sysLocation) || ''),
  };
}

/**
 * Collect IF-MIB and IF-X-MIB interfaces
 */
export async function collectInterfaces(
  client: SnmpClient,
  previousInterfaces?: Map<number, { inOctets: number; outOctets: number; timestamp: number }>
): Promise<InterfaceTelemetry[]> {
  const [
    names,
    descrs,
    types,
    speeds,
    adminStatuses,
    operStatuses,
    inOctets32,
    outOctets32,
    inOctets64,
    outOctets64,
    inErrors,
    outErrors,
    inDiscards,
    outDiscards,
    physAddrs,
    mtus,
  ] = await Promise.all([
    client.walk(STANDARD_OIDS.ifName).catch(() => []),
    client.walk(STANDARD_OIDS.ifDescr).catch(() => []),
    client.walk(STANDARD_OIDS.ifType).catch(() => []),
    client.walk(STANDARD_OIDS.ifSpeed).catch(() => []),
    client.walk(STANDARD_OIDS.ifAdminStatus).catch(() => []),
    client.walk(STANDARD_OIDS.ifOperStatus).catch(() => []),
    client.walk(STANDARD_OIDS.ifInOctets).catch(() => []),
    client.walk(STANDARD_OIDS.ifOutOctets).catch(() => []),
    client.walk(STANDARD_OIDS.ifHCInOctets).catch(() => []),
    client.walk(STANDARD_OIDS.ifHCOutOctets).catch(() => []),
    client.walk(STANDARD_OIDS.ifInErrors).catch(() => []),
    client.walk(STANDARD_OIDS.ifOutErrors).catch(() => []),
    client.walk(STANDARD_OIDS.ifInDiscards).catch(() => []),
    client.walk(STANDARD_OIDS.ifOutDiscards).catch(() => []),
    client.walk(STANDARD_OIDS.ifPhysAddress).catch(() => []),
    client.walk(STANDARD_OIDS.ifMtu).catch(() => []),
  ]);

  // Extract index from OID: e.g. .1.3.6.1.2.1.2.2.1.2.10 => 10
  const parseIndex = (oid: string): number => {
    const parts = oid.split('.');
    return parseInt(parts[parts.length - 1], 10);
  };

  const toMap = (varBinds: any[]) => {
    const m = new Map<number, any>();
    for (const vb of varBinds) {
      const idx = parseIndex(vb.oid);
      if (!isNaN(idx)) m.set(idx, vb.value);
    }
    return m;
  };

  const nameMap = toMap(names);
  const descrMap = toMap(descrs);
  const typeMap = toMap(types);
  const speedMap = toMap(speeds);
  const adminMap = toMap(adminStatuses);
  const operMap = toMap(operStatuses);
  const in32Map = toMap(inOctets32);
  const out32Map = toMap(outOctets32);
  const in64Map = toMap(inOctets64);
  const out64Map = toMap(outOctets64);
  const inErrMap = toMap(inErrors);
  const outErrMap = toMap(outErrors);
  const inDiscMap = toMap(inDiscards);
  const outDiscMap = toMap(outDiscards);
  const macMap = toMap(physAddrs);
  const mtuMap = toMap(mtus);

  // Union of all detected interface indices
  const allIndices = new Set<number>([
    ...nameMap.keys(),
    ...descrMap.keys(),
    ...typeMap.keys(),
    ...adminMap.keys(),
    ...operMap.keys(),
  ]);

  const now = Date.now();
  const interfaces: InterfaceTelemetry[] = [];

  for (const idx of Array.from(allIndices).sort((a, b) => a - b)) {
    const rawName = nameMap.get(idx);
    const rawDescr = descrMap.get(idx);
    const ifName = String(rawName || rawDescr || `if${idx}`);
    const ifDescr = String(rawDescr || rawName || '');

    const rawType = typeMap.get(idx);
    const ifType = typeof rawType === 'number' ? (IANA_IF_TYPES[rawType] || `type(${rawType})`) : 'ethernetCsmacd';

    const rawAdmin = adminMap.get(idx);
    const adminStatus = typeof rawAdmin === 'number' ? (ADMIN_STATUS_MAP[rawAdmin] || 'unknown') : 'unknown';

    const rawOper = operMap.get(idx);
    const operStatus = typeof rawOper === 'number' ? (OPER_STATUS_MAP[rawOper] || 'unknown') : 'unknown';

    const speedBps = Number(speedMap.get(idx) || 0);

    // Prefer 64-bit HC counters, fallback to 32-bit
    const currentIn = Number(in64Map.get(idx) ?? in32Map.get(idx) ?? 0);
    const currentOut = Number(out64Map.get(idx) ?? out32Map.get(idx) ?? 0);

    // Calculate rates in bps
    let inRateBps = 0;
    let outRateBps = 0;

    if (previousInterfaces && previousInterfaces.has(idx)) {
      const prev = previousInterfaces.get(idx)!;
      const deltaSec = (now - prev.timestamp) / 1000;
      if (deltaSec > 0 && deltaSec < 3600) {
        // Guard counter roll-over
        const deltaIn = currentIn >= prev.inOctets ? currentIn - prev.inOctets : currentIn;
        const deltaOut = currentOut >= prev.outOctets ? currentOut - prev.outOctets : currentOut;

        inRateBps = Math.round((deltaIn * 8) / deltaSec);
        outRateBps = Math.round((deltaOut * 8) / deltaSec);
      }
    }

    const formatMac = (val: any): string | undefined => {
      if (Buffer.isBuffer(val)) {
        return Array.from(val)
          .map((b) => b.toString(16).padStart(2, '0'))
          .join(':');
      }
      if (typeof val === 'string' && val.length > 0) {
        return val;
      }
      return undefined;
    };

    interfaces.push({
      ifIndex: idx,
      ifName,
      ifDescr,
      ifType,
      adminStatus,
      operStatus,
      speedBps,
      macAddress: formatMac(macMap.get(idx)),
      mtu: Number(mtuMap.get(idx) || 1500),
      inOctets: currentIn,
      outOctets: currentOut,
      inRateBps,
      outRateBps,
      inErrors: Number(inErrMap.get(idx) || 0),
      outErrors: Number(outErrMap.get(idx) || 0),
      inDiscards: Number(inDiscMap.get(idx) || 0),
      outDiscards: Number(outDiscMap.get(idx) || 0),
    });
  }

  return interfaces;
}
