/**
 * Shared API types. The frontend mirrors these in src/types/api.ts.
 * Keep both in sync when changing contracts.
 */

/** Where a piece of data came from. Demo data must always be labelled as such. */
export type DataSource = 'live' | 'demo' | 'mixed';

export interface ApiMeta {
  source: DataSource;
  generatedAt: string;
  [key: string]: unknown;
}

export type ServiceStatus = 'healthy' | 'warning' | 'offline';
export type OverallStatus = 'healthy' | 'degraded' | 'critical';

export interface ServiceHealth {
  key: 'application' | 'database' | 'freeradius' | 'radius_auth' | 'radius_acct';
  name: string;
  status: ServiceStatus;
  latencyMs: number | null;
  message: string;
  checkedAt: string;
}

export type TimeRange = '1h' | '6h' | '24h' | '7d' | '30d';
export const TIME_RANGES: TimeRange[] = ['1h', '6h', '24h', '7d', '30d'];

export interface StatCard {
  key:
    | 'total_subscribers'
    | 'online_users'
    | 'active_packages'
    | 'todays_revenue'
    | 'open_tickets'
    | 'radius_requests'
    | 'auth_success_rate'
    | 'auth_failure_rate'
    | 'nas_devices'
    | string;
  label: string;
  value: number;
  unit?: 'percent' | 'currency' | 'count';
  currency?: string;
  changePct: number | null;
  /** Whether an increase is good (green) or bad (red) for this metric. */
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
  type: 'Access-Accept' | 'Access-Reject' | 'Accounting-Start' | 'Accounting-Stop' | 'Interim-Update';
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

export interface PackagePriceItem {
  id: number;
  package_id: number;
  duration_months: number;
  price: number;
  currency: string;
  is_active: boolean;
  created_at: string;
}

export interface RechargeTransactionItem {
  id: number;
  receipt_no: string;
  subscriber_id: number;
  username?: string;
  customer_id?: string;
  full_name?: string;
  package_id: number;
  package_name?: string;
  duration_months: number;
  amount: number;
  currency: string;
  payment_method: string;
  recharge_date: string;
  previous_expiry: string | null;
  new_expiry: string;
  created_by: string;
  notes?: string;
  created_at: string;
}

export interface SessionActionItem {
  id: number;
  subscriber_id?: number | null;
  username: string;
  session_id?: string | null;
  nas_ip?: string | null;
  action: 'disconnect' | 'coa_rate_limit' | 'suspend' | 'resume';
  vendor: string;
  status: 'SUCCESS' | 'FAILED' | 'NOT SUPPORTED' | 'TIMEOUT';
  details?: string | null;
  operator_username: string;
  created_at: string;
}

export interface NetworkEventItem {
  id: number;
  event_type: string;
  severity: 'info' | 'warning' | 'critical';
  actor: string;
  target?: string | null;
  description: string;
  metadata?: any;
  created_at: string;
}

export interface AlertItem {
  id: number;
  severity: 'info' | 'warning' | 'critical';
  title: string;
  description: string;
  source: string;
  status: 'active' | 'acknowledged' | 'resolved';
  metadata?: any;
  created_at: string;
  resolved_at?: string | null;
  resolved_by?: string | null;
}

export interface NasTestResult {
  nas_id: number;
  nas_name: string;
  nas_ip: string;
  auth_port: number;
  result: 'ACCEPT' | 'REJECT' | 'ERROR' | 'TIMEOUT';
  response_time_ms: number;
  attributes: { attribute: string; value: string }[];
  error?: string;
}

export interface CoaResult {
  status: 'SUCCESS' | 'FAILED' | 'NOT SUPPORTED' | 'TIMEOUT';
  vendor: string;
  details: string;
}

export interface GlobalSearchResult {
  type: 'subscriber' | 'session' | 'nas' | 'package' | 'ip';
  title: string;
  subtitle: string;
  id: string | number;
  url?: string;
  badge?: string;
}
