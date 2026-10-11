export interface OltItem {
  id: number;
  name: string;
  vendor: string;
  model: string;
  hardware_version?: string;
  software_version?: string;
  patch_version?: string;
  management_ip: string;
  management_port: number;
  branch_id?: number | null;
  branch_name?: string | null;
  organization_id?: number | null;
  snmp_version: string;
  snmp_port: number;
  snmp_community_masked?: string;
  cli_protocol: 'telnet' | 'ssh';
  cli_username: string;
  cli_password_masked: string;
  connection_timeout: number;
  polling_interval: number;
  enabled: boolean;
  connection_status: 'online' | 'offline' | 'error' | 'unknown';
  last_seen_at?: string | null;
  last_sync_at?: string | null;
  last_error?: string | null;
  optical_warning_threshold: number;
  optical_critical_threshold: number;
  total_onus?: number;
  online_onus?: number;
  offline_onus?: number;
  created_at: string;
  updated_at: string;
}

export interface OnuItem {
  id: number;
  olt_id: number;
  olt_name?: string;
  serial_number: string;
  frame: number;
  slot: number;
  pon_port: number;
  ont_id: number;
  description?: string | null;
  vendor_id?: string | null;
  equipment_id?: string | null;
  model?: string | null;
  mac_address?: string | null;
  control_flag?: string;
  run_state: 'online' | 'offline' | 'missing' | 'unknown';
  config_state: 'initial' | 'normal' | 'failed' | 'unknown';
  match_state: 'match' | 'mismatch' | 'unknown';
  protection_state?: string;
  auth_type?: string;
  management_mode?: string;
  line_profile_id?: number;
  line_profile_name?: string;
  service_profile_id?: number;
  service_profile_name?: string;
  last_up_time?: string | null;
  last_down_time?: string | null;
  last_down_cause?: string | null;
  registration_state: 'registered' | 'unregistered' | 'missing';
  last_rx_power?: number | null;
  last_tx_power?: number | null;
  last_olt_rx_power?: number | null;
  last_optical_reading_at?: string | null;
  customer_id?: number | null;
  customer_username?: string | null;
  customer_name?: string | null;
  created_at: string;
  updated_at: string;
}

export interface DiscoveredOnt {
  frame: number;
  slot: number;
  ponPort: number;
  serialNumber: string;
  vendorId?: string;
  equipmentId?: string;
  version?: string;
  discoveryTime?: string;
}

export interface BoardInfo {
  slot: number;
  boardName: string;
  status: string;
  isGpon: boolean;
  isControl: boolean;
  isStandby: boolean;
}

export interface OpticalInfo {
  rxPower: number | null;
  txPower: number | null;
  oltRxPower: number | null;
  temperature: number | null;
  voltage: number | null;
  biasCurrent: number | null;
  isAvailable: boolean;
  rawText?: string;
}

export interface OpticalHistoryItem {
  id: number;
  rx_power: number | null;
  tx_power: number | null;
  olt_rx_power: number | null;
  temperature: number | null;
  voltage: number | null;
  bias_current: number | null;
  source: string;
  collection_status: string;
  error_message?: string | null;
  collected_at: string;
}

export interface OltOperationHistoryItem {
  id: number;
  olt_id: number;
  olt_name?: string;
  operation_type: string;
  operator_id?: string | null;
  operator_username?: string | null;
  sanitized_command_summary: string;
  status: 'started' | 'success' | 'partial_success' | 'failed';
  sanitized_result?: string | null;
  started_at: string;
  completed_at?: string | null;
}

export interface OltProfileItem {
  id: number;
  olt_id: number;
  profile_type: 'line' | 'service';
  profile_id: number;
  profile_name: string;
  source: 'olt' | 'local';
  is_verified: boolean;
  verified_at?: string | null;
}

export interface CustomerOnuDetails {
  association_id: number;
  association_source: string;
  associated_at: string;
  onu_id: number;
  serial_number: string;
  frame: number;
  slot: number;
  pon_port: number;
  ont_id: number;
  description?: string | null;
  vendor_id?: string | null;
  equipment_id?: string | null;
  model?: string | null;
  run_state: 'online' | 'offline' | 'missing' | 'unknown';
  config_state: 'initial' | 'normal' | 'failed' | 'unknown';
  match_state: 'match' | 'mismatch' | 'unknown';
  last_rx_power?: number | null;
  last_tx_power?: number | null;
  last_olt_rx_power?: number | null;
  last_optical_reading_at?: string | null;
  olt_id: number;
  olt_name: string;
  branch_id?: number | null;
  branch_name?: string | null;
  optical_warning_threshold: number;
  optical_critical_threshold: number;
  last_sync_at?: string | null;
}
