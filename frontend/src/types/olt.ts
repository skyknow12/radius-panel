export type OltVendor = 'Huawei' | 'BDCOM' | 'Powertech' | 'VSOL' | 'Other';

export const OLT_VENDORS: { label: string; value: OltVendor }[] = [
  { label: 'Huawei', value: 'Huawei' },
  { label: 'BDCOM', value: 'BDCOM' },
  { label: 'Powertech', value: 'Powertech' },
  { label: 'VSOL', value: 'VSOL' },
  { label: 'Other', value: 'Other' },
];

export const KNOWN_VENDOR_MODELS: Record<OltVendor, string[]> = {
  Huawei: ['MA5683T', 'MA5608T', 'MA5800-X7', 'MA5800-X15', 'MA5800-X17', 'Other'],
  BDCOM: ['GP3600-08', 'GP3600-16', 'P3608B', 'P3616-2TE', 'Other'],
  Powertech: ['PT-G08', 'PT-G16', 'PT-E04', 'Other'],
  VSOL: ['V1600G1', 'V1600G2', 'V1600D4', 'V1600D8', 'Other'],
  Other: ['Other'],
};

export interface OltItem {
  id: number;
  name: string;
  description?: string | null;
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
  snmp_enabled?: boolean;
  snmp_version: string;
  snmp_port: number;
  snmp_community_masked?: string;
  snmp_write_community_masked?: string;
  snmp_timeout_ms?: number;
  snmp_retries?: number;
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
  last_poll_at?: string | null;
  last_poll_status?: 'success' | 'error' | 'timeout' | 'unknown' | null;
  last_poll_error?: string | null;
  next_poll_at?: string | null;
  sys_uptime?: string | null;
  sys_descr?: string | null;
  sys_name?: string | null;
  sys_location?: string | null;
  sys_contact?: string | null;
  cpu_utilization?: number | null;
  memory_utilization?: number | null;
  temperature?: number | null;
  fans_status?: string | null;
  power_status?: string | null;
  active_alarms_count?: number;
  registered_onus_count?: number;
  online_onus_count?: number;
  optical_warning_threshold: number;
  optical_critical_threshold: number;
  total_onus?: number;
  online_onus?: number;
  offline_onus?: number;
  created_at: string;
  updated_at: string;
}

export interface OltInterfaceItem {
  id: number;
  olt_id: number;
  if_index: number;
  if_name: string;
  if_descr: string;
  if_type: string;
  admin_status: 'up' | 'down' | 'testing' | 'unknown';
  oper_status: 'up' | 'down' | 'testing' | 'unknown' | 'dormant' | 'notPresent' | 'lowerLayerDown';
  speed_bps: number;
  mac_address?: string | null;
  mtu?: number;
  in_octets: number;
  out_octets: number;
  in_rate_bps: number;
  out_rate_bps: number;
  in_errors: number;
  out_errors: number;
  in_discards: number;
  out_discards: number;
  last_change?: string | null;
  updated_at: string;
}

export interface OltAlarmItem {
  id: number;
  olt_id: number;
  alarm_id: string;
  severity: 'critical' | 'major' | 'minor' | 'warning' | 'info';
  title: string;
  description: string;
  entity_type?: string;
  entity_id?: string;
  cleared: boolean;
  raised_at: string;
  cleared_at?: string | null;
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
