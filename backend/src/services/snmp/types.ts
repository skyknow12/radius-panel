/**
 * Type definitions for SNMP client, MIB definitions, and OLT telemetry
 */

export type SnmpVersion = 'v1' | 'v2c' | 'v3';
export type SnmpV3SecurityLevel = 'noAuthNoPriv' | 'authNoPriv' | 'authPriv';
export type SnmpV3AuthProto = 'MD5' | 'SHA' | 'SHA256';
export type SnmpV3PrivProto = 'DES' | 'AES' | 'AES128';

export type OltVendor = 'Huawei' | 'BDCOM' | 'Powertech' | 'VSOL' | 'Other';

export interface SnmpV3Config {
  username?: string;
  securityLevel?: SnmpV3SecurityLevel;
  authProtocol?: SnmpV3AuthProto;
  authPassword?: string;
  privProtocol?: SnmpV3PrivProto;
  privPassword?: string;
  contextName?: string;
}

export interface SnmpConfig {
  host: string;
  port?: number;
  version?: SnmpVersion;
  community?: string;
  writeCommunity?: string;
  v3?: SnmpV3Config;
  timeoutMs?: number;
  retries?: number;
}

export interface SnmpVarBind {
  oid: string;
  type: string;
  value: any;
}

export interface OidMetadata {
  vendor: OltVendor | 'Standard';
  supportedModels: string[];
  oid: string;
  name: string;
  dataType: string;
  unit?: string;
  description: string;
  isVerified: boolean;
  isAvailable: boolean;
}

export interface SystemInfo {
  sysDescr: string;
  sysObjectID: string;
  sysUpTime: string;
  sysUpTimeSeconds: number;
  sysContact: string;
  sysName: string;
  sysLocation: string;
}

export interface InterfaceTelemetry {
  ifIndex: number;
  ifName: string;
  ifDescr: string;
  ifType: string;
  adminStatus: 'up' | 'down' | 'testing' | 'unknown';
  operStatus: 'up' | 'down' | 'testing' | 'unknown' | 'dormant' | 'notPresent' | 'lowerLayerDown';
  speedBps: number;
  macAddress?: string;
  mtu?: number;
  inOctets: number;
  outOctets: number;
  inRateBps: number;
  outRateBps: number;
  inErrors: number;
  outErrors: number;
  inDiscards: number;
  outDiscards: number;
  lastChange?: string;
}

export interface HardwareHealth {
  cpuUtilization: number | null; // percentage, null if unavailable
  memoryUtilization: number | null; // percentage, null if unavailable
  temperature: number | null; // Celsius, null if unavailable
  fansStatus: string | null; // e.g. "Normal", "Warning", null if unavailable
  powerStatus: string | null; // e.g. "Normal", "Redundant", null if unavailable
  isCpuSupported: boolean;
  isMemorySupported: boolean;
  isTemperatureSupported: boolean;
  isFansSupported: boolean;
  isPowerSupported: boolean;
}

export interface OnuOpticalTelemetry {
  frame: number;
  slot: number;
  ponPort: number;
  ontId: number;
  serialNumber: string;
  runState: 'online' | 'offline' | 'unknown';
  configState?: string;
  description?: string;
  rxPowerDbm: number | null;
  txPowerDbm: number | null;
  oltRxPowerDbm: number | null;
  voltageVolts: number | null;
  temperatureCelsius: number | null;
  isRxPowerAvailable: boolean;
  isTxPowerAvailable: boolean;
  isOltRxPowerAvailable: boolean;
  lastUpdate: string;
}

export interface OltAlarm {
  alarmId: string;
  severity: 'critical' | 'major' | 'minor' | 'warning' | 'info';
  title: string;
  description: string;
  entityType?: string;
  entityId?: string;
  raisedAt: string;
}

export interface OltNormalizedTelemetry {
  oltId: number;
  timestamp: string;
  isReachable: boolean;
  isStale: boolean;
  staleSince?: string | null;
  pollDurationMs: number;
  vendor: OltVendor;
  model: string;
  system: SystemInfo | null;
  health: HardwareHealth;
  interfaces: InterfaceTelemetry[];
  onus: OnuOpticalTelemetry[];
  alarms: OltAlarm[];
  counts: {
    totalInterfaces: number;
    upInterfaces: number;
    totalOnus: number;
    onlineOnus: number;
    activeAlarms: number;
  };
  supportedOids: OidMetadata[];
  error?: string | null;
}
