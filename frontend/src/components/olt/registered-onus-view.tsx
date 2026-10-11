'use client';

import React from 'react';
import {
  Radio,
  Search,
  RefreshCw,
  Signal,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Server,
  Trash2,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Sliders,
  History,
} from 'lucide-react';
import type { OnuItem, OltItem, OpticalHistoryItem } from '@/types/olt';

interface RegisteredOnusViewProps {
  onOpenCustomer?: (customerId: number) => void;
  currentUser?: any;
}

export function RegisteredOnusView({
  onOpenCustomer,
  currentUser,
}: RegisteredOnusViewProps) {
  const [onus, setOnus] = React.useState<OnuItem[]>([]);
  const [olts, setOlts] = React.useState<OltItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [search, setSearch] = React.useState('');
  const [selectedOltId, setSelectedOltId] = React.useState<string>('all');
  const [runStateFilter, setRunStateFilter] = React.useState<string>('all');
  const [page, setPage] = React.useState(1);
  const [totalPages, setTotalPages] = React.useState(1);
  const [totalCount, setTotalCount] = React.useState(0);
  const [notice, setNotice] = React.useState<{ text: string; error?: boolean } | null>(null);

  // Optical Inspection Drawer
  const [inspectingOnu, setInspectingOnu] = React.useState<OnuItem | null>(null);
  const [opticalHistory, setOpticalHistory] = React.useState<OpticalHistoryItem[]>([]);
  const [readingOptical, setReadingOptical] = React.useState(false);
  const [opticalHistoryLoading, setOpticalHistoryLoading] = React.useState(false);

  // Deletion Modal
  const [deletingOnu, setDeletingOnu] = React.useState<OnuItem | null>(null);
  const [deletingLoading, setDeletingLoading] = React.useState(false);

  const getAuthHeaders = (): Record<string, string> => {
    if (typeof window === 'undefined') return {};
    const token = localStorage.getItem('radius_token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const showMsg = (text: string, error = false) => {
    setNotice({ text, error });
    setTimeout(() => setNotice(null), 5000);
  };

  // Fetch OLTs
  React.useEffect(() => {
    const fetchOlts = async () => {
      try {
        const res = await fetch('/api/olts', { headers: getAuthHeaders() });
        if (res.ok) {
          const json = await res.json();
          setOlts(json.data || []);
        }
      } catch {}
    };
    fetchOlts();
  }, []);

  // Fetch registered ONUs
  const fetchOnus = async (targetPage = page) => {
    try {
      setLoading(true);
      const sp = new URLSearchParams();
      sp.set('page', String(targetPage));
      sp.set('limit', '25');
      if (selectedOltId !== 'all') sp.set('olt_id', selectedOltId);
      if (runStateFilter !== 'all') sp.set('run_state', runStateFilter);
      if (search.trim()) sp.set('search', search.trim());

      const res = await fetch(`/api/onus?${sp.toString()}`, {
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        const json = await res.json();
        setOnus(json.data || []);
        if (json.meta) {
          setTotalCount(json.meta.total || 0);
          setTotalPages(Math.ceil((json.meta.total || 0) / 25) || 1);
          setPage(json.meta.page || 1);
        }
      } else {
        showMsg('Failed to load registered ONUs', true);
      }
    } catch {
      showMsg('Network error loading registered ONUs', true);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchOnus(1);
  }, [selectedOltId, runStateFilter, search]);

  // Read Live Optical Power
  const handleReadLiveOptical = async (onu: OnuItem) => {
    try {
      setReadingOptical(true);
      const res = await fetch(`/api/olts/${onu.olt_id}/onus/${onu.id}/optical`, {
        headers: getAuthHeaders(),
      });
      const json = await res.json();
      if (res.ok) {
        showMsg(
          json.data?.isAvailable
            ? `Optical power: Rx ${json.data.rxPower} dBm, Tx ${json.data.txPower} dBm`
            : 'Optical power query returned unavailable'
        );
        fetchOnus(page);
        if (inspectingOnu?.id === onu.id) {
          fetchOpticalHistory(onu.id);
        }
      } else {
        showMsg('Failed to query optical parameters', true);
      }
    } catch {
      showMsg('Error querying optical power', true);
    } finally {
      setReadingOptical(false);
    }
  };

  // Fetch optical history
  const fetchOpticalHistory = async (onuId: number) => {
    try {
      setOpticalHistoryLoading(true);
      const res = await fetch(`/api/onus/${onuId}/optical-history`, {
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        const json = await res.json();
        setOpticalHistory(json.data || []);
      }
    } catch {} finally {
      setOpticalHistoryLoading(false);
    }
  };

  const handleOpenOpticalDrawer = (onu: OnuItem) => {
    setInspectingOnu(onu);
    fetchOpticalHistory(onu.id);
  };

  // Delete ONU
  const handleDeleteOnu = async () => {
    if (!deletingOnu) return;
    try {
      setDeletingLoading(true);
      const res = await fetch(`/api/olts/${deletingOnu.olt_id}/onus/${deletingOnu.id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        showMsg(`ONU ${deletingOnu.serial_number} deleted from OLT successfully`);
        setDeletingOnu(null);
        fetchOnus(page);
      } else {
        const json = await res.json().catch(() => null);
        showMsg(json?.error?.message || 'Failed to remove ONU from OLT', true);
      }
    } catch {
      showMsg('Error removing ONU', true);
    } finally {
      setDeletingLoading(false);
    }
  };

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
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Radio className="w-5 h-5 text-primary" />
            <h2 className="text-xl font-bold text-foreground">Registered ONUs Inventory</h2>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Complete database of active, provisioned fiber terminal units across all configured OLTs
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchOnus(page)}
            disabled={loading}
            className="p-2 rounded-xl bg-card hover:bg-muted border border-border text-foreground transition-all"
            title="Refresh list"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-primary' : ''}`} />
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-card p-4 rounded-2xl border border-border">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-xs">
            <span className="font-semibold text-muted-foreground flex items-center gap-1">
              <Server className="w-3.5 h-3.5" />
              OLT:
            </span>
            <select
              value={selectedOltId}
              onChange={(e) => setSelectedOltId(e.target.value)}
              className="px-3 py-1.5 rounded-xl bg-muted/60 border border-border text-xs font-semibold text-foreground outline-none"
            >
              <option value="all">All OLTs</option>
              {olts.map((o) => (
                <option key={o.id} value={String(o.id)}>
                  {o.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="font-semibold text-muted-foreground flex items-center gap-1">
              <Signal className="w-3.5 h-3.5" />
              State:
            </span>
            <select
              value={runStateFilter}
              onChange={(e) => setRunStateFilter(e.target.value)}
              className="px-3 py-1.5 rounded-xl bg-muted/60 border border-border text-xs font-semibold text-foreground outline-none"
            >
              <option value="all">All States</option>
              <option value="online">Online</option>
              <option value="offline">Offline</option>
              <option value="missing">Missing</option>
            </select>
          </div>
        </div>

        <div className="relative min-w-[260px]">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search SN, username, customer name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-muted/40 border border-border text-xs focus:ring-2 focus:ring-primary outline-none"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-card rounded-2xl border border-border overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-muted/50 border-b border-border text-muted-foreground uppercase tracking-wider text-[11px] font-semibold">
                <th className="py-3 px-4">Serial Number</th>
                <th className="py-3 px-4">OLT & Location</th>
                <th className="py-3 px-4">Associated Subscriber</th>
                <th className="py-3 px-4">Run State</th>
                <th className="py-3 px-4">Rx Power</th>
                <th className="py-3 px-4">Profiles (Line/Srv)</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading && onus.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-muted-foreground">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-primary" />
                    Loading registered ONUs...
                  </td>
                </tr>
              ) : onus.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-muted-foreground">
                    <Radio className="w-8 h-8 opacity-40 mx-auto mb-2" />
                    <p className="font-semibold text-foreground text-sm">No registered ONUs found</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Run discovery on an OLT to find and provision connected ONUs.
                    </p>
                  </td>
                </tr>
              ) : (
                onus.map((onu) => {
                  const isOnline = onu.run_state === 'online';
                  const rxPower = onu.last_rx_power;

                  let rxColor = 'text-muted-foreground';
                  if (rxPower !== null && rxPower !== undefined) {
                    if (rxPower >= -25.0) rxColor = 'text-emerald-500 font-bold';
                    else if (rxPower >= -28.0) rxColor = 'text-amber-500 font-bold';
                    else rxColor = 'text-rose-500 font-bold';
                  }

                  return (
                    <tr key={onu.id} className="hover:bg-muted/30 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-bold text-foreground">
                        {onu.serial_number}
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-foreground">{onu.olt_name}</div>
                        <div className="font-mono text-[11px] text-muted-foreground">
                          0/{onu.slot}/{onu.pon_port} : ID {onu.ont_id}
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        {onu.customer_username ? (
                          <div>
                            <button
                              onClick={() => onu.customer_id && onOpenCustomer?.(onu.customer_id)}
                              className="font-bold text-primary hover:underline flex items-center gap-1"
                            >
                              {onu.customer_username}
                              <ExternalLink className="w-3 h-3" />
                            </button>
                            <span className="text-[11px] text-muted-foreground">{onu.customer_name}</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground italic">Unassigned</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            isOnline
                              ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                              : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                          }`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-emerald-500' : 'bg-rose-400'}`} />
                          {onu.run_state.toUpperCase()}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 font-mono">
                        <span className={rxColor}>
                          {rxPower !== null && rxPower !== undefined ? `${rxPower} dBm` : '—'}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-muted-foreground text-[11px] font-mono">
                        L:{onu.line_profile_id || 2} / S:{onu.service_profile_id || 2}
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleOpenOpticalDrawer(onu)}
                            className="p-1.5 rounded-lg bg-muted hover:bg-primary hover:text-primary-foreground text-muted-foreground transition-all"
                            title="Inspect Optical Power History"
                          >
                            <Signal className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => setDeletingOnu(onu)}
                            className="p-1.5 rounded-lg bg-muted hover:bg-rose-600 hover:text-white text-muted-foreground transition-all"
                            title="Delete / Unregister ONU"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
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

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
            <div>
              Showing page {page} of {totalPages} ({totalCount} total ONUs)
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => fetchOnus(Math.max(1, page - 1))}
                disabled={page <= 1}
                className="p-1.5 rounded-lg bg-muted hover:bg-muted/80 disabled:opacity-40"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => fetchOnus(Math.min(totalPages, page + 1))}
                disabled={page >= totalPages}
                className="p-1.5 rounded-lg bg-muted hover:bg-muted/80 disabled:opacity-40"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Optical Power Inspection Drawer */}
      {inspectingOnu && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border w-full max-w-lg rounded-2xl shadow-2xl p-6 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h3 className="font-bold text-foreground text-base">Optical Power Diagnostics</h3>
                <p className="text-xs text-muted-foreground font-mono">
                  SN: {inspectingOnu.serial_number} • 0/{inspectingOnu.slot}/{inspectingOnu.pon_port}:{inspectingOnu.ont_id}
                </p>
              </div>
              <button onClick={() => setInspectingOnu(null)} className="font-bold text-muted-foreground hover:text-foreground">
                ✕
              </button>
            </div>

            <div className="flex items-center justify-between p-3.5 rounded-xl bg-muted/40 border border-border">
              <div>
                <span className="text-[11px] text-muted-foreground block">Current Rx Power</span>
                <span className="text-xl font-bold font-mono text-foreground mt-0.5 block">
                  {inspectingOnu.last_rx_power !== null && inspectingOnu.last_rx_power !== undefined
                    ? `${inspectingOnu.last_rx_power} dBm`
                    : 'Not sampled'}
                </span>
              </div>
              <button
                onClick={() => handleReadLiveOptical(inspectingOnu)}
                disabled={readingOptical}
                className="px-3 py-1.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs flex items-center gap-1.5 shadow-sm"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${readingOptical ? 'animate-spin' : ''}`} />
                {readingOptical ? 'Reading...' : 'Sample Now'}
              </button>
            </div>

            <div className="space-y-2">
              <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <History className="w-3.5 h-3.5 text-primary" />
                Recent Optical Telemetry History
              </h4>
              <div className="max-h-56 overflow-y-auto divide-y divide-border border border-border rounded-xl">
                {opticalHistoryLoading ? (
                  <div className="py-6 text-center text-muted-foreground text-xs">
                    <RefreshCw className="w-4 h-4 animate-spin mx-auto mb-1 text-primary" />
                    Loading telemetry...
                  </div>
                ) : opticalHistory.length === 0 ? (
                  <div className="py-6 text-center text-muted-foreground text-xs">
                    No historical readings stored yet.
                  </div>
                ) : (
                  opticalHistory.map((h) => (
                    <div key={h.id} className="p-2.5 flex items-center justify-between text-xs hover:bg-muted/20">
                      <div>
                        <span className="font-mono font-bold text-foreground block">
                          Rx: {h.rx_power ?? '—'} dBm / Tx: {h.tx_power ?? '—'} dBm
                        </span>
                        <span className="text-[10px] text-muted-foreground">{new Date(h.collected_at).toLocaleString()}</span>
                      </div>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-muted text-muted-foreground font-semibold uppercase">
                        {h.source}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setInspectingOnu(null)}
                className="px-4 py-2 rounded-xl bg-muted hover:bg-muted/80 text-foreground text-xs font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingOnu && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border w-full max-w-md rounded-2xl shadow-2xl p-6 space-y-4">
            <div className="text-center">
              <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-500 flex items-center justify-center mx-auto mb-2">
                <Trash2 className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-foreground text-base">Unregister & Delete ONU</h3>
              <p className="text-xs text-muted-foreground mt-1">
                Are you sure you want to remove ONU <strong className="text-foreground">{deletingOnu.serial_number}</strong> from OLT {deletingOnu.olt_name}?
                This will execute <code>ont delete</code> and remove associated service ports on the OLT. Customer accounts and FreeRADIUS records will remain untouched.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setDeletingOnu(null)}
                className="px-4 py-2 rounded-xl bg-muted hover:bg-muted/80 text-foreground text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteOnu}
                disabled={deletingLoading}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-rose-600/20"
              >
                {deletingLoading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                Confirm Deletion
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
