'use client';

import React from 'react';
import {
  DollarSign,
  Download,
  Filter,
  Search,
  Store,
  Calendar,
  Layers,
  ArrowUpRight,
  TrendingUp,
  Percent,
  CheckCircle2,
  RefreshCw,
  AlertCircle
} from 'lucide-react';
import type { ResellerItem, ResellerCommissionReportData } from '@/types/api';

export function ResellerCommissionView() {
  const [data, setData] = React.useState<ResellerCommissionReportData | null>(null);
  const [resellers, setResellers] = React.useState<ResellerItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [selectedResellerId, setSelectedResellerId] = React.useState<string>('ALL');
  const [startDate, setStartDate] = React.useState('');
  const [endDate, setEndDate] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);

  const fetchDependencies = async () => {
    try {
      setLoading(true);
      const [commRes, resRes] = await Promise.all([
        fetchCommissionReport(),
        fetch('/api/resellers'),
      ]);

      if (resRes.ok) {
        const json = await resRes.json();
        setResellers(json.data || []);
      }
    } catch {
      setError('Failed to load commission report');
    } finally {
      setLoading(false);
    }
  };

  const fetchCommissionReport = async () => {
    try {
      const params = new URLSearchParams();
      if (selectedResellerId && selectedResellerId !== 'ALL') {
        params.append('reseller_id', selectedResellerId);
      }
      if (startDate) params.append('start_date', startDate);
      if (endDate) params.append('end_date', endDate);

      const res = await fetch(`/api/reports/commission?${params.toString()}`);
      if (res.ok) {
        const json = await res.json();
        setData(json.data);
      }
    } catch {
      // ignore
    }
  };

  React.useEffect(() => {
    fetchDependencies();
  }, []);

  React.useEffect(() => {
    fetchCommissionReport();
  }, [selectedResellerId, startDate, endDate]);

  const getExportUrl = () => {
    const params = new URLSearchParams();
    if (selectedResellerId && selectedResellerId !== 'ALL') {
      params.append('reseller_id', selectedResellerId);
    }
    if (startDate) params.append('start_date', startDate);
    if (endDate) params.append('end_date', endDate);
    return `/api/reports/commission/export?${params.toString()}`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-bold text-foreground flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-amber-400" />
            Reseller Commission & Payout Report
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Audit trail of wholesale reseller discounts, incentives, and net ISP collected revenue
          </p>
        </div>

        <a
          href={getExportUrl()}
          download
          className="px-3.5 py-2 rounded-xl bg-card border border-border hover:bg-muted text-xs font-semibold text-foreground transition-colors flex items-center gap-1.5 self-start sm:self-auto shadow-sm"
        >
          <Download className="w-3.5 h-3.5 text-primary" />
          <span>Export Commission CSV</span>
        </a>
      </div>

      {error && (
        <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          <span>{error}</span>
        </div>
      )}

      {/* 4 Financial Totals Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-card border border-border shadow-sm">
          <span className="text-[10px] text-muted-foreground font-semibold uppercase block">Gross Retail Value</span>
          <div className="text-xl font-black text-foreground mt-1 font-mono">
            Rs. {(data?.totals.gross || 0).toLocaleString()}
          </div>
          <span className="text-[10px] text-muted-foreground">Standard list prices</span>
        </div>

        <div className="p-4 rounded-2xl bg-card border border-border shadow-sm">
          <span className="text-[10px] text-muted-foreground font-semibold uppercase block">Wholesale Discounts</span>
          <div className="text-xl font-black text-amber-400 mt-1 font-mono">
            Rs. {(data?.totals.discount || 0).toLocaleString()}
          </div>
          <span className="text-[10px] text-muted-foreground">Discount model savings</span>
        </div>

        <div className="p-4 rounded-2xl bg-card border border-border shadow-sm">
          <span className="text-[10px] text-muted-foreground font-semibold uppercase block">Commission Earned</span>
          <div className="text-xl font-black text-purple-400 mt-1 font-mono">
            Rs. {(data?.totals.commission || 0).toLocaleString()}
          </div>
          <span className="text-[10px] text-muted-foreground">Partner incentives</span>
        </div>

        <div className="p-4 rounded-2xl bg-card border border-border shadow-sm">
          <span className="text-[10px] text-muted-foreground font-semibold uppercase block">Net ISP Revenue</span>
          <div className="text-xl font-black text-emerald-400 mt-1 font-mono">
            Rs. {(data?.totals.netIspRevenue || 0).toLocaleString()}
          </div>
          <span className="text-[10px] text-emerald-400 font-semibold">Net Received</span>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-card p-3 rounded-2xl border border-border">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Store className="w-4 h-4 text-muted-foreground" />
          <select
            value={selectedResellerId}
            onChange={(e) => setSelectedResellerId(e.target.value)}
            className="bg-background border border-border rounded-xl px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="ALL">All Resellers</option>
            {resellers.map((r) => (
              <option key={r.id} value={String(r.id)}>
                {r.name} ({r.code})
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Calendar className="w-3.5 h-3.5" />
            <span>From:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-background border border-border rounded-xl px-2 py-1 text-xs text-foreground"
            />
          </div>

          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span>To:</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-background border border-border rounded-xl px-2 py-1 text-xs text-foreground"
            />
          </div>

          {(selectedResellerId !== 'ALL' || startDate || endDate) && (
            <button
              onClick={() => {
                setSelectedResellerId('ALL');
                setStartDate('');
                setEndDate('');
              }}
              className="text-xs text-primary font-semibold hover:underline px-2"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Report Table */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-muted/40 text-muted-foreground font-semibold border-b border-border">
              <tr>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Transaction / Receipt</th>
                <th className="py-3 px-4">Reseller</th>
                <th className="py-3 px-4">Subscriber</th>
                <th className="py-3 px-4">Package & Duration</th>
                <th className="py-3 px-4">Gross Price</th>
                <th className="py-3 px-4">Discount / Comm</th>
                <th className="py-3 px-4">Net ISP Revenue</th>
                <th className="py-3 px-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-muted-foreground animate-pulse">
                    Loading commission report...
                  </td>
                </tr>
              ) : !data || data.items.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-muted-foreground">
                    No reseller transactions recorded for the selected filter.
                  </td>
                </tr>
              ) : (
                data.items.map((item) => (
                  <tr key={item.id} className="hover:bg-muted/30 transition-colors">
                    <td className="py-3 px-4 text-muted-foreground whitespace-nowrap">
                      {new Date(item.recharge_date).toLocaleDateString([], {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </td>
                    <td className="py-3 px-4 font-mono font-semibold text-foreground">
                      <div>{item.transaction_id}</div>
                      <div className="text-[10px] text-muted-foreground">{item.receipt_no}</div>
                    </td>
                    <td className="py-3 px-4 font-medium text-foreground">
                      <div className="flex items-center gap-1.5">
                        <Store className="w-3.5 h-3.5 text-amber-400" />
                        <span>{item.reseller_name}</span>
                      </div>
                      <div className="text-[10px] text-muted-foreground font-mono">{item.reseller_code}</div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-foreground">{item.username}</div>
                      <div className="text-[10px] text-muted-foreground font-mono">CID: {item.customer_id}</div>
                    </td>
                    <td className="py-3 px-4">
                      <div>{item.package_name}</div>
                      <div className="text-[10px] text-muted-foreground font-mono">{item.duration} Month(s)</div>
                    </td>
                    <td className="py-3 px-4 font-mono text-muted-foreground">
                      Rs. {item.original_price.toLocaleString()}
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-amber-400">
                      - Rs. {(item.discount_amount || item.commission_amount || 0).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-emerald-400">
                      Rs. {item.final_amount.toLocaleString()}
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        {item.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
