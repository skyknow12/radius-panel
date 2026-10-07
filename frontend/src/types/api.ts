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
  status: 'enabled' | 'disabled' | 'suspended';
  current_package_id: number | null;
  package_name: string | null;
  package_speed: string | null;
  static_ip: string | null;
  mac_address: string | null;
  vlan_id: number | null;
  nas_restriction_id: number | null;
  nas_name: string | null;
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
