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
  Cpu,
  Thermometer,
  Wifi,
  Check,
} from 'lucide-react';
import {
  type OltItem,
  type OltVendor,
  OLT_VENDORS,
  KNOWN_VENDOR_MODELS,
} from '@/types/olt';

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
  const [testingCliId, setTestingCliId] = React.useState<number | null>(null);
  const [testingSnmpId, setTestingSnmpId] = React.useState<number | null>(null);
  const [pollingSnmpId, setPollingSnmpId] = React.useState<number | null>(null);
  const [syncingId, setSyncingId] = React.useState<number | null>(null);
  const [notice, setNotice] = React.useState<{ text: string; error?: boolean } | null>(null);

  // Modal states
  const [showAddModal, setShowAddModal] = React.useState(false);
  const [editingOlt, setEditingOlt] = React.useState<OltItem | null>(null);
  const [deletingOlt, setDeletingOlt] = React.useState<OltItem | null>(null);

  // Form states - General
  const [formName, setFormName] = React.useState('');
  const [formDescription, setFormDescription] = React.useState('');
  const [formVendor, setFormVendor] = React.useState<OltVendor>('Huawei');
  const [formModelSelect, setFormModelSelect] = React.useState('MA5683T');
  const [formCustomModel, setFormCustomModel] = React.useState('');
  const [formIp, setFormIp] = React.useState('');
  const [formPort, setFormPort] = React.useState('23');

  // Form states - CLI
  const [formProtocol, setFormProtocol] = React.useState<'telnet' | 'ssh'>('telnet');
  const [formUsername, setFormUsername] = React.useState('root');
  const [formPassword, setFormPassword] = React.useState('');
  const [formTimeout, setFormTimeout] = React.useState('5000');

  // Form states - SNMP
  const [formSnmpEnabled, setFormSnmpEnabled] = React.useState(true);
  const [formSnmpVersion, setFormSnmpVersion] = React.useState<'v1' | 'v2c' | 'v3'>('v2c');
  const [formSnmpPort, setFormSnmpPort] = React.useState('161');
  const [formSnmpCommunity, setFormSnmpCommunity] = React.useState('public');
  const [formSnmpWriteCommunity, setFormSnmpWriteCommunity] = React.useState('');
  const [formSnmpTimeout, setFormSnmpTimeout] = React.useState('3000');
  const [formSnmpRetries, setFormSnmpRetries] = React.useState('2');
  const [formPollingInterval, setFormPollingInterval] = React.useState('300');

  // SNMP v3 specific fields
  const [formV3Username, setFormV3Username] = React.useState('');
  const [formV3SecLevel, setFormV3SecLevel] = React.useState<'noAuthNoPriv' | 'authNoPriv' | 'authPriv'>('authPriv');
  const [formV3AuthProto, setFormV3AuthProto] = React.useState<'MD5' | 'SHA' | 'SHA256'>('SHA256');
  const [formV3AuthPass, setFormV3AuthPass] = React.useState('');
  const [formV3PrivProto, setFormV3PrivProto] = React.useState<'DES' | 'AES' | 'AES128'>('AES128');
  const [formV3PrivPass, setFormV3PrivPass] = React.useState('');

  // Thresholds
  const [formWarningThreshold, setFormWarningThreshold] = React.useState('-25.0');
  const [formCriticalThreshold, setFormCriticalThreshold] = React.useState('-28.0');

  // Submitting and connection test states inside modal
  const [formSubmitting, setFormSubmitting] = React.useState(false);
  const [modalTestingSnmp, setModalTestingSnmp] = React.useState(false);
  const [modalSnmpResult, setModalSnmpResult] = React.useState<{
    success: boolean;
    message: string;
    sysDescr?: string;
    sysUpTime?: string;
    rttMs?: number;
  } | null>(null);

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

  // Handle vendor selection changes
  const handleVendorChange = (newVendor: OltVendor) => {
    setFormVendor(newVendor);
    const availableModels = KNOWN_VENDOR_MODELS[newVendor] || ['Other'];
    setFormModelSelect(availableModels[0] || 'Other');
    setFormCustomModel('');
  };

  // Test CLI Connectivity from table row
  const handleTestCli = async (olt: OltItem, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      setTestingCliId(olt.id);
      const res = await fetch(`/api/olts/${olt.id}/test-cli`, {
        method: 'POST',
        headers: getAuthHeaders(),
      });
      const json = await res.json();
      if (res.ok && json.data?.success) {
        showMsg(`CLI test to ${olt.name} successful!`);
        fetchOlts();
      } else {
        showMsg(`CLI test to ${olt.name} failed: ${json.data?.message || 'Unreachable'}`, true);
      }
    } catch {
      showMsg('Failed to execute CLI test', true);
    } finally {
      setTestingCliId(null);
    }
  };

  // Test SNMP Connectivity from table row
  const handleTestSnmp = async (olt: OltItem, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      setTestingSnmpId(olt.id);
      const res = await fetch(`/api/olts/${olt.id}/test-snmp`, {
        method: 'POST',
        headers: getAuthHeaders(),
      });
      const json = await res.json();
      if (res.ok && json.data?.success) {
        showMsg(`SNMP test to ${olt.name} successful! (${json.data.rttMs}ms)`);
        fetchOlts();
      } else {
        showMsg(`SNMP test to ${olt.name} failed: ${json.data?.message || 'No response'}`, true);
      }
    } catch {
      showMsg('Failed to execute SNMP test', true);
    } finally {
      setTestingSnmpId(null);
    }
  };

  // Trigger SNMP Poll Now from table row
  const handlePollSnmp = async (olt: OltItem, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      setPollingSnmpId(olt.id);
      const res = await fetch(`/api/olts/${olt.id}/poll-snmp`, {
        method: 'POST',
        headers: getAuthHeaders(),
      });
      const json = await res.json();
      if (res.ok) {
        showMsg(`SNMP poll completed for ${olt.name} in ${json.data?.pollDurationMs}ms`);
        fetchOlts();
      } else {
        showMsg(`SNMP poll failed for ${olt.name}: ${json.error?.message || 'Error'}`, true);
      }
    } catch {
      showMsg('Failed to trigger SNMP poll', true);
    } finally {
      setPollingSnmpId(null);
    }
  };

  // Sync ONUs via CLI
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
    setFormDescription('');
    setFormVendor('Huawei');
    setFormModelSelect('MA5683T');
    setFormCustomModel('');
    setFormIp('');
    setFormPort('23');
    setFormProtocol('telnet');
    setFormUsername('root');
    setFormPassword('');
    setFormTimeout('5000');
    setFormSnmpEnabled(true);
    setFormSnmpVersion('v2c');
    setFormSnmpPort('161');
    setFormSnmpCommunity('public');
    setFormSnmpWriteCommunity('');
    setFormSnmpTimeout('3000');
    setFormSnmpRetries('2');
    setFormPollingInterval('300');
    setFormV3Username('');
    setFormV3SecLevel('authPriv');
    setFormV3AuthProto('SHA256');
    setFormV3AuthPass('');
    setFormV3PrivProto('AES128');
    setFormV3PrivPass('');
    setFormWarningThreshold('-25.0');
    setFormCriticalThreshold('-28.0');
    setModalSnmpResult(null);
    setShowAddModal(true);
  };

  const handleOpenEditModal = (olt: OltItem, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingOlt(olt);
    setFormName(olt.name);
    setFormDescription(olt.description || '');

    const vendor = (olt.vendor as OltVendor) || 'Huawei';
    setFormVendor(vendor);

    const knownModels = KNOWN_VENDOR_MODELS[vendor] || ['Other'];
    if (knownModels.includes(olt.model)) {
      setFormModelSelect(olt.model);
      setFormCustomModel('');
    } else {
      setFormModelSelect('Other');
      setFormCustomModel(olt.model || '');
    }

    setFormIp(olt.management_ip);
    setFormPort(String(olt.management_port || 23));
    setFormProtocol(olt.cli_protocol || 'telnet');
    setFormUsername(olt.cli_username || 'root');
    setFormPassword('');
    setFormTimeout(String(olt.connection_timeout || 5000));
    setFormSnmpEnabled(olt.snmp_enabled ?? true);
    setFormSnmpVersion((olt.snmp_version as any) || 'v2c');
    setFormSnmpPort(String(olt.snmp_port || 161));
    setFormSnmpCommunity(olt.snmp_community_masked ? '' : 'public');
    setFormSnmpWriteCommunity('');
    setFormSnmpTimeout(String(olt.snmp_timeout_ms || 3000));
    setFormSnmpRetries(String(olt.snmp_retries ?? 2));
    setFormPollingInterval(String(olt.polling_interval || 300));
    setFormWarningThreshold(String(olt.optical_warning_threshold ?? -25.0));
    setFormCriticalThreshold(String(olt.optical_critical_threshold ?? -28.0));
    setModalSnmpResult(null);
  };

  // Test SNMP Connection from inside the modal
  const handleModalTestSnmp = async () => {
    if (!formIp.trim()) {
      showMsg('Please provide a management IP before testing SNMP', true);
      return;
    }

    try {
      setModalTestingSnmp(true);
      setModalSnmpResult(null);

      const payload: any = {
        host: formIp.trim(),
        port: parseInt(formSnmpPort, 10) || 161,
        version: formSnmpVersion,
        community: formSnmpCommunity.trim() || 'public',
        timeoutMs: parseInt(formSnmpTimeout, 10) || 3000,
        retries: parseInt(formSnmpRetries, 10) || 2,
      };

      const res = await fetch('/api/olts/test-snmp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (res.ok && json.data) {
        setModalSnmpResult(json.data);
      } else {
        setModalSnmpResult({
          success: false,
          message: json.error?.message || 'SNMP connection test failed',
        });
      }
    } catch (err: any) {
      setModalSnmpResult({
        success: false,
        message: err.message || 'Network error while testing SNMP',
      });
    } finally {
      setModalTestingSnmp(false);
    }
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

    const effectiveModel = formModelSelect === 'Other' ? formCustomModel.trim() || 'Generic' : formModelSelect;

    try {
      setFormSubmitting(true);
      const payload: any = {
        name: formName.trim(),
        description: formDescription.trim() || undefined,
        vendor: formVendor,
        model: effectiveModel,
        management_ip: formIp.trim(),
        management_port: parseInt(formPort, 10) || 23,
        cli_protocol: formProtocol,
        cli_username: formUsername.trim(),
        connection_timeout: parseInt(formTimeout, 10) || 5000,
        snmp_enabled: formSnmpEnabled,
        snmp_version: formSnmpVersion,
        snmp_port: parseInt(formSnmpPort, 10) || 161,
        snmp_timeout_ms: parseInt(formSnmpTimeout, 10) || 3000,
        snmp_retries: parseInt(formSnmpRetries, 10) || 2,
        polling_interval: parseInt(formPollingInterval, 10) || 300,
        optical_warning_threshold: parseFloat(formWarningThreshold) || -25.0,
        optical_critical_threshold: parseFloat(formCriticalThreshold) || -28.0,
      };

      if (formSnmpCommunity.trim()) {
        payload.snmp_community = formSnmpCommunity.trim();
      }
      if (formSnmpWriteCommunity.trim()) {
        payload.snmp_write_community = formSnmpWriteCommunity.trim();
      }
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
      showMsg('Network error deleting OLT', true);
    } finally {
      setFormSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {notice && (
        <div
          className={`p-3 rounded-xl text-xs font-semibold flex items-center justify-between ${
            notice.error
              ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
              : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
          }`}
        >
          <span>{notice.text}</span>
          <button onClick={() => setNotice(null)} className="text-muted-foreground hover:text-foreground">
            ✕
          </button>
        </div>
      )}

      {/* Top Header & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by OLT name, vendor, model, or IP..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-xl bg-card border border-border text-xs focus:ring-2 focus:ring-primary outline-none"
          />
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchOlts()}
            className="p-2 rounded-xl bg-card border border-border hover:bg-muted text-muted-foreground transition-all"
            title="Refresh Inventory"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={handleOpenAddModal}
            className="px-4 py-2 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold flex items-center gap-1.5 shadow-sm shadow-primary/20 transition-all"
          >
            <Plus className="w-4 h-4" />
            Add OLT Chassis
          </button>
        </div>
      </div>

      {/* Inventory Table */}
      <div className="bg-card rounded-2xl border border-border overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-muted/50 border-b border-border text-muted-foreground uppercase tracking-wider text-[11px] font-semibold">
                <th className="py-3 px-4">OLT Chassis</th>
                <th className="py-3 px-4">Vendor & Model</th>
                <th className="py-3 px-4">Management & SNMP</th>
                <th className="py-3 px-4">Health / Telemetry</th>
                <th className="py-3 px-4">ONUs (Online / Off)</th>
                <th className="py-3 px-4">Last Poll</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading && olts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-muted-foreground">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-primary" />
                    Loading OLT inventory...
                  </td>
                </tr>
              ) : olts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-muted-foreground">
                    <Server className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    <p className="font-semibold text-foreground text-sm">No OLT devices registered</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Add a Huawei, BDCOM, Powertech, or VSOL chassis to start monitoring SNMP telemetry.
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
                  const isPollSuccess = olt.last_poll_status === 'success';
                  const isTestingCli = testingCliId === olt.id;
                  const isTestingSnmp = testingSnmpId === olt.id;
                  const isPollingSnmp = pollingSnmpId === olt.id;
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
                              {olt.branch_name || 'Organization-wide'}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-muted border border-border text-[11px] font-semibold text-foreground mr-1.5">
                          {olt.vendor}
                        </span>
                        <span className="text-[11px] text-muted-foreground font-mono font-medium">
                          {olt.model}
                        </span>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="font-mono text-foreground font-medium">
                          {olt.management_ip}:{olt.management_port}
                        </div>
                        <div className="text-[10px] text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                          <span>SNMP {olt.snmp_version} (Port {olt.snmp_port})</span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
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

                          {olt.cpu_utilization !== null && (
                            <span className="text-[11px] text-muted-foreground flex items-center gap-0.5" title="CPU Duty">
                              <Cpu className="w-3 h-3 text-primary" />
                              {olt.cpu_utilization}%
                            </span>
                          )}

                          {olt.temperature !== null && (
                            <span className="text-[11px] text-muted-foreground flex items-center gap-0.5" title="Chassis Temperature">
                              <Thermometer className="w-3 h-3 text-amber-500" />
                              {olt.temperature}°C
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-foreground">{olt.total_onus || 0}</span>
                          <span className="text-muted-foreground">|</span>
                          <span className="text-emerald-500 font-semibold">{olt.online_onus || 0} on</span>
                          <span className="text-muted-foreground">/</span>
                          <span className="text-rose-400 font-semibold">{olt.offline_onus || 0} off</span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-muted-foreground text-[11px]">
                        <div>
                          {olt.last_poll_at ? new Date(olt.last_poll_at).toLocaleTimeString() : 'Never'}
                        </div>
                        {olt.last_poll_status && (
                          <div
                            className={`text-[10px] font-bold ${
                              isPollSuccess
                                ? 'text-emerald-500'
                                : olt.last_poll_status === 'timeout'
                                ? 'text-amber-500'
                                : 'text-rose-500'
                            }`}
                          >
                            {olt.last_poll_status.toUpperCase()}
                          </div>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={(e) => handleTestSnmp(olt, e)}
                            disabled={isTestingSnmp}
                            className="p-1.5 rounded-lg bg-muted hover:bg-sky-600 hover:text-white text-muted-foreground transition-all"
                            title="Test SNMP Connection"
                          >
                            <Wifi className={`w-3.5 h-3.5 ${isTestingSnmp ? 'animate-spin' : ''}`} />
                          </button>

                          <button
                            onClick={(e) => handlePollSnmp(olt, e)}
                            disabled={isPollingSnmp}
                            className="p-1.5 rounded-lg bg-muted hover:bg-primary hover:text-primary-foreground text-muted-foreground transition-all"
                            title="Poll SNMP Now"
                          >
                            <Activity className={`w-3.5 h-3.5 ${isPollingSnmp ? 'animate-spin' : ''}`} />
                          </button>

                          <button
                            onClick={(e) => handleSync(olt, e)}
                            disabled={isSyncing}
                            className="p-1.5 rounded-lg bg-muted hover:bg-emerald-600 hover:text-white text-muted-foreground transition-all"
                            title="Synchronize Live CLI Inventory"
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
          <div className="bg-card border border-border w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between flex-shrink-0">
              <div>
                <h3 className="font-bold text-foreground text-sm">
                  {editingOlt ? `Edit OLT: ${editingOlt.name}` : 'Register New OLT Chassis'}
                </h3>
                <p className="text-[11px] text-muted-foreground">
                  Configure vendor hardware, management IP, SNMP monitoring, and CLI credentials
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

            <form onSubmit={handleSaveOlt} className="p-6 space-y-5 overflow-y-auto flex-1">
              {/* Section 1: Vendor & Hardware Selection */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
                  <Server className="w-3.5 h-3.5 text-primary" />
                  1. Hardware Identity & Affiliation
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-semibold text-foreground mb-1 block">OLT Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Core-Huawei-OLT-1"
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-card border border-border text-xs focus:ring-2 focus:ring-primary outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-foreground mb-1 block">Description / Notes</label>
                    <input
                      type="text"
                      placeholder="e.g. Primary FTTH Hub - Rack 4"
                      value={formDescription}
                      onChange={(e) => setFormDescription(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-card border border-border text-xs focus:ring-2 focus:ring-primary outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                  <div>
                    <label className="text-[11px] font-semibold text-foreground mb-1 block">Hardware Vendor *</label>
                    <select
                      value={formVendor}
                      onChange={(e) => handleVendorChange(e.target.value as OltVendor)}
                      className="w-full px-3 py-2 rounded-xl bg-card border border-border text-xs focus:ring-2 focus:ring-primary outline-none font-medium"
                    >
                      {OLT_VENDORS.map((v) => (
                        <option key={v.value} value={v.value}>
                          {v.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-foreground mb-1 block">Chassis Model *</label>
                    <select
                      value={formModelSelect}
                      onChange={(e) => setFormModelSelect(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-card border border-border text-xs focus:ring-2 focus:ring-primary outline-none font-medium"
                    >
                      {(KNOWN_VENDOR_MODELS[formVendor] || ['Other']).map((m) => (
                        <option key={m} value={m}>
                          {m === 'Other' ? 'Other / Custom Model...' : m}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {formModelSelect === 'Other' && (
                  <div className="mt-3">
                    <label className="text-[11px] font-semibold text-foreground mb-1 block">Custom Model Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="Enter exact OLT chassis model..."
                      value={formCustomModel}
                      onChange={(e) => setFormCustomModel(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-card border border-border text-xs focus:ring-2 focus:ring-primary outline-none"
                    />
                  </div>
                )}
              </div>

              {/* Section 2: Management IP */}
              <div className="pt-3 border-t border-border">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
                  <Wifi className="w-3.5 h-3.5 text-primary" />
                  2. IP Connectivity
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <label className="text-[11px] font-semibold text-foreground mb-1 block">Management IP Address *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. 192.168.100.10"
                      value={formIp}
                      onChange={(e) => setFormIp(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-card border border-border text-xs focus:ring-2 focus:ring-primary outline-none font-mono"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-foreground mb-1 block">CLI Port</label>
                    <input
                      type="number"
                      value={formPort}
                      onChange={(e) => setFormPort(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-card border border-border text-xs focus:ring-2 focus:ring-primary outline-none font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Section 3: SNMP Configuration */}
              <div className="pt-3 border-t border-border">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5 text-sky-500" />
                    3. SNMP Telemetry & Monitoring
                  </h4>
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-foreground">
                    <input
                      type="checkbox"
                      checked={formSnmpEnabled}
                      onChange={(e) => setFormSnmpEnabled(e.target.checked)}
                      className="rounded border-border text-primary focus:ring-primary"
                    />
                    Enable SNMP Polling
                  </label>
                </div>

                {formSnmpEnabled && (
                  <div className="space-y-3 bg-muted/30 p-3.5 rounded-xl border border-border">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="text-[11px] font-semibold text-foreground mb-1 block">SNMP Version</label>
                        <select
                          value={formSnmpVersion}
                          onChange={(e) => setFormSnmpVersion(e.target.value as any)}
                          className="w-full px-3 py-2 rounded-xl bg-card border border-border text-xs focus:ring-2 focus:ring-primary outline-none font-medium"
                        >
                          <option value="v2c">SNMPv2c (Recommended)</option>
                          <option value="v1">SNMPv1</option>
                          <option value="v3">SNMPv3 (Secure)</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-[11px] font-semibold text-foreground mb-1 block">SNMP Port</label>
                        <input
                          type="number"
                          value={formSnmpPort}
                          onChange={(e) => setFormSnmpPort(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl bg-card border border-border text-xs focus:ring-2 focus:ring-primary outline-none font-mono"
                        />
                      </div>

                      <div>
                        <label className="text-[11px] font-semibold text-foreground mb-1 block">Polling Interval (s)</label>
                        <input
                          type="number"
                          value={formPollingInterval}
                          onChange={(e) => setFormPollingInterval(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl bg-card border border-border text-xs focus:ring-2 focus:ring-primary outline-none font-mono"
                        />
                      </div>
                    </div>

                    {formSnmpVersion !== 'v3' ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="text-[11px] font-semibold text-foreground mb-1 block">Read Community</label>
                          <input
                            type="password"
                            placeholder="e.g. public"
                            value={formSnmpCommunity}
                            onChange={(e) => setFormSnmpCommunity(e.target.value)}
                            className="w-full px-3 py-2 rounded-xl bg-card border border-border text-xs focus:ring-2 focus:ring-primary outline-none font-mono"
                          />
                        </div>

                        <div>
                          <label className="text-[11px] font-semibold text-foreground mb-1 block">Write Community (Optional)</label>
                          <input
                            type="password"
                            placeholder="Optional write community"
                            value={formSnmpWriteCommunity}
                            onChange={(e) => setFormSnmpWriteCommunity(e.target.value)}
                            className="w-full px-3 py-2 rounded-xl bg-card border border-border text-xs focus:ring-2 focus:ring-primary outline-none font-mono"
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                          <label className="text-[11px] font-semibold text-foreground mb-1 block">v3 Security User</label>
                          <input
                            type="text"
                            placeholder="SNMPv3 username"
                            value={formV3Username}
                            onChange={(e) => setFormV3Username(e.target.value)}
                            className="w-full px-3 py-2 rounded-xl bg-card border border-border text-xs focus:ring-2 focus:ring-primary outline-none font-mono"
                          />
                        </div>

                        <div>
                          <label className="text-[11px] font-semibold text-foreground mb-1 block">Auth Password</label>
                          <input
                            type="password"
                            value={formV3AuthPass}
                            onChange={(e) => setFormV3AuthPass(e.target.value)}
                            className="w-full px-3 py-2 rounded-xl bg-card border border-border text-xs focus:ring-2 focus:ring-primary outline-none font-mono"
                          />
                        </div>

                        <div>
                          <label className="text-[11px] font-semibold text-foreground mb-1 block">Priv Password</label>
                          <input
                            type="password"
                            value={formV3PrivPass}
                            onChange={(e) => setFormV3PrivPass(e.target.value)}
                            className="w-full px-3 py-2 rounded-xl bg-card border border-border text-xs focus:ring-2 focus:ring-primary outline-none font-mono"
                          />
                        </div>
                      </div>
                    )}

                    {/* Test Connection Button & Status inside modal */}
                    <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={handleModalTestSnmp}
                        disabled={modalTestingSnmp}
                        className="px-3.5 py-1.5 rounded-lg bg-sky-500/10 hover:bg-sky-500/20 text-sky-600 dark:text-sky-400 border border-sky-500/20 text-xs font-semibold flex items-center gap-1.5 w-fit"
                      >
                        <Wifi className={`w-3.5 h-3.5 ${modalTestingSnmp ? 'animate-spin' : ''}`} />
                        {modalTestingSnmp ? 'Querying SNMP...' : 'Test SNMP Connection'}
                      </button>

                      {modalSnmpResult && (
                        <div
                          className={`text-xs font-medium px-2.5 py-1 rounded-lg border ${
                            modalSnmpResult.success
                              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                              : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20'
                          }`}
                        >
                          {modalSnmpResult.success ? (
                            <span>
                              ✓ {modalSnmpResult.message}
                              {modalSnmpResult.sysUpTime ? ` | Up: ${modalSnmpResult.sysUpTime}` : ''}
                            </span>
                          ) : (
                            <span>✕ {modalSnmpResult.message}</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Section 4: CLI Credentials */}
              <div className="pt-3 border-t border-border">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-primary" />
                  4. CLI Management Credentials
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
              </div>

              {/* Section 5: Optical Thresholds */}
              <div className="pt-3 border-t border-border">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-amber-500" />
                  5. Optical Health Thresholds
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-semibold text-foreground mb-1 block">
                      Warning Threshold (dBm)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={formWarningThreshold}
                      onChange={(e) => setFormWarningThreshold(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-card border border-border text-xs focus:ring-2 focus:ring-primary outline-none font-mono"
                    />
                    <span className="text-[10px] text-muted-foreground">Default: -25.0 dBm (Yellow alert)</span>
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-foreground mb-1 block">
                      Critical Threshold (dBm)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={formCriticalThreshold}
                      onChange={(e) => setFormCriticalThreshold(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-card border border-border text-xs focus:ring-2 focus:ring-primary outline-none font-mono"
                    />
                    <span className="text-[10px] text-muted-foreground">Default: -28.0 dBm (Red alarm)</span>
                  </div>
                </div>
              </div>

              {/* Form Action Buttons */}
              <div className="pt-4 border-t border-border flex items-center justify-end gap-2 flex-shrink-0">
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
