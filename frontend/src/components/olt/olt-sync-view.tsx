'use client';

import React from 'react';
import {
  RefreshCw,
  Server,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  ArrowRight,
  Database,
  Layers,
  Search,
  Filter,
  Check,
  ShieldAlert,
  Radio,
  ExternalLink,
} from 'lucide-react';
import type { OltItem, OnuItem } from '@/types/olt';

interface OltSyncViewProps {
  onNavigateToOltDetails?: (olt: OltItem) => void;
  onNavigateToRegisteredOnus?: (filter?: { oltId?: number; state?: string }) => void;
  currentUser?: any;
}

export function OltSyncView({
  onNavigateToOltDetails,
  onNavigateToRegisteredOnus,
  currentUser,
}: OltSyncViewProps) {
  const [olts, setOlts] = React.useState<OltItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [syncingOltId, setSyncingOltId] = React.useState<number | null>(null);
  const [syncingAll, setSyncingAll] = React.useState(false);
  const [notice, setNotice] = React.useState<{ text: string; error?: boolean } | null>(null);
  const [syncResults, setSyncResults] = React.useState<Record<number, any>>({});
  const [selectedOltFilter, setSelectedOltFilter] = React.useState<number | 'all'>('all');
  const [flaggedOnus, setFlaggedOnus] = React.useState<OnuItem[]>([]);
  const [loadingFlagged, setLoadingFlagged] = React.useState(false);

  const showMsg = (text: string, error = false) => {
    setNotice({ text, error });
    setTimeout(() => setNotice(null), 5000);
  };

  const getAuthHeaders = (): Record<string, string> => {
    if (typeof window === 'undefined') return {};
    const token = localStorage.getItem('radius_token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const fetchOlts = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/olts', { headers: getAuthHeaders() });
      if (res.ok) {
        const json = await res.json();
        setOlts(json.data || []);
      }
    } catch {
      showMsg('Failed to load OLT list', true);
    } finally {
      setLoading(false);
    }
  };

  const fetchFlaggedOnus = async () => {
    try {
      setLoadingFlagged(true);
      const res = await fetch('/api/onus?limit=50', { headers: getAuthHeaders() });
      if (res.ok) {
        const json = await res.json();
        const all: OnuItem[] = json.data || [];
        // Filter for missing or unmapped
        const flagged = all.filter(
          (o) => o.run_state === 'missing' || !o.customer_id || o.config_state === 'failed'
        );
        setFlaggedOnus(flagged);
      }
    } catch {} finally {
      setLoadingFlagged(false);
    }
  };

  React.useEffect(() => {
    fetchOlts();
    fetchFlaggedOnus();
  }, []);

  const handleSyncOlt = async (oltId: number) => {
    try {
      setSyncingOltId(oltId);
      const res = await fetch(`/api/olts/${oltId}/sync`, {
        method: 'POST',
        headers: getAuthHeaders(),
      });
      const json = await res.json();
      if (res.ok) {
        showMsg(`OLT synchronized successfully: ${json.data?.totalDiscovered ?? 0} ONUs scanned.`);
        setSyncResults((prev) => ({ ...prev, [oltId]: json.data }));
        fetchOlts();
        fetchFlaggedOnus();
      } else {
        showMsg(json.error || 'Synchronization failed', true);
      }
    } catch {
      showMsg('Network error while triggering synchronization', true);
    } finally {
      setSyncingOltId(null);
    }
  };

  const handleSyncAll = async () => {
    if (olts.length === 0) return;
    setSyncingAll(true);
    let successCount = 0;
    for (const olt of olts) {
      if (!olt.enabled) continue;
      try {
        const res = await fetch(`/api/olts/${olt.id}/sync`, {
          method: 'POST',
          headers: getAuthHeaders(),
        });
        if (res.ok) {
          const json = await res.json();
          setSyncResults((prev) => ({ ...prev, [olt.id]: json.data }));
          successCount++;
        }
      } catch {}
    }
    setSyncingAll(false);
    showMsg(`Batch synchronization completed for ${successCount}/${olts.length} active OLTs`);
    fetchOlts();
    fetchFlaggedOnus();
  };

  const totalOnus = olts.reduce((sum, o) => sum + (o.total_onus || 0), 0);
  const onlineOnus = olts.reduce((sum, o) => sum + (o.online_onus || 0), 0);
  const offlineOnus = olts.reduce((sum, o) => sum + (o.offline_onus || 0), 0);
  const onlineOlts = olts.filter((o) => o.connection_status === 'online').length;

  const filteredOlts =
    selectedOltFilter === 'all' ? olts : olts.filter((o) => o.id === selectedOltFilter);

  return (
    <div className="space-y-6">
      {/* Notice Alert */}
      {notice && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between shadow-sm animate-in fade-in duration-200 ${
            notice.error
              ? 'bg-rose-500/10 border-rose-500/30 text-rose-600 dark:text-rose-400'
              : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
          }`}
        >
          <div className="flex items-center gap-2">
            {notice.error ? <AlertTriangle className="w-5 h-5 flex-shrink-0" /> : <CheckCircle2 className="w-5 h-5 flex-shrink-0" />}
            <span className="text-sm font-medium">{notice.text}</span>
          </div>
          <button onClick={() => setNotice(null)} className="text-xs hover:underline font-semibold ml-4">
            Dismiss
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <RefreshCw className="w-5 h-5 text-primary" />
            OLT Synchronization Engine
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Real-time reconciliation between Huawei hardware registers and FreeRADIUS database
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              fetchOlts();
              fetchFlaggedOnus();
            }}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-semibold hover:bg-muted transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={handleSyncAll}
            disabled={syncingAll || olts.length === 0}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors shadow-sm disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncingAll ? 'animate-spin' : ''}`} />
            {syncingAll ? 'Synchronizing All...' : 'Synchronize All Active OLTs'}
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">OLT Chassis Status</span>
            <Server className="w-4 h-4 text-primary" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-foreground">{onlineOlts}</span>
            <span className="text-xs text-muted-foreground">/ {olts.length} Online</span>
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Total Synced ONUs</span>
            <Layers className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-foreground">{totalOnus}</span>
            <span className="text-xs text-muted-foreground">In Database</span>
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Online ONT Sessions</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{onlineOnus}</span>
            <span className="text-xs text-muted-foreground">Operational</span>
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Flagged / Unmapped</span>
            <AlertTriangle className="w-4 h-4 text-amber-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-amber-600 dark:text-amber-400">{flaggedOnus.length}</span>
            <span className="text-xs text-muted-foreground">Attention Needed</span>
          </div>
        </div>
      </div>

      {/* Reconciliation Engine Explained Card */}
      <div className="bg-muted/40 border border-border rounded-xl p-4 text-xs text-muted-foreground space-y-2">
        <div className="flex items-center gap-2 font-semibold text-foreground">
          <Database className="w-4 h-4 text-primary" />
          Reconciliation & Idempotency Rules
        </div>
        <p>
          1. <strong>Live Telnet Harvest</strong>: Runs typed Huawei CLI commands (<code className="bg-muted px-1 py-0.5 rounded text-[11px] font-mono">display ont info &lt;slot&gt;/&lt;port&gt; all</code>) across all populated GPON boards without impacting live customer traffic.
        </p>
        <p>
          2. <strong>Safe Upsert</strong>: Newly discovered ONUs are written to the database with operational state, MAC address, vendor info, and assigned ONT ID.
        </p>
        <p>
          3. <strong>Anti-Data-Loss</strong>: ONUs no longer present on the physical OLT port are marked as <span className="text-amber-600 font-semibold">missing</span> rather than deleted, ensuring subscriber ownership and historical optical metrics remain intact.
        </p>
      </div>

      {/* OLT Devices Sync Table */}
      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-border flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Server className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">Configured OLT Nodes</h3>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Filter OLT:</span>
            <select
              value={selectedOltFilter}
              onChange={(e) => setSelectedOltFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))}
              className="text-xs border border-border rounded-lg px-2.5 py-1 bg-background text-foreground"
            >
              <option value="all">All OLTs ({olts.length})</option>
              {olts.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name} ({o.management_ip})
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-muted/50 border-b border-border text-muted-foreground font-semibold">
              <tr>
                <th className="py-2.5 px-3">OLT Chassis</th>
                <th className="py-2.5 px-3">Management IP</th>
                <th className="py-2.5 px-3">Branch Office</th>
                <th className="py-2.5 px-3">Hardware Status</th>
                <th className="py-2.5 px-3">Last Synchronized</th>
                <th className="py-2.5 px-3 text-center">Registered ONUs</th>
                <th className="py-2.5 px-3 text-center">Online / Offline</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-muted-foreground">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-primary" />
                    Scanning OLT synchronization status...
                  </td>
                </tr>
              ) : filteredOlts.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-muted-foreground">
                    No OLT devices registered.
                  </td>
                </tr>
              ) : (
                filteredOlts.map((olt) => {
                  const isSyncing = syncingOltId === olt.id || syncingAll;
                  const recentSync = syncResults[olt.id];

                  return (
                    <tr key={olt.id} className="hover:bg-muted/30 transition-colors">
                      <td className="py-3 px-3 font-medium text-foreground">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => onNavigateToOltDetails?.(olt)}
                            className="font-semibold text-primary hover:underline flex items-center gap-1"
                          >
                            {olt.name}
                            <ExternalLink className="w-3 h-3 text-muted-foreground" />
                          </button>
                        </div>
                        <div className="text-[10px] text-muted-foreground mt-0.5">
                          {olt.vendor} {olt.model}
                        </div>
                      </td>

                      <td className="py-3 px-3 font-mono text-muted-foreground">
                        {olt.management_ip}:{olt.management_port}
                      </td>

                      <td className="py-3 px-3 text-muted-foreground">
                        {olt.branch_name || 'Global (All Branches)'}
                      </td>

                      <td className="py-3 px-3">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                            olt.connection_status === 'online'
                              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                              : olt.connection_status === 'offline'
                              ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                              : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              olt.connection_status === 'online'
                                ? 'bg-emerald-500'
                                : olt.connection_status === 'offline'
                                ? 'bg-rose-500'
                                : 'bg-amber-500'
                            }`}
                          />
                          {olt.connection_status.toUpperCase()}
                        </span>
                      </td>

                      <td className="py-3 px-3 text-muted-foreground">
                        {olt.last_sync_at ? (
                          <div className="flex items-center gap-1.5">
                            <Clock className="w-3 h-3 text-muted-foreground" />
                            <span>{new Date(olt.last_sync_at).toLocaleString()}</span>
                          </div>
                        ) : (
                          <span className="text-amber-600 dark:text-amber-400 font-medium text-[11px]">
                            Never Synced
                          </span>
                        )}
                        {recentSync && (
                          <div className="text-[10px] text-emerald-600 font-medium mt-0.5">
                            Just updated: {recentSync.totalDiscovered} found
                          </div>
                        )}
                      </td>

                      <td className="py-3 px-3 text-center font-bold text-foreground">
                        {olt.total_onus ?? 0}
                      </td>

                      <td className="py-3 px-3 text-center">
                        <span className="text-emerald-600 font-semibold">{olt.online_onus ?? 0}</span>
                        <span className="text-muted-foreground mx-1">/</span>
                        <span className="text-rose-600 font-semibold">{olt.offline_onus ?? 0}</span>
                      </td>

                      <td className="py-3 px-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleSyncOlt(olt.id)}
                            disabled={isSyncing || !olt.enabled}
                            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors text-[11px] font-semibold disabled:opacity-50"
                          >
                            <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} />
                            {isSyncing ? 'Syncing...' : 'Sync Now'}
                          </button>
                          <button
                            onClick={() => onNavigateToRegisteredOnus?.({ oltId: olt.id })}
                            className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-border hover:bg-muted transition-colors text-[11px] font-medium"
                          >
                            View ONUs
                            <ArrowRight className="w-3 h-3" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Flagged / Discrepancy Breakdown Section */}
      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-border flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            <h3 className="text-sm font-semibold text-foreground">
              Discrepancy Inspector & Unmapped ONUs ({flaggedOnus.length})
            </h3>
          </div>
          <span className="text-xs text-muted-foreground">
            ONUs requiring subscriber association or hardware verification
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-muted/50 border-b border-border text-muted-foreground font-semibold">
              <tr>
                <th className="py-2.5 px-3">Serial Number</th>
                <th className="py-2.5 px-3">OLT / PON Location</th>
                <th className="py-2.5 px-3">Run State</th>
                <th className="py-2.5 px-3">Config State</th>
                <th className="py-2.5 px-3">Associated Customer</th>
                <th className="py-2.5 px-3">Discrepancy Reason</th>
                <th className="py-2.5 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loadingFlagged ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-muted-foreground">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-primary" />
                    Analyzing database discrepancies...
                  </td>
                </tr>
              ) : flaggedOnus.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-emerald-600 dark:text-emerald-400 font-medium">
                    <CheckCircle2 className="w-6 h-6 mx-auto mb-1 text-emerald-500" />
                    No discrepancies found. All registered ONUs are healthy and mapped.
                  </td>
                </tr>
              ) : (
                flaggedOnus.map((onu) => {
                  const isMissing = onu.run_state === 'missing';
                  const isUnmapped = !onu.customer_id;

                  return (
                    <tr key={onu.id} className="hover:bg-muted/30 transition-colors">
                      <td className="py-3 px-3 font-mono font-semibold text-foreground">
                        {onu.serial_number}
                      </td>

                      <td className="py-3 px-3">
                        <div className="font-medium text-foreground">{onu.olt_name || `OLT #${onu.olt_id}`}</div>
                        <div className="text-[10px] text-muted-foreground font-mono">
                          0/{onu.slot}/{onu.pon_port} : ONT {onu.ont_id}
                        </div>
                      </td>

                      <td className="py-3 px-3">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                            onu.run_state === 'online'
                              ? 'bg-emerald-500/10 text-emerald-600'
                              : onu.run_state === 'missing'
                              ? 'bg-rose-500/10 text-rose-600'
                              : 'bg-muted text-muted-foreground'
                          }`}
                        >
                          {onu.run_state.toUpperCase()}
                        </span>
                      </td>

                      <td className="py-3 px-3 font-mono text-muted-foreground">
                        {onu.config_state || 'unknown'}
                      </td>

                      <td className="py-3 px-3">
                        {onu.customer_username ? (
                          <span className="font-semibold text-foreground">{onu.customer_username}</span>
                        ) : (
                          <span className="text-amber-600 dark:text-amber-400 font-semibold text-[11px]">
                            Unassigned
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-3">
                        {isMissing ? (
                          <span className="text-rose-600 font-medium text-[11px] flex items-center gap-1">
                            <XCircle className="w-3 h-3 flex-shrink-0" />
                            Missing from hardware scan
                          </span>
                        ) : isUnmapped ? (
                          <span className="text-amber-600 font-medium text-[11px] flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3 flex-shrink-0" />
                            No customer linked
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-[11px]">Config failure</span>
                        )}
                      </td>

                      <td className="py-3 px-3 text-right">
                        <button
                          onClick={() => onNavigateToRegisteredOnus?.({ oltId: onu.olt_id })}
                          className="px-2.5 py-1 rounded-lg border border-border text-[11px] font-medium hover:bg-muted transition-colors"
                        >
                          Manage ONU
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
  );
}
