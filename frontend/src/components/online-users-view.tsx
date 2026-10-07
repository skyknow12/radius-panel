'use client';

import React from 'react';
import {
  Layers,
  Search,
  RefreshCw,
  PowerOff,
  Clock,
  ArrowDownUp,
  Server,
  Shield,
  CheckCircle2,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import type { SessionItem } from '@/types/api';

interface OnlineUsersViewProps {
  filterNasIp?: string | null;
  onClearNasFilter?: () => void;
}

export function OnlineUsersView({ filterNasIp, onClearNasFilter }: OnlineUsersViewProps) {
  const [sessions, setSessions] = React.useState<SessionItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [search, setSearch] = React.useState('');
  const [autoRefreshInterval, setAutoRefreshInterval] = React.useState<number>(30); // 30s default
  const [meta, setMeta] = React.useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [disconnectingId, setDisconnectingId] = React.useState<string | null>(null);
  const [disconnectConfirm, setDisconnectConfirm] = React.useState<SessionItem | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);

  const fetchSessions = async (page = meta.page) => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', String(meta.limit));
      if (search.trim()) params.set('search', search.trim());
      if (filterNasIp) params.set('nas_ip', filterNasIp);

      const res = await fetch(`/api/radius/sessions?${params.toString()}`);
      if (res.ok) {
        const json = await res.json();
        setSessions(json.data || []);
        if (json.meta) setMeta(json.meta);
      }
    } catch {} finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchSessions(1);
  }, [search, filterNasIp]);

  // Auto-refresh timer
  React.useEffect(() => {
    if (autoRefreshInterval <= 0) return;
    const interval = setInterval(() => {
      fetchSessions();
    }, autoRefreshInterval * 1000);
    return () => clearInterval(interval);
  }, [autoRefreshInterval, search, filterNasIp, meta.page]);

  const handleDisconnect = async (session: SessionItem) => {
    try {
      setDisconnectingId(session.radacctid);
      const token = typeof window !== 'undefined' ? localStorage.getItem('radius_token') : null;
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`/api/radius/sessions/${session.acctsessionid || session.radacctid}/disconnect`, {
        method: 'POST',
        headers,
      });
      const json = await res.json();
      setDisconnectConfirm(null);
      setNotice(json.data?.message || `Session ${session.username} disconnected successfully`);
      setTimeout(() => setNotice(null), 4000);
      fetchSessions();
    } catch (err: any) {
      setNotice(`Error disconnecting: ${err.message}`);
    } finally {
      setDisconnectingId(null);
    }
  };

  const formatBytes = (bytes: number) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  };

  const formatDuration = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hrs > 0) return `${hrs}h ${mins}m`;
    return `${mins}m ${secs}s`;
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Auto-Refresh Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Layers className="w-5 h-5 text-primary" />
            <span>Online Sessions & Live Accounting</span>
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Real-time active PPPoE/IPoE subscriber sessions tracked from FreeRADIUS radacct.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Auto Refresh Interval Selector */}
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-card border border-border px-3 py-1.5 rounded-xl">
            <Clock className="w-3.5 h-3.5 text-primary" />
            <span>Auto Refresh:</span>
            <select
              value={autoRefreshInterval}
              onChange={(e) => setAutoRefreshInterval(Number(e.target.value))}
              className="bg-transparent text-foreground font-semibold focus:outline-none cursor-pointer"
            >
              <option value={10}>10s</option>
              <option value={30}>30s</option>
              <option value={60}>60s</option>
              <option value={0}>Off</option>
            </select>
          </div>

          <button
            onClick={() => fetchSessions()}
            disabled={loading}
            className="p-2 rounded-xl border border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground text-xs font-medium flex items-center gap-1.5 transition-colors"
            title="Manual refresh"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Notice Toast */}
      {notice && (
        <div className="p-3 rounded-xl bg-primary/10 border border-primary/20 text-primary text-xs flex items-center justify-between animate-in fade-in slide-in-from-top-1">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            <span>{notice}</span>
          </div>
          <button onClick={() => setNotice(null)} className="opacity-70 hover:opacity-100 font-semibold">
            ✕
          </button>
        </div>
      )}

      {/* NAS Filter Badge if active */}
      {filterNasIp && (
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-primary/10 border border-primary/20 text-xs text-primary font-medium w-fit">
          <Server className="w-3.5 h-3.5" />
          <span>Filtered by NAS Gateway: <strong>{filterNasIp}</strong></span>
          {onClearNasFilter && (
            <button
              onClick={onClearNasFilter}
              className="ml-2 hover:bg-primary/20 px-1.5 py-0.5 rounded text-[10px]"
            >
              Clear Filter
            </button>
          )}
        </div>
      )}

      {/* Search Bar */}
      <div className="p-3.5 rounded-2xl border border-border bg-card/60 backdrop-blur-sm flex items-center justify-between gap-4">
        <div className="relative w-full max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by username, subscriber name, IP or session ID..."
            className="w-full bg-muted/50 border border-border rounded-xl pl-9 pr-4 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all"
          />
        </div>

        <div className="text-xs text-muted-foreground">
          Active Sessions: <span className="text-foreground font-bold font-mono">{meta.total}</span>
        </div>
      </div>

      {/* Sessions Table */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-muted-foreground font-semibold">
                <th className="py-3 px-4">Username</th>
                <th className="py-3 px-4">Customer Name</th>
                <th className="py-3 px-4">Framed IP</th>
                <th className="py-3 px-4">NAS Gateway</th>
                <th className="py-3 px-4">Session ID</th>
                <th className="py-3 px-4">Login Time</th>
                <th className="py-3 px-4">Duration</th>
                <th className="py-3 px-4">Download / Upload</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Disconnect</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {loading && sessions.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-muted-foreground">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-primary" />
                    <span>Querying active accounting sessions...</span>
                  </td>
                </tr>
              ) : sessions.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-muted-foreground">
                    No active online sessions found.
                  </td>
                </tr>
              ) : (
                sessions.map((s) => (
                  <tr key={s.radacctid} className="hover:bg-muted/40 transition-colors group">
                    <td className="py-3 px-4 font-semibold text-foreground flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      <span>{s.username}</span>
                    </td>
                    <td className="py-3 px-4 text-muted-foreground">
                      {s.customer_name || '-'}
                    </td>
                    <td className="py-3 px-4 font-mono font-medium text-emerald-500">
                      {s.framedipaddress || '-'}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-medium text-foreground">{s.nas_name || s.nasipaddress}</div>
                      <div className="text-[10px] font-mono text-muted-foreground">{s.nasipaddress}</div>
                    </td>
                    <td className="py-3 px-4 font-mono text-muted-foreground/80 text-[11px]">
                      {s.acctsessionid}
                    </td>
                    <td className="py-3 px-4 font-mono text-muted-foreground">
                      {s.acctstarttime ? new Date(s.acctstarttime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '-'}
                    </td>
                    <td className="py-3 px-4 font-medium text-foreground">
                      {formatDuration(s.session_seconds)}
                    </td>
                    <td className="py-3 px-4 font-mono text-foreground">
                      <div className="flex items-center gap-1.5 text-[11px]">
                        <span className="text-emerald-500">↓ {formatBytes(s.acctoutputoctets)}</span>
                        <span className="text-muted-foreground">/</span>
                        <span className="text-blue-500">↑ {formatBytes(s.acctinputoctets)}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                        Online
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => setDisconnectConfirm(s)}
                        disabled={disconnectingId === s.radacctid}
                        className="px-2.5 py-1 rounded-lg border border-rose-500/20 bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 font-semibold text-[11px] flex items-center gap-1.5 ml-auto transition-colors"
                        title="Disconnect session via RADIUS CoA"
                      >
                        <PowerOff className="w-3 h-3" />
                        <span>Disconnect</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="p-3.5 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
          <div>
            Showing <span className="font-semibold text-foreground">{sessions.length}</span> of{' '}
            <span className="font-semibold text-foreground">{meta.total}</span> sessions
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchSessions(meta.page - 1)}
              disabled={meta.page <= 1}
              className="p-1.5 rounded-lg border border-border hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="font-medium text-foreground">
              Page {meta.page} of {meta.totalPages}
            </span>
            <button
              onClick={() => fetchSessions(meta.page + 1)}
              disabled={meta.page >= meta.totalPages}
              className="p-1.5 rounded-lg border border-border hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      {disconnectConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-md animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 text-rose-500 mb-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center">
                <PowerOff className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-foreground">Disconnect this subscriber?</h3>
                <p className="text-[11px] text-muted-foreground">RFC 3576 Disconnect-Request (PoD)</p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mb-6 leading-relaxed">
              Are you sure you want to disconnect subscriber{' '}
              <strong className="text-foreground">{disconnectConfirm.username}</strong> on IP{' '}
              <strong className="text-foreground font-mono">{disconnectConfirm.framedipaddress}</strong> from NAS{' '}
              <strong className="text-foreground">{disconnectConfirm.nas_name || disconnectConfirm.nasipaddress}</strong>?
            </p>
            <div className="flex items-center justify-end gap-2.5">
              <button
                onClick={() => setDisconnectConfirm(null)}
                className="px-4 py-2 rounded-xl border border-border text-xs font-medium hover:bg-muted"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDisconnect(disconnectConfirm)}
                className="px-5 py-2 rounded-xl bg-rose-500 text-white text-xs font-semibold hover:bg-rose-600 shadow-md shadow-rose-500/20"
              >
                Confirm Disconnect
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
