'use client';

import React from 'react';
import {
  Radio,
  Search,
  RefreshCw,
  Zap,
  CheckCircle2,
  AlertTriangle,
  Server,
  Layers,
  ArrowRight,
  Filter,
} from 'lucide-react';
import type { DiscoveredOnt, OltItem } from '@/types/olt';

interface OnuDiscoveryViewProps {
  onRegisterOnu: (params: { oltId: number; slot: number; port: number; sn: string }) => void;
  initialOltId?: number;
  currentUser?: any;
}

export function OnuDiscoveryView({
  onRegisterOnu,
  initialOltId,
  currentUser,
}: OnuDiscoveryViewProps) {
  const [olts, setOlts] = React.useState<OltItem[]>([]);
  const [selectedOltId, setSelectedOltId] = React.useState<number | ''>(initialOltId || '');
  const [discoveredList, setDiscoveredList] = React.useState<DiscoveredOnt[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [search, setSearch] = React.useState('');
  const [portFilter, setPortFilter] = React.useState<string>('all');
  const [notice, setNotice] = React.useState<{ text: string; error?: boolean } | null>(null);

  const getAuthHeaders = (): Record<string, string> => {
    if (typeof window === 'undefined') return {};
    const token = localStorage.getItem('radius_token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const showMsg = (text: string, error = false) => {
    setNotice({ text, error });
    setTimeout(() => setNotice(null), 5000);
  };

  // Fetch OLTs for dropdown
  React.useEffect(() => {
    const fetchOlts = async () => {
      try {
        const res = await fetch('/api/olts', { headers: getAuthHeaders() });
        if (res.ok) {
          const json = await res.json();
          setOlts(json.data || []);
          if (!selectedOltId && json.data?.length > 0) {
            setSelectedOltId(json.data[0].id);
          }
        }
      } catch {}
    };
    fetchOlts();
  }, []);

  const handleDiscover = async () => {
    if (!selectedOltId) {
      showMsg('Please select an OLT chassis first', true);
      return;
    }

    try {
      setLoading(true);
      const res = await fetch(`/api/olts/${selectedOltId}/discover`, {
        headers: getAuthHeaders(),
      });
      const json = await res.json();
      if (res.ok) {
        setDiscoveredList(json.data || []);
        if ((json.data || []).length === 0) {
          showMsg('Autofind completed: No unregistered ONUs currently detected.');
        } else {
          showMsg(`Autofind completed: Found ${json.data.length} unregistered ONUs`);
        }
      } else {
        showMsg(json.error?.message || 'Failed to query autofind ONUs', true);
      }
    } catch {
      showMsg('Network error executing autofind query', true);
    } finally {
      setLoading(false);
    }
  };

  // Run initial discover when OLT selected
  React.useEffect(() => {
    if (selectedOltId) {
      handleDiscover();
    }
  }, [selectedOltId]);

  const filtered = discoveredList.filter((d) => {
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      const snMatch = d.serialNumber.toLowerCase().includes(q);
      const eqMatch = (d.equipmentId || '').toLowerCase().includes(q);
      if (!snMatch && !eqMatch) return false;
    }
    if (portFilter !== 'all' && String(d.ponPort) !== portFilter) {
      return false;
    }
    return true;
  });

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

      {/* Header banner */}
      <div className="bg-card rounded-2xl border border-border p-6 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Radio className="w-5 h-5 text-indigo-500" />
            <h2 className="text-xl font-bold text-foreground">Unregistered ONU Discovery (Autofind)</h2>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Scans GPON transceiver ports for newly attached optical subscriber terminals without modifying OLT configuration.
          </p>
        </div>

        <button
          onClick={handleDiscover}
          disabled={loading || !selectedOltId}
          className="px-5 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs flex items-center gap-2 shadow-lg shadow-primary/20 transition-all disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          {loading ? 'Scanning OLT Ports...' : 'DISCOVER NEW ONUs'}
        </button>
      </div>

      {/* Control & Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-card p-4 rounded-2xl border border-border">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-xs">
            <span className="font-semibold text-muted-foreground flex items-center gap-1">
              <Server className="w-3.5 h-3.5" />
              Target OLT:
            </span>
            <select
              value={selectedOltId}
              onChange={(e) => setSelectedOltId(Number(e.target.value))}
              className="px-3 py-1.5 rounded-xl bg-muted/60 border border-border text-xs font-semibold text-foreground outline-none"
            >
              {olts.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name} ({o.management_ip})
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="font-semibold text-muted-foreground flex items-center gap-1">
              <Layers className="w-3.5 h-3.5" />
              PON Port:
            </span>
            <select
              value={portFilter}
              onChange={(e) => setPortFilter(e.target.value)}
              className="px-3 py-1.5 rounded-xl bg-muted/60 border border-border text-xs font-semibold text-foreground outline-none"
            >
              <option value="all">All Ports</option>
              {Array.from({ length: 16 }, (_, p) => (
                <option key={p} value={String(p)}>
                  Port {p}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="relative min-w-[240px]">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by SN or equipment ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-muted/40 border border-border text-xs focus:ring-2 focus:ring-primary outline-none"
          />
        </div>
      </div>

      {/* Discovered ONUs Table */}
      <div className="bg-card rounded-2xl border border-border overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-muted/50 border-b border-border text-muted-foreground uppercase tracking-wider text-[11px] font-semibold">
                <th className="py-3 px-4">Serial Number</th>
                <th className="py-3 px-4">PON Location (F/S/P)</th>
                <th className="py-3 px-4">Vendor ID</th>
                <th className="py-3 px-4">Equipment ID / Model</th>
                <th className="py-3 px-4">Autofind Detected At</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-muted-foreground">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-primary" />
                    Executing <code>display ont autofind all</code> on OLT...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center text-muted-foreground">
                    <CheckCircle2 className="w-10 h-10 text-emerald-500/40 mx-auto mb-3" />
                    <p className="font-bold text-foreground text-base">No unregistered ONUs currently detected.</p>
                    <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
                      All connected optical terminal devices are registered, or no new unprovisioned ONUs are broadcasting on the configured GPON splitters.
                    </p>
                    <button
                      onClick={handleDiscover}
                      className="mt-4 px-4 py-2 rounded-xl bg-muted hover:bg-muted/80 text-foreground font-semibold text-xs inline-flex items-center gap-1.5"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      Scan Again
                    </button>
                  </td>
                </tr>
              ) : (
                filtered.map((d) => (
                  <tr key={d.serialNumber} className="hover:bg-muted/30 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-foreground text-sm">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                        {d.serialNumber}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-foreground font-semibold">
                      0/{d.slot}/{d.ponPort}
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-foreground">
                      <span className="px-2 py-0.5 rounded-md bg-muted border border-border text-[11px]">
                        {d.vendorId || 'Huawei'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-muted-foreground font-medium">
                      {d.equipmentId || 'EchoLife ONT'}
                    </td>
                    <td className="py-3.5 px-4 text-muted-foreground text-[11px]">
                      {d.discoveryTime || 'Just now'}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() =>
                          onRegisterOnu({
                            oltId: Number(selectedOltId),
                            slot: d.slot,
                            port: d.ponPort,
                            sn: d.serialNumber,
                          })
                        }
                        className="px-4 py-1.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs inline-flex items-center gap-1.5 shadow-sm transition-all"
                      >
                        <Zap className="w-3.5 h-3.5" />
                        Register ONU
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
