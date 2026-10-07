'use client';

import React from 'react';
import {
  FileBarChart,
  Download,
  Calendar,
  Filter,
  DollarSign,
  TrendingUp,
  Box,
  CreditCard,
  Tag,
  RotateCcw,
  Sliders,
} from 'lucide-react';

export function FinancialReportsView() {
  const [reportType, setReportType] = React.useState<string>('daily');
  const [dateFrom, setDateFrom] = React.useState<string>('');
  const [dateTo, setDateTo] = React.useState<string>('');
  const [data, setData] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState<boolean>(true);

  const fetchReport = React.useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.set('type', reportType);
      if (dateFrom) params.set('date_from', dateFrom);
      if (dateTo) params.set('date_to', dateTo);

      const res = await fetch(`/api/billing/reports?${params.toString()}`);
      if (res.ok) {
        const json = await res.json();
        setData(Array.isArray(json.data) ? json.data : []);
      }
    } catch {} finally {
      setLoading(false);
    }
  }, [reportType, dateFrom, dateTo]);

  React.useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const handleExportCsv = () => {
    const params = new URLSearchParams();
    params.set('type', reportType);
    if (dateFrom) params.set('date_from', dateFrom);
    if (dateTo) params.set('date_to', dateTo);
    window.open(`/api/billing/reports/export?${params.toString()}`, '_blank');
  };

  return (
    <div className="space-y-5">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-2 border-b border-border">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <FileBarChart className="w-5 h-5 text-emerald-500" />
            Financial & Revenue Accounting Reports
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Audit-grade revenue analytics, package breakdowns, payment channel metrics, and discount ledgers.
          </p>
        </div>

        <button
          onClick={handleExportCsv}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-card border border-border hover:bg-muted text-xs font-semibold text-foreground transition-colors shadow-sm"
        >
          <Download className="w-4 h-4 text-emerald-500" />
          <span>Export Current Report (CSV)</span>
        </button>
      </div>

      {/* Report Types & Filter Controls */}
      <div className="p-3.5 rounded-2xl bg-card border border-border space-y-3">
        {/* Report Selector Pills */}
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          {[
            { id: 'daily', label: 'Daily Revenue', icon: Calendar },
            { id: 'monthly', label: 'Monthly Revenue', icon: TrendingUp },
            { id: 'packages', label: 'Package Breakdown', icon: Box },
            { id: 'methods', label: 'Payment Channels', icon: CreditCard },
            { id: 'discounts', label: 'Discounts Given', icon: Tag },
            { id: 'refunds', label: 'Refunds Ledger', icon: RotateCcw },
            { id: 'adjustments', label: 'Manual Adjustments', icon: Sliders },
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setReportType(id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-medium transition-all ${
                reportType === id
                  ? 'bg-primary text-primary-foreground font-bold shadow-sm'
                  : 'bg-muted/50 text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{label}</span>
            </button>
          ))}
        </div>

        {/* Date Filters */}
        <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-border/60 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground font-medium">From:</span>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="bg-muted/50 border border-border rounded-xl px-2.5 py-1 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-muted-foreground font-medium">To:</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="bg-muted/50 border border-border rounded-xl px-2.5 py-1 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {(dateFrom || dateTo) && (
            <button
              onClick={() => { setDateFrom(''); setDateTo(''); }}
              className="text-xs text-primary hover:underline font-medium"
            >
              Clear dates
            </button>
          )}
        </div>
      </div>

      {/* Report Data Table */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          {loading ? (
            <div className="py-16 text-center text-muted-foreground text-xs">
              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              Aggregating financial report records...
            </div>
          ) : data.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground text-xs">
              No financial records found for this period.
            </div>
          ) : (
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-muted/40 border-b border-border text-muted-foreground font-semibold">
                  {Object.keys(data[0]).map((key) => (
                    <th key={key} className="py-3 px-3.5 uppercase text-[10px] tracking-wider">
                      {key.replace(/_/g, ' ')}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {data.map((row, idx) => (
                  <tr key={idx} className="hover:bg-muted/30 transition-colors">
                    {Object.keys(row).map((k) => {
                      const val = row[k];
                      const isMoney = k.includes('revenue') || k.includes('price') || k.includes('amount') || k.includes('discount');
                      return (
                        <td
                          key={k}
                          className={`py-2.5 px-3.5 font-mono ${
                            isMoney ? 'font-semibold text-foreground' : 'text-muted-foreground'
                          }`}
                        >
                          {val === null || val === undefined
                            ? '—'
                            : isMoney && !isNaN(Number(val))
                            ? `Rs. ${Number(val).toLocaleString()}`
                            : String(val)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
