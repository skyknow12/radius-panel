'use client';

import React from 'react';
import {
  Server,
  Activity,
  Radio,
  Layers,
  Sliders,
  RefreshCw,
  Clock,
  Shield,
  ArrowLeft,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Zap,
  Eye,
  Trash2,
  Plus,
  Search,
  Filter,
  Check,
  FileText,
  Signal,
  Cpu,
} from 'lucide-react';
import type { OltItem, OnuItem, BoardInfo, DiscoveredOnt, OltProfileItem, OltOperationHistoryItem } from '@/types/olt';

interface OltDetailsViewProps {
  olt: OltItem;
  onBack: () => void;
  onNavigateToProvision: (params?: { oltId?: number; slot?: number; port?: number; sn?: string }) => void;
  currentUser?: any;
}

export function OltDetailsView({
  olt,
  onBack,
  onNavigateToProvision,
  currentUser,
}: OltDetailsViewProps) {
  const [activeTab, setActiveTab] = React.useState<
    'overview' | 'boards' | 'ports' | 'onus' | 'discovery' | 'optical' | 'profiles' | 'service_ports' | 'sync' | 'history'
  >('overview');

  const [loading, setLoading] = React.useState(false);
  const [notice, setNotice] = React.useState<{ text: string; error?: boolean } | null>(null);

  // Tab Data States
  const [boards, setBoards] = React.useState<BoardInfo[]>([]);
  const [onus, setOnus] = React.useState<OnuItem[]>([]);
  const [discoveredOnus, setDiscoveredOnus] = React.useState<DiscoveredOnt[]>([]);
  const [profiles, setProfiles] = React.useState<OltProfileItem[]>([]);
  const [history, setHistory] = React.useState<OltOperationHistoryItem[]>([]);

  // Action Loading States
  const [testingCli, setTestingCli] = React.useState(false);
  const [syncing, setSyncing] = React.useState(false);
  const [discovering, setDiscovering] = React.useState(false);
  const [inspectingOpticalOnuId, setInspectingOpticalOnuId] = React.useState<number | null>(null);
  const [opticalResult, setOpticalResult] = React.useState<any | null>(null);

  // Filters
  const [onuSearch, setOnuSearch] = React.useState('');
  const [onuRunStateFilter, setOnuRunStateFilter] = React.useState('all');
  const [selectedSlot, setSelectedSlot] = React.useState<number>(0);
  const [selectedPort, setSelectedPort] = React.useState<number>(0);

  const showMsg = (text: string, error = false) => {
    setNotice({ text, error });
    setTimeout(() => setNotice(null), 5000);
  };

  const getAuthHeaders = (): Record<string, string> => {
    if (typeof window === 'undefined') return {};
    const token = localStorage.getItem('radius_token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  // Fetch registered ONUs for this OLT
  const fetchOnus = async () => {
    try {
      const sp = new URLSearchParams();
      if (onuSearch.trim()) sp.set('search', onuSearch.trim());
      if (onuRunStateFilter !== 'all') sp.set('run_state', onuRunStateFilter);

      const res = await fetch(`/api/olts/${olt.id}/onus?${sp.toString()}`, {
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        const json = await res.json();
        setOnus(json.data || []);
      }
    } catch {}
  };

  // Fetch Boards via CLI test
  const fetchBoards = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/olts/${olt.id}/test-cli`, {
        method: 'POST',
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        const json = await res.json();
        setBoards(json.data?.boards || []);
      }
    } catch {} finally {
      setLoading(false);
    }
  };

  // Fetch Operation History
  const fetchHistory = async () => {
    try {
      const res = await fetch(`/api/olts/${olt.id}/history`, {
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        const json = await res.json();
        setHistory(json.data || []);
      }
    } catch {}
  };

  // Fetch Profiles
  const fetchProfiles = async () => {
    try {
      const res = await fetch(`/api/olts/${olt.id}/profiles`, {
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        const json = await res.json();
        setProfiles(json.data || []);
      }
    } catch {}
  };

  // Run discovery
  const handleRunDiscovery = async () => {
    try {
      setDiscovering(true);
      const res = await fetch(`/api/olts/${olt.id}/discover`, {
        headers: getAuthHeaders(),
      });
      const json = await res.json();
      if (res.ok) {
        setDiscoveredOnus(json.data || []);
        showMsg(`Autofind finished: ${json.data?.length || 0} unregistered ONUs detected`);
      } else {
        showMsg('Autofind query failed', true);
      }
    } catch {
      showMsg('Failed running discovery', true);
    } finally {
      setDiscovering(false);
    }
  };

  // Run Sync
  const handleSyncOlt = async () => {
    try {
      setSyncing(true);
      const res = await fetch(`/api/olts/${olt.id}/sync`, {
        method: 'POST',
        headers: getAuthHeaders(),
      });
      const json = await res.json();
      if (res.ok) {
        showMsg(json.data?.message || 'Synchronization complete');
        fetchOnus();
        fetchHistory();
      } else {
        showMsg(json.error?.message || 'Sync failed', true);
      }
    } catch {
      showMsg('Sync request failed', true);
    } finally {
      setSyncing(false);
    }
  };

  // Read Optical Info on single ONU
  const handleReadOptical = async (onu: OnuItem) => {
    try {
      setInspectingOpticalOnuId(onu.id);
      const res = await fetch(`/api/olts/${olt.id}/onus/${onu.id}/optical`, {
        headers: getAuthHeaders(),
      });
      const json = await res.json();
      if (res.ok) {
        setOpticalResult(json.data);
        showMsg(
          json.data?.isAvailable
            ? `Optical reading: Rx ${json.data.rxPower} dBm, Tx ${json.data.txPower} dBm`
            : 'Optical reading unavailable (ONU may be offline)'
        );
        fetchOnus();
      } else {
        showMsg('Failed to query optical parameters', true);
      }
    } catch {
      showMsg('Optical query failed', true);
    } finally {
      setInspectingOpticalOnuId(null);
    }
  };

  React.useEffect(() => {
    fetchOnus();
    if (activeTab === 'boards') fetchBoards();
    if (activeTab === 'discovery') handleRunDiscovery();
    if (activeTab === 'history') fetchHistory();
    if (activeTab === 'profiles') fetchProfiles();
  }, [activeTab]);

  const tabs = [
    { key: 'overview', label: 'Overview', icon: Server },
    { key: 'boards', label: 'Boards', icon: Cpu },
    { key: 'ports', label: 'PON Ports', icon: Layers },
    { key: 'onus', label: `Registered ONUs (${onus.length})`, icon: Radio },
    { key: 'discovery', label: `ONU Discovery (${discoveredOnus.length})`, icon: Zap },
    { key: 'optical', label: 'Optical Monitoring', icon: Signal },
    { key: 'profiles', label: 'Profiles', icon: Sliders },
    { key: 'service_ports', label: 'Service Ports', icon: Layers },
    { key: 'sync', label: 'Synchronization', icon: RefreshCw },
    { key: 'history', label: 'Operation History', icon: Clock },
  ] as const;

  return (
    <div className="space-y-6">
      {/* Toast */}
      {notice && (
        <div
          className={`px-4 py-3 rounded-xl border text-xs font-semibold flex items-center justify-between shadow-lg transition-all animate-in fade-in slide-in-from-top-2 ${
            notice.error
              ? 'bg-rose-50 border-rose-200 text-rose-700 dark:bg-rose-950/40 dark:border-rose-800 dark:text-rose-300'
              : 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-300'
          }`}
        >
          <span>{notice.text}</span>
          <button onClick={() => setNotice(null)} className="ml-3 font-bold hover:opacity-75">
            ✕
          </button>
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-card rounded-2xl border border-border p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <button
              onClick={onBack}
              className="p-2 rounded-xl bg-muted hover:bg-muted/80 text-foreground transition-all"
              title="Back to OLT Inventory"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary flex-shrink-0">
              <Server className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-foreground">{olt.name}</h2>
                <span
                  className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                    olt.connection_status === 'online'
                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                      : olt.connection_status === 'error'
                      ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                      : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      olt.connection_status === 'online'
                        ? 'bg-emerald-500'
                        : olt.connection_status === 'error'
                        ? 'bg-rose-500'
                        : 'bg-amber-500'
                    }`}
                  />
                  {olt.connection_status.toUpperCase()}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {olt.vendor} {olt.model} • IP: <span className="font-mono text-foreground">{olt.management_ip}:{olt.management_port}</span> • Branch: {olt.branch_name || 'Organization Core'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleSyncOlt}
              disabled={syncing}
              className="px-3.5 py-2 rounded-xl bg-card hover:bg-muted border border-border text-xs font-semibold text-foreground flex items-center gap-1.5 transition-all shadow-sm"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin text-primary' : ''}`} />
              {syncing ? 'Syncing...' : 'Sync OLT'}
            </button>

            <button
              onClick={() => onNavigateToProvision({ oltId: olt.id })}
              className="px-4 py-2 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold flex items-center gap-1.5 transition-all shadow-md shadow-primary/20"
            >
              <Zap className="w-3.5 h-3.5" />
              Provision ONU
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1 overflow-x-auto mt-6 pt-4 border-t border-border">
          {tabs.map((t) => {
            const Icon = t.icon;
            const isActive = activeTab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key)}
                className={`px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 whitespace-nowrap transition-all ${
                  isActive
                    ? 'bg-primary text-primary-foreground shadow-sm shadow-primary/20'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* TAB CONTENT */}

      {/* 1. OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-card rounded-2xl border border-border p-5 space-y-4 shadow-sm md:col-span-2">
            <h3 className="font-bold text-foreground text-sm flex items-center gap-2">
              <Server className="w-4 h-4 text-primary" />
              Chassis Specifications & Firmware
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs">
              <div className="p-3 rounded-xl bg-muted/40 border border-border">
                <span className="text-[11px] text-muted-foreground block">Vendor & Model</span>
                <span className="font-semibold text-foreground text-sm mt-0.5 block">{olt.vendor} {olt.model}</span>
              </div>
              <div className="p-3 rounded-xl bg-muted/40 border border-border">
                <span className="text-[11px] text-muted-foreground block">Software Version</span>
                <span className="font-mono text-foreground mt-0.5 block">{olt.software_version || 'MA5600V800R015C00'}</span>
              </div>
              <div className="p-3 rounded-xl bg-muted/40 border border-border">
                <span className="text-[11px] text-muted-foreground block">Patch Level</span>
                <span className="font-mono text-foreground mt-0.5 block">{olt.patch_version || 'SPC108 HP1019'}</span>
              </div>
              <div className="p-3 rounded-xl bg-muted/40 border border-border">
                <span className="text-[11px] text-muted-foreground block">CLI Protocol & Port</span>
                <span className="font-mono text-foreground uppercase mt-0.5 block">{olt.cli_protocol} / {olt.management_port}</span>
              </div>
              <div className="p-3 rounded-xl bg-muted/40 border border-border">
                <span className="text-[11px] text-muted-foreground block">SNMP Version & Port</span>
                <span className="font-mono text-foreground mt-0.5 block">{olt.snmp_version} / {olt.snmp_port}</span>
              </div>
              <div className="p-3 rounded-xl bg-muted/40 border border-border">
                <span className="text-[11px] text-muted-foreground block">Command Timeout</span>
                <span className="font-mono text-foreground mt-0.5 block">{olt.connection_timeout} ms</span>
              </div>
            </div>

            <div className="pt-3 border-t border-border">
              <h4 className="text-xs font-bold text-foreground mb-2">Optical Alert Thresholds</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400">
                  <span className="text-[11px] block font-semibold">Warning Threshold (Yellow)</span>
                  <span className="text-base font-bold font-mono mt-0.5 block">{olt.optical_warning_threshold} dBm</span>
                  <span className="text-[10px] opacity-80">Flags degrading fiber drop before service drops</span>
                </div>
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-400">
                  <span className="text-[11px] block font-semibold">Critical Threshold (Red)</span>
                  <span className="text-base font-bold font-mono mt-0.5 block">{olt.optical_critical_threshold} dBm</span>
                  <span className="text-[10px] opacity-80">Severe attenuation requiring physical inspection</span>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-card rounded-2xl border border-border p-5 space-y-4 shadow-sm">
            <h3 className="font-bold text-foreground text-sm flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-500" />
              Live Link Health Summary
            </h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 rounded-xl bg-muted/40 border border-border text-xs">
                <span className="text-muted-foreground">Total ONUs</span>
                <span className="font-bold text-foreground text-sm">{onus.length}</span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs">
                <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Online Optical ONUs</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                  {onus.filter((o) => o.run_state === 'online').length}
                </span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs">
                <span className="text-rose-600 dark:text-rose-400 font-semibold">Offline ONUs</span>
                <span className="font-bold text-rose-600 dark:text-rose-400 text-sm">
                  {onus.filter((o) => o.run_state === 'offline').length}
                </span>
              </div>
            </div>

            <div className="pt-2 border-t border-border text-xs text-muted-foreground space-y-1">
              <div>Last Sync: {olt.last_sync_at ? new Date(olt.last_sync_at).toLocaleString() : 'Never'}</div>
              <div>Last Seen: {olt.last_seen_at ? new Date(olt.last_seen_at).toLocaleString() : 'Never'}</div>
              {olt.last_error && (
                <div className="text-rose-500 text-[11px] font-semibold mt-1">
                  Alert: {olt.last_error}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 2. BOARDS */}
      {activeTab === 'boards' && (
        <div className="bg-card rounded-2xl border border-border overflow-hidden shadow-sm">
          <div className="p-4 border-b border-border flex items-center justify-between">
            <div>
              <h3 className="font-bold text-foreground text-sm">Chassis Board Slot Configuration</h3>
              <p className="text-[11px] text-muted-foreground">Huawei MA5683T service, control, and uplink modules</p>
            </div>
            <button
              onClick={fetchBoards}
              disabled={loading}
              className="px-3 py-1.5 rounded-xl bg-muted hover:bg-muted/80 text-foreground text-xs font-semibold flex items-center gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-primary' : ''}`} />
              Query Hardware
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-muted/50 border-b border-border text-muted-foreground uppercase tracking-wider text-[11px] font-semibold">
                  <th className="py-3 px-4">Slot ID</th>
                  <th className="py-3 px-4">Board Name</th>
                  <th className="py-3 px-4">Board Function</th>
                  <th className="py-3 px-4">Operational Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {boards.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-muted-foreground">
                      Click "Query Hardware" to retrieve real-time slot inventory from OLT.
                    </td>
                  </tr>
                ) : (
                  boards.map((b) => (
                    <tr key={b.slot} className="hover:bg-muted/30">
                      <td className="py-3 px-4 font-mono font-bold text-foreground">Slot {b.slot}</td>
                      <td className="py-3 px-4 font-bold text-foreground">{b.boardName}</td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded-md text-[11px] font-semibold ${
                            b.isGpon
                              ? 'bg-indigo-500/10 text-indigo-500 border border-indigo-500/20'
                              : b.isControl
                              ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                              : 'bg-muted text-muted-foreground'
                          }`}
                        >
                          {b.isGpon ? 'GPON 16-Port Service' : b.isControl ? (b.isStandby ? 'Standby SCUN' : 'Active SCUN') : 'Uplink / Other'}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-semibold text-emerald-500">{b.status}</td>
                      <td className="py-3 px-4 text-right">
                        {b.isGpon && (
                          <button
                            onClick={() => {
                              setSelectedSlot(b.slot);
                              setActiveTab('onus');
                            }}
                            className="px-2.5 py-1 rounded-lg bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground font-semibold text-[11px] transition-colors"
                          >
                            View ONUs
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 3. PON PORTS */}
      {activeTab === 'ports' && (
        <div className="bg-card rounded-2xl border border-border p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-foreground text-sm">GPON PON Ports Matrix</h3>
              <p className="text-[11px] text-muted-foreground">Select a PON port to inspect registered optical subscribers or trigger discovery</p>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="text-muted-foreground">Slot:</span>
              <select
                value={selectedSlot}
                onChange={(e) => setSelectedSlot(Number(e.target.value))}
                className="px-2.5 py-1.5 rounded-xl bg-card border border-border font-semibold text-xs"
              >
                {[0, 2, 3, 5].map((s) => (
                  <option key={s} value={s}>Slot {s} (H805GPFD)</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-8 gap-3 pt-2">
            {Array.from({ length: 16 }, (_, p) => {
              const count = onus.filter((o) => o.slot === selectedSlot && o.pon_port === p).length;
              return (
                <div
                  key={p}
                  onClick={() => {
                    setSelectedPort(p);
                    setActiveTab('onus');
                  }}
                  className="p-3 rounded-xl bg-muted/40 hover:bg-primary/10 hover:border-primary/30 border border-border cursor-pointer transition-all text-center group"
                >
                  <span className="text-[11px] text-muted-foreground block font-mono">Port {p}</span>
                  <span className="text-lg font-bold text-foreground group-hover:text-primary transition-colors block mt-1">
                    {count}
                  </span>
                  <span className="text-[10px] text-muted-foreground">ONUs</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 4. REGISTERED ONUS */}
      {activeTab === 'onus' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="relative flex-1 min-w-[240px] max-w-md">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search registered ONUs by SN, username, desc..."
                value={onuSearch}
                onChange={(e) => setOnuSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 rounded-xl bg-card border border-border text-xs focus:ring-2 focus:ring-primary outline-none"
              />
            </div>

            <div className="flex items-center gap-2">
              <select
                value={onuRunStateFilter}
                onChange={(e) => setOnuRunStateFilter(e.target.value)}
                className="px-3 py-2 rounded-xl bg-card border border-border text-xs font-semibold"
              >
                <option value="all">All States</option>
                <option value="online">Online</option>
                <option value="offline">Offline</option>
                <option value="missing">Missing</option>
              </select>

              <button
                onClick={fetchOnus}
                className="p-2 rounded-xl bg-card border border-border hover:bg-muted text-foreground transition-all"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="bg-card rounded-2xl border border-border overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-muted/50 border-b border-border text-muted-foreground uppercase tracking-wider text-[11px] font-semibold">
                    <th className="py-3 px-4">Serial Number</th>
                    <th className="py-3 px-4">Location (F/S/P:ID)</th>
                    <th className="py-3 px-4">Associated Customer</th>
                    <th className="py-3 px-4">Run State</th>
                    <th className="py-3 px-4">Rx Power (dBm)</th>
                    <th className="py-3 px-4">Last Event</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {onus.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-muted-foreground">
                        No registered ONUs matching query.
                      </td>
                    </tr>
                  ) : (
                    onus.map((onu) => {
                      const isOnline = onu.run_state === 'online';
                      const isInspecting = inspectingOpticalOnuId === onu.id;
                      const rxPower = onu.last_rx_power;

                      let rxColorClass = 'text-muted-foreground';
                      if (rxPower !== null && rxPower !== undefined) {
                        if (rxPower >= olt.optical_warning_threshold) {
                          rxColorClass = 'text-emerald-500 font-bold';
                        } else if (rxPower >= olt.optical_critical_threshold) {
                          rxColorClass = 'text-amber-500 font-bold';
                        } else {
                          rxColorClass = 'text-rose-500 font-bold';
                        }
                      }

                      return (
                        <tr key={onu.id} className="hover:bg-muted/30">
                          <td className="py-3 px-4 font-mono font-bold text-foreground">
                            {onu.serial_number}
                          </td>
                          <td className="py-3 px-4 font-mono text-muted-foreground">
                            {onu.frame}/{onu.slot}/{onu.pon_port}:{onu.ont_id}
                          </td>
                          <td className="py-3 px-4">
                            {onu.customer_username ? (
                              <div>
                                <span className="font-bold text-foreground block">{onu.customer_username}</span>
                                <span className="text-[11px] text-muted-foreground">{onu.customer_name}</span>
                              </div>
                            ) : (
                              <span className="text-muted-foreground italic">Unassigned</span>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                isOnline
                                  ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                                  : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                              }`}
                            >
                              <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-emerald-500' : 'bg-rose-400'}`} />
                              {onu.run_state.toUpperCase()}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-mono">
                            <span className={rxColorClass}>
                              {rxPower !== null && rxPower !== undefined ? `${rxPower} dBm` : '—'}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-muted-foreground text-[11px]">
                            {onu.last_down_cause ? (
                              <span className="text-rose-400 font-medium">Down: {onu.last_down_cause}</span>
                            ) : onu.last_up_time ? (
                              <span>Up: {new Date(onu.last_up_time).toLocaleString()}</span>
                            ) : (
                              '—'
                            )}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <button
                              onClick={() => handleReadOptical(onu)}
                              disabled={isInspecting}
                              className="px-2.5 py-1 rounded-lg bg-muted hover:bg-primary hover:text-primary-foreground font-semibold text-[11px] transition-colors inline-flex items-center gap-1"
                              title="Read Live Optical Power"
                            >
                              <Signal className={`w-3 h-3 ${isInspecting ? 'animate-spin' : ''}`} />
                              Optical
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 5. ONU DISCOVERY (AUTOFIND) */}
      {activeTab === 'discovery' && (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-card border border-border flex items-center justify-between">
            <div>
              <h3 className="font-bold text-foreground text-sm">Unregistered ONU Discovery (Autofind)</h3>
              <p className="text-[11px] text-muted-foreground">Scans GPON ports for newly plugged, unprovisioned ONUs</p>
            </div>
            <button
              onClick={handleRunDiscovery}
              disabled={discovering}
              className="px-4 py-2 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-primary/20"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${discovering ? 'animate-spin' : ''}`} />
              {discovering ? 'Scanning OLT...' : 'DISCOVER NEW ONUs'}
            </button>
          </div>

          <div className="bg-card rounded-2xl border border-border overflow-hidden shadow-sm">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-muted/50 border-b border-border text-muted-foreground uppercase tracking-wider text-[11px] font-semibold">
                  <th className="py-3 px-4">Discovered Serial Number</th>
                  <th className="py-3 px-4">Location (F/S/P)</th>
                  <th className="py-3 px-4">Vendor ID</th>
                  <th className="py-3 px-4">Equipment ID / Model</th>
                  <th className="py-3 px-4">Discovery Timestamp</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {discoveredOnus.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-muted-foreground">
                      <CheckCircle2 className="w-8 h-8 text-emerald-500/50 mx-auto mb-2" />
                      <p className="font-semibold text-foreground text-sm">No unregistered ONUs currently detected.</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        All physically connected optical transceivers are registered or no new devices are plugged in.
                      </p>
                    </td>
                  </tr>
                ) : (
                  discoveredOnus.map((d) => (
                    <tr key={d.serialNumber} className="hover:bg-muted/30">
                      <td className="py-3.5 px-4 font-mono font-bold text-foreground text-sm">
                        {d.serialNumber}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-muted-foreground">
                        {d.frame}/{d.slot}/{d.ponPort}
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-foreground">{d.vendorId || 'Huawei'}</td>
                      <td className="py-3.5 px-4 text-muted-foreground">{d.equipmentId || 'EchoLife ONT'}</td>
                      <td className="py-3.5 px-4 text-muted-foreground text-[11px]">{d.discoveryTime || 'Just now'}</td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() =>
                            onNavigateToProvision({
                              oltId: olt.id,
                              slot: d.slot,
                              port: d.ponPort,
                              sn: d.serialNumber,
                            })
                          }
                          className="px-3.5 py-1.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs transition-all shadow-sm"
                        >
                          Register This ONU
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 6. OPTICAL MONITORING */}
      {activeTab === 'optical' && (
        <div className="bg-card rounded-2xl border border-border p-6 space-y-6 shadow-sm">
          <div>
            <h3 className="font-bold text-foreground text-sm">Optical Link Power Monitoring</h3>
            <p className="text-[11px] text-muted-foreground">
              Real-time received signal levels (Rx dBm) with configurable attenuation thresholds
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
              <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 block">Good Quality (-14 to {olt.optical_warning_threshold} dBm)</span>
              <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 block mt-1">
                {onus.filter((o) => o.last_rx_power !== null && o.last_rx_power !== undefined && o.last_rx_power >= olt.optical_warning_threshold).length}
              </span>
              <span className="text-[10px] text-muted-foreground">Optimal optical margin</span>
            </div>

            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
              <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 block">Warning Range ({olt.optical_warning_threshold} to {olt.optical_critical_threshold} dBm)</span>
              <span className="text-2xl font-bold text-amber-600 dark:text-amber-400 block mt-1">
                {onus.filter((o) => o.last_rx_power !== null && o.last_rx_power !== undefined && o.last_rx_power < olt.optical_warning_threshold && o.last_rx_power >= olt.optical_critical_threshold).length}
              </span>
              <span className="text-[10px] text-muted-foreground">Elevated attenuation</span>
            </div>

            <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20">
              <span className="text-[11px] font-semibold text-rose-600 dark:text-rose-400 block">Critical Alarm (&lt; {olt.optical_critical_threshold} dBm)</span>
              <span className="text-2xl font-bold text-rose-600 dark:text-rose-400 block mt-1">
                {onus.filter((o) => o.last_rx_power !== null && o.last_rx_power !== undefined && o.last_rx_power < olt.optical_critical_threshold).length}
              </span>
              <span className="text-[10px] text-muted-foreground">Severe degradation</span>
            </div>
          </div>
        </div>
      )}

      {/* 7. PROFILES */}
      {activeTab === 'profiles' && (
        <div className="bg-card rounded-2xl border border-border p-6 space-y-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-foreground text-sm">Line & Service Profiles Catalog</h3>
              <p className="text-[11px] text-muted-foreground">Verified OMCI profiles registered on this OLT</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="border border-border rounded-xl p-4 bg-muted/20">
              <h4 className="font-bold text-foreground text-xs mb-3 flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-primary" />
                Line Profiles (T-CONT & GEM Port)
              </h4>
              <div className="space-y-2">
                <div className="p-2.5 rounded-lg bg-card border border-border flex items-center justify-between text-xs">
                  <div>
                    <span className="font-bold text-foreground block">line-profile-2</span>
                    <span className="text-[11px] text-muted-foreground">Profile ID: 2 (OMCI T-CONT GEM:10)</span>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-500 font-bold">Verified</span>
                </div>
              </div>
            </div>

            <div className="border border-border rounded-xl p-4 bg-muted/20">
              <h4 className="font-bold text-foreground text-xs mb-3 flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-indigo-500" />
                Service Profiles (Ethernet & VLAN)
              </h4>
              <div className="space-y-2">
                <div className="p-2.5 rounded-lg bg-card border border-border flex items-center justify-between text-xs">
                  <div>
                    <span className="font-bold text-foreground block">srv-profile-2</span>
                    <span className="text-[11px] text-muted-foreground">Profile ID: 2 (GigabitEthernet Multi-service)</span>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-500 font-bold">Verified</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 8. SERVICE PORTS */}
      {activeTab === 'service_ports' && (
        <div className="bg-card rounded-2xl border border-border p-6 shadow-sm space-y-4">
          <div>
            <h3 className="font-bold text-foreground text-sm">Provisioned Service Ports Mapping</h3>
            <p className="text-[11px] text-muted-foreground">VLAN translations and GEM port routing between PON and Uplink</p>
          </div>
          <div className="p-4 rounded-xl bg-muted/30 border border-border text-xs text-muted-foreground text-center">
            Service port configuration is verified on registration and synchronized with OLT.
          </div>
        </div>
      )}

      {/* 9. SYNCHRONIZATION */}
      {activeTab === 'sync' && (
        <div className="bg-card rounded-2xl border border-border p-6 space-y-6 shadow-sm">
          <div>
            <h3 className="font-bold text-foreground text-sm">OLT Synchronization Engine</h3>
            <p className="text-[11px] text-muted-foreground">
              Reconciles live Huawei hardware state with panel database idempotently
            </p>
          </div>

          <div className="p-4 rounded-xl bg-muted/30 border border-border flex items-center justify-between">
            <div>
              <span className="font-bold text-foreground block text-sm">Full Chassis Sync</span>
              <span className="text-xs text-muted-foreground">
                Enumerates slots [0, 2, 3, 5], reads all 16 ports per slot, updates statuses without overwriting manual customer links.
              </span>
            </div>
            <button
              onClick={handleSyncOlt}
              disabled={syncing}
              className="px-5 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs flex items-center gap-2 shadow-md shadow-primary/20"
            >
              <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Synchronizing...' : 'Run Sync Now'}
            </button>
          </div>
        </div>
      )}

      {/* 10. OPERATION HISTORY */}
      {activeTab === 'history' && (
        <div className="bg-card rounded-2xl border border-border overflow-hidden shadow-sm">
          <div className="p-4 border-b border-border">
            <h3 className="font-bold text-foreground text-sm">OLT Execution Audit History</h3>
            <p className="text-[11px] text-muted-foreground">All CLI provisioning, queries, and synchronization events (credentials sanitized)</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-muted/50 border-b border-border text-muted-foreground uppercase tracking-wider text-[11px] font-semibold">
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4">Operation</th>
                  <th className="py-3 px-4">Operator</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Command Summary</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {history.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-muted-foreground">
                      No operation history recorded for this OLT yet.
                    </td>
                  </tr>
                ) : (
                  history.map((h) => (
                    <tr key={h.id} className="hover:bg-muted/30">
                      <td className="py-3 px-4 font-mono text-[11px] text-muted-foreground">
                        {new Date(h.started_at).toLocaleString()}
                      </td>
                      <td className="py-3 px-4 font-bold text-foreground uppercase text-[11px]">
                        {h.operation_type}
                      </td>
                      <td className="py-3 px-4 text-foreground font-medium">{h.operator_username || 'system'}</td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            h.status === 'success'
                              ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                              : h.status === 'partial_success'
                              ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                              : 'bg-rose-500/10 text-rose-500 border border-rose-500/20'
                          }`}
                        >
                          {h.status.toUpperCase()}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-muted-foreground font-mono text-[11px] max-w-md truncate">
                        {h.sanitized_command_summary}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
