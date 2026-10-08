'use client';

import React from 'react';
import {
  Users,
  Wifi,
  UserCheck,
  PauseCircle,
  AlertTriangle,
  Clock,
  UserPlus,
  CreditCard,
  TrendingUp,
  Package,
  Building2,
  Radio,
  Search,
  RefreshCw,
  ArrowRight,
  ArrowUpRight,
  ShieldCheck,
  Download,
} from 'lucide-react';
import { CommonFilters, type FilterState } from './common-filters';
import type { CustomerDashboardMetrics, SubscriberItem } from '@/types/api';

interface CustomerDashboardViewProps {
  onNavigate: (tab: string, queryParams?: Record<string, string>) => void;
  onOpenSubscriber: (id: number) => void;
  onOpenCreateCustomer?: () => void;
  onOpenSearch?: () => void;
}

export function CustomerDashboardView({
  onNavigate,
  onOpenSubscriber,
  onOpenCreateCustomer,
  onOpenSearch,
}: CustomerDashboardViewProps) {
  const [filters, setFilters] = React.useState<FilterState>({
    period: 'today',
  });
  const [data, setData] = React.useState<CustomerDashboardMetrics | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const fetchMetrics = React.useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams();
      if (filters.period) params.set('period', filters.period);
      if (filters.dateFrom) params.set('from', filters.dateFrom);
      if (filters.dateTo) params.set('to', filters.dateTo);

      const res = await fetch(`/api/customers/dashboard?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to load customer metrics');
      const json = await res.json();
      setData(json.data);
    } catch (err: any) {
      setError(err.message || 'Error fetching customer dashboard');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  React.useEffect(() => {
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 30000);
    return () => clearInterval(interval);
  }, [fetchMetrics]);

  const periodTitle =
    filters.period === 'today'
      ? 'Today'
      : filters.period === 'yesterday'
      ? 'Yesterday'
      : filters.period === 'this_week'
      ? 'This Week'
      : filters.period === 'last_week'
      ? 'Last Week'
      : filters.period === 'this_month'
      ? 'This Month'
      : filters.period === 'last_month'
      ? 'Last Month'
      : filters.period === 'this_year'
      ? 'This Year'
      : filters.period === 'custom'
      ? 'Selected Date Range'
      : 'All Time';

  return (
    <div className="space-y-6">
      {/* Top Banner & Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/60 pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-purple-600/10 border border-purple-600/20 flex items-center justify-center text-purple-500 shadow-sm">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
                <span>Customer Operations Dashboard</span>
                <span className="text-[10px] bg-purple-500/10 text-purple-400 font-semibold px-2 py-0.5 rounded-full border border-purple-500/20">
                  ISP Subscribers
                </span>
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Real-time operational subscriber status, lifecycle health, and cohort acquisition metrics.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {onOpenCreateCustomer && (
            <button
              onClick={onOpenCreateCustomer}
              className="px-3.5 py-2 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-primary/20 transition-all"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Create Customer</span>
            </button>
          )}

          <button
            onClick={() => onNavigate('online_customers')}
            className="px-3 py-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 text-xs font-semibold flex items-center gap-1.5 transition-colors"
          >
            <Wifi className="w-3.5 h-3.5 animate-pulse" />
            <span>Online Monitor</span>
          </button>

          {onOpenSearch && (
            <button
              onClick={onOpenSearch}
              className="p-2 rounded-xl border border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground text-xs font-medium transition-colors"
              title="Search Customers"
            >
              <Search className="w-4 h-4" />
            </button>
          )}

          <button
            onClick={fetchMetrics}
            disabled={loading}
            className="p-2 rounded-xl border border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground text-xs font-medium transition-colors"
            title="Refresh Metrics"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Global Period Filter Component */}
      <CommonFilters
        filters={filters}
        onChange={(next) => setFilters(next)}
        showPeriod={true}
        showCustomDates={true}
      />

      {error && (
        <div className="p-4 rounded-xl border border-rose-500/20 bg-rose-500/10 text-rose-500 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Section 1: Real-Time Operational Status (Current Network State) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Real-Time Operational Metrics (Live Status)
            </h3>
          </div>
          <span className="text-[11px] text-muted-foreground font-mono">Independent of date range</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {/* Card 1: Total Customers */}
          <div
            onClick={() => onNavigate('subscribers')}
            className="p-4 rounded-2xl bg-card border border-border hover:border-primary/50 hover:shadow-md transition-all cursor-pointer group"
          >
            <div className="flex items-center justify-between text-muted-foreground mb-1">
              <span className="text-xs font-medium group-hover:text-primary transition-colors">Total Customers</span>
              <Users className="w-4 h-4 text-primary" />
            </div>
            <div className="text-2xl font-black text-foreground mt-1">
              {data ? data.totalCustomers.toLocaleString() : '—'}
            </div>
            <div className="text-[10px] text-muted-foreground flex items-center gap-1 mt-1 group-hover:text-primary transition-colors">
              <span>View directory</span>
              <ArrowUpRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
            </div>
          </div>

          {/* Card 2: Online Customers */}
          <div
            onClick={() => onNavigate('online_customers')}
            className="p-4 rounded-2xl bg-card border border-border hover:border-emerald-500/50 hover:shadow-md transition-all cursor-pointer group"
          >
            <div className="flex items-center justify-between text-muted-foreground mb-1">
              <span className="text-xs font-medium group-hover:text-emerald-500 transition-colors">Online Users</span>
              <Wifi className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="text-2xl font-black text-emerald-500 mt-1 flex items-center gap-2">
              <span>{data ? data.onlineCustomers.toLocaleString() : '—'}</span>
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
            </div>
            <div className="text-[10px] text-muted-foreground flex items-center gap-1 mt-1 group-hover:text-emerald-500 transition-colors">
              <span>Live sessions</span>
              <ArrowUpRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
            </div>
          </div>

          {/* Card 3: Active Customers */}
          <div
            onClick={() => onNavigate('subscribers', { status: 'active' })}
            className="p-4 rounded-2xl bg-card border border-border hover:border-primary/50 hover:shadow-md transition-all cursor-pointer group"
          >
            <div className="flex items-center justify-between text-muted-foreground mb-1">
              <span className="text-xs font-medium group-hover:text-primary transition-colors">Active Status</span>
              <UserCheck className="w-4 h-4 text-blue-500" />
            </div>
            <div className="text-2xl font-black text-foreground mt-1">
              {data ? data.activeCustomers.toLocaleString() : '—'}
            </div>
            <div className="text-[10px] text-muted-foreground flex items-center gap-1 mt-1 group-hover:text-primary transition-colors">
              <span>Enabled accounts</span>
              <ArrowRight className="w-3 h-3" />
            </div>
          </div>

          {/* Card 4: Suspended */}
          <div
            onClick={() => onNavigate('subscribers', { status: 'suspended' })}
            className="p-4 rounded-2xl bg-card border border-border hover:border-amber-500/50 hover:shadow-md transition-all cursor-pointer group"
          >
            <div className="flex items-center justify-between text-muted-foreground mb-1">
              <span className="text-xs font-medium group-hover:text-amber-500 transition-colors">Suspended</span>
              <PauseCircle className="w-4 h-4 text-amber-500" />
            </div>
            <div className="text-2xl font-black text-amber-500 mt-1">
              {data ? data.suspendedCustomers.toLocaleString() : '—'}
            </div>
            <div className="text-[10px] text-muted-foreground flex items-center gap-1 mt-1 group-hover:text-amber-500 transition-colors">
              <span>Restricted access</span>
              <ArrowRight className="w-3 h-3" />
            </div>
          </div>

          {/* Card 5: Expired */}
          <div
            onClick={() => onNavigate('subscribers', { status: 'expired' })}
            className="p-4 rounded-2xl bg-card border border-border hover:border-rose-500/50 hover:shadow-md transition-all cursor-pointer group"
          >
            <div className="flex items-center justify-between text-muted-foreground mb-1">
              <span className="text-xs font-medium group-hover:text-rose-500 transition-colors">Expired</span>
              <AlertTriangle className="w-4 h-4 text-rose-500" />
            </div>
            <div className="text-2xl font-black text-rose-500 mt-1">
              {data ? data.expiredCustomers.toLocaleString() : '—'}
            </div>
            <div className="text-[10px] text-muted-foreground flex items-center gap-1 mt-1 group-hover:text-rose-500 transition-colors">
              <span>Needs renewal</span>
              <ArrowRight className="w-3 h-3" />
            </div>
          </div>

          {/* Card 6: Expiring Soon */}
          <div
            onClick={() => onNavigate('subscribers', { expiry_status: '7days' })}
            className="p-4 rounded-2xl bg-card border border-border hover:border-purple-500/50 hover:shadow-md transition-all cursor-pointer group"
          >
            <div className="flex items-center justify-between text-muted-foreground mb-1">
              <span className="text-xs font-medium group-hover:text-purple-400 transition-colors">Expiring (7d)</span>
              <Clock className="w-4 h-4 text-purple-400" />
            </div>
            <div className="text-2xl font-black text-foreground mt-1">
              {data ? data.expiringSoonCustomers.toLocaleString() : '—'}
            </div>
            <div className="text-[10px] text-muted-foreground flex items-center gap-1 mt-1 group-hover:text-purple-400 transition-colors">
              <span>Follow-up queue</span>
              <ArrowRight className="w-3 h-3" />
            </div>
          </div>
        </div>
      </div>

      {/* Section 2: Date-Range Metrics (Performance in Selected Period) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <TrendingUp className="w-4 h-4 text-primary" />
            <span>Date-Range Performance ({periodTitle})</span>
          </h3>
          <span className="text-[11px] text-primary font-medium">Filtered to {periodTitle}</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Card: New Customers */}
          <div
            onClick={() => onNavigate('subscribers', { period: filters.period || 'today' })}
            className="p-5 rounded-2xl bg-gradient-to-br from-card to-primary/5 border border-border hover:border-primary/50 hover:shadow-md transition-all cursor-pointer group"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                New Customers ({periodTitle})
              </span>
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                <UserPlus className="w-4 h-4" />
              </div>
            </div>
            <div className="text-3xl font-black text-foreground mt-3">
              {data ? data.newCustomers.toLocaleString() : '—'}
            </div>
            <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1 group-hover:text-primary transition-colors">
              <span>View newly onboarded subscribers</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </p>
          </div>

          {/* Card: New Recharges */}
          <div
            onClick={() => onNavigate('billing_transactions', { period: filters.period || 'today' })}
            className="p-5 rounded-2xl bg-gradient-to-br from-card to-emerald-500/5 border border-border hover:border-emerald-500/50 hover:shadow-md transition-all cursor-pointer group"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Recharges Volume ({periodTitle})
              </span>
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-500 group-hover:scale-110 transition-transform">
                <CreditCard className="w-4 h-4" />
              </div>
            </div>
            <div className="text-3xl font-black text-emerald-500 mt-3">
              {data ? data.newRecharges.toLocaleString() : '—'}
            </div>
            <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1 group-hover:text-emerald-500 transition-colors">
              <span>View transactions completed</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </p>
          </div>

          {/* Card: Period Revenue */}
          <div
            onClick={() => onNavigate('billing_transactions', { period: filters.period || 'today' })}
            className="p-5 rounded-2xl bg-gradient-to-br from-card to-indigo-500/5 border border-border hover:border-indigo-500/50 hover:shadow-md transition-all cursor-pointer group"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Period Revenue ({periodTitle})
              </span>
              <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-500 group-hover:scale-110 transition-transform">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
            <div className="text-3xl font-black text-foreground mt-3 font-mono">
              Rs. {data ? data.rechargeRevenue.toLocaleString() : '0'}
            </div>
            <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1 group-hover:text-indigo-400 transition-colors">
              <span>Gross financial transactions ledger</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </p>
          </div>
        </div>
      </div>

      {/* Section 3: Package & Branch Distributions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Package Distribution */}
        <div className="p-5 rounded-2xl border border-border bg-card space-y-4 shadow-sm">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
              <Package className="w-4 h-4 text-primary" />
              <span>Subscribers by Service Plan</span>
            </h4>
            <button
              onClick={() => onNavigate('packages')}
              className="text-xs text-primary hover:underline font-medium"
            >
              Manage Plans
            </button>
          </div>

          <div className="space-y-3">
            {data?.packageBreakdown && data.packageBreakdown.length > 0 ? (
              data.packageBreakdown.map((item, idx) => {
                const total = data.totalCustomers || 1;
                const pct = Math.round((item.count / total) * 100);
                return (
                  <div key={idx} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-foreground">{item.packageName}</span>
                      <span className="font-mono text-muted-foreground">
                        {item.count} ({pct}%)
                      </span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-purple-500 to-primary rounded-full transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="text-xs text-muted-foreground py-6 text-center">No package distribution data.</p>
            )}
          </div>
        </div>

        {/* Branch Distribution */}
        <div className="p-5 rounded-2xl border border-border bg-card space-y-4 shadow-sm">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
              <Building2 className="w-4 h-4 text-primary" />
              <span>Subscribers by Branch Office</span>
            </h4>
            <button
              onClick={() => onNavigate('branches')}
              className="text-xs text-primary hover:underline font-medium"
            >
              Manage Branches
            </button>
          </div>

          <div className="space-y-3">
            {data?.branchBreakdown && data.branchBreakdown.length > 0 ? (
              data.branchBreakdown.map((item, idx) => {
                const total = data.totalCustomers || 1;
                const pct = Math.round((item.count / total) * 100);
                return (
                  <div key={idx} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-foreground">{item.branchName}</span>
                      <span className="font-mono text-muted-foreground">
                        {item.count} ({pct}%)
                      </span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-indigo-500 to-cyan-500 rounded-full transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="text-xs text-muted-foreground py-6 text-center">No branch distribution data.</p>
            )}
          </div>
        </div>
      </div>

      {/* Section 4: Recent Customers Table */}
      <div className="p-5 rounded-2xl border border-border bg-card space-y-4 shadow-sm">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" />
            <span>Recently Added Subscribers</span>
          </h4>
          <button
            onClick={() => onNavigate('subscribers')}
            className="text-xs text-primary hover:underline font-medium flex items-center gap-1"
          >
            <span>View All Subscribers</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-border bg-muted/30 text-muted-foreground font-semibold">
                <th className="py-2.5 px-3">Customer ID</th>
                <th className="py-2.5 px-3">Full Name</th>
                <th className="py-2.5 px-3">Username</th>
                <th className="py-2.5 px-3">Service Package</th>
                <th className="py-2.5 px-3">Type</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3">Created</th>
                <th className="py-2.5 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {data?.recentCustomers && data.recentCustomers.length > 0 ? (
                data.recentCustomers.map((sub: any) => (
                  <tr key={sub.id} className="hover:bg-muted/40 transition-colors">
                    <td className="py-2.5 px-3 font-mono font-medium text-primary">
                      {sub.customer_id}
                    </td>
                    <td className="py-2.5 px-3 font-semibold text-foreground">
                      {sub.full_name}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-muted-foreground">
                      {sub.username}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="px-2 py-0.5 rounded-md bg-muted text-foreground text-[11px] font-medium border border-border">
                        {sub.package_name || 'No Plan'}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-muted-foreground">
                      {sub.connection_type || 'PPPoE'}
                    </td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          sub.status === 'active' || sub.status === 'enabled'
                            ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                            : sub.status === 'suspended'
                            ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                            : 'bg-muted text-muted-foreground border border-border'
                        }`}
                      >
                        {sub.status}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-muted-foreground font-mono text-[11px]">
                      {new Date(sub.created_at).toLocaleDateString()}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <button
                        onClick={() => onOpenSubscriber(sub.id)}
                        className="px-2 py-1 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary text-[11px] font-semibold transition-colors"
                      >
                        View Profile
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="py-6 text-center text-muted-foreground">
                    No recent subscriber records available.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
