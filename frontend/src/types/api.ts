export type DataSource = 'live' | 'demo' | 'mixed';
export type ServiceStatus = 'healthy' | 'warning' | 'offline';
export type OverallStatus = 'healthy' | 'degraded' | 'critical';

export interface ServiceHealth {
  key: string;
  name: string;
  status: ServiceStatus;
  latencyMs: number | null;
  message: string;
  checkedAt: string;
}

export type TimeRange = '1h' | '6h' | '24h' | '7d' | '30d';

export interface StatCard {
  key: string;
  label: string;
  value: number;
  unit?: 'percent' | 'currency' | 'count';
  currency?: string;
  changePct: number | null;
  positiveIsGood: boolean;
  sparkline: number[] | null;
  source: DataSource;
}

export interface NetworkOverviewPoint {
  timestamp: string;
  onlineSubscribers: number;
  authRequests: number;
  authSuccess: number;
  authFailure: number;
}

export interface RadiusActivityItem {
  id: string;
  time: string;
  username: string;
  nas: string;
  ipAddress: string | null;
  type: string;
  status: 'success' | 'failed' | 'info';
}

export interface OnlineSession {
  id: string;
  username: string;
  ipAddress: string | null;
  nas: string;
  nasIp: string | null;
  startedAt: string | null;
  sessionSeconds: number;
  downloadBytes: number;
  uploadBytes: number;
  macAddress: string | null;
}

export interface NasDevice {
  id: string;
  name: string;
  ipAddress: string;
  type: string;
  location: string | null;
  status: 'online' | 'warning' | 'offline' | 'unknown';
  sessions: number;
  lastSeenAt: string | null;
}

export interface AuthStatistics {
  range: TimeRange;
  total: number;
  success: number;
  reject: number;
  timeout: number;
  successPct: number;
  rejectPct: number;
  timeoutPct: number;
}

export interface NasDeviceItem {
  id: number;
  name: string;
  ip_address: string;
  nas_type: string;
  description: string | null;
  location: string | null;
  coa_port: number;
  status: 'online' | 'warning' | 'offline' | 'unknown';
  sessions: number;
  last_seen_at: string | null;
  secret?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PackageItem {
  id: number;
  name: string;
  download_speed_mbps: number;
  upload_speed_mbps: number;
  rate_limit: string;
  burst_download_mbps?: number | null;
  burst_upload_mbps?: number | null;
  burst_threshold_dl_mbps?: number | null;
  burst_threshold_ul_mbps?: number | null;
  burst_time_seconds?: number | null;
  radius_profile_id?: number | null;
  radius_profile_name?: string | null;
  validity_days: number;
  price: number;
  currency: string;
  description: string | null;
  is_active: boolean;
  subscribers_count: number;
  attributes?: { id?: number; attribute: string; op: string; value: string }[];
  created_at: string;
  updated_at: string;
}

export interface SubscriberItem {
  id: number;
  customer_id: string;
  username: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  status: 'active' | 'suspended' | 'expired' | 'disabled' | 'pending' | 'terminated' | 'enabled';
  connection_type: 'PPPoE' | 'IPoE' | 'Static IP' | 'Other';
  address?: string | null;
  area?: string | null;
  branch?: string | null;
  installation_date?: string | null;
  current_package_id: number | null;
  package_name: string | null;
  package_speed: string | null;
  ip_pool_id?: number | null;
  ip_pool_name?: string | null;
  static_ip: string | null;
  ipv6_address?: string | null;
  ipv6_prefix?: string | null;
  ipv6_prefix_length?: number | null;
  mac_address: string | null;
  vlan_id: number | null;
  nas_restriction_id: number | null;
  nas_name: string | null;
  olt_pon_port?: string | null;
  onu_mac_sn?: string | null;
  onu_model?: string | null;
  expiry_date: string | null;
  is_expired: boolean;
  is_online: boolean;
  current_ip: string | null;
  current_nas_ip: string | null;
  current_session_id: string | null;
  session_start_time: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface SubscriberServiceItem {
  id: number;
  service_id: string;
  subscriber_id: number;
  package_id: number;
  package_name: string;
  package_speed: string;
  start_date: string;
  expiry_date: string | null;
  status: string;
  nas_id: number | null;
  nas_name: string | null;
  ip_address: string | null;
  ipv6_prefix: string | null;
  created_by: string | null;
  notes: string | null;
  created_at: string;
}

export interface SubscriberNoteItem {
  id: number;
  subscriber_id: number;
  author_id: string | null;
  author_name: string;
  content: string;
  created_at: string;
}

export interface SubscriberActivityItem {
  id: number;
  subscriber_id: number;
  action: string;
  details: string;
  admin_id: string | null;
  admin_username: string | null;
  created_at: string;
}

export interface SubscriberUsageData {
  current_session: {
    session_id: string;
    nas_ip: string;
    framed_ip: string;
    duration_seconds: number;
    download_bytes: number;
    upload_bytes: number;
    login_time: string;
  } | null;
  total_download_bytes: number;
  total_upload_bytes: number;
  total_bytes: number;
  formatted_download: string;
  formatted_upload: string;
  formatted_total: string;
  session_count: number;
  last_login: string | null;
  last_logout: string | null;
  daily_chart: {
    date: string;
    download_bytes: number;
    upload_bytes: number;
    download_mb: number;
    upload_mb: number;
  }[];
}

export interface SubscriberProfileData {
  subscriber: SubscriberItem;
  services: SubscriberServiceItem[];
  notes: SubscriberNoteItem[];
  activity: SubscriberActivityItem[];
  radiusAttributes: {
    check: { id: number; attribute: string; op: string; value: string }[];
    reply: { id: number; attribute: string; op: string; value: string }[];
    groupReply: { id: number; groupname: string; attribute: string; op: string; value: string }[];
  };
}

export interface RadiusAttributeItem {
  id: number;
  profile_id?: number;
  vendor: string;
  attribute_name: string;
  attribute_type: string;
  op: string;
  value: string;
  created_at?: string;
}

export interface RadiusProfileItem {
  id: number;
  name: string;
  description: string | null;
  is_active: boolean;
  attributes: RadiusAttributeItem[];
  created_at: string;
  updated_at: string;
}

export interface IpPoolItem {
  id: number;
  name: string;
  network: string;
  gateway: string;
  start_ip: string;
  end_ip: string;
  subnet: string;
  description: string | null;
  status: 'active' | 'inactive' | 'exhausted';
  total_ips: number;
  used_ips: number;
  utilization_percent: number;
  created_at: string;
  updated_at: string;
}

export interface IpAddressItem {
  id: number;
  pool_id: number | null;
  pool_name: string | null;
  ip_address: string;
  subscriber_id: number | null;
  customer_id: string | null;
  username: string | null;
  subscriber_name: string | null;
  status: 'available' | 'assigned' | 'reserved' | 'blocked';
  allocation_date: string | null;
  last_seen: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface SessionItem {
  radacctid: string;
  acctsessionid: string;
  username: string;
  customer_name: string | null;
  customer_id: string | null;
  framedipaddress: string | null;
  nasipaddress: string;
  nas_name: string | null;
  nas_type: string | null;
  acctstarttime: string | null;
  session_seconds: number;
  acctinputoctets: number;
  acctoutputoctets: number;
  callingstationid: string | null;
  status: 'online' | 'stopped';
}

export interface AuthLogItem {
  id: string;
  username: string;
  reply: string;
  authdate: string;
  calledstationid: string | null;
  callingstationid: string | null;
  nas_name: string | null;
  nas_ip: string | null;
  reason: string;
}
