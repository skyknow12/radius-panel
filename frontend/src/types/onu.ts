export type OnuVendor = 'Huawei' | 'ZTE' | 'Fiberhome' | 'BDCOM' | 'Powertech' | 'VSOL' | 'Other';

export interface OnuOverviewData {
  totalOnus: number;
  linkedToCustomers: number;
  configuredProfiles: number;
  pendingModelConfig: number;
  pendingNewModelsCount: number;
  webReachable: number;
  webUnreachable: number;
  failedOperations: number;
  topVendors?: { vendor: string; count: number }[];
  topModels?: { model: string; count: number }[];
}

export interface DetectedOnuItem {
  id: number;
  olt_id: number;
  olt_name: string;
  branch_id?: number | null;
  branch_name?: string | null;
  serial_number: string;
  frame: number;
  slot: number;
  pon_port: number;
  ont_id: number;
  vendor: string;
  model: string;
  firmware_version?: string | null;
  hardware_version?: string | null;
  management_ip?: string | null;
  web_port: number;
  web_protocol: 'http' | 'https';
  web_status: 'reachable' | 'unreachable' | 'unknown';
  management_status: 'unconfigured' | 'pending_profile' | 'configured' | 'unsupported' | 'error';
  run_state: string;
  profile_id?: number | null;
  profile_name?: string | null;
  adapter_type?: string | null;
  wifi_ssid_2g?: string | null;
  wifi_ssid_5g?: string | null;
  wifi_last_status?: 'verified' | 'unverified' | 'failed' | 'unknown';
  association_id?: number | null;
  customer_id?: number | null;
  customer_username?: string | null;
  customer_name?: string | null;
  last_seen_at?: string | null;
  last_web_seen_at?: string | null;
  created_at: string;
}

export interface OnuModelRequestItem {
  id: number;
  vendor: string;
  model: string;
  firmware?: string | null;
  detected_on_olt_id: number;
  olt_name?: string;
  detected_on_branch_id?: number | null;
  branch_name?: string | null;
  sample_onu_id?: number | null;
  sample_serial_number?: string | null;
  sample_management_ip?: string | null;
  web_status: 'reachable' | 'unreachable' | 'unknown';
  device_count: number;
  status: 'pending' | 'resolved' | 'ignored';
  resolved_profile_id?: number | null;
  first_detected_at: string;
  last_detected_at: string;
  created_at: string;
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
  status: 'active' | 'disabled' | 'needs_testing';
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
  scope: 'global' | 'model' | 'branch' | 'device';
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

export interface OnuActivityLogItem {
  id: number;
  onu_id?: number | null;
  onu_serial?: string | null;
  customer_id?: number | null;
  customer_username?: string | null;
  branch_id?: number | null;
  branch_name?: string | null;
  operator_id?: string | null;
  operator_username?: string | null;
  operation_type: string;
  vendor?: string | null;
  model?: string | null;
  target_ip?: string | null;
  status: 'started' | 'success' | 'failed' | 'unsupported' | 'unverified';
  verification_status: 'verified' | 'unverified' | 'failed' | 'not_applicable';
  sanitized_details?: Record<string, any>;
  error_message?: string | null;
  duration_ms?: number;
  created_at: string;
}

export interface OnuWifiBandConfig {
  band: '2.4GHz' | '5GHz';
  ssid: string;
  enabled: boolean;
  authMode?: string;
  encryption?: string;
}

export interface OnuWifiConfiguration {
  bands: OnuWifiBandConfig[];
  clientCount?: number;
}
