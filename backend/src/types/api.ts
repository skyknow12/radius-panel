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
    | 'radius_requests'
    | 'auth_success_rate'
    | 'auth_failure_rate'
    | 'nas_devices';
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
