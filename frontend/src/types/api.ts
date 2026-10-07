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
  username: string;
  customer_id: string;
  full_name: string;
  package_id: number;
  package_name: string;
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

export interface NocMetrics {
  onlineUsersCount: number;
  activeSessionsCount: number;
  todayAuthTotal: number;
  todayAuthSuccess: number;
  todayAuthReject: number;
  activeNasCount: number;
  offlineNasCount: number;
  todayInputBytes: number;
  todayOutputBytes: number;
  todayTrafficFormatted: string;
  ipPoolUtilizationPct: number;
  radiusHealth: {
    status: 'HEALTHY' | 'WARNING' | 'CRITICAL';
    authService: boolean;
    acctService: boolean;
    dbService: boolean;
    avgLatencyMs: number;
  };
}

export interface GlobalSearchResult {
  type: 'subscriber' | 'session' | 'nas' | 'package' | 'ip' | 'transaction' | 'invoice';
  title: string;
  subtitle: string;
  id: string | number;
  url?: string;
  badge?: string;
}

// =============================================================================
// PHASE 5 BILLING & FINANCIAL MANAGEMENT TYPES
// =============================================================================

export interface BillingTransactionItem {
  id: number;
  transaction_id: string;
  receipt_no: string;
  subscriber_id: number;
  username: string;
  customer_id: string;
  full_name: string;
  package_id: number;
  package_name: string;
  duration: number;
  duration_unit: string;
  original_price: string;
  discount_type: 'none' | 'fixed' | 'percentage';
  discount_value: string;
  discount_amount: string;
  adjustment_amount: string;
  tax_rate: string;
  tax_amount: string;
  final_amount: string;
  currency: string;
  payment_method: string;
  payment_reference: string | null;
  recharge_date: string;
  previous_expiry: string | null;
  new_expiry: string;
  status: 'PENDING' | 'COMPLETED' | 'CANCELLED' | 'REFUNDED' | 'PARTIALLY_REFUNDED' | 'FAILED';
  created_by: string;
  notes: string | null;
  idempotency_key?: string | null;
  created_at: string;
}

export interface InvoiceItem {
  id: number;
  invoice_no: string;
  transaction_id: string | null;
  subscriber_id: number;
  customer_name: string;
  customer_id: string;
  username: string;
  service_name: string;
  package_name: string;
  duration_months: number;
  price: string;
  discount_amount: string;
  tax_rate: string;
  tax_amount: string;
  total_amount: string;
  currency: string;
  status: 'PAID' | 'UNPAID' | 'CANCELLED';
  issue_date: string;
  due_date: string | null;
  created_at: string;
}

export interface RefundItem {
  id: number;
  refund_id: string;
  transaction_id: string;
  subscriber_id: number;
  amount: string;
  currency: string;
  refund_type: 'full' | 'partial';
  reason: string;
  refund_method: string;
  processed_by: string;
  created_at: string;
}

export interface PaymentMethodItem {
  id: number;
  code: string;
  name: string;
  requires_reference: boolean;
  is_active: boolean;
  sort_order: number;
  description: string | null;
  created_at: string;
}

export interface PackagePriceHistoryItem {
  id: number;
  package_id: number;
  duration_months: number;
  old_price: string | null;
  new_price: string;
  currency: string;
  changed_by: string;
  reason: string | null;
  created_at: string;
}

export interface BillingAdjustmentItem {
  id: number;
  adjustment_id: string;
  subscriber_id: number;
  adjustment_type: 'amount' | 'expiry' | 'credit' | 'discount';
  amount: string;
  days: number;
  reason: string;
  operator_username: string;
  created_at: string;
}

export interface BillingDashboardMetrics {
  todayRevenue: number;
  monthRevenue: number;
  todayRechargesCount: number;
  monthRechargesCount: number;
  activeSubscribers: number;
  expiringTodayCount: number;
  expiringSoonCount: number;
  expiredSubscribersCount: number;
  pendingTransactionsCount: number;
  refundsAmount: number;
  grossRevenue: number;
  totalDiscounts: number;
  totalRefunds: number;
  netRevenue: number;
  recentTransactions: BillingTransactionItem[];
}


