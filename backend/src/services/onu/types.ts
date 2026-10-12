/**
 * Type definitions for ONU Web Management, Model Profiles & Adapters
 */

export type OnuVendor = 'Huawei' | 'ZTE' | 'Fiberhome' | 'BDCOM' | 'Powertech' | 'VSOL' | 'Other';

export type OnuManagementStatus = 'unconfigured' | 'pending_profile' | 'configured' | 'unsupported' | 'error';
export type OnuWebStatus = 'reachable' | 'unreachable' | 'unknown';
export type OnuProfileStatus = 'active' | 'disabled' | 'needs_testing';
export type CredentialScope = 'global' | 'model' | 'branch' | 'device';

export interface OnuIdentity {
  vendor: OnuVendor;
  model: string;
  firmwareVersion?: string | null;
  hardwareVersion?: string | null;
  serialNumber: string;
  managementIp?: string | null;
  webPort: number;
  webProtocol: 'http' | 'https';
  webStatus: OnuWebStatus;
  managementStatus: OnuManagementStatus;
  matchedProfileId?: number | null;
  identificationConfidence: 'high' | 'medium' | 'low';
  evidenceSummary: string;
}

export interface OnuModelProfileItem {
  id: number;
  name: string;
  vendor: string;
  model: string;
  firmware_pattern?: string | null;
  adapter_type: 'huawei_web' | 'zte_web' | 'generic_web' | 'unsupported';
  default_protocol: 'http' | 'https';
  default_port: number;
  login_path: string;
  default_username: string;
  default_password_masked?: string;
  wifi_bands: string[];
  capabilities: {
    change_ssid: boolean;
    change_password: boolean;
    read_wifi: boolean;
    verify_changes: boolean;
  };
  status: OnuProfileStatus;
  tested_capabilities: {
    connection: boolean;
    auth: boolean;
    info: boolean;
    ssid: boolean;
    password: boolean;
    verify: boolean;
  };
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface OnuCredentialItem {
  id: number;
  name: string;
  scope: CredentialScope;
  profile_id?: number | null;
  profile_name?: string | null;
  branch_id?: number | null;
  branch_name?: string | null;
  onu_id?: number | null;
  onu_serial?: string | null;
  username: string;
  password_masked: string;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ResolvedOnuCredentials {
  username: string;
  passwordDecrypted: string;
  sourceScope: CredentialScope;
  credentialId?: number;
}

export interface OnuWifiBandConfig {
  band: '2.4GHz' | '5GHz';
  ssid: string;
  enabled: boolean;
  hidden?: boolean;
  authMode?: string;
  encryption?: string;
  channel?: number;
  txPowerPercent?: number;
}

export interface OnuWifiConfiguration {
  bands: OnuWifiBandConfig[];
  macFilteringEnabled?: boolean;
  wpsEnabled?: boolean;
  clientCount?: number;
}

export interface OnuDeviceInformation {
  vendor: string;
  model: string;
  hardwareVersion?: string;
  softwareVersion?: string;
  serialNumber?: string;
  macAddress?: string;
  upTimeSeconds?: number;
  cpuUsagePercent?: number;
  memoryUsagePercent?: number;
}

export interface OnuOperationResult {
  success: boolean;
  message: string;
  verified: boolean;
  verificationStatus: 'verified' | 'unverified' | 'failed' | 'not_applicable';
  durationMs: number;
  details?: Record<string, any>;
  error?: string;
}

export interface OnuTestResult {
  connection: boolean;
  auth: boolean;
  deviceInfo?: OnuDeviceInformation;
  wifiConfig?: OnuWifiConfiguration;
  supportedBands: string[];
  message: string;
  durationMs: number;
  testedCapabilities: {
    connection: boolean;
    auth: boolean;
    info: boolean;
    ssid: boolean;
    password: boolean;
    verify: boolean;
  };
}
