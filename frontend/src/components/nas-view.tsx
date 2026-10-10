'use client';

import React from 'react';
import {
  Server,
  Plus,
  Search,
  Activity,
  Edit2,
  Trash2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  ExternalLink,
  Shield,
  Radio,
  Lock,
  Layers,
} from 'lucide-react';
import type { NasDeviceItem } from '@/types/api';

interface NasViewProps {
  onViewSessions?: (nasIp: string) => void;
}

export function NasView({ onViewSessions }: NasViewProps) {
  const [devices, setDevices] = React.useState<NasDeviceItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [search, setSearch] = React.useState('');
  const [modalOpen, setModalOpen] = React.useState(false);
  const [editingDevice, setEditingDevice] = React.useState<NasDeviceItem | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = React.useState<number | null>(null);
  const [testingId, setTestingId] = React.useState<number | null>(null);
  const [testResult, setTestResult] = React.useState<{ id: number; message: string; success: boolean } | null>(null);

  // Form state
  const [formName, setFormName] = React.useState('');
  const [formIp, setFormIp] = React.useState('');
  const [formType, setFormType] = React.useState('mikrotik');
  const [formVendor, setFormVendor] = React.useState('mikrotik');
  const [formModel, setFormModel] = React.useState('');
  const [formOsVersion, setFormOsVersion] = React.useState('');
  const [formDynamicProfile, setFormDynamicProfile] = React.useState('');
  const [formCoaEnabled, setFormCoaEnabled] = React.useState(true);
  const [formSecret, setFormSecret] = React.useState('');
  const [formLocation, setFormLocation] = React.useState('');
  const [formDescription, setFormDescription] = React.useState('');
  const [formCoaPort, setFormCoaPort] = React.useState(3799);
  const [formStatus, setFormStatus] = React.useState<'online' | 'warning' | 'offline' | 'unknown'>('online');
  const [formError, setFormError] = React.useState<string | null>(null);
  const [formSubmitting, setFormSubmitting] = React.useState(false);

  const fetchNasDevices = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/nas');
      if (res.ok) {
        const json = await res.json();
        setDevices(json.data || []);
      }
    } catch {
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchNasDevices();
  }, []);

  const openAddModal = () => {
    setEditingDevice(null);
    setFormName('');
    setFormIp('');
    setFormType('mikrotik');
    setFormVendor('mikrotik');
    setFormModel('');
    setFormOsVersion('');
    setFormDynamicProfile('');
    setFormCoaEnabled(true);
    setFormSecret('');
    setFormLocation('');
    setFormDescription('');
    setFormCoaPort(3799);
    setFormStatus('online');
    setFormError(null);
    setModalOpen(true);
  };

  const openEditModal = (dev: NasDeviceItem) => {
    setEditingDevice(dev);
    setFormName(dev.name);
    setFormIp(dev.ip_address);
    setFormType(dev.nas_type);
    setFormVendor(dev.vendor || (dev.nas_type === 'juniper' ? 'juniper' : dev.nas_type === 'cisco' ? 'cisco' : dev.nas_type === 'huawei' ? 'huawei' : 'mikrotik'));
    setFormModel(dev.model || '');
    setFormOsVersion(dev.os_version || '');
    setFormDynamicProfile(dev.dynamic_profile_name || '');
    setFormCoaEnabled(dev.coa_enabled ?? true);
    setFormSecret(''); // Keep blank unless changing
    setFormLocation(dev.location || '');
    setFormDescription(dev.description || '');
    setFormCoaPort(dev.coa_port || 3799);
    setFormStatus(dev.status);
    setFormError(null);
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    // Validation
    if (!formName.trim()) {
      setFormError('NAS Name is required');
      return;
    }
    const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    if (!ipRegex.test(formIp.trim())) {
      setFormError('Valid IPv4 address required (e.g. 100.97.0.34)');
      return;
    }
    if (!editingDevice && !formSecret.trim()) {
      setFormError('RADIUS Shared Secret is required for new NAS');
      return;
    }

    try {
      setFormSubmitting(true);
      const token = typeof window !== 'undefined' ? localStorage.getItem('radius_token') : null;
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const payload = {
        name: formName.trim(),
        ip_address: formIp.trim(),
        nas_type: formType,
        vendor: formVendor,
        model: formModel.trim() || undefined,
        os_version: formOsVersion.trim() || undefined,
        dynamic_profile_name: formDynamicProfile.trim() || undefined,
        coa_enabled: formCoaEnabled,
        secret: formSecret.trim() || undefined,
        location: formLocation.trim() || undefined,
        description: formDescription.trim() || undefined,
        coa_port: Number(formCoaPort) || 3799,
        status: formStatus,
      };

      const url = editingDevice ? `/api/nas/${editingDevice.id}` : '/api/nas';
      const method = editingDevice ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers,
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error?.message || json.message || 'Failed to save NAS device');
      }

      setModalOpen(false);
      fetchNasDevices();
    } catch (err: any) {
      setFormError(err.message || 'Failed to save NAS');
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('radius_token') : null;
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`/api/nas/${id}`, { method: 'DELETE', headers });
      if (res.ok) {
        setDeleteConfirmId(null);
        fetchNasDevices();
      }
    } catch {}
  };

  const handleTestProbe = async (id: number) => {
    try {
      setTestingId(id);
      setTestResult(null);
      const token = typeof window !== 'undefined' ? localStorage.getItem('radius_token') : null;
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`/api/nas/${id}/test`, { method: 'POST', headers });
      const json = await res.json();
      setTestResult({
        id,
        message: json.data?.message || (json.data?.success ? 'Probe successful' : 'Probe failed'),
        success: Boolean(json.data?.success),
      });
    } catch (err: any) {
      setTestResult({
        id,
        message: `Probe error: ${err.message}`,
        success: false,
      });
    } finally {
      setTestingId(null);
    }
  };

  const filtered = devices.filter(
    (d) =>
      d.name.toLowerCase().includes(search.toLowerCase()) ||
      d.ip_address.includes(search) ||
      (d.description && d.description.toLowerCase().includes(search.toLowerCase())) ||
      (d.location && d.location.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      {/* Top Banner & Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Server className="w-5 h-5 text-primary" />
            <span>NAS Devices & BNG Routers</span>
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Manage carrier BRAS, MikroTik routers, and BNG clients synchronized with FreeRADIUS SQL.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={fetchNasDevices}
            disabled={loading}
            className="p-2 rounded-xl border border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground text-xs font-medium flex items-center gap-1.5 transition-colors"
            title="Refresh NAS list"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
          <button
            onClick={openAddModal}
            className="px-3.5 py-2 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-semibold flex items-center gap-2 shadow-md shadow-primary/20 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Add NAS</span>
          </button>
        </div>
      </div>

      {/* Filter / Search Bar */}
      <div className="flex items-center justify-between gap-4 p-3 rounded-xl border border-border bg-card/60 backdrop-blur-sm">
        <div className="relative w-full max-w-sm">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search NAS by name, IP, location..."
            className="w-full bg-muted/50 border border-border rounded-lg pl-9 pr-4 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all"
          />
        </div>
        <div className="text-xs text-muted-foreground font-medium">
          Total Devices: <span className="text-foreground font-semibold">{devices.length}</span>
        </div>
      </div>

      {/* Test Result Toast */}
      {testResult && (
        <div
          className={`p-3 rounded-xl text-xs flex items-center justify-between border ${
            testResult.success
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-500'
          }`}
        >
          <div className="flex items-center gap-2">
            {testResult.success ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
            <span>{testResult.message}</span>
          </div>
          <button onClick={() => setTestResult(null)} className="opacity-70 hover:opacity-100 text-xs font-semibold">
            Dismiss
          </button>
        </div>
      )}

      {/* Table */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-muted-foreground font-semibold">
                <th className="py-3 px-4">Name</th>
                <th className="py-3 px-4">IP Address</th>
                <th className="py-3 px-4">Vendor & Profile</th>
                <th className="py-3 px-4">Location / Description</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Active Sessions</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {loading && devices.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-muted-foreground">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-primary" />
                    <span>Loading NAS inventory...</span>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-muted-foreground">
                    No NAS devices found matching your criteria.
                  </td>
                </tr>
              ) : (
                filtered.map((dev) => {
                  const isOnline = dev.status === 'online';
                  const isWarning = dev.status === 'warning';
                  const isJuniper = dev.vendor === 'juniper' || dev.nas_type === 'juniper';
                  const isMikrotik = dev.vendor === 'mikrotik' || dev.nas_type === 'mikrotik';
                  const isCisco = dev.vendor === 'cisco' || dev.nas_type === 'cisco';
                  return (
                    <tr key={dev.id} className="hover:bg-muted/40 transition-colors group">
                      <td className="py-3 px-4 font-semibold text-foreground flex items-center gap-2">
                        <Server className="w-4 h-4 text-primary shrink-0" />
                        <span>{dev.name}</span>
                      </td>
                      <td className="py-3 px-4 font-mono text-muted-foreground">
                        {dev.ip_address}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex flex-col gap-1 items-start">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-semibold border ${
                              isJuniper
                                ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                                : isMikrotik
                                ? 'bg-sky-500/15 text-sky-600 dark:text-sky-400 border-sky-500/30'
                                : isCisco
                                ? 'bg-orange-500/15 text-orange-600 dark:text-orange-400 border-orange-500/30'
                                : 'bg-muted text-foreground border-border'
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                isJuniper ? 'bg-emerald-500' : isMikrotik ? 'bg-sky-500' : isCisco ? 'bg-orange-500' : 'bg-muted-foreground'
                              }`}
                            />
                            {isJuniper ? 'Juniper BNG' : isMikrotik ? 'MikroTik' : isCisco ? 'Cisco' : dev.vendor || dev.nas_type}
                          </span>
                          {dev.model && (
                            <span className="text-[10px] text-muted-foreground font-mono">
                              {dev.model} {dev.os_version ? `(${dev.os_version})` : ''}
                            </span>
                          )}
                          {dev.dynamic_profile_name && (
                            <span className="text-[10px] text-primary font-mono bg-primary/10 px-1 rounded border border-primary/20">
                              Profile: {dev.dynamic_profile_name}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-muted-foreground">
                        <div>{dev.location || '-'}</div>
                        {dev.description && <div className="text-[10px] text-muted-foreground/70">{dev.description}</div>}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium border ${
                            isOnline
                              ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                              : isWarning
                              ? 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                              : 'bg-rose-500/10 text-rose-500 border-rose-500/20'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              isOnline ? 'bg-emerald-500' : isWarning ? 'bg-amber-500' : 'bg-rose-500'
                            }`}
                          />
                          <span className="capitalize">{dev.status}</span>
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono font-medium text-foreground">
                        <span className="px-2 py-0.5 rounded-md bg-primary/10 text-primary border border-primary/20">
                          {dev.sessions.toLocaleString()}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Test probe */}
                          <button
                            onClick={() => handleTestProbe(dev.id)}
                            disabled={testingId === dev.id}
                            className="p-1.5 rounded-lg border border-border hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                            title="Test Connection Probe"
                          >
                            <Activity className={`w-3.5 h-3.5 ${testingId === dev.id ? 'animate-spin text-primary' : ''}`} />
                          </button>

                          {/* View sessions */}
                          {onViewSessions && (
                            <button
                              onClick={() => onViewSessions(dev.ip_address)}
                              className="p-1.5 rounded-lg border border-border hover:bg-muted text-muted-foreground hover:text-primary transition-colors"
                              title="View Active Sessions on this NAS"
                            >
                              <Layers className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {/* Edit */}
                          <button
                            onClick={() => openEditModal(dev)}
                            className="p-1.5 rounded-lg border border-border hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                            title="Edit NAS"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          {/* Delete */}
                          {deleteConfirmId === dev.id ? (
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => handleDelete(dev.id)}
                                className="px-2 py-1 rounded bg-rose-500 text-white font-semibold text-[10px] hover:bg-rose-600"
                              >
                                Confirm
                              </button>
                              <button
                                onClick={() => setDeleteConfirmId(null)}
                                className="px-2 py-1 rounded bg-muted text-muted-foreground hover:text-foreground text-[10px]"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setDeleteConfirmId(dev.id)}
                              className="p-1.5 rounded-lg border border-border hover:bg-rose-500/10 text-muted-foreground hover:text-rose-500 transition-colors"
                              title="Delete NAS"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
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

      {/* Add / Edit NAS Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-md animate-in fade-in duration-150">
          <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-border">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                  <Server className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground">
                    {editingDevice ? `Edit NAS: ${editingDevice.name}` : 'Add New NAS Router'}
                  </h3>
                  <p className="text-[11px] text-muted-foreground">
                    Synchronizes directly with FreeRADIUS SQL client database
                  </p>
                </div>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                className="text-muted-foreground hover:text-foreground text-sm p-1.5 rounded-lg hover:bg-muted"
              >
                ✕
              </button>
            </div>

            {formError && (
              <div className="mt-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSave} className="mt-4 space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-medium text-foreground mb-1">
                    NAS Short Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="FW-BNG-01"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    className="w-full bg-muted/50 border border-border rounded-xl px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
                  />
                </div>

                <div>
                  <label className="block font-medium text-foreground mb-1">
                    NAS IP Address *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="100.97.0.34"
                    value={formIp}
                    onChange={(e) => setFormIp(e.target.value)}
                    className="w-full bg-muted/50 border border-border rounded-xl px-3 py-2 text-foreground font-mono focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-medium text-foreground mb-1">
                    Vendor / Architecture *
                  </label>
                  <select
                    value={formVendor}
                    onChange={(e) => {
                      const v = e.target.value;
                      setFormVendor(v);
                      if (v === 'juniper') setFormType('juniper');
                      else if (v === 'mikrotik') setFormType('mikrotik');
                      else if (v === 'cisco') setFormType('cisco');
                      else if (v === 'huawei') setFormType('huawei');
                      else setFormType('other');
                    }}
                    className="w-full bg-muted/50 border border-border rounded-xl px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary font-medium"
                  >
                    <option value="juniper">Juniper Networks (MX / Junos BNG)</option>
                    <option value="mikrotik">MikroTik RouterOS</option>
                    <option value="cisco">Cisco Systems (ASR / IOS-XE)</option>
                    <option value="huawei">Huawei (NE / VRP)</option>
                    <option value="generic">Generic / RFC Standard</option>
                  </select>
                </div>

                <div>
                  <label className="block font-medium text-foreground mb-1">
                    Hardware Model / Platform
                  </label>
                  <input
                    type="text"
                    placeholder={formVendor === 'juniper' ? 'MX204, MX480, vMX' : formVendor === 'mikrotik' ? 'CCR2004, CCR1036, RB4011' : 'ASR9001, NE40E'}
                    value={formModel}
                    onChange={(e) => setFormModel(e.target.value)}
                    className="w-full bg-muted/50 border border-border rounded-xl px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-medium text-foreground mb-1">
                    Software / Junos Version
                  </label>
                  <input
                    type="text"
                    placeholder={formVendor === 'juniper' ? 'Junos 21.4R3-S5' : 'RouterOS 7.15'}
                    value={formOsVersion}
                    onChange={(e) => setFormOsVersion(e.target.value)}
                    className="w-full bg-muted/50 border border-border rounded-xl px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary font-mono"
                  />
                </div>

                <div>
                  <label className="block font-medium text-foreground mb-1">
                    Dynamic Profile Name
                  </label>
                  <input
                    type="text"
                    placeholder="PPPOE-PROFILE"
                    value={formDynamicProfile}
                    onChange={(e) => setFormDynamicProfile(e.target.value)}
                    className="w-full bg-muted/50 border border-border rounded-xl px-3 py-2 text-foreground font-mono focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-medium text-foreground mb-1">
                    CoA / Disconnect Port
                  </label>
                  <input
                    type="number"
                    value={formCoaPort}
                    onChange={(e) => setFormCoaPort(parseInt(e.target.value, 10))}
                    className="w-full bg-muted/50 border border-border rounded-xl px-3 py-2 text-foreground font-mono focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
                  />
                </div>

                <div className="flex items-center gap-2 pt-6">
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formCoaEnabled}
                      onChange={(e) => setFormCoaEnabled(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
                    <span className="ml-2 font-medium text-foreground">Enable RFC 5176 CoA / PoD</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block font-medium text-foreground mb-1 flex items-center justify-between">
                  <span>RADIUS Shared Secret *</span>
                  <span className="text-[10px] text-muted-foreground font-normal">
                    {editingDevice ? 'Leave blank to keep current secret' : 'Stored securely; never displayed in plain text'}
                  </span>
                </label>
                <div className="relative">
                  <Lock className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="password"
                    placeholder={editingDevice ? '••••••••' : 'Enter shared secret'}
                    value={formSecret}
                    onChange={(e) => setFormSecret(e.target.value)}
                    className="w-full bg-muted/50 border border-border rounded-xl pl-9 pr-3 py-2 text-foreground font-mono focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-medium text-foreground mb-1">
                    Location / POP
                  </label>
                  <input
                    type="text"
                    placeholder="Kathmandu DC-1"
                    value={formLocation}
                    onChange={(e) => setFormLocation(e.target.value)}
                    className="w-full bg-muted/50 border border-border rounded-xl px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
                  />
                </div>

                <div>
                  <label className="block font-medium text-foreground mb-1">
                    Status
                  </label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as any)}
                    className="w-full bg-muted/50 border border-border rounded-xl px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
                  >
                    <option value="online">Online / Active</option>
                    <option value="warning">Warning</option>
                    <option value="offline">Offline / Disabled</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-medium text-foreground mb-1">
                  Description / Notes
                </label>
                <input
                  type="text"
                  placeholder="Primary PPPoE termination gateway"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className="w-full bg-muted/50 border border-border rounded-xl px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
                />
              </div>

              <div className="pt-4 border-t border-border flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-border text-foreground hover:bg-muted font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="px-5 py-2 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 font-semibold shadow-md shadow-primary/20 disabled:opacity-50 transition-all"
                >
                  {formSubmitting ? 'Saving...' : editingDevice ? 'Save Changes' : 'Create NAS'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
