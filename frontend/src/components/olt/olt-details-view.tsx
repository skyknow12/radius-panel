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
  Wifi,
  Thermometer,
  ShieldAlert,
  HardDrive,
  Network,
} from 'lucide-react';
import type {
  OltItem,
  OnuItem,
  BoardInfo,
  DiscoveredOnt,
  OltProfileItem,
  OltOperationHistoryItem,
  OltInterfaceItem,
  OltAlarmItem,
} from '@/types/olt';

interface OltDetailsViewProps {
  olt: OltItem;
  onBack: () => void;
  onNavigateToProvision: (params?: { oltId?: number; slot?: number; port?: number; sn?: string }) => void;
  currentUser?: any;
}

function formatBps(bps: number): string {
  if (bps >= 1_000_000_000) return `${(bps / 1_000_000_000).toFixed(2)} Gbps`;
  if (bps >= 1_000_000) return `${(bps / 1_000_000).toFixed(2)} Mbps`;
  if (bps >= 1_000) return `${(bps / 1_000).toFixed(2)} Kbps`;
  return `${bps} bps`;
}

export function OltDetailsView({
  olt: initialOlt,
  onBack,
  onNavigateToProvision,
  currentUser,
}: OltDetailsViewProps) {
  const [olt, setOlt] = React.useState<OltItem>(initialOlt);
  const [activeTab, setActiveTab] = React.useState<
    | 'overview'
    | 'interfaces'
    | 'optical'
    | 'alarms'
    | 'boards'
    | 'ports'
    | 'onus'
    | 'discovery'
    | 'profiles'
    | 'service_ports'
    | 'sync'
    | 'history'
  >('overview');

  const [loading, setLoading] = React.useState(false);
  const [notice, setNotice] = React.useState<{ text: string; error?: boolean } | null>(null);

  // Tab Data States
  const [telemetry, setTelemetry] = React.useState<any | null>(null);
  const [interfaces, setInterfaces] = React.useState<OltInterfaceItem[]>([]);
  const [alarms, setAlarms] = React.useState<OltAlarmItem[]>([]);
  const [boards, setBoards] = React.useState<BoardInfo[]>([]);
  const [onus, setOnus] = React.useState<OnuItem[]>([]);
  const [discoveredOnus, setDiscoveredOnus] = React.useState<DiscoveredOnt[]>([]);
  const [profiles, setProfiles] = React.useState<OltProfileItem[]>([]);
  const [history, setHistory] = React.useState<OltOperationHistoryItem[]>([]);

  // Action Loading States
  const [pollingSnmp, setPollingSnmp] = React.useState(false);
  const [syncing, setSyncing] = React.useState(false);
  const [discovering, setDiscovering] = React.useState(false);
  const [inspectingOpticalOnuId, setInspectingOpticalOnuId] = React.useState<number | null>(null);
  const [opticalResult, setOpticalResult] = React.useState<any | null>(null);

  // Filters
  const [onuSearch, setOnuSearch] = React.useState('');
  const [onuRunStateFilter, setOnuRunStateFilter] = React.useState('all');
  const [interfaceSearch, setInterfaceSearch] = React.useState('');

  const showMsg = (text: string, error = false) => {
    setNotice({ text, error });
    setTimeout(() => setNotice(null), 5000);
  };

  const getAuthHeaders = (): Record<string, string> => {
    if (typeof window === 'undefined') return {};
    const token = localStorage.getItem('radius_token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  // Fetch telemetry
  const fetchTelemetry = async () => {
    try {
      const res = await fetch(`/api/olts/${olt.id}/telemetry`, {
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        const json = await res.json();
        setTelemetry(json.data);
      }
    } catch {}
  };

  // Fetch interfaces
  const fetchInterfaces = async () => {
    try {
      const res = await fetch(`/api/olts/${olt.id}/interfaces`, {
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        const json = await res.json();
        setInterfaces(json.data || []);
      }
    } catch {}
  };

  // Fetch alarms
  const fetchAlarms = async () => {
    try {
      const res = await fetch(`/api/olts/${olt.id}/alarms`, {
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        const json = await res.json();
        setAlarms(json.data || []);
      }
    } catch {}
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

  // Trigger SNMP Poll Now
  const handlePollSnmpNow = async () => {
    try {
      setPollingSnmp(true);
      const res = await fetch(`/api/olts/${olt.id}/poll-snmp`, {
        method: 'POST',
        headers: getAuthHeaders(),
      });
      const json = await res.json();
      if (res.ok) {
        showMsg(`SNMP poll completed in ${json.data?.pollDurationMs}ms`);
        setTelemetry(json.data);
        // Refresh OLT details
        const oRes = await fetch(`/api/olts/${olt.id}`, { headers: getAuthHeaders() });
        if (oRes.ok) {
          const oJson = await oRes.json();
          if (oJson.data) setOlt(oJson.data);
        }
        fetchInterfaces();
        fetchAlarms();
        fetchOnus();
      } else {
        showMsg(json.error?.message || 'SNMP polling failed', true);
      }
    } catch {
      showMsg('Failed to trigger SNMP poll', true);
    } finally {
      setPollingSnmp(false);
    }
  };

  // Synchronize OLT via CLI
  const handleSyncOlt = async () => {
    try {
      setSyncing(true);
      const res = await fetch(`/api/olts/${olt.id}/sync`, {
        method: 'POST',
        headers: getAuthHeaders(),
      });
      const json = await res.json();
      if (res.ok) {
        showMsg(json.data?.message || 'Sync completed successfully');
        fetchOnus();
      } else {
        showMsg(`Sync failed: ${json.error?.message || 'Error'}`, true);
      }
    } catch {
      showMsg('Failed to trigger synchronization', true);
    } finally {
      setSyncing(false);
    }
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

  // Sample optical power for specific ONU
  const handleSampleOptical = async (onu: OnuItem) => {
    try {
      setInspectingOpticalOnuId(onu.id);
      setOpticalResult(null);
      const res = await fetch(`/api/olts/${olt.id}/onus/${onu.id}/optical`, {
        headers: getAuthHeaders(),
      });
      const json = await res.json();
      if (res.ok) {
        setOpticalResult({ onuId: onu.id, ...json.data });
        showMsg(`Optical sampled: Rx ${json.data.rxPower} dBm`);
        fetchOnus();
      } else {
        showMsg(json.error?.message || 'Failed to query optical parameters', true);
      }
    } catch {
      showMsg('Error querying optical power', true);
    } finally {
      setInspectingOpticalOnuId(null);
    }
  };

  React.useEffect(() => {
    fetchTelemetry();
    fetchOnus();
    if (activeTab === 'interfaces') fetchInterfaces();
    if (activeTab === 'alarms') fetchAlarms();
    if (activeTab === 'boards') fetchBoards();
    if (activeTab === 'discovery') handleRunDiscovery();
    if (activeTab === 'history') fetchHistory();
    if (activeTab === 'profiles') fetchProfiles();
  }, [activeTab]);

  const tabs = [
    { key: 'overview', label: 'Overview & Telemetry', icon: Server },
    { key: 'interfaces', label: `Interfaces (${interfaces.length || '...'})`, icon: Network },
    { key: 'optical', label: 'Optical Monitoring', icon: Signal },
    { key: 'alarms', label: `Alarms (${alarms.length || olt.active_alarms_count || 0})`, icon: ShieldAlert },
    { key: 'boards', label: 'Boards', icon: Cpu },
    { key: 'ports', label: 'PON Ports', icon: Layers },
    { key: 'onus', label: `Registered ONUs (${onus.length})`, icon: Radio },
    { key: 'discovery', label: `ONU Discovery (${discoveredOnus.length})`, icon: Zap },
    { key: 'profiles', label: 'Profiles', icon: Sliders },
    { key: 'service_ports', label: 'Service Ports', icon: Layers },
    { key: 'sync', label: 'Synchronization', icon: RefreshCw },
    { key: 'history', label: 'Operation History', icon: Clock },
  ] as const;

  const isStale = telemetry?.isStale || olt.last_poll_status === 'error' || olt.last_poll_status === 'timeout';
  const sysInfo = telemetry?.system || null;
  const health = telemetry?.health || null;

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

                {isStale && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                    STALE TELEMETRY
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {olt.vendor} {olt.model} • IP: <span className="font-mono text-foreground">{olt.management_ip}:{olt.management_port}</span> • SNMP: {olt.snmp_version} (Port {olt.snmp_port}) • Branch: {olt.branch_name || 'Organization Core'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePollSnmpNow}
              disabled={pollingSnmp}
              className="px-3.5 py-2 rounded-xl bg-sky-500/10 hover:bg-sky-500/20 text-sky-600 dark:text-sky-400 border border-sky-500/20 text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm"
              title="Poll SNMP MIB Telemetry Now"
            >
              <Wifi className={`w-3.5 h-3.5 ${pollingSnmp ? 'animate-spin' : ''}`} />
              {pollingSnmp ? 'Polling...' : 'Poll SNMP Now'}
            </button>

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

      {/* 1. OVERVIEW & TELEMETRY */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Hardware Health Metrics Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {/* CPU */}
            <div className="bg-card rounded-2xl border border-border p-4 shadow-sm">
              <div className="flex items-center justify-between text-muted-foreground mb-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider">CPU Duty</span>
                <Cpu className="w-4 h-4 text-primary" />
              </div>
              {health?.isCpuSupported && health.cpuUtilization !== null ? (
                <div>
                  <div className="text-xl font-bold font-mono text-foreground">{health.cpuUtilization}%</div>
                  <div className="w-full bg-muted rounded-full h-1.5 mt-2 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        health.cpuUtilization > 85 ? 'bg-rose-500' : health.cpuUtilization > 65 ? 'bg-amber-500' : 'bg-primary'
                      }`}
                      style={{ width: `${Math.min(health.cpuUtilization, 100)}%` }}
                    />
                  </div>
                </div>
              ) : olt.cpu_utilization !== null ? (
                <div>
                  <div className="text-xl font-bold font-mono text-foreground">{olt.cpu_utilization}%</div>
                </div>
              ) : (
                <div className="text-xs text-muted-foreground italic mt-1">Not supported on this model</div>
              )}
            </div>

            {/* Memory */}
            <div className="bg-card rounded-2xl border border-border p-4 shadow-sm">
              <div className="flex items-center justify-between text-muted-foreground mb-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider">Memory Duty</span>
                <HardDrive className="w-4 h-4 text-indigo-500" />
              </div>
              {health?.isMemorySupported && health.memoryUtilization !== null ? (
                <div>
                  <div className="text-xl font-bold font-mono text-foreground">{health.memoryUtilization}%</div>
                  <div className="w-full bg-muted rounded-full h-1.5 mt-2 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        health.memoryUtilization > 85 ? 'bg-rose-500' : health.memoryUtilization > 65 ? 'bg-amber-500' : 'bg-indigo-500'
                      }`}
                      style={{ width: `${Math.min(health.memoryUtilization, 100)}%` }}
                    />
                  </div>
                </div>
              ) : olt.memory_utilization !== null ? (
                <div>
                  <div className="text-xl font-bold font-mono text-foreground">{olt.memory_utilization}%</div>
                </div>
              ) : (
                <div className="text-xs text-muted-foreground italic mt-1">Not supported</div>
              )}
            </div>

            {/* Temperature */}
            <div className="bg-card rounded-2xl border border-border p-4 shadow-sm">
              <div className="flex items-center justify-between text-muted-foreground mb-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider">Temperature</span>
                <Thermometer className="w-4 h-4 text-amber-500" />
              </div>
              {health?.isTemperatureSupported && health.temperature !== null ? (
                <div className="text-xl font-bold font-mono text-foreground">{health.temperature}°C</div>
              ) : olt.temperature !== null ? (
                <div className="text-xl font-bold font-mono text-foreground">{olt.temperature}°C</div>
              ) : (
                <div className="text-xs text-muted-foreground italic mt-1">Not supported</div>
              )}
            </div>

            {/* Fans */}
            <div className="bg-card rounded-2xl border border-border p-4 shadow-sm">
              <div className="flex items-center justify-between text-muted-foreground mb-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider">Fan Status</span>
                <Activity className="w-4 h-4 text-emerald-500" />
              </div>
              <div className="text-sm font-bold text-foreground">
                {health?.fansStatus || olt.fans_status || (health?.isFansSupported === false ? 'Not supported' : 'Normal')}
              </div>
            </div>

            {/* Power */}
            <div className="bg-card rounded-2xl border border-border p-4 shadow-sm">
              <div className="flex items-center justify-between text-muted-foreground mb-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider">Power Status</span>
                <Zap className="w-4 h-4 text-amber-500" />
              </div>
              <div className="text-sm font-bold text-foreground">
                {health?.powerStatus || olt.power_status || (health?.isPowerSupported === false ? 'Not supported' : 'Normal')}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* System MIB Details */}
            <div className="bg-card rounded-2xl border border-border p-5 space-y-4 shadow-sm md:col-span-2">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-foreground text-sm flex items-center gap-2">
                  <Server className="w-4 h-4 text-primary" />
                  Standard SNMP MIB-II System Group
                </h3>
                {isStale && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                    Stale Since: {telemetry?.staleSince ? new Date(telemetry.staleSince).toLocaleTimeString() : 'Recent poll fail'}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-muted/40 border border-border">
                  <span className="text-[11px] text-muted-foreground block">System Name (sysName)</span>
                  <span className="font-semibold text-foreground mt-0.5 block truncate">
                    {sysInfo?.sysName || olt.sys_name || olt.name}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-muted/40 border border-border">
                  <span className="text-[11px] text-muted-foreground block">Uptime (sysUpTime)</span>
                  <span className="font-mono text-foreground font-semibold mt-0.5 block">
                    {sysInfo?.sysUpTime || olt.sys_uptime || 'Unknown'}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-muted/40 border border-border">
                  <span className="text-[11px] text-muted-foreground block">Location (sysLocation)</span>
                  <span className="text-foreground mt-0.5 block truncate">
                    {sysInfo?.sysLocation || olt.sys_location || 'Not set in device'}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-muted/40 border border-border">
                  <span className="text-[11px] text-muted-foreground block">Contact (sysContact)</span>
                  <span className="text-foreground mt-0.5 block truncate">
                    {sysInfo?.sysContact || olt.sys_contact || 'Not set in device'}
                  </span>
                </div>

                <div className="sm:col-span-2 p-3 rounded-xl bg-muted/40 border border-border">
                  <span className="text-[11px] text-muted-foreground block">System Description (sysDescr)</span>
                  <p className="font-mono text-[11px] text-foreground mt-0.5 break-words">
                    {sysInfo?.sysDescr || olt.sys_descr || `${olt.vendor} ${olt.model} Optical Line Termination Chassis`}
                  </p>
                </div>
              </div>

              {/* Optical Alert Thresholds */}
              <div className="pt-3 border-t border-border">
                <h4 className="text-xs font-bold text-foreground mb-2">Optical Margin Thresholds</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400">
                    <span className="text-[11px] block font-semibold">Warning Threshold (Yellow)</span>
                    <span className="text-base font-bold font-mono mt-0.5 block">{olt.optical_warning_threshold} dBm</span>
                    <span className="text-[10px] opacity-80">Triggers pre-emptive fiber inspection alert</span>
                  </div>
                  <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-400">
                    <span className="text-[11px] block font-semibold">Critical Threshold (Red)</span>
                    <span className="text-base font-bold font-mono mt-0.5 block">{olt.optical_critical_threshold} dBm</span>
                    <span className="text-[10px] opacity-80">Severe optical attenuation below margin</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Summary Card */}
            <div className="bg-card rounded-2xl border border-border p-5 space-y-4 shadow-sm">
              <h3 className="font-bold text-foreground text-sm flex items-center gap-2">
                <Activity className="w-4 h-4 text-emerald-500" />
                Live Link Health Summary
              </h3>

              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded-xl bg-muted/40 border border-border text-xs">
                  <span className="text-muted-foreground">Total ONUs</span>
                  <span className="font-bold text-foreground text-sm">{onus.length || olt.registered_onus_count || 0}</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs">
                  <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Online Optical ONUs</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                    {onus.filter((o) => o.run_state === 'online').length || olt.online_onus_count || 0}
                  </span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs">
                  <span className="text-rose-600 dark:text-rose-400 font-semibold">Offline ONUs</span>
                  <span className="font-bold text-rose-600 dark:text-rose-400 text-sm">
                    {onus.filter((o) => o.run_state === 'offline').length}
                  </span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs">
                  <span className="text-amber-600 dark:text-amber-400 font-semibold">Active Alarms</span>
                  <span className="font-bold text-amber-600 dark:text-amber-400 text-sm">
                    {alarms.length || olt.active_alarms_count || 0}
                  </span>
                </div>
              </div>

              <div className="pt-2 border-t border-border text-xs text-muted-foreground space-y-1">
                <div>Last Poll: {olt.last_poll_at ? new Date(olt.last_poll_at).toLocaleString() : 'Never'}</div>
                <div>Last Seen: {olt.last_seen_at ? new Date(olt.last_seen_at).toLocaleString() : 'Never'}</div>
                {olt.last_poll_error && (
                  <div className="text-rose-500 text-[11px] font-semibold mt-1">
                    Poll Error: {olt.last_poll_error}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. INTERFACES TAB */}
      {activeTab === 'interfaces' && (
        <div className="bg-card rounded-2xl border border-border overflow-hidden shadow-sm">
          <div className="p-4 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="font-bold text-foreground text-sm">Physical & Logical Interfaces (IF-MIB / IF-X-MIB)</h3>
              <p className="text-[11px] text-muted-foreground">
                64-bit high-capacity octet counters and live traffic rates calculated across poll intervals
              </p>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Filter interfaces..."
                value={interfaceSearch}
                onChange={(e) => setInterfaceSearch(e.target.value)}
                className="px-3 py-1.5 rounded-xl bg-muted border border-border text-xs outline-none focus:ring-2 focus:ring-primary"
              />
              <button
                onClick={fetchInterfaces}
                className="p-1.5 rounded-xl bg-muted hover:bg-muted/80 text-foreground text-xs"
                title="Refresh interfaces"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-muted/50 border-b border-border text-muted-foreground uppercase tracking-wider text-[11px] font-semibold">
                  <th className="py-3 px-4">Index</th>
                  <th className="py-3 px-4">Interface Name</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Admin / Oper Status</th>
                  <th className="py-3 px-4">Inbound Rate (bps)</th>
                  <th className="py-3 px-4">Outbound Rate (bps)</th>
                  <th className="py-3 px-4">Errors / Discards</th>
                  <th className="py-3 px-4">Speed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {interfaces.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-muted-foreground">
                      <Network className="w-8 h-8 mx-auto mb-2 opacity-40" />
                      <p className="font-semibold text-foreground text-sm">No interfaces loaded yet</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Click "Poll SNMP Now" to query the IF-MIB interface table from this OLT.
                      </p>
                    </td>
                  </tr>
                ) : (
                  interfaces
                    .filter(
                      (i) =>
                        !interfaceSearch.trim() ||
                        i.if_name.toLowerCase().includes(interfaceSearch.toLowerCase()) ||
                        i.if_descr.toLowerCase().includes(interfaceSearch.toLowerCase())
                    )
                    .map((iface) => {
                      const isUp = iface.oper_status === 'up';
                      return (
                        <tr key={iface.id || iface.if_index} className="hover:bg-muted/40">
                          <td className="py-3 px-4 font-mono text-muted-foreground">{iface.if_index}</td>
                          <td className="py-3 px-4 font-semibold text-foreground">
                            <div>{iface.if_name}</div>
                            {iface.if_descr && iface.if_descr !== iface.if_name && (
                              <div className="text-[10px] text-muted-foreground">{iface.if_descr}</div>
                            )}
                          </td>
                          <td className="py-3 px-4 text-muted-foreground font-mono">{iface.if_type}</td>
                          <td className="py-3 px-4">
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                isUp
                                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                                  : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                              }`}
                            >
                              <span className={`w-1.5 h-1.5 rounded-full ${isUp ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                              {iface.oper_status.toUpperCase()}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                            {formatBps(iface.in_rate_bps || 0)}
                          </td>
                          <td className="py-3 px-4 font-mono font-semibold text-sky-600 dark:text-sky-400">
                            {formatBps(iface.out_rate_bps || 0)}
                          </td>
                          <td className="py-3 px-4 font-mono text-muted-foreground">
                            {iface.in_errors + iface.out_errors > 0 ? (
                              <span className="text-rose-500 font-bold">{iface.in_errors + iface.out_errors} err</span>
                            ) : (
                              '0 err'
                            )}
                          </td>
                          <td className="py-3 px-4 font-mono text-muted-foreground">
                            {iface.speed_bps > 0 ? formatBps(iface.speed_bps) : 'N/A'}
                          </td>
                        </tr>
                      );
                    })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 3. OPTICAL MONITORING TAB */}
      {activeTab === 'optical' && (
        <div className="bg-card rounded-2xl border border-border overflow-hidden shadow-sm space-y-4 p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="font-bold text-foreground text-sm flex items-center gap-2">
                <Signal className="w-4 h-4 text-primary" />
                GPON Optical Signal Telemetry (SNMP hwGponOntOpticalInfoTable)
              </h3>
              <p className="text-[11px] text-muted-foreground">
                Live transceiver optical power received by ONT, transmit power, and OLT receiver metrics in 0.01 dBm precision
              </p>
            </div>

            <button
              onClick={handlePollSnmpNow}
              disabled={pollingSnmp}
              className="px-3.5 py-1.5 rounded-xl bg-primary text-primary-foreground text-xs font-semibold flex items-center gap-1.5 shadow-sm"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${pollingSnmp ? 'animate-spin' : ''}`} />
              Poll Telemetry Now
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs">
              <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 block">Optimal Signal Margin</span>
              <div className="text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-1">
                {onus.filter((o) => typeof o.last_rx_power === 'number' && o.last_rx_power >= (olt.optical_warning_threshold ?? -25)).length}
              </div>
              <span className="text-[10px] text-muted-foreground">Power ≥ {olt.optical_warning_threshold} dBm</span>
            </div>

            <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs">
              <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 block">Warning Signal Attenuation</span>
              <div className="text-xl font-bold font-mono text-amber-600 dark:text-amber-400 mt-1">
                {onus.filter((o) => typeof o.last_rx_power === 'number' && o.last_rx_power < (olt.optical_warning_threshold ?? -25) && o.last_rx_power >= (olt.optical_critical_threshold ?? -28)).length}
              </div>
              <span className="text-[10px] text-muted-foreground">Between {olt.optical_warning_threshold} and {olt.optical_critical_threshold} dBm</span>
            </div>

            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs">
              <span className="text-[11px] font-semibold text-rose-600 dark:text-rose-400 block">Critical Optical Alarm</span>
              <div className="text-xl font-bold font-mono text-rose-600 dark:text-rose-400 mt-1">
                {onus.filter((o) => typeof o.last_rx_power === 'number' && o.last_rx_power < (olt.optical_critical_threshold ?? -28)).length}
              </div>
              <span className="text-[10px] text-muted-foreground">Power &lt; {olt.optical_critical_threshold} dBm</span>
            </div>
          </div>

          <div className="overflow-x-auto pt-2">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-muted/50 border-b border-border text-muted-foreground uppercase tracking-wider text-[11px] font-semibold">
                  <th className="py-3 px-4">ONT Location</th>
                  <th className="py-3 px-4">Serial Number</th>
                  <th className="py-3 px-4">Subscriber</th>
                  <th className="py-3 px-4">Run State</th>
                  <th className="py-3 px-4">ONT Rx Power</th>
                  <th className="py-3 px-4">ONT Tx Power</th>
                  <th className="py-3 px-4">OLT Rx Power</th>
                  <th className="py-3 px-4">Freshness</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {onus.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-muted-foreground">
                      No ONUs registered on this OLT chassis.
                    </td>
                  </tr>
                ) : (
                  onus.map((onu) => {
                    const rx = onu.last_rx_power;
                    const isOnline = onu.run_state === 'online';
                    const warnThresh = olt.optical_warning_threshold ?? -25;
                    const critThresh = olt.optical_critical_threshold ?? -28;
                    const isWarning = typeof rx === 'number' && rx < warnThresh && rx >= critThresh;
                    const isCritical = typeof rx === 'number' && rx < critThresh;

                    return (
                      <tr key={onu.id} className="hover:bg-muted/40">
                        <td className="py-3 px-4 font-mono">
                          {onu.slot}/{onu.pon_port}:{onu.ont_id}
                        </td>
                        <td className="py-3 px-4 font-mono font-bold text-foreground">{onu.serial_number}</td>
                        <td className="py-3 px-4 text-foreground">
                          {onu.customer_username ? (
                            <span className="font-semibold text-primary">{onu.customer_username}</span>
                          ) : (
                            <span className="text-muted-foreground italic">Unlinked</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              isOnline
                                ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                                : 'bg-rose-500/10 text-rose-500 border border-rose-500/20'
                            }`}
                          >
                            {onu.run_state.toUpperCase()}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-mono font-bold">
                          {typeof rx === 'number' ? (
                            <span className={isCritical ? 'text-rose-500' : isWarning ? 'text-amber-500' : 'text-emerald-500'}>
                              {rx} dBm
                            </span>
                          ) : (
                            <span className="text-muted-foreground">N/A</span>
                          )}
                        </td>
                        <td className="py-3 px-4 font-mono text-muted-foreground">
                          {typeof onu.last_tx_power === 'number' ? `${onu.last_tx_power} dBm` : 'N/A'}
                        </td>
                        <td className="py-3 px-4 font-mono text-muted-foreground">
                          {typeof onu.last_olt_rx_power === 'number' ? `${onu.last_olt_rx_power} dBm` : 'N/A'}
                        </td>
                        <td className="py-3 px-4 text-[10px] text-muted-foreground">
                          {onu.last_optical_reading_at ? (
                            <span className="px-1.5 py-0.5 rounded bg-muted border border-border">
                              {new Date(onu.last_optical_reading_at).toLocaleTimeString()}
                            </span>
                          ) : (
                            <span className="text-muted-foreground italic">Pending</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 4. ALARMS TAB */}
      {activeTab === 'alarms' && (
        <div className="bg-card rounded-2xl border border-border overflow-hidden shadow-sm">
          <div className="p-4 border-b border-border flex items-center justify-between">
            <div>
              <h3 className="font-bold text-foreground text-sm flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-rose-500" />
                Active & Logged Hardware Alarms (SNMP hwAlarmActiveTable)
              </h3>
              <p className="text-[11px] text-muted-foreground">Faults, link drops, power fluctuations, and transceiver alarms</p>
            </div>

            <button
              onClick={fetchAlarms}
              className="p-1.5 rounded-xl bg-muted hover:bg-muted/80 text-foreground text-xs"
              title="Refresh Alarms"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-muted/50 border-b border-border text-muted-foreground uppercase tracking-wider text-[11px] font-semibold">
                  <th className="py-3 px-4">Severity</th>
                  <th className="py-3 px-4">Alarm ID</th>
                  <th className="py-3 px-4">Title</th>
                  <th className="py-3 px-4">Description</th>
                  <th className="py-3 px-4">Raised At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {alarms.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-10 text-center text-muted-foreground">
                      <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-emerald-500 opacity-60" />
                      <p className="font-semibold text-foreground text-sm">No active alarms</p>
                      <p className="text-xs text-muted-foreground mt-0.5">All hardware boards and PON ports operating normally.</p>
                    </td>
                  </tr>
                ) : (
                  alarms.map((alarm) => {
                    const isCrit = alarm.severity === 'critical';
                    const isMaj = alarm.severity === 'major';
                    const isMin = alarm.severity === 'minor';

                    return (
                      <tr key={alarm.id || alarm.alarm_id} className="hover:bg-muted/40">
                        <td className="py-3 px-4">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              isCrit
                                ? 'bg-rose-500/10 text-rose-500 border border-rose-500/20'
                                : isMaj
                                ? 'bg-orange-500/10 text-orange-500 border border-orange-500/20'
                                : isMin
                                ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                                : 'bg-blue-500/10 text-blue-500 border border-blue-500/20'
                            }`}
                          >
                            {alarm.severity.toUpperCase()}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-mono text-muted-foreground">{alarm.alarm_id}</td>
                        <td className="py-3 px-4 font-bold text-foreground">{alarm.title}</td>
                        <td className="py-3 px-4 text-muted-foreground">{alarm.description}</td>
                        <td className="py-3 px-4 font-mono text-muted-foreground">
                          {new Date(alarm.raised_at).toLocaleString()}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 5. BOARDS TAB */}
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
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {boards.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-muted-foreground">
                      Click &quot;Query Hardware&quot; to retrieve real-time slot inventory from OLT.
                    </td>
                  </tr>
                ) : (
                  boards.map((b) => (
                    <tr key={b.slot} className="hover:bg-muted/30">
                      <td className="py-3 px-4 font-mono font-bold text-foreground">Slot {b.slot}</td>
                      <td className="py-3 px-4 font-bold text-primary">{b.boardName}</td>
                      <td className="py-3 px-4 text-muted-foreground">
                        {b.isGpon ? '16-Port GPON Service Board' : b.isControl ? 'Main Control / Switch Unit' : 'Uplink Interface'}
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                          {b.status.toUpperCase()}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 6. PON PORTS TAB */}
      {activeTab === 'ports' && (
        <div className="bg-card rounded-2xl border border-border p-6 shadow-sm space-y-4">
          <div>
            <h3 className="font-bold text-foreground text-sm">Chassis PON Port Matrix</h3>
            <p className="text-[11px] text-muted-foreground">Select a PON port to inspect registered optical subscribers or trigger discovery</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-8 gap-3">
            {Array.from({ length: 16 }).map((_, idx) => (
              <div
                key={idx}
                className="p-3 rounded-xl bg-muted/40 border border-border text-center hover:border-primary cursor-pointer transition-all"
              >
                <div className="text-[11px] font-bold text-foreground">Port {idx}</div>
                <div className="text-[10px] text-muted-foreground mt-0.5">GPON SFP</div>
                <div className="mt-2 text-[10px] font-bold text-emerald-500">Active</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 7. REGISTERED ONUS */}
      {activeTab === 'onus' && (
        <div className="bg-card rounded-2xl border border-border overflow-hidden shadow-sm">
          <div className="p-4 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="font-bold text-foreground text-sm">Provisioned ONT Subscriber Terminals</h3>
              <p className="text-[11px] text-muted-foreground">Manage authorized serial numbers and inspect optical metrics</p>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Search serial or username..."
                value={onuSearch}
                onChange={(e) => setOnuSearch(e.target.value)}
                className="px-3 py-1.5 rounded-xl bg-muted border border-border text-xs outline-none focus:ring-2 focus:ring-primary"
              />
              <button
                onClick={fetchOnus}
                className="p-1.5 rounded-xl bg-muted hover:bg-muted/80 text-foreground text-xs"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-muted/50 border-b border-border text-muted-foreground uppercase tracking-wider text-[11px] font-semibold">
                  <th className="py-3 px-4">ONT Location</th>
                  <th className="py-3 px-4">Serial Number</th>
                  <th className="py-3 px-4">Subscriber</th>
                  <th className="py-3 px-4">Run State</th>
                  <th className="py-3 px-4">Rx Power</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {onus.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-muted-foreground">
                      No ONUs registered yet.
                    </td>
                  </tr>
                ) : (
                  onus.map((onu) => (
                    <tr key={onu.id} className="hover:bg-muted/40">
                      <td className="py-3 px-4 font-mono">
                        {onu.slot}/{onu.pon_port}:{onu.ont_id}
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-foreground">{onu.serial_number}</td>
                      <td className="py-3 px-4 text-foreground">
                        {onu.customer_username ? (
                          <span className="font-semibold text-primary">{onu.customer_username}</span>
                        ) : (
                          <span className="text-muted-foreground italic">Unlinked</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            onu.run_state === 'online'
                              ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                              : 'bg-rose-500/10 text-rose-500 border border-rose-500/20'
                          }`}
                        >
                          {onu.run_state.toUpperCase()}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono font-bold">
                        {typeof onu.last_rx_power === 'number' ? `${onu.last_rx_power} dBm` : 'N/A'}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => handleSampleOptical(onu)}
                          disabled={inspectingOpticalOnuId === onu.id}
                          className="px-2.5 py-1 rounded-lg bg-muted hover:bg-primary hover:text-primary-foreground text-xs font-semibold"
                        >
                          {inspectingOpticalOnuId === onu.id ? 'Sampling...' : 'Sample Optical'}
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

      {/* 8. ONU DISCOVERY */}
      {activeTab === 'discovery' && (
        <div className="bg-card rounded-2xl border border-border p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-foreground text-sm">Autofind Unregistered ONUs</h3>
              <p className="text-[11px] text-muted-foreground">Scans GPON transceiver ports for newly attached optical subscriber terminals</p>
            </div>
            <button
              onClick={handleRunDiscovery}
              disabled={discovering}
              className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold flex items-center gap-1.5 shadow-sm"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${discovering ? 'animate-spin' : ''}`} />
              {discovering ? 'Scanning...' : 'Trigger Autofind'}
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-muted/50 border-b border-border text-muted-foreground uppercase tracking-wider text-[11px] font-semibold">
                  <th className="py-3 px-4">Slot/Port</th>
                  <th className="py-3 px-4">Serial Number</th>
                  <th className="py-3 px-4">Vendor ID</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {discoveredOnus.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-muted-foreground">
                      No unprovisioned ONUs broadcasting on splitters.
                    </td>
                  </tr>
                ) : (
                  discoveredOnus.map((d, idx) => (
                    <tr key={idx} className="hover:bg-muted/40">
                      <td className="py-3 px-4 font-mono">
                        {d.slot}/{d.ponPort}
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-foreground">{d.serialNumber}</td>
                      <td className="py-3 px-4 text-muted-foreground">{d.vendorId || 'Huawei'}</td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => onNavigateToProvision({ oltId: olt.id, slot: d.slot, port: d.ponPort, sn: d.serialNumber })}
                          className="px-3 py-1 rounded-lg bg-primary text-primary-foreground font-semibold text-xs"
                        >
                          Register Now
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

      {/* 9. PROFILES */}
      {activeTab === 'profiles' && (
        <div className="bg-card rounded-2xl border border-border p-6 space-y-4 shadow-sm">
          <div>
            <h3 className="font-bold text-foreground text-sm">Line & Service Profiles Catalog</h3>
            <p className="text-[11px] text-muted-foreground">Verified OMCI profiles registered on this OLT</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="border border-border rounded-xl p-4 bg-muted/20">
              <h4 className="font-bold text-foreground text-xs mb-3 flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-primary" />
                Line Profiles
              </h4>
              <div className="p-2.5 rounded-lg bg-card border border-border text-xs">
                <span className="font-bold text-foreground block">line-profile-2</span>
                <span className="text-[11px] text-muted-foreground">Profile ID: 2 (OMCI T-CONT GEM:10)</span>
              </div>
            </div>

            <div className="border border-border rounded-xl p-4 bg-muted/20">
              <h4 className="font-bold text-foreground text-xs mb-3 flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-indigo-500" />
                Service Profiles
              </h4>
              <div className="p-2.5 rounded-lg bg-card border border-border text-xs">
                <span className="font-bold text-foreground block">srv-profile-2</span>
                <span className="text-[11px] text-muted-foreground">Profile ID: 2 (GigabitEthernet Multi-service)</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 10. SERVICE PORTS */}
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

      {/* 11. SYNCHRONIZATION */}
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
                Enumerates slots, reads all ports, and updates ONU statuses without overwriting manual customer links.
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

      {/* 12. OPERATION HISTORY */}
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
