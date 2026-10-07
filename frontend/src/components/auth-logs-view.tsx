'use client';

import React from 'react';
import {
  Activity,
  Search,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Filter,
  ChevronLeft,
  ChevronRight,
  Clock,
  Server,
  Shield,
} from 'lucide-react';
import type { AuthLogItem } from '@/types/api';

interface AuthLogsViewProps {
  onViewSubscriber?: (username: string) => void;
}

export function AuthLogsView({ onViewSubscriber }: AuthLogsViewProps = {}) {
  const [logs, setLogs] = React.useState<AuthLogItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [search, setSearch] = React.useState('');
  const [replyFilter, setReplyFilter] = React.useState('all');
  const [meta, setMeta] = React.useState({ page: 1, limit: 25, total: 0, totalPages: 1 });
  const [autoRefresh, setAutoRefresh] = React.useState(true);

  const fetchLogs = async (page = meta.page) => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', String(meta.limit));
      if (search.trim()) params.set('search', search.trim());
      if (replyFilter !== 'all') params.set('reply', replyFilter);

      const res = await fetch(`/api/radius/authentication-logs?${params.toString()}`);
      if (res.ok) {
        const json = await res.json();
        setLogs(json.data || []);
        if (json.meta) setMeta(json.meta);
      }
    } catch {} finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchLogs(1);
  }, [search, replyFilter]);

  React.useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      fetchLogs();
    }, 15000); // 15s auto-refresh
    return () => clearInterval(interval);
  }, [autoRefresh, search, replyFilter, meta.page]);

  return (
    <div className="space-y-6">
      {/* Top Banner & Refresh */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Activity className="w-5 h-5 text-primary" />
            <span>RADIUS Authentication Logs</span>
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Audit trail of Access-Accept and Access-Reject attempts recorded in FreeRADIUS radpostauth.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer bg-card border border-border px-3 py-1.5 rounded-xl">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="w-3.5 h-3.5 rounded text-primary"
            />
            <span>Auto Refresh (15s)</span>
          </label>

          <button
            onClick={() => fetchLogs()}
            disabled={loading}
            className="p-2 rounded-xl border border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground text-xs font-medium flex items-center gap-1.5 transition-colors"
            title="Refresh logs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-3.5 rounded-2xl border border-border bg-card/60 backdrop-blur-sm flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by username, calling station ID, or NAS..."
            className="w-full bg-muted/50 border border-border rounded-xl pl-9 pr-4 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all"
          />
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end text-xs">
          <select
            value={replyFilter}
            onChange={(e) => setReplyFilter(e.target.value)}
            className="bg-muted/50 border border-border rounded-xl px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
          >
            <option value="all">All Results</option>
            <option value="Access-Accept">Access-Accept (Success)</option>
            <option value="Access-Reject">Access-Reject (Failure)</option>
          </select>

          <div className="text-muted-foreground">
            Total Logged: <span className="font-bold text-foreground font-mono">{meta.total}</span>
          </div>
        </div>
      </div>

      {/* Logs Table */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-muted-foreground font-semibold">
                <th className="py-3 px-4">Time</th>
                <th className="py-3 px-4">Username</th>
                <th className="py-3 px-4">NAS Gateway</th>
                <th className="py-3 px-4">NAS IP</th>
                <th className="py-3 px-4">Source / Calling IP</th>
                <th className="py-3 px-4">Result</th>
                <th className="py-3 px-4">Reason / Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {loading && logs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-muted-foreground">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-primary" />
                    <span>Loading authentication logs...</span>
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-muted-foreground">
                    No authentication events found.
                  </td>
                </tr>
              ) : (
                logs.map((log) => {
                  const isAccept = log.reply === 'Access-Accept';
                  const d = new Date(log.authdate);
                  return (
                    <tr key={log.id} className="hover:bg-muted/40 transition-colors">
                      <td className="py-3 px-4 font-mono text-muted-foreground">
                        <div>
                          {d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </div>
                        <div className="text-[10px] text-muted-foreground/60">
                          {d.toLocaleDateString([], { month: 'short', day: 'numeric' })}
                        </div>
                      </td>
                      <td className="py-3 px-4 font-semibold text-foreground">
                        {onViewSubscriber ? (
                          <button
                            onClick={() => onViewSubscriber(log.username)}
                            className="text-primary hover:underline font-semibold text-left"
                          >
                            {log.username}
                          </button>
                        ) : (
                          <span>{log.username}</span>
                        )}
                      </td>
                      <td className="py-3 px-4 font-medium text-foreground">
                        {log.nas_name || log.calledstationid || '-'}
                      </td>
                      <td className="py-3 px-4 font-mono text-muted-foreground">
                        {log.nas_ip || '-'}
                      </td>
                      <td className="py-3 px-4 font-mono text-muted-foreground">
                        {log.callingstationid || '-'}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${
                            isAccept
                              ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                              : 'bg-rose-500/10 text-rose-500 border-rose-500/20'
                          }`}
                        >
                          {isAccept ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                          <span>{log.reply}</span>
                        </span>
                      </td>
                      <td className="py-3 px-4 text-muted-foreground">
                        {log.reason}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="p-3.5 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
          <div>
            Showing <span className="font-semibold text-foreground">{logs.length}</span> of{' '}
            <span className="font-semibold text-foreground">{meta.total}</span> attempts
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchLogs(meta.page - 1)}
              disabled={meta.page <= 1}
              className="p-1.5 rounded-lg border border-border hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="font-medium text-foreground">
              Page {meta.page} of {meta.totalPages}
            </span>
            <button
              onClick={() => fetchLogs(meta.page + 1)}
              disabled={meta.page >= meta.totalPages}
              className="p-1.5 rounded-lg border border-border hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
