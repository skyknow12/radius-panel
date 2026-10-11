'use client';

import React from 'react';
import {
  Server,
  Plus,
  Search,
  RefreshCw,
  Activity,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Radio,
  Sliders,
  Trash2,
  Edit2,
  ExternalLink,
  ChevronRight,
  ShieldAlert,
  Zap,
} from 'lucide-react';
import type { OltItem } from '@/types/olt';

interface OltInventoryViewProps {
  onSelectOlt: (olt: OltItem) => void;
  onNavigateToProvision: (params?: number | { oltId?: number; slot?: number; port?: number; sn?: string }) => void;
  onNavigateToDiscovery: (oltId?: number) => void;
  currentUser?: any;
}

export function OltInventoryView({
  onSelectOlt,
  onNavigateToProvision,
  onNavigateToDiscovery,
  currentUser,
}: OltInventoryViewProps) {
  const [olts, setOlts] = React.useState<OltItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [search, setSearch] = React.useState('');
  const [testingId, setTestingId] = React.useState<number | null>(null);
  const [syncingId, setSyncingId] = React.useState<number | null>(null);
  const [notice, setNotice] = React.useState<{ text: string; error?: boolean } | null>(null);

  // Modal states
  const [showAddModal, setShowAddModal] = React.useState(false);
  const [editingOlt, setEditingOlt] = React.useState<OltItem | null>(null);
  const [deletingOlt, setDeletingOlt] = React.useState<OltItem | null>(null);

  // Form states
  const [formName, setFormName] = React.useState('');
  const [formVendor, setFormVendor] = React.useState('Huawei');
  const [formModel, setFormModel] = React.useState('MA5683T');
  const [formIp, setFormIp] = React.useState('');
  const [formPort, setFormPort] = React.useState('23');
  const [formProtocol, setFormProtocol] = React.useState<'telnet' | 'ssh'>('telnet');
  const [formUsername, setFormUsername] = React.useState('root');
  const [formPassword, setFormPassword] = React.useState('');
  const [formTimeout, setFormTimeout] = React.useState('5000');
  const [formWarningThreshold, setFormWarningThreshold] = React.useState('-25.0');
  const [formCriticalThreshold, setFormCriticalThreshold] = React.useState('-28.0');
  const [formSubmitting, setFormSubmitting] = React.useState(false);

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
      const sp = new URLSearchParams();
      if (search.trim()) sp.set('search', search.trim());

      const res = await fetch(`/api/olts?${sp.toString()}`, {
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        const json = await res.json();
        setOlts(json.data || []);
      } else {
        showMsg('Failed to load OLT inventory', true);
      }
    } catch {
      showMsg('Network error while loading OLT inventory', true);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchOlts();
  }, [search]);

  const handleTestCli = async (olt: OltItem, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      setTestingId(olt.id);
      const res = await fetch(`/api/olts/${olt.id}/test-cli`, {
        method: 'POST',
        headers: getAuthHeaders(),
      });
      const json = await res.json();
      if (res.ok && json.data?.success) {
        showMsg(`Connection test to ${olt.name} successful!`);
        fetchOlts();
      } else {
        showMsg(`Connection test to ${olt.name} failed: ${json.data?.message || 'Unreachable'}`, true);
      }
    } catch {
      showMsg('Failed to execute CLI test', true);
    } finally {
      setTestingId(null);
    }
  };

  const handleSync = async (olt: OltItem, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      setSyncingId(olt.id);
      const res = await fetch(`/api/olts/${olt.id}/sync`, {
        method: 'POST',
        headers: getAuthHeaders(),
      });
      const json = await res.json();
      if (res.ok) {
        showMsg(json.data?.message || `Synchronized ${olt.name}`);
        fetchOlts();
      } else {
        const err = json.error?.message || 'Sync failed';
        showMsg(`Sync failed on ${olt.name}: ${err}`, true);
      }
    } catch {
      showMsg('Failed to trigger synchronization', true);
    } finally {
      setSyncingId(null);
    }
  };

  const handleOpenAddModal = () => {
    setFormName('');
    setFormVendor('Huawei');
    setFormModel('MA5683T');
    setFormIp('');
    setFormPort('23');
    setFormProtocol('telnet');
    setFormUsername('root');
    setFormPassword('');
    setFormTimeout('5000');
    setFormWarningThreshold('-25.0');
    setFormCriticalThreshold('-28.0');
    setShowAddModal(true);
  };

  const handleOpenEditModal = (olt: OltItem, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingOlt(olt);
    setFormName(olt.name);
    setFormVendor(olt.vendor);
    setFormModel(olt.model);
    setFormIp(olt.management_ip);
    setFormPort(String(olt.management_port));
    setFormProtocol(olt.cli_protocol);
    setFormUsername(olt.cli_username);
    setFormPassword('');
    setFormTimeout(String(olt.connection_timeout));
    setFormWarningThreshold(String(olt.optical_warning_threshold));
    setFormCriticalThreshold(String(olt.optical_critical_threshold));
  };

  const handleSaveOlt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formIp.trim() || !formUsername.trim()) {
      showMsg('Please fill in all required fields', true);
      return;
    }
    if (!editingOlt && !formPassword.trim()) {
      showMsg('CLI password is required for new OLTs', true);
      return;
    }

    try {
      setFormSubmitting(true);
      const payload: any = {
        name: formName.trim(),
        vendor: formVendor,
        model: formModel,
        management_ip: formIp.trim(),
        management_port: parseInt(formPort, 10) || 23,
        cli_protocol: formProtocol,
        cli_username: formUsername.trim(),
        connection_timeout: parseInt(formTimeout, 10) || 5000,
        optical_warning_threshold: parseFloat(formWarningThreshold) || -25.0,
        optical_critical_threshold: parseFloat(formCriticalThreshold) || -28.0,
      };

      if (formPassword.trim()) {
        payload.cli_password = formPassword.trim();
      }

      const url = editingOlt ? `/api/olts/${editingOlt.id}` : '/api/olts';
      const method = editingOlt ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        showMsg(editingOlt ? 'OLT configuration updated successfully' : 'OLT registered successfully');
        setShowAddModal(false);
        setEditingOlt(null);
        fetchOlts();
      } else {
        const errJson = await res.json().catch(() => null);
        showMsg(errJson?.error?.message || 'Failed to save OLT configuration', true);
      }
    } catch {
      showMsg('Error submitting OLT configuration', true);
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleDeleteOlt = async () => {
    if (!deletingOlt) return;
    try {
      setFormSubmitting(true);
      const res = await fetch(`/api/olts/${deletingOlt.id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        showMsg(`OLT ${deletingOlt.name} removed successfully`);
        setDeletingOlt(null);
        fetchOlts();
      } else {
        const json = await res.json().catch(() => null);
        showMsg(json?.error?.message || 'Failed to delete OLT', true);
      }
    } catch {
      showMsg('Error removing OLT', true);
    } finally {
      setFormSubmitting(false);
    }
  };

  // Aggregate stats
  const totalOlts = olts.length;
  const onlineOlts = olts.filter((o) => o.connection_status === 'online').length;
  const totalOnus = olts.reduce((sum, o) => sum + (o.total_onus || 0), 0);
  const onlineOnus = olts.reduce((sum, o) => sum + (o.online_onus || 0), 0);

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
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

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-card border border-border shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Total OLT Chassis</span>
            <Server className="w-4 h-4 text-primary" />
          </div>
          <div className="mt-2 text-2xl font-bold text-foreground">{totalOlts}</div>
          <span className="text-[11px] text-muted-foreground">Managed Huawei units</span>
        </div>

        <div className="p-4 rounded-2xl bg-card border border-border shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Online OLTs</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-emerald-500">{onlineOlts}</div>
          <span className="text-[11px] text-muted-foreground">Reachable via Telnet/CLI</span>
        </div>

        <div className="p-4 rounded-2xl bg-card border border-border shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Registered ONUs</span>
            <Radio className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-indigo-500">{totalOnus}</div>
          <span className="text-[11px] text-muted-foreground">Across all PON ports</span>
        </div>

        <div className="p-4 rounded-2xl bg-card border border-border shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Online Optical Links</span>
            <Activity className="w-4 h-4 text-teal-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-teal-500">{onlineOnus}</div>
          <span className="text-[11px] text-muted-foreground">Active fiber subscribers</span>
        </div>
      </div>

      {/* Action & Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative flex-1 min-w-[260px] max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search OLT by name, IP, model..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-xl bg-card border border-border text-xs focus:ring-2 focus:ring-primary outline-none text-foreground placeholder:text-muted-foreground"
          />
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => onNavigateToDiscovery()}
            className="px-3.5 py-2 rounded-xl bg-card hover:bg-muted border border-border text-xs font-semibold text-foreground flex items-center gap-1.5 transition-all shadow-sm"
          >
            <Radio className="w-3.5 h-3.5 text-indigo-500" />
            Discover ONUs
          </button>

          <button
            onClick={() => onNavigateToProvision()}
            className="px-3.5 py-2 rounded-xl bg-card hover:bg-muted border border-border text-xs font-semibold text-foreground flex items-center gap-1.5 transition-all shadow-sm"
          >
            <Zap className="w-3.5 h-3.5 text-amber-500" />
            Provision Wizard
          </button>

          <button
            onClick={fetchOlts}
            disabled={loading}
            className="p-2 rounded-xl bg-card hover:bg-muted border border-border text-foreground transition-all"
            title="Refresh OLT List"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-primary' : ''}`} />
          </button>

          <button
            onClick={handleOpenAddModal}
            className="px-4 py-2 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold flex items-center gap-1.5 transition-all shadow-md shadow-primary/20"
          >
            <Plus className="w-4 h-4" />
            Add OLT Chassis
          </button>
        </div>
      </div>

      {/* OLT Inventory Table */}
      <div className="bg-card rounded-2xl border border-border overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-muted/50 border-b border-border text-muted-foreground uppercase tracking-wider text-[11px] font-semibold">
                <th className="py-3 px-4">OLT Name & Vendor</th>
                <th className="py-3 px-4">Branch Affiliation</th>
                <th className="py-3 px-4">Management IP & Port</th>
                <th className="py-3 px-4">Connection State</th>
                <th className="py-3 px-4">Registered ONUs</th>
                <th className="py-3 px-4">Online / Offline</th>
                <th className="py-3 px-4">Last Sync</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading && olts.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-muted-foreground">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-primary" />
                    Loading OLT inventory...
                  </td>
                </tr>
              ) : olts.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-muted-foreground">
                    <Server className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    <p className="font-semibold text-foreground text-sm">No OLT devices registered</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Add a Huawei MA5683T chassis to start managing GPON boards, discovery, and ONUs.
                    </p>
                    <button
                      onClick={handleOpenAddModal}
                      className="mt-3 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold inline-flex items-center gap-1.5"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add First OLT
                    </button>
                  </td>
                </tr>
              ) : (
                olts.map((olt) => {
                  const isOnline = olt.connection_status === 'online';
                  const isError = olt.connection_status === 'error';
                  const isTesting = testingId === olt.id;
                  const isSyncing = syncingId === olt.id;

                  return (
                    <tr
                      key={olt.id}
                      onClick={() => onSelectOlt(olt)}
                      className="hover:bg-muted/40 cursor-pointer transition-colors group"
                    >
                      <td className="py-3.5 px-4 font-semibold text-foreground">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary flex-shrink-0">
                            <Server className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="text-foreground font-bold group-hover:text-primary transition-colors flex items-center gap-1.5">
                              {olt.name}
                              <ChevronRight className="w-3 h-3 text-muted-foreground/60 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                            <div className="text-[11px] text-muted-foreground">
                              {olt.vendor} {olt.model}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-muted-foreground">
                        <span className="px-2 py-0.5 rounded-md bg-muted border border-border text-[11px] font-medium text-foreground">
                          {olt.branch_name || 'Organization-wide'}
                        </span>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="font-mono text-foreground font-medium">
                          {olt.management_ip}:{olt.management_port}
                        </div>
                        <div className="text-[10px] text-muted-foreground uppercase tracking-wider">
                          Protocol: {olt.cli_protocol}
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                            isOnline
                              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                              : isError
                              ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                              : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              isOnline ? 'bg-emerald-500' : isError ? 'bg-rose-500' : 'bg-amber-500'
                            }`}
                          />
                          {olt.connection_status.toUpperCase()}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 font-bold text-foreground">
                        {olt.total_onus || 0}
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <span className="text-emerald-500 font-semibold">{olt.online_onus || 0} on</span>
                          <span className="text-muted-foreground font-normal">/</span>
                          <span className="text-rose-400 font-semibold">{olt.offline_onus || 0} off</span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-muted-foreground text-[11px]">
                        {olt.last_sync_at ? new Date(olt.last_sync_at).toLocaleString() : 'Never'}
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={(e) => handleTestCli(olt, e)}
                            disabled={isTesting}
                            className="p-1.5 rounded-lg bg-muted hover:bg-primary hover:text-primary-foreground text-muted-foreground transition-all"
                            title="Test CLI Connectivity"
                          >
                            <Activity className={`w-3.5 h-3.5 ${isTesting ? 'animate-spin' : ''}`} />
                          </button>

                          <button
                            onClick={(e) => handleSync(olt, e)}
                            disabled={isSyncing}
                            className="p-1.5 rounded-lg bg-muted hover:bg-emerald-600 hover:text-white text-muted-foreground transition-all"
                            title="Synchronize Live Inventory"
                          >
                            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                          </button>

                          <button
                            onClick={(e) => handleOpenEditModal(olt, e)}
                            className="p-1.5 rounded-lg bg-muted hover:bg-indigo-600 hover:text-white text-muted-foreground transition-all"
                            title="Edit OLT Settings"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeletingOlt(olt);
                            }}
                            className="p-1.5 rounded-lg bg-muted hover:bg-rose-600 hover:text-white text-muted-foreground transition-all"
                            title="Remove OLT"
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
      </div>

      {/* Add / Edit OLT Modal */}
      {(showAddModal || editingOlt) && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <div>
                <h3 className="font-bold text-foreground text-sm">
                  {editingOlt ? `Edit OLT: ${editingOlt.name}` : 'Register Huawei OLT Chassis'}
                </h3>
                <p className="text-[11px] text-muted-foreground">
                  Provide management IP, credentials, and polling parameters
                </p>
              </div>
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setEditingOlt(null);
                }}
                className="text-muted-foreground hover:text-foreground font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveOlt} className="p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-[11px] font-semibold text-foreground mb-1 block">OLT Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Kathmandu-Core-OLT-1"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-card border border-border text-xs focus:ring-2 focus:ring-primary outline-none"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-foreground mb-1 block">Model</label>
                  <input
                    type="text"
                    value={formModel}
                    onChange={(e) => setFormModel(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-card border border-border text-xs focus:ring-2 focus:ring-primary outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2">
                  <label className="text-[11px] font-semibold text-foreground mb-1 block">Management IP *</label>
                  <input
                    type="text"
                    required
                    placeholder="192.168.100.1"
                    value={formIp}
                    onChange={(e) => setFormIp(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-card border border-border text-xs focus:ring-2 focus:ring-primary outline-none font-mono"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-foreground mb-1 block">Port</label>
                  <input
                    type="number"
                    value={formPort}
                    onChange={(e) => setFormPort(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-card border border-border text-xs focus:ring-2 focus:ring-primary outline-none font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="text-[11px] font-semibold text-foreground mb-1 block">CLI Protocol</label>
                  <select
                    value={formProtocol}
                    onChange={(e) => setFormProtocol(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl bg-card border border-border text-xs focus:ring-2 focus:ring-primary outline-none font-medium"
                  >
                    <option value="telnet">Telnet</option>
                    <option value="ssh">SSH</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-foreground mb-1 block">CLI Username *</label>
                  <input
                    type="text"
                    required
                    value={formUsername}
                    onChange={(e) => setFormUsername(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-card border border-border text-xs focus:ring-2 focus:ring-primary outline-none font-mono"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-foreground mb-1 block">
                    CLI Password {editingOlt ? '(leave blank to keep)' : '*'}
                  </label>
                  <input
                    type="password"
                    placeholder={editingOlt ? '••••••••' : 'Enter CLI password'}
                    value={formPassword}
                    onChange={(e) => setFormPassword(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-card border border-border text-xs focus:ring-2 focus:ring-primary outline-none font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-border">
                <div>
                  <label className="text-[11px] font-semibold text-foreground mb-1 block">
                    Optical Warning Threshold (dBm)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={formWarningThreshold}
                    onChange={(e) => setFormWarningThreshold(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-card border border-border text-xs focus:ring-2 focus:ring-primary outline-none font-mono"
                  />
                  <span className="text-[10px] text-muted-foreground">e.g. -25.0 dBm (Yellow alert)</span>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-foreground mb-1 block">
                    Optical Critical Threshold (dBm)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={formCriticalThreshold}
                    onChange={(e) => setFormCriticalThreshold(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-card border border-border text-xs focus:ring-2 focus:ring-primary outline-none font-mono"
                  />
                  <span className="text-[10px] text-muted-foreground">e.g. -28.0 dBm (Red alarm)</span>
                </div>
              </div>

              <div className="pt-4 border-t border-border flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false);
                    setEditingOlt(null);
                  }}
                  className="px-4 py-2 rounded-xl bg-muted hover:bg-muted/80 text-foreground text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="px-5 py-2 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold shadow-md shadow-primary/20 flex items-center gap-1.5"
                >
                  {formSubmitting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  {editingOlt ? 'Update Configuration' : 'Save OLT'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingOlt && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border w-full max-w-md rounded-2xl shadow-2xl p-6 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-500 flex items-center justify-center mx-auto">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div className="text-center">
              <h3 className="font-bold text-foreground text-base">Delete OLT Chassis</h3>
              <p className="text-xs text-muted-foreground mt-1">
                Are you sure you want to remove <strong className="text-foreground">{deletingOlt.name}</strong>?
                This will delete its registered ONU inventory records. Customers linked will have to be unlinked first.
              </p>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setDeletingOlt(null)}
                className="px-4 py-2 rounded-xl bg-muted hover:bg-muted/80 text-foreground text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteOlt}
                disabled={formSubmitting}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-md shadow-rose-600/20 flex items-center gap-1.5"
              >
                {formSubmitting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
