'use client';

import React from 'react';
import {
  FileBarChart,
  DollarSign,
  ShieldAlert,
  Percent,
  Download,
  RefreshCw,
  Search,
  Filter,
  Building2,
  Users,
  CreditCard,
  Layers,
  ArrowRight,
  TrendingUp,
} from 'lucide-react';
import type { ResellerFinancialReportData, ResellerItem } from '@/types/api';
import { ResellerTopupModal } from './reseller-topup-modal';

interface ResellerReportsViewProps {
  currentUser?: any;
  onOpenResellerProfile?: (resellerId: number) => void;
}

export function ResellerReportsView({
  currentUser,
  onOpenResellerProfile,
}: ResellerReportsViewProps) {
  const [reportData, setReportData] = React.useState<ResellerFinancialReportData | null>(null);
  const [resellers, setResellers] = React.useState<ResellerItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [period, setPeriod] = React.useState('this_month');
  const [selectedResellerId, setSelectedResellerId] = React.useState<number | ''>('');
  const [topupModalReseller, setTopupModalReseller] = React.useState<ResellerItem | null>(null);

  const fetchReports = async () => {
    try {
      setLoading(true);
      const resParam = selectedResellerId ? `&reseller_id=${selectedResellerId}` : '';
      const [repRes, resListRes] = await Promise.all([
        fetch(`/api/resellers/reports?period=${period}${resParam}`),
        fetch('/api/resellers'),
      ]);

      if (repRes.ok) {
        const json = await repRes.json();
        setReportData(json.data);
      }
      if (resListRes.ok) {
        const json = await resListRes.json();
        setResellers(json.data || []);
      }
    } catch {} finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchReports();
  }, [period, selectedResellerId]);

  const handleExportCsv = () => {
    const resParam = selectedResellerId ? `/${selectedResellerId}` : '';
    window.open(`/api/resellers${resParam ? `/resellers${resParam}` : ''}/reports`, '_blank');
  };

  return (
    <div className="space-y-6 pb-16 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <FileBarChart className="w-6 h-6 text-purple-400" />
            Reseller Financial Reports
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Prepaid commission accounting, cash receipts, approved credit facilities, and selling volume
          </p>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 flex-wrap">
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="px-3 py-1.5 bg-muted/40 border border-border rounded-xl text-xs text-foreground focus:ring-2 focus:ring-purple-500"
          >
            <option value="today">Today</option>
            <option value="yesterday">Yesterday</option>
            <option value="this_week">This Week</option>
            <option value="last_week">Last Week</option>
            <option value="this_month">This Month</option>
            <option value="last_month">Last Month</option>
            <option value="this_year">This Year</option>
            <option value="all_time">All Time</option>
          </select>

          <select
            value={selectedResellerId}
            onChange={(e) => setSelectedResellerId(e.target.value ? Number(e.target.value) : '')}
            className="px-3 py-1.5 bg-muted/40 border border-border rounded-xl text-xs text-foreground focus:ring-2 focus:ring-purple-500"
          >
            <option value="">All Resellers</option>
            {resellers.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name} ({r.code})
              </option>
            ))}
          </select>

          <button
            onClick={fetchReports}
            className="p-2 rounded-xl border border-border hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            title="Refresh Report"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Section 29 Mandatory Distinction Callout */}
      <div className="p-4 rounded-2xl bg-muted/30 border border-border text-xs text-muted-foreground flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400" />
          <span>
            <strong className="text-foreground">Accounting Rule:</strong> Only actual Cash Received is recognized as ISP Cash Revenue. Approved credit top-ups and customer-selling wallet values are strictly distinguished.
          </span>
        </div>
      </div>

      {loading && !reportData ? (
        <div className="p-12 text-center text-xs text-muted-foreground">Loading reseller financial reports...</div>
      ) : reportData ? (
        <div className="space-y-6">
          {/* Totals KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-5 rounded-2xl bg-card border border-border">
              <span className="text-[11px] font-bold text-muted-foreground uppercase flex items-center justify-between">
                <span>Actual Cash Received</span>
                <DollarSign className="w-4 h-4 text-emerald-400" />
              </span>
              <div className="text-2xl font-black text-emerald-400 mt-2">
                Rs. {reportData.totals.totalCashReceived.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </div>
              <span className="text-[10px] text-emerald-500 font-semibold mt-1 block">
                True Cash Revenue
              </span>
            </div>

            <div className="p-5 rounded-2xl bg-card border border-border">
              <span className="text-[11px] font-bold text-muted-foreground uppercase flex items-center justify-between">
                <span>Credit Facility Granted</span>
                <ShieldAlert className="w-4 h-4 text-amber-400" />
              </span>
              <div className="text-2xl font-black text-amber-400 mt-2">
                Rs. {reportData.totals.totalCreditGranted.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </div>
              <span className="text-[10px] text-amber-500 font-semibold mt-1 block">
                Approved Credit Balance
              </span>
            </div>

            <div className="p-5 rounded-2xl bg-card border border-border">
              <span className="text-[11px] font-bold text-muted-foreground uppercase flex items-center justify-between">
                <span>Total Commission Added</span>
                <Percent className="w-4 h-4 text-purple-400" />
              </span>
              <div className="text-2xl font-black text-purple-400 mt-2">
                Rs. {reportData.totals.totalCommissionGranted.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </div>
              <span className="text-[10px] text-purple-400 font-semibold mt-1 block">
                Prepaid Commission Granted
              </span>
            </div>

            <div className="p-5 rounded-2xl bg-card border border-border">
              <span className="text-[11px] font-bold text-muted-foreground uppercase flex items-center justify-between">
                <span>Customer Recharges</span>
                <CreditCard className="w-4 h-4 text-blue-400" />
              </span>
              <div className="text-2xl font-black text-blue-400 mt-2">
                Rs. {reportData.totals.totalCustomerRecharge.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </div>
              <span className="text-[10px] text-blue-400 font-semibold mt-1 block">
                Total Selling Value Consumed
              </span>
            </div>
          </div>

          {/* Breakdown by Reseller Table */}
          <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                <Users className="w-4 h-4 text-purple-400" />
                Reseller Financial Breakdown
              </h3>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-border/80 text-[11px] font-bold text-muted-foreground uppercase">
                    <th className="pb-2.5">Reseller Name</th>
                    <th className="pb-2.5">Code</th>
                    <th className="pb-2.5 text-right">Commission %</th>
                    <th className="pb-2.5 text-right">Wallet Balance</th>
                    <th className="pb-2.5 text-right">Credit Remaining</th>
                    <th className="pb-2.5 text-right">Cash Paid</th>
                    <th className="pb-2.5 text-right">Credit Taken</th>
                    <th className="pb-2.5 text-right">Commission Granted</th>
                    <th className="pb-2.5 text-right">Customer Recharges</th>
                    <th className="pb-2.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {reportData.resellerBreakdown.map((r) => (
                    <tr key={r.reseller_id} className="hover:bg-muted/30 transition-colors">
                      <td className="py-3 font-semibold text-foreground">{r.reseller_name}</td>
                      <td className="py-3 font-mono text-muted-foreground">{r.reseller_code}</td>
                      <td className="py-3 text-right text-purple-400 font-bold">{r.commission_percent.toFixed(2)}%</td>
                      <td className="py-3 text-right font-black text-foreground">
                        Rs. {r.wallet_balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 text-right font-semibold text-cyan-400">
                        Rs. {r.credit_remaining.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 text-right font-semibold text-emerald-400">
                        Rs. {r.cash_paid.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 text-right font-semibold text-amber-400">
                        Rs. {r.credit_taken.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 text-right font-bold text-purple-400">
                        Rs. {r.commission_earned.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 text-right font-bold text-blue-400">
                        Rs. {r.customer_recharges.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => {
                              const found = resellers.find((x) => x.id === r.reseller_id);
                              if (found) setTopupModalReseller(found);
                            }}
                            className="px-2 py-1 rounded-lg bg-purple-600/15 border border-purple-500/30 text-purple-400 hover:bg-purple-600/25 font-bold text-[11px]"
                          >
                            + Top-Up
                          </button>
                          <button
                            onClick={() => onOpenResellerProfile?.(r.reseller_id)}
                            className="px-2 py-1 rounded-lg border border-border text-foreground hover:bg-muted text-[11px] font-medium"
                          >
                            Profile
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}

      {/* Topup modal if triggered from reports */}
      {topupModalReseller && (
        <ResellerTopupModal
          isOpen={!!topupModalReseller}
          onClose={() => setTopupModalReseller(null)}
          reseller={topupModalReseller}
          currentUser={currentUser}
          onSuccess={() => {
            fetchReports();
          }}
        />
      )}
    </div>
  );
}
