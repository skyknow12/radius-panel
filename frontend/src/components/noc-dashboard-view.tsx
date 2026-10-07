'use client';

import React from 'react';
import {
  Activity,
  Users,
  Server,
  Network,
  Radio,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowUpRight,
  RefreshCw,
  Zap,
  Shield,
  Layers,
  ArrowDown,
  ArrowUp,
  Sliders,
  Play,
} from 'lucide-react';
import type { NocMetrics } from '@/types/api';

interface NocDashboardViewProps {
  onNavigate: (tab: string) => void;
  onViewSubscriberByUsername: (username: string) => void;
  onOpenTestModal: () => void;
}

export function NocDashboardView({
  onNavigate,
  onViewSubscriberByUsername,
  onOpenTestModal,
}: NocDashboardViewProps) {
  const [metrics, setMetrics] = React.useState<NocMetrics | null>(null);
  const [onlineSessions, setOnlineSessions] = React.useState<any[]>([]);
  const [recentAuth, setRecentAuth] = React.useState<any[]>([]);
  const [nasList, setNasList] = React.useState<any[]>([]);
  const [ipPools, setIpPools] = React.useState<any[]>([]);
  const [events, setEvents] = React.useState<any[]>([]);
  const [alerts, setAlerts] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState<boolean>(true);
  const [disconnectingUser, setDisconnectingUser] = React.useState<string | null>(null);

  const fetchNocData = async () => {
    try {
      setLoading(true);
      const token = typeof window !== 'undefined' ? localStorage.getItem('radius_token') : null;
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const [nocRes, sessRes, authRes, nasRes, poolRes, eventRes, alertRes] = await Promise.all([
        fetch('/api/noc/dashboard', { headers }),
        fetch('/api/sessions?limit=5', { headers }),
        fetch('/api/radius/auth-logs?limit=5', { headers }),
        fetch('/api/nas-devices', { headers }),
        fetch('/api/ip-pools', { headers }),
        fetch('/api/network-events?limit=5', { headers }),
        fetch('/api/alerts?status=active&limit=5', { headers }),
      ]);

      if (nocRes.ok) {
        const json = await nocRes.json();
        setMetrics(json.data);
      }
      if (sessRes.ok) {
        const json = await sessRes.json();
        setOnlineSessions(json.data?.sessions || json.data || []);
      }
      if (authRes.ok) {
        const json = await authRes.json();
        setRecentAuth(json.data?.logs || json.data || []);
      }
      if (nasRes.ok) {
        const json = await nasRes.json();
        setNasList(json.data || []);
      }
      if (poolRes.ok) {
        const json = await poolRes.json();
        setIpPools(json.data || []);
      }
      if (eventRes.ok) {
        const json = await eventRes.json();
        setEvents(json.data?.items || json.data || []);
      }
      if (alertRes.ok) {
        const json = await alertRes.json();
        setAlerts(json.data?.items || json.data || []);
      }
    } catch {} finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchNocData();
    const interval = setInterval(fetchNocData, 15000); // 15s refresh for live NOC operations
    return () => clearInterval(interval);
  }, []);

  const handleDisconnect = async (username: string, sessionId?: string, nasIp?: string, framedIp?: string) => {
    if (!confirm(`Are you sure you want to disconnect live session for ${username}?`)) return;
    try {
      setDisconnectingUser(username);
      const token = typeof window !== 'undefined' ? localStorage.getItem('radius_token') : null;
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch('/api/sessions/disconnect', {
        method: 'POST',
        headers,
        body: JSON.stringify({ username, sessionId, nasIp, framedIp }),
      });
      const json = await res.json();
      if (res.ok) {
        alert(`Disconnect result: ${json.data?.status} — ${json.data?.details}`);
        fetchNocData();
      } else {
        alert(`Disconnect failed: ${json.error?.message || json.message}`);
      }
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setDisconnectingUser(null);
    }
  };

  const handleResolveAlert = async (id: number) => {
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('radius_token') : null;
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      await fetch(`/api/alerts/${id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ status: 'resolved' }),
      });
      fetchNocData();
    } catch {}
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Refresh */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/60 pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-600/10 border border-indigo-600/20 flex items-center justify-center text-indigo-500">
              <Activity className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
                <span>ISP NOC Control Center</span>
                <span className="text-[10px] bg-emerald-500/10 text-emerald-500 font-semibold px-2 py-0.5 rounded-full border border-emerald-500/20 animate-pulse">
                  Live Telemetry
                </span>
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Centralized real-time operational monitor for subscriber sessions, FreeRADIUS daemons, BNG telemetry, and network alerts.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={fetchNocData}
            disabled={loading}
            className="p-2 rounded-xl border border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground text-xs font-medium flex items-center gap-1.5 transition-colors"
            title="Refresh NOC Data"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
          <button
            onClick={onOpenTestModal}
            className="px-3 py-2 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all"
          >
            <Play className="w-3.5 h-3.5" />
            <span>Test RADIUS Probe</span>
          </button>
        </div>
      </div>

      {/* 1. Operational Overview Cards (All Clickable) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Online Users */}
        <div
          onClick={() => onNavigate('sessions')}
          className="rounded-2xl border border-border bg-card p-4 shadow-sm hover:border-primary/50 hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between text-muted-foreground mb-1">
            <span className="text-xs font-medium group-hover:text-primary transition-colors">Online Users</span>
            <Users className="w-4 h-4 text-primary" />
          </div>
          <div className="text-2xl font-black text-foreground">
            {metrics ? metrics.onlineUsersCount.toLocaleString() : '—'}
          </div>
          <div className="text-[10px] text-muted-foreground flex items-center gap-1 mt-1">
            <span>Click to view sessions</span>
            <ArrowUpRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
          </div>
        </div>

        {/* Active Sessions */}
        <div
          onClick={() => onNavigate('sessions')}
          className="rounded-2xl border border-border bg-card p-4 shadow-sm hover:border-primary/50 hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between text-muted-foreground mb-1">
            <span className="text-xs font-medium group-hover:text-primary transition-colors">Active Sessions</span>
            <Layers className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="text-2xl font-black text-foreground">
            {metrics ? metrics.activeSessionsCount.toLocaleString() : '—'}
          </div>
          <div className="text-[10px] text-muted-foreground flex items-center gap-1 mt-1">
            <span>Accounting sessions</span>
          </div>
        </div>

        {/* Auth Requests (Today) */}
        <div
          onClick={() => onNavigate('auth_logs')}
          className="rounded-2xl border border-border bg-card p-4 shadow-sm hover:border-primary/50 hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between text-muted-foreground mb-1">
            <span className="text-xs font-medium group-hover:text-primary transition-colors">Auth Requests</span>
            <Radio className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl font-black text-foreground">
            {metrics ? metrics.todayAuthTotal.toLocaleString() : '—'}
          </div>
          <div className="text-[10px] text-emerald-500 flex items-center gap-1 mt-1">
            <span>{metrics ? metrics.todayAuthSuccess : 0} accepted</span>
          </div>
        </div>

        {/* Auth Failures */}
        <div
          onClick={() => onNavigate('auth_logs')}
          className="rounded-2xl border border-border bg-card p-4 shadow-sm hover:border-rose-500/50 hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between text-muted-foreground mb-1">
            <span className="text-xs font-medium group-hover:text-rose-500 transition-colors">Auth Failures</span>
            <XCircle className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-2xl font-black text-rose-500">
            {metrics ? metrics.todayAuthReject.toLocaleString() : '—'}
          </div>
          <div className="text-[10px] text-muted-foreground flex items-center gap-1 mt-1">
            <span>Access-Rejects today</span>
          </div>
        </div>

        {/* NAS Devices (Active / Total) */}
        <div
          onClick={() => onNavigate('nas_devices')}
          className="rounded-2xl border border-border bg-card p-4 shadow-sm hover:border-primary/50 hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between text-muted-foreground mb-1">
            <span className="text-xs font-medium group-hover:text-primary transition-colors">BNG / NAS</span>
            <Server className="w-4 h-4 text-cyan-500" />
          </div>
          <div className="text-2xl font-black text-foreground">
            {metrics ? `${metrics.activeNasCount}/${metrics.activeNasCount + metrics.offlineNasCount}` : '—'}
          </div>
          <div className="text-[10px] text-muted-foreground flex items-center gap-1 mt-1">
            <span>{metrics?.offlineNasCount || 0} offline</span>
          </div>
        </div>

        {/* Today's Traffic */}
        <div
          onClick={() => onNavigate('reports')}
          className="rounded-2xl border border-border bg-card p-4 shadow-sm hover:border-primary/50 hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between text-muted-foreground mb-1">
            <span className="text-xs font-medium group-hover:text-primary transition-colors">Today's Traffic</span>
            <Zap className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-black text-foreground">
            {metrics ? metrics.todayTrafficFormatted : '—'}
          </div>
          <div className="text-[10px] text-muted-foreground flex items-center gap-1 mt-1">
            <span>Volume transferred</span>
          </div>
        </div>
      </div>

      {/* 2. Operational Panels Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Panel 1: Online Users Live Table (Col Span 2) */}
        <div className="lg:col-span-2 rounded-2xl border border-border bg-card p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-border/80 pb-3">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" />
              <h3 className="font-bold text-sm text-foreground">Live Subscriber Sessions</h3>
            </div>
            <button
              onClick={() => onNavigate('sessions')}
              className="text-xs text-primary hover:underline flex items-center gap-1"
            >
              <span>View all ({metrics?.onlineUsersCount || 0})</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="pb-2 font-medium">Username</th>
                  <th className="pb-2 font-medium">Framed IP</th>
                  <th className="pb-2 font-medium">NAS IP</th>
                  <th className="pb-2 font-medium">Duration</th>
                  <th className="pb-2 font-medium">Traffic (DL / UL)</th>
                  <th className="pb-2 font-medium text-right">Session Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {onlineSessions.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-muted-foreground">
                      No online subscriber sessions recorded.
                    </td>
                  </tr>
                ) : (
                  onlineSessions.map((s, idx) => (
                    <tr key={idx} className="hover:bg-muted/40 transition-colors">
                      <td className="py-2.5 font-medium">
                        <button
                          onClick={() => onViewSubscriberByUsername(s.username)}
                          className="font-bold text-primary hover:underline flex items-center gap-1"
                        >
                          {s.username}
                        </button>
                      </td>
                      <td className="py-2.5 font-mono text-muted-foreground">
                        {s.framedipaddress || s.ipAddress || '—'}
                      </td>
                      <td className="py-2.5 font-mono text-muted-foreground">
                        {s.nasipaddress || s.nasIp || '—'}
                      </td>
                      <td className="py-2.5 text-muted-foreground">
                        {Math.floor((s.session_seconds || s.sessionSeconds || 0) / 60)} min
                      </td>
                      <td className="py-2.5 font-mono text-muted-foreground">
                        {(((s.acctinputoctets || s.downloadBytes || 0) / (1024 * 1024))).toFixed(1)}M /{' '}
                        {(((s.acctoutputoctets || s.uploadBytes || 0) / (1024 * 1024))).toFixed(1)}M
                      </td>
                      <td className="py-2.5 text-right">
                        <button
                          onClick={() =>
                            handleDisconnect(
                              s.username,
                              s.acctsessionid || s.id,
                              s.nasipaddress || s.nasIp,
                              s.framedipaddress || s.ipAddress
                            )
                          }
                          disabled={disconnectingUser === s.username}
                          className="px-2.5 py-1 rounded-lg bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white font-medium text-[11px] transition-colors border border-rose-500/20"
                        >
                          {disconnectingUser === s.username ? 'Disconnecting...' : 'Disconnect'}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Panel 2: RADIUS Health & Daemons */}
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-border/80 pb-3">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-primary" />
              <h3 className="font-bold text-sm text-foreground">RADIUS Daemon Health</h3>
            </div>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                metrics?.radiusHealth?.status === 'HEALTHY'
                  ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                  : metrics?.radiusHealth?.status === 'WARNING'
                  ? 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                  : 'bg-rose-500/10 text-rose-500 border-rose-500/20'
              }`}
            >
              {metrics?.radiusHealth?.status || 'UNKNOWN'}
            </span>
          </div>

          <div className="space-y-3 text-xs">
            <div className="p-3 rounded-xl bg-muted/40 border border-border flex items-center justify-between">
              <div>
                <span className="font-bold text-foreground block">FreeRADIUS Authentication</span>
                <span className="text-[11px] text-muted-foreground font-mono">UDP Port 1812 (Access-Request)</span>
              </div>
              <span className="flex items-center gap-1 text-emerald-500 font-semibold text-[11px]">
                <CheckCircle2 className="w-3.5 h-3.5" /> Active
              </span>
            </div>

            <div className="p-3 rounded-xl bg-muted/40 border border-border flex items-center justify-between">
              <div>
                <span className="font-bold text-foreground block">FreeRADIUS Accounting</span>
                <span className="text-[11px] text-muted-foreground font-mono">UDP Port 1813 (Acct-Start/Interim)</span>
              </div>
              <span className="flex items-center gap-1 text-emerald-500 font-semibold text-[11px]">
                <CheckCircle2 className="w-3.5 h-3.5" /> Active
              </span>
            </div>

            <div className="p-3 rounded-xl bg-muted/40 border border-border flex items-center justify-between">
              <div>
                <span className="font-bold text-foreground block">PostgreSQL (rlm_sql)</span>
                <span className="text-[11px] text-muted-foreground font-mono">Port 5432 (Pool latency ~{metrics?.radiusHealth?.avgLatencyMs || 12}ms)</span>
              </div>
              <span className="flex items-center gap-1 text-emerald-500 font-semibold text-[11px]">
                <CheckCircle2 className="w-3.5 h-3.5" /> Connected
              </span>
            </div>

            <div className="p-3 rounded-xl bg-muted/40 border border-border flex items-center justify-between">
              <div>
                <span className="font-bold text-foreground block">RFC 3576 Disconnect / CoA</span>
                <span className="text-[11px] text-muted-foreground font-mono">UDP Port 3799 (Vendor-Aware)</span>
              </div>
              <span className="flex items-center gap-1 text-cyan-400 font-semibold text-[11px]">
                <Zap className="w-3.5 h-3.5" /> Ready
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Lower Grid: BNG Health, IP Pools, Recent Auth, Alerts & Events */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Panel 3: NAS Status List */}
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between border-b border-border/80 pb-2.5">
            <div className="flex items-center gap-2">
              <Server className="w-4 h-4 text-cyan-500" />
              <h4 className="font-bold text-xs text-foreground">BNG / NAS Status</h4>
            </div>
            <button onClick={() => onNavigate('nas_devices')} className="text-[11px] text-primary hover:underline">
              Manage
            </button>
          </div>

          <div className="space-y-2 text-xs">
            {nasList.length === 0 ? (
              <div className="py-4 text-center text-muted-foreground text-[11px]">No NAS devices configured.</div>
            ) : (
              nasList.slice(0, 4).map((nas) => (
                <div key={nas.id} className="p-2.5 rounded-xl border border-border/80 bg-muted/30 flex items-center justify-between">
                  <div>
                    <span className="font-bold text-foreground block text-xs">{nas.name}</span>
                    <span className="font-mono text-[10px] text-muted-foreground">{nas.ip_address} ({nas.nas_type})</span>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${
                      nas.status === 'online'
                        ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                        : 'bg-muted text-muted-foreground border-border'
                    }`}
                  >
                    {nas.status}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Panel 4: IP Pool Utilization */}
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between border-b border-border/80 pb-2.5">
            <div className="flex items-center gap-2">
              <Network className="w-4 h-4 text-blue-500" />
              <h4 className="font-bold text-xs text-foreground">IP Pool Capacity</h4>
            </div>
            <button onClick={() => onNavigate('ip_pools')} className="text-[11px] text-primary hover:underline">
              Pools
            </button>
          </div>

          <div className="space-y-3 text-xs">
            {ipPools.length === 0 ? (
              <div className="py-4 text-center text-muted-foreground text-[11px]">No IP Pools configured.</div>
            ) : (
              ipPools.slice(0, 3).map((p) => {
                const pct = p.total_ips > 0 ? Math.round((p.used_ips / p.total_ips) * 100) : 0;
                return (
                  <div key={p.id} className="space-y-1.5">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-bold text-foreground">{p.name}</span>
                      <span className="font-mono text-muted-foreground">
                        {p.used_ips} / {p.total_ips} ({pct}%)
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          pct > 90 ? 'bg-rose-500' : pct > 75 ? 'bg-amber-500' : 'bg-primary'
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Panel 5: Recent Authentication Activity */}
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between border-b border-border/80 pb-2.5">
            <div className="flex items-center gap-2">
              <Radio className="w-4 h-4 text-primary" />
              <h4 className="font-bold text-xs text-foreground">Recent Authentications</h4>
            </div>
            <button onClick={() => onNavigate('auth_logs')} className="text-[11px] text-primary hover:underline">
              Logs
            </button>
          </div>

          <div className="space-y-2 text-xs">
            {recentAuth.length === 0 ? (
              <div className="py-4 text-center text-muted-foreground text-[11px]">No recent logins.</div>
            ) : (
              recentAuth.slice(0, 4).map((l, i) => (
                <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-muted/30 border border-border/60">
                  <div className="overflow-hidden">
                    <button
                      onClick={() => onViewSubscriberByUsername(l.username)}
                      className="font-bold text-primary hover:underline truncate block max-w-[120px] text-xs"
                    >
                      {l.username}
                    </button>
                    <span className="text-[10px] text-muted-foreground font-mono">{l.nas_ip || l.nas_name || '127.0.0.1'}</span>
                  </div>
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] font-semibold border ${
                      l.reply === 'Access-Accept'
                        ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                        : 'bg-rose-500/10 text-rose-500 border-rose-500/20'
                    }`}
                  >
                    {l.reply === 'Access-Accept' ? 'Accept' : 'Reject'}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Panel 6: Active Alerts */}
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between border-b border-border/80 pb-2.5">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              <h4 className="font-bold text-xs text-foreground">Active Alerts</h4>
            </div>
            <button onClick={() => onNavigate('alerts')} className="text-[11px] text-primary hover:underline">
              All Alerts
            </button>
          </div>

          <div className="space-y-2 text-xs">
            {alerts.length === 0 ? (
              <div className="py-4 text-center text-emerald-500 text-[11px] flex items-center justify-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> No active alerts
              </div>
            ) : (
              alerts.slice(0, 3).map((a) => (
                <div key={a.id} className="p-2 rounded-xl bg-amber-500/5 border border-amber-500/20 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-foreground text-[11px]">{a.title}</span>
                    <button
                      onClick={() => handleResolveAlert(a.id)}
                      className="text-[10px] text-emerald-500 hover:underline"
                    >
                      Resolve
                    </button>
                  </div>
                  <p className="text-[10px] text-muted-foreground line-clamp-1">{a.description}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
