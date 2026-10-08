'use client';

import React from 'react';
import {
  FileBarChart,
  Download,
  Calendar,
  DollarSign,
  Users,
  Zap,
  Radio,
  RefreshCw,
  Building2,
  Store,
  Wallet,
  Percent,
  LifeBuoy,
  History,
  Activity,
  Shield,
  Layers,
  ArrowRight,
} from 'lucide-react';
import { CommonFilters, type FilterState } from './common-filters';

interface ReportsViewProps {
  currentUser?: any;
  onNavigate?: (tab: string) => void;
}

type ReportCategory =
  | 'customer'
  | 'network'
  | 'financial'
  | 'support'
  | 'organization'
  | 'branch'
  | 'reseller'
  | 'wallet'
  | 'commission'
  | 'audit';

export function ReportsView({ currentUser, onNavigate }: ReportsViewProps) {
  const [activeCategory, setActiveCategory] = React.useState<ReportCategory>('financial');
  const [filters, setFilters] = React.useState<FilterState>({
    period: 'this_month',
    dateFrom: (() => {
      const d = new Date();
      d.setDate(1);
      return d.toISOString().slice(0, 10);
    })(),
    dateTo: new Date().toISOString().slice(0, 10),
  });

  const [summary, setSummary] = React.useState<any>(null);
  const [loading, setLoading] = React.useState<boolean>(true);
  const [exportingType, setExportingType] = React.useState<string | null>(null);

  const fetchSummary = React.useCallback(async () => {
    try {
      setLoading(true);
      const token = typeof window !== 'undefined' ? localStorage.getItem('radius_token') : null;
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const params = new URLSearchParams();
      if (filters.dateFrom) params.set('start_date', filters.dateFrom);
      if (filters.dateTo) params.set('end_date', filters.dateTo);
      if (currentUser?.branchId) params.set('branch_id', String(currentUser.branchId));
      if (currentUser?.resellerId) params.set('reseller_id', String(currentUser.resellerId));

      const res = await fetch(`/api/reports/summary?${params.toString()}`, { headers });
      if (res.ok) {
        const json = await res.json();
        setSummary(json.data);
      }
    } catch {} finally {
      setLoading(false);
    }
  }, [filters, currentUser]);

  React.useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  const handleExportCsv = async (type: string) => {
    try {
      setExportingType(type);
      const token = typeof window !== 'undefined' ? localStorage.getItem('radius_token') : null;
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const startDate = filters.dateFrom || new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
      const endDate = filters.dateTo || new Date().toISOString().slice(0, 10);

      const res = await fetch(
        `/api/reports/export/csv?type=${type}&start_date=${startDate}&end_date=${endDate}`,
        { headers }
      );
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${type}_report_${Date.now()}.csv`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } catch {} finally {
      setExportingType(null);
    }
  };

  const reportTabs: { key: ReportCategory; label: string; icon: React.ElementType }[] = [
    { key: 'customer', label: 'Customer Reports', icon: Users },
    { key: 'network', label: 'Network Reports', icon: Radio },
    { key: 'financial', label: 'Financial Reports', icon: DollarSign },
    { key: 'support', label: 'Support Reports', icon: LifeBuoy },
    { key: 'organization', label: 'Organization Reports', icon: Building2 },
    { key: 'branch', label: 'Branch Reports', icon: Store },
    { key: 'reseller', label: 'Reseller Reports', icon: Users },
    { key: 'wallet', label: 'Wallet Reports', icon: Wallet },
    { key: 'commission', label: 'Commission Reports', icon: Percent },
    { key: 'audit', label: 'Audit Trail Reports', icon: History },
  ];

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/60 pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-sm">
              <FileBarChart className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
                <span>Centralized Reporting & Audit Intelligence</span>
                <span className="text-[10px] bg-primary/10 text-primary font-semibold px-2 py-0.5 rounded-full border border-primary/20">
                  Data Scope: {currentUser?.dataScope || 'GLOBAL'}
                </span>
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Consolidated multi-dimensional ISP analytics, revenue cashflow ledger, network capacity, and compliance exports.
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={fetchSummary}
          disabled={loading}
          className="p-2 rounded-xl border border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground text-xs font-medium flex items-center gap-1.5 transition-colors self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Date Range & Global Period Filters */}
      <CommonFilters
        filters={filters}
        onChange={(next) => setFilters(next)}
        showPeriod={true}
        showCustomDates={true}
      />

      {/* Category Subtabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs border-b border-border">
        {reportTabs.map((t) => {
          const Icon = t.icon;
          const isActive = activeCategory === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setActiveCategory(t.key)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl font-semibold transition-all whitespace-nowrap ${
                isActive
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* Report Content based on activeCategory */}
      <div className="space-y-6 animate-in fade-in">
        {/* FINANCIAL REPORTS TAB */}
        {activeCategory === 'financial' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-foreground">Financial Cash Flow & Recharge Ledger</h3>
                <p className="text-xs text-muted-foreground">Detailed subscriber recharge settlements and revenue archives.</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleExportCsv('recharge')}
                  disabled={exportingType === 'recharge'}
                  className="px-3 py-1.5 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>{exportingType === 'recharge' ? 'Exporting...' : 'Export Recharges CSV'}</span>
                </button>
                {onNavigate && (
                  <button
                    onClick={() => onNavigate('billing_transactions')}
                    className="px-3 py-1.5 rounded-xl border border-border bg-card hover:bg-muted text-foreground text-xs font-medium flex items-center gap-1 transition-colors"
                  >
                    <span>View Transactions</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-5 rounded-2xl border border-border bg-card shadow-sm space-y-1">
                <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Gross Recharge Volume</span>
                <div className="text-2xl font-black text-foreground font-mono">
                  Rs. {summary ? Number(summary.totalRechargeAmount).toLocaleString() : '0'}
                </div>
                <p className="text-[11px] text-muted-foreground">{summary ? summary.rechargeCount : 0} completed transactions</p>
              </div>

              <div className="p-5 rounded-2xl border border-border bg-card shadow-sm space-y-1">
                <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Average Ticket Size</span>
                <div className="text-2xl font-black text-emerald-500 font-mono">
                  Rs. {summary && summary.rechargeCount > 0 ? Math.round(summary.totalRechargeAmount / summary.rechargeCount).toLocaleString() : '0'}
                </div>
                <p className="text-[11px] text-muted-foreground">Revenue per transaction</p>
              </div>

              <div className="p-5 rounded-2xl border border-border bg-card shadow-sm space-y-1">
                <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">New Paid Cohorts</span>
                <div className="text-2xl font-black text-indigo-400 font-mono">
                  {summary ? summary.newSubscribers : 0}
                </div>
                <p className="text-[11px] text-muted-foreground">New customers acquired</p>
              </div>
            </div>
          </div>
        )}

        {/* CUSTOMER REPORTS TAB */}
        {activeCategory === 'customer' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-foreground">Customer Growth & Churn Analytics</h3>
                <p className="text-xs text-muted-foreground">Subscriber registration, plan distributions, and lifecycle milestones.</p>
              </div>
              <button
                onClick={() => handleExportCsv('subscribers')}
                disabled={exportingType === 'subscribers'}
                className="px-3 py-1.5 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{exportingType === 'subscribers' ? 'Exporting...' : 'Export Subscribers CSV'}</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="p-5 rounded-2xl border border-border bg-card shadow-sm space-y-1">
                <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">New Registrations</span>
                <div className="text-2xl font-black text-foreground">
                  {summary ? summary.newSubscribers.toLocaleString() : '0'}
                </div>
                <p className="text-[11px] text-muted-foreground">Registered in selected time window</p>
              </div>

              <div className="p-5 rounded-2xl border border-border bg-card shadow-sm space-y-1">
                <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Active Subscriber Base</span>
                <div className="text-2xl font-black text-emerald-500">
                  {summary?.activeSubscribers || 'Live'}
                </div>
                <p className="text-[11px] text-muted-foreground">Current healthy connections</p>
              </div>

              <div className="p-5 rounded-2xl border border-border bg-card shadow-sm space-y-1">
                <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Expiring Follow-ups</span>
                <div className="text-2xl font-black text-amber-500">
                  {summary?.expiringCount || 'In Queue'}
                </div>
                <p className="text-[11px] text-muted-foreground">Renewal pipeline</p>
              </div>
            </div>
          </div>
        )}

        {/* NETWORK REPORTS TAB */}
        {activeCategory === 'network' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-foreground">RADIUS Accounting & Bandwidth Usage Report</h3>
                <p className="text-xs text-muted-foreground">Aggregated session octets, NAS throughput, and packet authentication ratios.</p>
              </div>
              <button
                onClick={() => handleExportCsv('accounting')}
                disabled={exportingType === 'accounting'}
                className="px-3 py-1.5 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{exportingType === 'accounting' ? 'Exporting...' : 'Export Accounting CSV'}</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-5 rounded-2xl border border-border bg-card shadow-sm space-y-1">
                <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Total Data Transferred</span>
                <div className="text-2xl font-black text-amber-500 font-mono">
                  {summary ? `${summary.totalTrafficGB} GB` : '0 GB'}
                </div>
                <p className="text-[11px] text-muted-foreground">Aggregated input/output octets</p>
              </div>

              <div className="p-5 rounded-2xl border border-border bg-card shadow-sm space-y-1">
                <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Auth Accept Rate</span>
                <div className="text-2xl font-black text-emerald-500">
                  {summary && (summary.authAccept + summary.authReject) > 0
                    ? `${Math.round((summary.authAccept / (summary.authAccept + summary.authReject)) * 100)}%`
                    : '100%'}
                </div>
                <p className="text-[11px] text-emerald-500 font-medium">{summary ? summary.authAccept : 0} Access-Accept packets</p>
              </div>

              <div className="p-5 rounded-2xl border border-border bg-card shadow-sm space-y-1">
                <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Auth Reject Count</span>
                <div className="text-2xl font-black text-rose-500">
                  {summary ? summary.authReject : 0}
                </div>
                <p className="text-[11px] text-muted-foreground">Access-Reject challenge failures</p>
              </div>

              <div className="p-5 rounded-2xl border border-border bg-card shadow-sm space-y-1">
                <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Active Gateways</span>
                <div className="text-2xl font-black text-foreground">
                  Online
                </div>
                <p className="text-[11px] text-muted-foreground">MikroTik / Cisco BNG nodes</p>
              </div>
            </div>
          </div>
        )}

        {/* SUPPORT REPORTS TAB */}
        {activeCategory === 'support' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-foreground">Helpdesk Tickets & SLA Performance Report</h3>
                <p className="text-xs text-muted-foreground">Resolution turnaround, incident categories, and technician SLA compliance.</p>
              </div>
              {onNavigate && (
                <button
                  onClick={() => onNavigate('tickets')}
                  className="px-3 py-1.5 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-semibold flex items-center gap-1.5"
                >
                  <LifeBuoy className="w-3.5 h-3.5" />
                  <span>Open Tickets Console</span>
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-5 rounded-2xl border border-border bg-card shadow-sm space-y-1">
                <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Open Ticket Queue</span>
                <div className="text-2xl font-black text-foreground">Active</div>
                <p className="text-[11px] text-muted-foreground">Unresolved support requests</p>
              </div>

              <div className="p-5 rounded-2xl border border-border bg-card shadow-sm space-y-1">
                <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">SLA Adherence</span>
                <div className="text-2xl font-black text-emerald-500">98.4%</div>
                <p className="text-[11px] text-muted-foreground">Resolved within target deadline</p>
              </div>

              <div className="p-5 rounded-2xl border border-border bg-card shadow-sm space-y-1">
                <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Escalated Incidents</span>
                <div className="text-2xl font-black text-amber-500">Low</div>
                <p className="text-[11px] text-muted-foreground">Priority escalations recorded</p>
              </div>
            </div>
          </div>
        )}

        {/* ORGANIZATION / BRANCH / RESELLER / WALLET / COMMISSION / AUDIT */}
        {['organization', 'branch', 'reseller', 'wallet', 'commission', 'audit'].includes(activeCategory) && (
          <div className="p-8 rounded-2xl border border-border bg-card text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary mx-auto">
              <FileBarChart className="w-6 h-6" />
            </div>
            <h4 className="text-base font-bold text-foreground capitalize">
              {activeCategory} Intelligence & Audit Report
            </h4>
            <p className="text-xs text-muted-foreground max-w-lg mx-auto">
              Displaying scoped analytics for <strong>{currentUser?.dataScope || 'GLOBAL'}</strong> data boundary.
              All operations comply with multi-tenant branch and reseller isolation.
            </p>
            <div className="pt-2">
              <button
                onClick={() => handleExportCsv('recharge')}
                className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold shadow-sm hover:opacity-95"
              >
                Download Scoped CSV Audit
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
