'use client';

import React from 'react';
import { FileBarChart, Download, Calendar, DollarSign, Users, Zap, Radio, RefreshCw } from 'lucide-react';

export function ReportsView() {
  const [startDate, setStartDate] = React.useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  });
  const [endDate, setEndDate] = React.useState<string>(() => new Date().toISOString().slice(0, 10));
  const [summary, setSummary] = React.useState<any>(null);
  const [loading, setLoading] = React.useState<boolean>(true);
  const [exportingType, setExportingType] = React.useState<string | null>(null);

  const fetchSummary = async () => {
    try {
      setLoading(true);
      const token = typeof window !== 'undefined' ? localStorage.getItem('radius_token') : null;
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`/api/reports/summary?start_date=${startDate}&end_date=${endDate}`, { headers });
      if (res.ok) {
        const json = await res.json();
        setSummary(json.data);
      }
    } catch {} finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchSummary();
  }, [startDate, endDate]);

  const handleExportCsv = async (type: 'recharge' | 'accounting' | 'subscribers') => {
    try {
      setExportingType(type);
      const token = typeof window !== 'undefined' ? localStorage.getItem('radius_token') : null;
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`/api/reports/export/csv?type=${type}&start_date=${startDate}&end_date=${endDate}`, { headers });
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

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/60 pb-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <FileBarChart className="w-5 h-5 text-primary" />
            <span>NOC Reports & Revenue Analytics</span>
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Operational summaries, recharge cash flow analytics, and downloadable CSV audit archives.
          </p>
        </div>

        <button
          onClick={fetchSummary}
          disabled={loading}
          className="p-2 rounded-xl border border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground text-xs font-medium flex items-center gap-1.5 transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Date Range Picker */}
      <div className="p-4 rounded-2xl border border-border bg-card shadow-sm flex flex-wrap items-center justify-between gap-4 text-xs">
        <div className="flex items-center gap-3">
          <Calendar className="w-4 h-4 text-primary" />
          <span className="font-semibold text-foreground">Report Period:</span>
          <div className="flex items-center gap-2">
            <label className="text-muted-foreground">From:</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-muted/50 border border-border rounded-lg px-2.5 py-1 text-foreground font-mono"
            />
            <label className="text-muted-foreground">To:</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-muted/50 border border-border rounded-lg px-2.5 py-1 text-foreground font-mono"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => handleExportCsv('recharge')}
            disabled={exportingType === 'recharge'}
            className="px-3 py-1.5 rounded-xl border border-border bg-card hover:bg-muted text-foreground font-medium flex items-center gap-1.5 transition-colors shadow-sm"
          >
            <Download className="w-3.5 h-3.5 text-primary" />
            <span>{exportingType === 'recharge' ? 'Exporting...' : 'Export Recharges CSV'}</span>
          </button>

          <button
            onClick={() => handleExportCsv('accounting')}
            disabled={exportingType === 'accounting'}
            className="px-3 py-1.5 rounded-xl border border-border bg-card hover:bg-muted text-foreground font-medium flex items-center gap-1.5 transition-colors shadow-sm"
          >
            <Download className="w-3.5 h-3.5 text-indigo-400" />
            <span>{exportingType === 'accounting' ? 'Exporting...' : 'Export Accounting CSV'}</span>
          </button>

          <button
            onClick={() => handleExportCsv('subscribers')}
            disabled={exportingType === 'subscribers'}
            className="px-3 py-1.5 rounded-xl border border-border bg-card hover:bg-muted text-foreground font-medium flex items-center gap-1.5 transition-colors shadow-sm"
          >
            <Download className="w-3.5 h-3.5 text-cyan-400" />
            <span>{exportingType === 'subscribers' ? 'Exporting...' : 'Export Subscribers CSV'}</span>
          </button>
        </div>
      </div>

      {/* Summary Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Recharge Volume */}
        <div className="p-5 rounded-2xl border border-border bg-card shadow-sm space-y-1">
          <div className="flex items-center justify-between text-muted-foreground text-xs">
            <span className="font-medium">Total Recharge Volume</span>
            <DollarSign className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-black text-foreground">
            NPR {summary ? Number(summary.totalRechargeAmount).toLocaleString() : '0'}
          </div>
          <div className="text-[11px] text-muted-foreground">
            {summary ? summary.rechargeCount : 0} completed transactions
          </div>
        </div>

        {/* New Subscribers */}
        <div className="p-5 rounded-2xl border border-border bg-card shadow-sm space-y-1">
          <div className="flex items-center justify-between text-muted-foreground text-xs">
            <span className="font-medium">New Subscribers</span>
            <Users className="w-4 h-4 text-primary" />
          </div>
          <div className="text-2xl font-black text-foreground">
            {summary ? summary.newSubscribers.toLocaleString() : '0'}
          </div>
          <div className="text-[11px] text-muted-foreground">
            Registered in selected period
          </div>
        </div>

        {/* Traffic Transferred */}
        <div className="p-5 rounded-2xl border border-border bg-card shadow-sm space-y-1">
          <div className="flex items-center justify-between text-muted-foreground text-xs">
            <span className="font-medium">Total Traffic Transferred</span>
            <Zap className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-black text-foreground">
            {summary ? `${summary.totalTrafficGB} GB` : '0 GB'}
          </div>
          <div className="text-[11px] text-muted-foreground">
            Aggregated from radacct octets
          </div>
        </div>

        {/* Authentications */}
        <div className="p-5 rounded-2xl border border-border bg-card shadow-sm space-y-1">
          <div className="flex items-center justify-between text-muted-foreground text-xs">
            <span className="font-medium">Authentication Requests</span>
            <Radio className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl font-black text-foreground">
            {summary ? (summary.authAccept + summary.authReject).toLocaleString() : '0'}
          </div>
          <div className="text-[11px] text-emerald-500 font-medium">
            {summary ? summary.authAccept : 0} accepted ({summary ? summary.authReject : 0} rejected)
          </div>
        </div>
      </div>
    </div>
  );
}
