'use client';

import React from 'react';
import {
  Wifi,
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
  Filter,
  User,
  Package,
  Building2,
  Store,
  Layers,
  ArrowUp,
  ArrowDown,
  X,
  RotateCcw,
} from 'lucide-react';
import type { SessionItem } from '@/types/api';

interface OnlineCustomersViewProps {
  filterNasIp?: string | null;
  onClearNasFilter?: () => void;
  onViewSubscriber: (username: string) => void;
}

export function OnlineCustomersView({
  filterNasIp,
  onClearNasFilter,
  onViewSubscriber,
}: OnlineCustomersViewProps) {
  const [sessions, setSessions] = React.useState<SessionItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [search, setSearch] = React.useState('');
  const [nasFilter, setNasFilter] = React.useState<string>(filterNasIp || 'all');
  const [packageFilter, setPackageFilter] = React.useState<string>('all');
  const [branchFilter, setBranchFilter] = React.useState<string>('all');
  const [resellerFilter, setResellerFilter] = React.useState<string>('all');
  const [autoRefreshInterval, setAutoRefreshInterval] = React.useState<number>(15); // 15s default for NOC/Online
  const [meta, setMeta] = React.useState({ page: 1, limit: 25, total: 0, totalPages: 1 });
  const [disconnectingId, setDisconnectingId] = React.useState<string | null>(null);
  const [disconnectConfirm, setDisconnectConfirm] = React.useState<SessionItem | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);

  // Dropdown options
  const [nasOptions, setNasOptions] = React.useState<{ id: number; name: string; ip_address: string }[]>([]);
  const [packageOptions, setPackageOptions] = React.useState<{ id: number; name: string }[]>([]);
  const [branchOptions, setBranchOptions] = React.useState<{ id: number; name: string }[]>([]);
  const [resellerOptions, setResellerOptions] = React.useState<{ id: number; name: string }[]>([]);

  React.useEffect(() => {
    // Fetch filter options
    Promise.all([
      fetch('/api/nas').then((r) => r.json()).catch(() => ({ data: [] })),
      fetch('/api/packages').then((r) => r.json()).catch(() => ({ data: [] })),
      fetch('/api/branches').then((r) => r.json()).catch(() => ({ data: [] })),
      fetch('/api/resellers').then((r) => r.json()).catch(() => ({ data: [] })),
    ]).then(([nasRes, pkgRes, brRes, resRes]) => {
      if (nasRes.data) setNasOptions(nasRes.data);
      if (pkgRes.data) setPackageOptions(pkgRes.data);
      if (brRes.data) setBranchOptions(brRes.data);
      if (resRes.data) setResellerOptions(resRes.data);
    });
  }, []);

  const fetchSessions = async (page = meta.page) => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', String(meta.limit));
      if (search.trim()) params.set('search', search.trim());
      if (nasFilter !== 'all') params.set('nas_ip', nasFilter);
      if (packageFilter !== 'all') params.set('package_id', packageFilter);
      if (branchFilter !== 'all') params.set('branch', branchFilter);
      if (resellerFilter !== 'all') params.set('reseller_id', resellerFilter);

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
  }, [search, nasFilter, packageFilter, branchFilter, resellerFilter]);

  // Auto-refresh timer
  React.useEffect(() => {
    if (autoRefreshInterval <= 0) return;
    const interval = setInterval(() => {
      fetchSessions();
    }, autoRefreshInterval * 1000);
    return () => clearInterval(interval);
  }, [autoRefreshInterval, search, nasFilter, packageFilter, branchFilter, resellerFilter, meta.page]);

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
      setNotice(json.data?.message || `Session for ${session.username} terminated via CoA disconnect`);
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
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
  };

  const formatDuration = (seconds: number) => {
    if (!seconds || seconds <= 0) return '0s';
    const days = Math.floor(seconds / 86400);
    const hrs = Math.floor((seconds % 86400) / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (days > 0) return `${days}d ${hrs}h ${mins}m`;
    if (hrs > 0) return `${hrs}h ${mins}m ${secs}s`;
    return `${mins}m ${secs}s`;
  };

  const calculateRate = (octets: number, seconds: number) => {
    if (!octets || !seconds || seconds <= 0) return '0 Kbps';
    const bps = (octets * 8) / seconds;
    if (bps >= 1_000_000) return `${(bps / 1_000_000).toFixed(1)} Mbps`;
    return `${(bps / 1000).toFixed(0)} Kbps`;
  };

  return (
    <div className="space-y-5">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/60 pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500 shadow-sm">
              <Wifi className="w-4 h-4 animate-pulse" />
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
                <span>Online Customers Operational Monitor</span>
                <span className="text-[10px] bg-emerald-500/10 text-emerald-500 font-semibold px-2 py-0.5 rounded-full border border-emerald-500/20">
                  Live Accounting
                </span>
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Real-time active RADIUS subscriber sessions with dynamic bandwidth, framing IP, and CoA disconnect management.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Refresh interval selector */}
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-card border border-border px-2.5 py-1.5 rounded-xl">
            <Clock className="w-3.5 h-3.5 text-primary" />
            <span className="hidden sm:inline">Refresh:</span>
            <select
              value={autoRefreshInterval}
              onChange={(e) => setAutoRefreshInterval(Number(e.target.value))}
              className="bg-transparent text-foreground font-semibold focus:outline-none"
            >
              <option value={10}>10s</option>
              <option value={15}>15s</option>
              <option value={30}>30s</option>
              <option value={60}>60s</option>
              <option value={0}>Off</option>
            </select>
          </div>

          <button
            onClick={() => fetchSessions()}
            disabled={loading}
            className="px-3 py-2 rounded-xl border border-border bg-card hover:bg-muted text-foreground text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Notice Banner */}
      {notice && (
        <div className="p-3 rounded-xl bg-primary/10 border border-primary/20 text-primary text-xs flex items-center justify-between animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            <span>{notice}</span>
          </div>
          <button onClick={() => setNotice(null)} className="opacity-70 hover:opacity-100 font-semibold">
            ✕
          </button>
        </div>
      )}

      {/* Filter and Search Toolbar */}
      <div className="p-4 rounded-2xl border border-border bg-card/70 backdrop-blur-md shadow-sm space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative flex-1 min-w-[260px] max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by username, customer name, Framed IP or session ID..."
            className="w-full bg-muted/50 border border-border rounded-xl pl-9 pr-4 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-3 text-xs">
          {filterNasIp && (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-primary/10 border border-primary/20 text-primary font-medium">
              <Server className="w-3.5 h-3.5" />
              <span>Gateway: {filterNasIp}</span>
              {onClearNasFilter && (
                <button
                  onClick={onClearNasFilter}
                  className="hover:bg-primary/20 rounded p-0.5 ml-1"
                  title="Clear filter"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          )}

          <div className="text-muted-foreground font-medium">
            Active Online Sessions: <span className="text-foreground font-bold font-mono">{meta.total}</span>
          </div>
        </div>
      </div>

      {/* Dropdown Filters Bar */}
      <div className="flex flex-wrap items-center gap-2.5 pt-1">
        {/* NAS Gateway Dropdown */}
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] text-muted-foreground font-medium flex items-center gap-1">
            <Server className="w-3.5 h-3.5 text-primary" /> Gateway:
          </span>
          <select
            value={nasFilter}
            onChange={(e) => setNasFilter(e.target.value)}
            className="bg-card border border-border rounded-xl px-2.5 py-1 text-xs text-foreground font-medium focus:outline-none focus:border-primary"
          >
            <option value="all">All Gateways</option>
            {nasOptions.map((nas) => (
              <option key={nas.id} value={nas.ip_address}>
                {nas.name || nas.ip_address}
              </option>
            ))}
          </select>
        </div>

        {/* Package Dropdown */}
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] text-muted-foreground font-medium flex items-center gap-1">
            <Package className="w-3.5 h-3.5 text-primary" /> Plan:
          </span>
          <select
            value={packageFilter}
            onChange={(e) => setPackageFilter(e.target.value)}
            className="bg-card border border-border rounded-xl px-2.5 py-1 text-xs text-foreground font-medium focus:outline-none focus:border-primary"
          >
            <option value="all">All Packages</option>
            {packageOptions.map((pkg) => (
              <option key={pkg.id} value={String(pkg.id)}>
                {pkg.name}
              </option>
            ))}
          </select>
        </div>

        {/* Branch Dropdown */}
        {branchOptions.length > 0 && (
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-muted-foreground font-medium flex items-center gap-1">
              <Building2 className="w-3.5 h-3.5 text-primary" /> Branch:
            </span>
            <select
              value={branchFilter}
              onChange={(e) => setBranchFilter(e.target.value)}
              className="bg-card border border-border rounded-xl px-2.5 py-1 text-xs text-foreground font-medium focus:outline-none focus:border-primary"
            >
              <option value="all">All Branches</option>
              {branchOptions.map((b) => (
                <option key={b.id} value={b.name}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Reseller Dropdown */}
        {resellerOptions.length > 0 && (
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-muted-foreground font-medium flex items-center gap-1">
              <Store className="w-3.5 h-3.5 text-primary" /> Reseller:
            </span>
            <select
              value={resellerFilter}
              onChange={(e) => setResellerFilter(e.target.value)}
              className="bg-card border border-border rounded-xl px-2.5 py-1 text-xs text-foreground font-medium focus:outline-none focus:border-primary"
            >
              <option value="all">All Resellers</option>
              {resellerOptions.map((r) => (
                <option key={r.id} value={String(r.id)}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Reset Filters Button */}
        {(search ||
          nasFilter !== 'all' ||
          packageFilter !== 'all' ||
          branchFilter !== 'all' ||
          resellerFilter !== 'all') && (
          <button
            onClick={() => {
              setSearch('');
              setNasFilter('all');
              setPackageFilter('all');
              setBranchFilter('all');
              setResellerFilter('all');
              onClearNasFilter?.();
            }}
            className="flex items-center gap-1 px-2.5 py-1 rounded-xl border border-border hover:bg-muted text-xs text-rose-500 font-medium transition-colors ml-auto"
            title="Reset all filters"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset</span>
          </button>
        )}
      </div>
    </div>

      {/* Sessions Operational Table */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-muted-foreground font-semibold">
                <th className="py-3 px-3.5">Customer / Username</th>
                <th className="py-3 px-3.5">Package</th>
                <th className="py-3 px-3.5">NAS / BNG Gateway</th>
                <th className="py-3 px-3.5">Session ID</th>
                <th className="py-3 px-3.5">Framed IP</th>
                <th className="py-3 px-3.5">IPv6 Prefix</th>
                <th className="py-3 px-3.5">Login Time</th>
                <th className="py-3 px-3.5">Duration</th>
                <th className="py-3 px-3.5">Traffic (Down / Up)</th>
                <th className="py-3 px-3.5">Traffic Rate</th>
                <th className="py-3 px-3.5">Branch / Reseller</th>
                <th className="py-3 px-3.5 text-right">Disconnect</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {loading && sessions.length === 0 ? (
                <tr>
                  <td colSpan={12} className="py-12 text-center text-muted-foreground">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-primary" />
                    <span>Polling live RADIUS accounting sessions...</span>
                  </td>
                </tr>
              ) : sessions.length === 0 ? (
                <tr>
                  <td colSpan={12} className="py-12 text-center text-muted-foreground">
                    No active online subscriber sessions found.
                  </td>
                </tr>
              ) : (
                sessions.map((s) => (
                  <tr key={s.radacctid} className="hover:bg-muted/40 transition-colors group">
                    {/* Username & Customer Name */}
                    <td className="py-3 px-3.5">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse flex-shrink-0" />
                        <div>
                          <button
                            onClick={() => onViewSubscriber(s.username)}
                            className="font-bold text-primary hover:underline text-left block"
                            title="Click to view full customer profile"
                          >
                            {s.username}
                          </button>
                          <span className="text-[11px] text-muted-foreground block truncate max-w-[130px]">
                            {s.customer_name || 'Subscriber'}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Package */}
                    <td className="py-3 px-3.5">
                      <span className="px-2 py-0.5 rounded-md bg-muted text-foreground font-medium text-[11px] border border-border whitespace-nowrap">
                        {s.package_name || 'Assigned Plan'}
                      </span>
                    </td>

                    {/* NAS Gateway */}
                    <td className="py-3 px-3.5">
                      <div className="font-medium text-foreground whitespace-nowrap">
                        {s.nas_name || s.nasipaddress}
                      </div>
                      <div className="text-[10px] font-mono text-muted-foreground">
                        {s.nasipaddress}
                      </div>
                    </td>

                    {/* Session ID */}
                    <td className="py-3 px-3.5 font-mono text-muted-foreground text-[10px] max-w-[120px] truncate" title={s.acctsessionid}>
                      {s.acctsessionid}
                    </td>

                    {/* Framed IP */}
                    <td className="py-3 px-3.5 font-mono font-medium text-emerald-500 whitespace-nowrap">
                      {s.framedipaddress || '—'}
                    </td>

                    {/* IPv6 */}
                    <td className="py-3 px-3.5 font-mono text-[10px] text-muted-foreground whitespace-nowrap">
                      {s.ipv6_prefix || '—'}
                    </td>

                    {/* Login Time */}
                    <td className="py-3 px-3.5 text-muted-foreground whitespace-nowrap font-mono text-[11px]">
                      {s.acctstarttime ? new Date(s.acctstarttime).toLocaleTimeString() : '—'}
                    </td>

                    {/* Duration */}
                    <td className="py-3 px-3.5 font-mono text-foreground font-medium whitespace-nowrap">
                      {formatDuration(s.session_seconds)}
                    </td>

                    {/* Download / Upload */}
                    <td className="py-3 px-3.5 whitespace-nowrap font-mono">
                      <div className="text-emerald-500 flex items-center gap-1">
                        <ArrowDown className="w-3 h-3" />
                        <span>{formatBytes(s.acctoutputoctets)}</span>
                      </div>
                      <div className="text-indigo-400 flex items-center gap-1 text-[10px]">
                        <ArrowUp className="w-3 h-3" />
                        <span>{formatBytes(s.acctinputoctets)}</span>
                      </div>
                    </td>

                    {/* Current Traffic Rate */}
                    <td className="py-3 px-3.5 whitespace-nowrap font-mono text-[11px] font-semibold text-foreground">
                      {calculateRate(s.acctoutputoctets + s.acctinputoctets, s.session_seconds)}
                    </td>

                    {/* Branch / Reseller */}
                    <td className="py-3 px-3.5 text-[11px]">
                      <div className="text-foreground font-medium truncate max-w-[100px]">
                        {s.branch || 'Main Branch'}
                      </div>
                      <div className="text-[10px] text-muted-foreground truncate max-w-[100px]">
                        {s.reseller_name || 'Direct'}
                      </div>
                    </td>

                    {/* Action Disconnect */}
                    <td className="py-3 px-3.5 text-right">
                      <button
                        onClick={() => setDisconnectConfirm(s)}
                        disabled={disconnectingId === s.radacctid}
                        className="px-2.5 py-1.5 rounded-lg border border-rose-500/30 text-rose-500 hover:bg-rose-500/10 font-semibold text-[11px] transition-colors disabled:opacity-50"
                        title="Disconnect session via FreeRADIUS CoA"
                      >
                        <PowerOff className="w-3.5 h-3.5 inline mr-1" />
                        Disconnect
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        {meta.totalPages > 1 && (
          <div className="p-3 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
            <span>
              Showing Page {meta.page} of {meta.totalPages} ({meta.total} active sessions)
            </span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => fetchSessions(meta.page - 1)}
                disabled={meta.page <= 1}
                className="p-1 rounded-lg border border-border hover:bg-muted disabled:opacity-40"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => fetchSessions(meta.page + 1)}
                disabled={meta.page >= meta.totalPages}
                className="p-1 rounded-lg border border-border hover:bg-muted disabled:opacity-40"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Disconnect Confirmation Modal */}
      {disconnectConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-card border border-border rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-500">
              <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20">
                <PowerOff className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-foreground">Terminate Live Session</h3>
                <p className="text-xs text-muted-foreground">FreeRADIUS CoA Disconnect-Request</p>
              </div>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed">
              Are you sure you want to forcibly terminate the connection for subscriber{' '}
              <strong className="text-foreground">{disconnectConfirm.username}</strong> on gateway{' '}
              <strong className="text-foreground">{disconnectConfirm.nas_name || disconnectConfirm.nasipaddress}</strong>?
              This will send a RFC 3576 Disconnect-Request packet to the NAS.
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                onClick={() => setDisconnectConfirm(null)}
                className="px-3.5 py-2 rounded-xl border border-border hover:bg-muted text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDisconnect(disconnectConfirm)}
                disabled={disconnectingId === disconnectConfirm.radacctid}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-all shadow-md shadow-rose-600/20"
              >
                {disconnectingId === disconnectConfirm.radacctid ? 'Disconnecting...' : 'Confirm Disconnect'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
