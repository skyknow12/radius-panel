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
  organization_id?: number | null;
  branch_id?: number | null;
  branch_name?: string | null;
  reseller_id?: number | null;
  reseller_name?: string | null;
  ownership_type?: 'head_office' | 'branch' | 'reseller';
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
  package_name?: string | null;
  ipv6_prefix?: string | null;
  branch?: string | null;
  reseller_name?: string | null;
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

export interface CustomerDashboardMetrics {
  totalCustomers: number;
  onlineCustomers: number;
  activeCustomers: number;
  suspendedCustomers: number;
  expiredCustomers: number;
  expiringSoonCustomers: number;
  period: string;
  from?: string;
  to?: string;
  newCustomers: number;
  newRecharges: number;
  rechargeRevenue: number;
  packageBreakdown: { packageName: string; count: number }[];
  branchBreakdown: { branchName: string; count: number }[];
  connectionTypeBreakdown: { connectionType: string; count: number }[];
  recentCustomers: SubscriberItem[];
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
  type: 'subscriber' | 'session' | 'nas' | 'package' | 'ip' | 'transaction' | 'invoice' | 'branch' | 'reseller' | 'wallet' | 'ticket' | 'user';
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
  original_price: string | number;
  discount_type: 'none' | 'fixed' | 'percentage';
  discount_value: string | number;
  discount_amount: string | number;
  adjustment_amount: string | number;
  tax_rate: string | number;
  tax_amount: string | number;
  final_amount: string | number;
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
  price: string | number;
  discount_amount: string | number;
  tax_rate: string | number;
  tax_amount: string | number;
  total_amount: string | number;
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
  amount: string | number;
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

// =============================================================================
// PHASE 6: ORGANIZATION, BRANCH, RESELLER, WALLET, CREDIT & COMMISSION
// =============================================================================

export interface OrganizationItem {
  id: number;
  name: string;
  code: string;
  logo_url: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  currency: string;
  timezone: string;
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
  settings: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface BranchItem {
  id: number;
  organization_id: number;
  name: string;
  code: string;
  address: string | null;
  contact_number: string | null;
  email: string | null;
  manager_name: string | null;
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
  notes: string | null;
  wallet_id?: number | null;
  wallet_balance?: number;
  credit_limit?: number;
  subscriber_count?: number;
  active_subscribers?: number;
  created_at: string;
  updated_at: string;
}

export interface ResellerItem {
  id: number;
  organization_id: number;
  branch_id: number | null;
  branch_name?: string | null;
  name: string;
  code: string;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
  commission_model: 'discount' | 'commission';
  commission_percent?: number;
  credit_status?: 'ACTIVE' | 'SUSPENDED' | 'EXPIRED';
  notes: string | null;
  wallet_id?: number | null;
  wallet_balance?: number;
  credit_limit?: number;
  used_credit?: number;
  credit_remaining?: number;
  customer_count?: number;
  active_customers?: number;
  created_at: string;
  updated_at: string;
}

export interface ResellerTopupTarget {
  id: number;
  name: string;
  code: string;
  commission_percent?: number;
  credit_limit?: number;
  used_credit?: number;
  credit_used?: number;
  credit_remaining?: number;
  wallet_balance?: number;
  status?: string;
  credit_status?: string;
  branch_id?: number | null;
  branch_name?: string | null;
  created_at?: string;
  updated_at?: string;
  wallet_number?: string;
  [key: string]: any;
}

export interface ResellerTopupCalcResult {
  paymentAmount: number;
  commissionPercent: number;
  walletValue: number;
  commissionAmount: number;
  cashAmount: number;
  creditAmount: number;
  type: 'CASH' | 'CREDIT';
}

export interface ResellerWalletTxRow {
  id: number;
  transaction_id: string;
  reseller_id: number;
  reseller_name?: string;
  reseller_code?: string;
  wallet_id: number | null;
  type: string;
  status: string;
  cash_amount: number;
  credit_amount: number;
  commission_percent: number;
  commission_amount: number;
  wallet_value: number;
  wallet_debit: number;
  balance_before: number;
  balance_after: number;
  credit_used_before: number;
  credit_used_after: number;
  customer_id: number | null;
  customer_username: string | null;
  package_id: number | null;
  package_name: string | null;
  duration_months: number;
  payment_method: string | null;
  reference: string | null;
  remarks: string | null;
  reversal_of_id: string | null;
  refund_of_id: string | null;
  idempotency_key: string | null;
  created_by: string;
  created_at: string;
}

export interface ResellerProfileDashboardData {
  reseller: {
    id: number;
    name: string;
    code: string;
    contact_person: string | null;
    phone: string | null;
    email: string | null;
    address: string | null;
    status: string;
    commission_percent: number;
    credit_limit: number;
    credit_used: number;
    credit_remaining: number;
    credit_status: string;
    branch_id: number | null;
    branch_name: string | null;
    created_at: string;
    wallet_number: string;
  };
  cards: {
    currentBalance: number;
    totalCashTopup: number;
    totalCreditTopup: number;
    totalCommissionGranted: number;
    totalWalletValueReceived: number;
    totalCustomerRecharge: number;
    totalCreditUsed: number;
    creditRemaining: number;
    customers: number;
    todayRecharge: number;
  };
  customersSummary: {
    total: number;
    active: number;
    expired: number;
  };
  recentTransactions: ResellerWalletTxRow[];
}

export interface ResellerCommissionHistoryItem {
  id: number;
  reseller_id: number;
  previous_percent: number;
  new_percent: number;
  changed_by: string;
  reason: string | null;
  created_at: string;
}

export interface ResellerFinancialReportData {
  totals: {
    totalCashReceived: number;
    totalCreditGranted: number;
    totalCommissionGranted: number;
    totalWalletValueAdded: number;
    totalCustomerRecharge: number;
    totalRefund: number;
    totalReversal: number;
    cashRevenue: number;
  };
  timeSeries: Array<{
    date: string;
    cash_received: number;
    credit_granted: number;
    commission_granted: number;
    wallet_added: number;
    customer_recharge: number;
  }>;
  resellerBreakdown: Array<{
    reseller_id: number;
    reseller_name: string;
    reseller_code: string;
    commission_percent: number;
    wallet_balance: number;
    credit_limit: number;
    credit_used: number;
    credit_remaining: number;
    cash_paid: number;
    credit_taken: number;
    commission_earned: number;
    wallet_credited: number;
    customer_recharges: number;
  }>;
}

export interface WalletItem {
  id: number;
  wallet_number: string;
  entity_type: 'branch' | 'reseller';
  branch_id: number | null;
  reseller_id: number | null;
  entity_name?: string;
  entity_code?: string;
  balance: number;
  total_topup: number;
  total_used: number;
  total_refund: number;
  total_adjusted: number;
  currency: string;
  status: 'ACTIVE' | 'SUSPENDED' | 'LOCKED';
  credit_enabled?: boolean;
  credit_limit?: number;
  used_credit?: number;
  remaining_credit?: number;
  total_available?: number;
  credit_status?: string;
  credit_expiry?: string | null;
  created_at: string;
  updated_at: string;
}

export interface WalletTransactionItem {
  id: number;
  transaction_id: string;
  wallet_id: number;
  wallet_number?: string;
  entity_name?: string;
  entity_type?: string;
  type: 'TOP_UP' | 'DEBIT' | 'CREDIT' | 'REFUND' | 'ADJUSTMENT' | 'REVERSAL';
  amount: number;
  balance_before: number;
  balance_after: number;
  credit_used_before: number;
  credit_used_after: number;
  reference: string | null;
  payment_method: string | null;
  reason: string | null;
  idempotency_key?: string | null;
  created_by: string;
  created_at: string;
}

export interface ChannelPricingRuleItem {
  id: number;
  rule_name: string;
  channel_type: 'branch' | 'reseller';
  branch_id: number | null;
  branch_name?: string | null;
  reseller_id: number | null;
  reseller_name?: string | null;
  package_id: number | null;
  package_name?: string | null;
  duration_months: number | null;
  rule_type: 'percentage_discount' | 'percentage_commission' | 'fixed_discount' | 'fixed_override';
  value: number;
  is_active: boolean;
  notes: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface OwnershipHistoryItem {
  id: number;
  subscriber_id: number;
  username?: string;
  previous_ownership_type: string;
  previous_branch_name?: string | null;
  previous_reseller_name?: string | null;
  new_ownership_type: string;
  new_branch_name?: string | null;
  new_reseller_name?: string | null;
  changed_by: string;
  reason: string | null;
  created_at: string;
}

export interface OrganizationDashboardMetrics {
  totalBranches: number;
  activeBranches: number;
  totalResellers: number;
  activeResellers: number;
  totalSubscribers: number;
  activeSubscribers: number;
  expiredSubscribers: number;
  onlineUsers: number;
  todayRecharge: number;
  monthlyRecharge: number;
  monthlyRevenue: number;
  monthlyCommission: number;
  walletBalance: number;
  totalCredit: number;
  usedCredit: number;
  availableCredit: number;
}

export interface BranchDashboardMetrics {
  subscribers: number;
  activeSubscribers: number;
  expiredSubscribers: number;
  todayRecharge: number;
  monthlyRevenue: number;
  walletBalance: number;
  creditLimit: number;
  usedCredit: number;
  remainingCredit: number;
  totalAvailable: number;
  recentTransactions: any[];
}

export interface ResellerDashboardMetrics {
  customers: number;
  activeCustomers: number;
  expiredCustomers: number;
  todayRecharge: number;
  monthlyRevenue: number;
  commission: number;
  walletBalance: number;
  creditLimit: number;
  usedCredit: number;
  remainingCredit: number;
  totalAvailable: number;
  recentTransactions: any[];
}

export interface WalletDashboardMetrics {
  totalWalletBalance: number;
  totalCreditLimit: number;
  usedCredit: number;
  availableCredit: number;
  todayTopups: number;
  todayDebits: number;
  monthlyWalletUsage: number;
}

export interface ResellerCommissionReportData {
  totals: {
    gross: number;
    discount: number;
    commission: number;
    netIspRevenue: number;
  };
  items: Array<{
    id: number;
    transaction_id: string;
    receipt_no: string;
    subscriber_id: number;
    username: string;
    customer_id: string;
    full_name: string;
    package_name: string;
    duration: number;
    original_price: number;
    discount_amount: number;
    final_amount: number;
    commission_amount: number;
    recharge_date: string;
    status: string;
    reseller_name: string;
    reseller_code: string;
  }>;
  total: number;
}

// =============================================================================
// PHASE 7: USER MANAGEMENT, RBAC, CRM, TICKETS & NOTIFICATIONS
// =============================================================================

export interface UserManagementItem {
  id: string;
  username: string;
  email: string | null;
  full_name: string | null;
  phone: string | null;
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
  is_active: boolean;
  data_scope: 'GLOBAL' | 'ORGANIZATION' | 'BRANCH' | 'RESELLER' | 'OWN';
  user_type: string;
  organization_id: number | null;
  branch_id: number | null;
  reseller_id: number | null;
  organization_name?: string | null;
  branch_name?: string | null;
  reseller_name?: string | null;
  roles: Array<{ id: number; name: string; display_name: string }>;
  role_name?: string;
  role_display_name?: string;
  permissions?: string[];
  last_login_at: string | null;
  last_login_ip: string | null;
  force_password_reset: boolean;
  token_version: number;
  created_at: string;
  updated_at: string;
}

export interface RoleItem {
  id: number;
  name: string;
  display_name: string;
  description: string | null;
  is_system: boolean;
  user_count?: number;
  permission_count?: number;
  permissions?: string[];
  created_at: string;
  updated_at: string;
}

export interface PermissionItem {
  id: number;
  key: string;
  module: string;
  description: string | null;
}

export interface LoginHistoryItem {
  id: number;
  user_id: string | null;
  username: string;
  ip_address: string | null;
  user_agent: string | null;
  status: 'SUCCESS' | 'FAILED' | 'LOCKED';
  failure_reason: string | null;
  created_at: string;
}

export interface UserSessionItem {
  id: string;
  user_id: string;
  ip_address: string | null;
  user_agent: string | null;
  last_activity: string;
  expires_at: string | null;
  is_revoked: boolean;
  created_at: string;
}

export interface TicketItem {
  id: number;
  ticket_number: string;
  subscriber_id: number;
  username: string;
  customer_name?: string;
  customer_phone?: string;
  organization_id: number | null;
  branch_id: number | null;
  reseller_id: number | null;
  branch_name?: string | null;
  reseller_name?: string | null;
  category: string;
  subcategory: string | null;
  subject: string;
  description: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  status: 'OPEN' | 'IN_PROGRESS' | 'WAITING_CUSTOMER' | 'WAITING_INTERNAL' | 'RESOLVED' | 'CLOSED' | 'REOPENED';
  assigned_user_id: string | null;
  assigned_user_name?: string | null;
  created_by_id: string | null;
  created_by_name: string;
  sla_deadline: string | null;
  sla_breached: boolean;
  sla_remaining_minutes?: number | null;
  first_response_at: string | null;
  resolved_at: string | null;
  closed_at: string | null;
  resolution: string | null;
  internal_notes: string | null;
  customer_notes: string | null;
  escalation_count: number;
  created_at: string;
  updated_at: string;
}

export interface TicketCommentItem {
  id: number;
  ticket_id: number;
  author_id: string | null;
  author_name: string;
  comment: string;
  is_internal: boolean;
  created_at: string;
}

export interface TicketAttachmentItem {
  id: number;
  ticket_id: number;
  filename: string;
  file_url: string;
  file_size: number | null;
  mime_type: string | null;
  uploaded_by: string | null;
  created_at: string;
}

export interface TicketStatusHistoryItem {
  id: number;
  ticket_id: number;
  from_status: string | null;
  to_status: string;
  changed_by: string | null;
  changed_by_name: string;
  reason: string | null;
  created_at: string;
}

export interface TicketEscalationItem {
  id: number;
  ticket_id: number;
  escalated_by: string | null;
  from_priority: string;
  to_priority: string;
  reason: string;
  created_at: string;
}

export interface TicketMetrics {
  openTickets: number;
  inProgressTickets: number;
  criticalTickets: number;
  slaNearBreach: number;
  slaBreached: number;
  resolvedToday: number;
  totalTickets: number;
}

export interface TicketCategoryItem {
  id: number;
  name: string;
  description: string | null;
  default_priority: string;
  default_sla_hours: number;
  is_active: boolean;
}

export interface SlaRuleItem {
  id: number;
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  response_time_hours: number;
  resolution_time_hours: number;
  is_active: boolean;
  updated_at: string;
}

export interface CrmNoteItem {
  id: number;
  subscriber_id: number;
  author_id: string | null;
  author_name: string;
  note: string;
  is_pinned: boolean;
  created_at: string;
  updated_at: string;
}

export interface CustomerActivityItem {
  id: number;
  subscriber_id: number;
  actor_id: string | null;
  actor_name: string;
  action_type: string;
  description: string;
  metadata: Record<string, any>;
  created_at: string;
}

export interface CustomerCommunicationItem {
  id: number;
  subscriber_id: number;
  channel: 'IN_APP' | 'SMS' | 'EMAIL' | 'WHATSAPP' | 'CALL';
  recipient: string;
  subject: string | null;
  message: string;
  status: 'QUEUED' | 'SENT' | 'FAILED' | 'DELIVERED';
  sent_by: string | null;
  created_at: string;
}

export interface NotificationItem {
  id: number;
  user_id: string;
  title: string;
  message: string;
  type: 'INFO' | 'SUCCESS' | 'WARNING' | 'CRITICAL' | 'TICKET' | 'BILLING';
  category: string;
  action_url: string | null;
  is_read: boolean;
  read_at: string | null;
  metadata: Record<string, any>;
  created_at: string;
}



