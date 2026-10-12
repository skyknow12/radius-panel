'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Wifi,
  Server,
  Cpu,
  Layers,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Search,
  Plus,
  Trash2,
  Copy,
  Key,
  RefreshCw,
  Activity,
  ArrowRight,
  Info,
  FileCode,
  Radio,
  ExternalLink,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type {
  OnuOverviewData,
  DetectedOnuItem,
  OnuModelRequestItem,
  OnuModelProfileItem,
  OnuCredentialItem,
  OnuActivityLogItem,
} from '@/types/onu';

export type OnuSubTab =
  | 'overview'
  | 'detected_onus'
  | 'model_requests'
  | 'model_profiles'
  | 'credentials'
  | 'logs';

interface OnuManagementViewProps {
  initialSubTab?: OnuSubTab;
  onOpenCustomer?: (customerId: number) => void;
  currentUser?: any;
}

export function OnuManagementView({
  initialSubTab = 'overview',
  onOpenCustomer,
  currentUser: _currentUser,
}: OnuManagementViewProps) {
  const [activeTab, setActiveTab] = useState<OnuSubTab>(initialSubTab);

  // Synchronize initialSubTab if provided
  useEffect(() => {
    if (initialSubTab && initialSubTab !== activeTab) {
      setActiveTab(initialSubTab);
    }
  }, [initialSubTab]);

  // Overview Data
  const [overview, setOverview] = useState<OnuOverviewData | null>(null);
  const [loadingOverview, setLoadingOverview] = useState(false);

  // Detected ONUs
  const [detectedOnus, setDetectedOnus] = useState<DetectedOnuItem[]>([]);
  const [totalDetected, setTotalDetected] = useState(0);
  const [loadingDetected, setLoadingDetected] = useState(false);
  const [detectedSearch, setDetectedSearch] = useState('');
  const [detectedVendor, setDetectedVendor] = useState<string>('all');
  const [detectedWebStatus, setDetectedWebStatus] = useState<string>('all');
  const [detectedPage, setDetectedPage] = useState(1);

  // Model Requests
  const [modelRequests, setModelRequests] = useState<OnuModelRequestItem[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [requestStatusFilter, setRequestStatusFilter] = useState<'pending' | 'resolved' | 'ignored'>('pending');

  // Model Profiles
  const [profiles, setProfiles] = useState<OnuModelProfileItem[]>([]);
  const [loadingProfiles, setLoadingProfiles] = useState(false);
  const [profileSearch, setProfileSearch] = useState('');
  const [profileVendorFilter, setProfileVendorFilter] = useState('all');

  // Credentials
  const [credentials, setCredentials] = useState<OnuCredentialItem[]>([]);
  const [loadingCredentials, setLoadingCredentials] = useState(false);
  const [credentialScopeFilter, setCredentialScopeFilter] = useState('all');

  // Logs
  const [logs, setLogs] = useState<OnuActivityLogItem[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [logStatusFilter, setLogStatusFilter] = useState('all');

  // Feedback & Action notices
  const [actionNotice, setActionNotice] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  // Modals
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState<Partial<OnuModelProfileItem> | null>(null);
  const [credentialModalOpen, setCredentialModalOpen] = useState(false);
  const [testResultModal, setTestResultModal] = useState<{ title: string; result: any } | null>(null);
  const [testingOnuId, setTestingOnuId] = useState<number | null>(null);

  const showNotice = (type: 'success' | 'error' | 'info', message: string) => {
    setActionNotice({ type, message });
    setTimeout(() => setActionNotice(null), 5000);
  };

  // 1. Fetch Overview
  const fetchOverview = useCallback(async () => {
    try {
      setLoadingOverview(true);
      const res = await fetch('/api/onu/overview');
      if (res.ok) {
        const json = await res.json();
        setOverview(json.data || json);
      }
    } catch (err: any) {
      console.error('Error fetching ONU overview:', err);
    } finally {
      setLoadingOverview(false);
    }
  }, []);

  // 2. Fetch Detected ONUs
  const fetchDetectedOnus = useCallback(async () => {
    try {
      setLoadingDetected(true);
      const sp = new URLSearchParams();
      sp.set('page', String(detectedPage));
      sp.set('limit', '25');
      if (detectedSearch) sp.set('search', detectedSearch);
      if (detectedVendor !== 'all') sp.set('vendor', detectedVendor);
      if (detectedWebStatus !== 'all') sp.set('web_status', detectedWebStatus);

      const res = await fetch(`/api/onu/detected?${sp.toString()}`);
      if (res.ok) {
        const json = await res.json();
        setDetectedOnus(json.data?.items || []);
        setTotalDetected(json.data?.total || 0);
      }
    } catch (err: any) {
      console.error('Error fetching detected ONUs:', err);
    } finally {
      setLoadingDetected(false);
    }
  }, [detectedPage, detectedSearch, detectedVendor, detectedWebStatus]);

  // 3. Fetch Model Requests
  const fetchModelRequests = useCallback(async () => {
    try {
      setLoadingRequests(true);
      const res = await fetch(`/api/onu/model-requests?status=${requestStatusFilter}`);
      if (res.ok) {
        const json = await res.json();
        setModelRequests(json.data || []);
      }
    } catch (err: any) {
      console.error('Error fetching model requests:', err);
    } finally {
      setLoadingRequests(false);
    }
  }, [requestStatusFilter]);

  // 4. Fetch Profiles
  const fetchProfiles = useCallback(async () => {
    try {
      setLoadingProfiles(true);
      const sp = new URLSearchParams();
      if (profileSearch) sp.set('search', profileSearch);
      if (profileVendorFilter !== 'all') sp.set('vendor', profileVendorFilter);

      const res = await fetch(`/api/onu/model-profiles?${sp.toString()}`);
      if (res.ok) {
        const json = await res.json();
        setProfiles(json.data || []);
      }
    } catch (err: any) {
      console.error('Error fetching model profiles:', err);
    } finally {
      setLoadingProfiles(false);
    }
  }, [profileSearch, profileVendorFilter]);

  // 5. Fetch Credentials
  const fetchCredentials = useCallback(async () => {
    try {
      setLoadingCredentials(true);
      const sp = new URLSearchParams();
      if (credentialScopeFilter !== 'all') sp.set('scope', credentialScopeFilter);

      const res = await fetch(`/api/onu/credentials?${sp.toString()}`);
      if (res.ok) {
        const json = await res.json();
        setCredentials(json.data || []);
      }
    } catch (err: any) {
      console.error('Error fetching credentials:', err);
    } finally {
      setLoadingCredentials(false);
    }
  }, [credentialScopeFilter]);

  // 6. Fetch Logs
  const fetchLogs = useCallback(async () => {
    try {
      setLoadingLogs(true);
      const sp = new URLSearchParams();
      if (logStatusFilter !== 'all') sp.set('status', logStatusFilter);
      sp.set('limit', '50');

      const res = await fetch(`/api/onu/logs?${sp.toString()}`);
      if (res.ok) {
        const json = await res.json();
        setLogs(json.data || []);
      }
    } catch (err: any) {
      console.error('Error fetching logs:', err);
    } finally {
      setLoadingLogs(false);
    }
  }, [logStatusFilter]);

  // Load active tab data
  useEffect(() => {
    if (activeTab === 'overview') fetchOverview();
    if (activeTab === 'detected_onus') fetchDetectedOnus();
    if (activeTab === 'model_requests') fetchModelRequests();
    if (activeTab === 'model_profiles') fetchProfiles();
    if (activeTab === 'credentials') fetchCredentials();
    if (activeTab === 'logs') fetchLogs();
  }, [activeTab, fetchOverview, fetchDetectedOnus, fetchModelRequests, fetchProfiles, fetchCredentials, fetchLogs]);

  // Handle Test Connection
  const handleTestConnection = async (onuId: number) => {
    try {
      setTestingOnuId(onuId);
      const res = await fetch(`/api/onu/${onuId}/test-connection`, { method: 'POST' });
      const json = await res.json();
      setTestResultModal({
        title: 'ONU Reachability & Port Test',
        result: json.data || json,
      });
      if (json.data?.reachable) {
        showNotice('success', 'ONU is reachable over management network');
      } else {
        showNotice('error', json.data?.error || 'ONU is not reachable');
      }
    } catch (err: any) {
      showNotice('error', err.message || 'Connection test failed');
    } finally {
      setTestingOnuId(null);
    }
  };

  // Handle Test Login
  const handleTestLogin = async (onuId: number) => {
    try {
      setTestingOnuId(onuId);
      const res = await fetch(`/api/onu/${onuId}/test-login`, { method: 'POST' });
      const json = await res.json();
      setTestResultModal({
        title: 'ONU Web Authentication Test',
        result: json.data || json,
      });
      if (json.data?.authenticated) {
        showNotice('success', 'ONU Web Login authenticated successfully');
      } else {
        showNotice('error', json.data?.error || 'ONU Web Login failed');
      }
    } catch (err: any) {
      showNotice('error', err.message || 'Login test failed');
    } finally {
      setTestingOnuId(null);
    }
  };

  // Handle Create Profile from Request
  const handleCreateProfileFromRequest = (req: OnuModelRequestItem) => {
    setEditingProfile({
      name: `${req.vendor} ${req.model}`,
      vendor: req.vendor,
      model: req.model,
      firmware_pattern: req.firmware || '',
      adapter_type: req.vendor.toLowerCase().includes('huawei')
        ? 'huawei_web'
        : req.vendor.toLowerCase().includes('zte')
        ? 'zte_web'
        : 'generic_web',
      default_protocol: 'http',
      default_port: 80,
      login_path: '/',
      default_username: 'telecomadmin',
      capabilities: {
        change_ssid: true,
        change_password: true,
        read_wifi: true,
        verify_changes: true,
      },
      wifi_bands: ['2.4GHz', '5GHz'],
      status: 'needs_testing',
      tested_capabilities: {
        connection: false,
        auth: false,
        info: false,
        ssid: false,
        password: false,
        verify: false,
      },
      notes: `Generated from discovery request #${req.id} (seen on ${req.olt_name || 'OLT'})`,
    });
    setProfileModalOpen(true);
  };

  // Tab definitions
  const tabs = [
    { id: 'overview', label: 'Overview', icon: Layers },
    {
      id: 'detected_onus',
      label: 'Detected ONUs',
      icon: Wifi,
      badge: overview?.totalOnus ? String(overview.totalOnus) : undefined,
    },
    {
      id: 'model_requests',
      label: 'New Model Requests',
      icon: AlertTriangle,
      badge: overview?.pendingNewModelsCount ? String(overview.pendingNewModelsCount) : undefined,
      badgeColor: 'bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30',
    },
    { id: 'model_profiles', label: 'Model Profiles', icon: FileCode },
    { id: 'credentials', label: 'Management Credentials', icon: Key },
    { id: 'logs', label: 'Activity Logs', icon: Activity },
  ];

  return (
    <div className="space-y-6">
      {/* Top Banner Notice */}
      {actionNotice && (
        <div
          className={cn(
            'p-4 rounded-xl text-xs font-semibold flex items-center justify-between shadow-sm animate-in fade-in',
            actionNotice.type === 'success' && 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20',
            actionNotice.type === 'error' && 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20',
            actionNotice.type === 'info' && 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20'
          )}
        >
          <div className="flex items-center gap-2">
            {actionNotice.type === 'success' && <CheckCircle2 className="w-4 h-4" />}
            {actionNotice.type === 'error' && <XCircle className="w-4 h-4" />}
            {actionNotice.type === 'info' && <Info className="w-4 h-4" />}
            <span>{actionNotice.message}</span>
          </div>
          <button onClick={() => setActionNotice(null)} className="opacity-70 hover:opacity-100">
            Dismiss
          </button>
        </div>
      )}

      {/* Header and Subtab Navigation Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/60 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-primary/10 text-primary">
              <Wifi className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight text-foreground">ONU Web & Wi-Fi Management</h2>
              <p className="text-xs text-muted-foreground">
                Automatic vendor/model identification, centralized model profiles, credential hierarchy, and Wi-Fi administration.
              </p>
            </div>
          </div>
        </div>

        {/* Action button shortcuts */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              if (activeTab === 'overview') fetchOverview();
              if (activeTab === 'detected_onus') fetchDetectedOnus();
              if (activeTab === 'model_requests') fetchModelRequests();
              if (activeTab === 'model_profiles') fetchProfiles();
              if (activeTab === 'credentials') fetchCredentials();
              if (activeTab === 'logs') fetchLogs();
            }}
            className="px-3 py-1.5 rounded-xl border border-border text-xs font-semibold text-foreground hover:bg-muted transition-colors flex items-center gap-1.5"
            title="Refresh current view"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </button>
        </div>
      </div>

      {/* Subtab Navigation Pills */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1 border-b border-border/40 scrollbar-none">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as OnuSubTab)}
              className={cn(
                'flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap',
                isActive
                  ? 'bg-primary text-primary-foreground shadow-sm shadow-primary/20'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/70'
              )}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
              {tab.badge && (
                <span
                  className={cn(
                    'px-1.5 py-0.2 rounded-full text-[10px] font-bold',
                    isActive
                      ? 'bg-primary-foreground/20 text-primary-foreground'
                      : tab.badgeColor || 'bg-muted text-foreground'
                  )}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ========================================================================= */}
      {/* 1. OVERVIEW TAB */}
      {/* ========================================================================= */}
      {activeTab === 'overview' && (
        <div className="space-y-6 animate-in fade-in">
          {/* Pending Model Requests Banner */}
          {overview && overview.pendingNewModelsCount > 0 && (
            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/25 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-foreground">
                    {overview.pendingNewModelsCount} Unconfigured ONU Model{overview.pendingNewModelsCount > 1 ? 's' : ''} Detected
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    New ONU hardware models were discovered during OLT polling. Create model profiles to enable automatic web management and Wi-Fi provisioning.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setActiveTab('model_requests')}
                className="px-4 py-2 rounded-xl bg-amber-500 text-white font-semibold text-xs hover:bg-amber-600 transition-colors shadow-sm whitespace-nowrap flex items-center gap-1.5"
              >
                View Model Requests
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Metric Stat Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="p-4 rounded-2xl border border-border bg-card shadow-sm space-y-1">
              <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground block">
                Total Detected ONUs
              </span>
              <div className="text-2xl font-black text-foreground">{overview?.totalOnus ?? 0}</div>
              <span className="text-[10px] text-muted-foreground">Synchronized with OLTs</span>
            </div>

            <div className="p-4 rounded-2xl border border-border bg-card shadow-sm space-y-1">
              <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground block">
                Customer Linked
              </span>
              <div className="text-2xl font-black text-foreground">{overview?.linkedToCustomers ?? 0}</div>
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">Mapped to Subscriber</span>
            </div>

            <div className="p-4 rounded-2xl border border-border bg-card shadow-sm space-y-1">
              <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground block">
                Configured Profiles
              </span>
              <div className="text-2xl font-black text-foreground">{overview?.configuredProfiles ?? 0}</div>
              <span className="text-[10px] text-primary font-medium">Managed with Profiles</span>
            </div>

            <div className="p-4 rounded-2xl border border-border bg-card shadow-sm space-y-1">
              <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground block">
                Pending Model Profile
              </span>
              <div className="text-2xl font-black text-amber-600 dark:text-amber-400">
                {overview?.pendingModelConfig ?? 0}
              </div>
              <span className="text-[10px] text-muted-foreground">Needs Model Profile</span>
            </div>

            <div className="p-4 rounded-2xl border border-border bg-card shadow-sm space-y-1">
              <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground block">
                Web Reachable
              </span>
              <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                {overview?.webReachable ?? 0}
              </div>
              <span className="text-[10px] text-muted-foreground">Management IP online</span>
            </div>

            <div className="p-4 rounded-2xl border border-border bg-card shadow-sm space-y-1">
              <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground block">
                Failed Operations
              </span>
              <div className="text-2xl font-black text-rose-600 dark:text-rose-400">
                {overview?.failedOperations ?? 0}
              </div>
              <span className="text-[10px] text-muted-foreground">Last 30 days</span>
            </div>
          </div>

          {/* Vendors and Models Distribution Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-5 rounded-2xl border border-border bg-card shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-primary" /> Top ONU Vendors
                </h4>
                <span className="text-xs text-muted-foreground">Hardware distribution</span>
              </div>
              <div className="space-y-2.5">
                {overview?.topVendors && overview.topVendors.length > 0 ? (
                  overview.topVendors.map((v, i) => (
                    <div key={i} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-primary" />
                        <span className="font-semibold text-foreground">{v.vendor}</span>
                      </div>
                      <span className="font-mono text-muted-foreground">{v.count} units</span>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-muted-foreground">No vendor telemetry recorded yet.</p>
                )}
              </div>
            </div>

            <div className="p-5 rounded-2xl border border-border bg-card shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <Server className="w-4 h-4 text-primary" /> Top Detected Models
                </h4>
                <span className="text-xs text-muted-foreground">Equipment models</span>
              </div>
              <div className="space-y-2.5">
                {overview?.topModels && overview.topModels.length > 0 ? (
                  overview.topModels.map((m, i) => (
                    <div key={i} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-500" />
                        <span className="font-semibold text-foreground">{m.model}</span>
                      </div>
                      <span className="font-mono text-muted-foreground">{m.count} units</span>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-muted-foreground">No model telemetry recorded yet.</p>
                )}
              </div>
            </div>
          </div>

          {/* Quick Guidance Box */}
          <div className="p-5 rounded-2xl border border-border bg-card/40 space-y-2 text-xs text-muted-foreground">
            <h5 className="font-bold text-foreground flex items-center gap-2">
              <Info className="w-4 h-4 text-primary" /> How ONU Management Works
            </h5>
            <p>
              1. <strong>Automatic Detection:</strong> When ONUs are discovered via OLT synchronization or SNMP polling, the system identifies the vendor and model using ITU-T G.984 serial prefixes and equipment IDs.
            </p>
            <p>
              2. <strong>Model Profiles:</strong> Central profiles define the web login URLs, authentication mechanisms, and Wi-Fi parameter formats for each hardware model.
            </p>
            <p>
              3. <strong>Credential Hierarchy:</strong> Credentials follow a strict precedence resolution: <em>Device Override &rarr; Branch Credentials &rarr; Model Profile Defaults &rarr; Global Defaults</em>.
            </p>
            <p>
              4. <strong>Customer Wi-Fi Management:</strong> In the customer profile modal under the &quot;ONU / Wi-Fi&quot; tab, operators can change the SSID or WPA key with automatic verification and zero plaintext password leaks.
            </p>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. DETECTED ONUS TAB */}
      {/* ========================================================================= */}
      {activeTab === 'detected_onus' && (
        <div className="space-y-4 animate-in fade-in">
          {/* Filters Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl border border-border bg-card shadow-sm">
            <div className="flex items-center gap-2 flex-1">
              <div className="relative flex-1 max-w-sm">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search serial, IP, customer, model..."
                  value={detectedSearch}
                  onChange={(e) => {
                    setDetectedSearch(e.target.value);
                    setDetectedPage(1);
                  }}
                  className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-border bg-background text-xs focus:ring-1 focus:ring-primary outline-none"
                />
              </div>

              <select
                value={detectedVendor}
                onChange={(e) => {
                  setDetectedVendor(e.target.value);
                  setDetectedPage(1);
                }}
                className="px-3 py-1.5 rounded-xl border border-border bg-background text-xs focus:ring-1 focus:ring-primary outline-none"
              >
                <option value="all">All Vendors</option>
                <option value="Huawei">Huawei</option>
                <option value="ZTE">ZTE</option>
                <option value="Fiberhome">Fiberhome</option>
                <option value="BDCOM">BDCOM</option>
                <option value="Powertech">Powertech</option>
                <option value="VSOL">VSOL</option>
              </select>

              <select
                value={detectedWebStatus}
                onChange={(e) => {
                  setDetectedWebStatus(e.target.value);
                  setDetectedPage(1);
                }}
                className="px-3 py-1.5 rounded-xl border border-border bg-background text-xs focus:ring-1 focus:ring-primary outline-none"
              >
                <option value="all">All Web Status</option>
                <option value="reachable">Reachable</option>
                <option value="unreachable">Unreachable</option>
                <option value="unknown">Unknown</option>
              </select>
            </div>

            <div className="text-xs text-muted-foreground">
              Showing {detectedOnus.length} of {totalDetected} ONUs
            </div>
          </div>

          {/* Table */}
          <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-muted/50 border-b border-border text-muted-foreground font-semibold uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="p-3">ONU Hardware</th>
                    <th className="p-3">Location / OLT</th>
                    <th className="p-3">Linked Customer</th>
                    <th className="p-3">Management Target</th>
                    <th className="p-3">Model Profile</th>
                    <th className="p-3">Wi-Fi SSIDs</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {loadingDetected ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-muted-foreground">
                        <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-primary" />
                        Loading detected ONUs...
                      </td>
                    </tr>
                  ) : detectedOnus.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-muted-foreground">
                        No ONUs found matching your filters.
                      </td>
                    </tr>
                  ) : (
                    detectedOnus.map((onu) => (
                      <tr key={onu.id} className="hover:bg-muted/30 transition-colors">
                        <td className="p-3">
                          <div className="space-y-0.5">
                            <span className="font-mono font-bold text-foreground block">
                              {onu.serial_number}
                            </span>
                            <span className="text-[10px] text-muted-foreground">
                              {onu.vendor} &bull; {onu.model}
                            </span>
                          </div>
                        </td>
                        <td className="p-3">
                          <div className="space-y-0.5">
                            <span className="font-medium text-foreground block">{onu.olt_name}</span>
                            <span className="text-[10px] text-muted-foreground font-mono">
                              0/{onu.slot}/{onu.pon_port} : ONT {onu.ont_id}
                            </span>
                          </div>
                        </td>
                        <td className="p-3">
                          {onu.customer_id ? (
                            <button
                              onClick={() => onOpenCustomer?.(onu.customer_id!)}
                              className="text-primary hover:underline font-semibold flex items-center gap-1"
                            >
                              <span>{onu.customer_username || `Customer #${onu.customer_id}`}</span>
                              <ExternalLink className="w-3 h-3 opacity-60" />
                            </button>
                          ) : (
                            <span className="text-[10px] text-muted-foreground italic">Unassigned</span>
                          )}
                        </td>
                        <td className="p-3">
                          <div className="space-y-0.5">
                            <span className="font-mono text-foreground block">
                              {onu.management_ip || 'No IP set'}
                            </span>
                            <div className="flex items-center gap-1.5">
                              <span
                                className={cn(
                                  'w-1.5 h-1.5 rounded-full',
                                  onu.web_status === 'reachable'
                                    ? 'bg-emerald-500'
                                    : onu.web_status === 'unreachable'
                                    ? 'bg-rose-500'
                                    : 'bg-zinc-400'
                                )}
                              />
                              <span className="text-[10px] text-muted-foreground uppercase font-mono">
                                {onu.web_protocol.toUpperCase()}:{onu.web_port} ({onu.web_status})
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="p-3">
                          {onu.profile_name ? (
                            <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 text-[10px] font-semibold">
                              {onu.profile_name}
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 text-[10px] font-semibold">
                              Pending Profile
                            </span>
                          )}
                        </td>
                        <td className="p-3">
                          <div className="space-y-0.5">
                            {onu.wifi_ssid_2g && (
                              <span className="text-[10px] text-foreground font-mono block">
                                2.4G: {onu.wifi_ssid_2g}
                              </span>
                            )}
                            {onu.wifi_ssid_5g && (
                              <span className="text-[10px] text-muted-foreground font-mono block">
                                5G: {onu.wifi_ssid_5g}
                              </span>
                            )}
                            {!onu.wifi_ssid_2g && !onu.wifi_ssid_5g && (
                              <span className="text-[10px] text-muted-foreground italic">Not sampled</span>
                            )}
                          </div>
                        </td>
                        <td className="p-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleTestConnection(onu.id)}
                              disabled={testingOnuId === onu.id}
                              className="px-2 py-1 rounded-lg border border-border text-[11px] font-medium hover:bg-muted transition-colors disabled:opacity-50"
                              title="Test reachability & port"
                            >
                              Ping
                            </button>
                            <button
                              onClick={() => handleTestLogin(onu.id)}
                              disabled={testingOnuId === onu.id}
                              className="px-2 py-1 rounded-lg border border-border text-[11px] font-medium hover:bg-muted transition-colors disabled:opacity-50"
                              title="Test login with scoped credentials"
                            >
                              Login
                            </button>
                            {onu.customer_id && (
                              <button
                                onClick={() => onOpenCustomer?.(onu.customer_id!)}
                                className="px-2 py-1 rounded-lg bg-primary text-primary-foreground text-[11px] font-semibold hover:bg-primary/90 transition-colors shadow-sm"
                                title="Manage Wi-Fi settings"
                              >
                                Wi-Fi
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination footer */}
            <div className="p-3 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
              <span>Page {detectedPage}</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setDetectedPage((p) => Math.max(1, p - 1))}
                  disabled={detectedPage <= 1}
                  className="px-2.5 py-1 rounded-lg border border-border disabled:opacity-40 hover:bg-muted"
                >
                  Previous
                </button>
                <button
                  onClick={() => setDetectedPage((p) => p + 1)}
                  disabled={detectedOnus.length < 25}
                  className="px-2.5 py-1 rounded-lg border border-border disabled:opacity-40 hover:bg-muted"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. NEW MODEL REQUESTS TAB */}
      {/* ========================================================================= */}
      {activeTab === 'model_requests' && (
        <div className="space-y-4 animate-in fade-in">
          {/* Filter Bar */}
          <div className="flex items-center justify-between p-3.5 rounded-2xl border border-border bg-card shadow-sm">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-foreground">Filter Status:</span>
              {(['pending', 'resolved', 'ignored'] as const).map((st) => (
                <button
                  key={st}
                  onClick={() => setRequestStatusFilter(st)}
                  className={cn(
                    'px-3 py-1 rounded-xl text-xs font-semibold capitalize transition-colors',
                    requestStatusFilter === st
                      ? 'bg-primary text-primary-foreground'
                      : 'border border-border text-muted-foreground hover:bg-muted'
                  )}
                >
                  {st}
                </button>
              ))}
            </div>
            <span className="text-xs text-muted-foreground">
              {modelRequests.length} request{modelRequests.length !== 1 ? 's' : ''}
            </span>
          </div>

          {/* Cards List */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {loadingRequests ? (
              <div className="col-span-2 p-8 text-center text-muted-foreground">
                <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-primary" />
                Loading new model requests...
              </div>
            ) : modelRequests.length === 0 ? (
              <div className="col-span-2 p-8 text-center text-muted-foreground border border-dashed border-border rounded-2xl">
                No model requests found in &quot;{requestStatusFilter}&quot; status.
              </div>
            ) : (
              modelRequests.map((req) => (
                <div
                  key={req.id}
                  className="p-5 rounded-2xl border border-border bg-card shadow-sm space-y-4 flex flex-col justify-between"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 text-[10px] font-bold uppercase">
                        {req.status}
                      </span>
                      <span className="text-xs font-mono font-bold text-foreground">
                        {req.device_count} device{req.device_count !== 1 ? 's' : ''} detected
                      </span>
                    </div>

                    <div>
                      <h4 className="text-base font-bold text-foreground">
                        {req.vendor} {req.model}
                      </h4>
                      {req.firmware && (
                        <p className="text-xs text-muted-foreground font-mono">Firmware: {req.firmware}</p>
                      )}
                    </div>

                    <div className="text-xs space-y-1 text-muted-foreground pt-2 border-t border-border/60">
                      <div>
                        <strong>OLT Node:</strong> {req.olt_name || `OLT #${req.detected_on_olt_id}`}
                      </div>
                      {req.sample_serial_number && (
                        <div>
                          <strong>Sample SN:</strong>{' '}
                          <span className="font-mono text-foreground">{req.sample_serial_number}</span>
                        </div>
                      )}
                      <div>
                        <strong>First Detected:</strong> {new Date(req.first_detected_at).toLocaleString()}
                      </div>
                      <div>
                        <strong>Last Detected:</strong> {new Date(req.last_detected_at).toLocaleString()}
                      </div>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-border flex items-center justify-between">
                    <button
                      onClick={() => handleCreateProfileFromRequest(req)}
                      className="px-3.5 py-1.5 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors shadow-sm flex items-center gap-1.5"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Create Model Profile
                    </button>

                    {req.status === 'pending' && (
                      <button
                        onClick={async () => {
                          await fetch(`/api/onu/model-requests/${req.id}/status`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ status: 'ignored' }),
                          });
                          fetchModelRequests();
                          showNotice('info', 'Request marked as ignored');
                        }}
                        className="text-xs text-muted-foreground hover:text-foreground"
                      >
                        Dismiss
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. MODEL PROFILES TAB */}
      {/* ========================================================================= */}
      {activeTab === 'model_profiles' && (
        <div className="space-y-4 animate-in fade-in">
          {/* Header Action Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl border border-border bg-card shadow-sm">
            <div className="flex items-center gap-2 flex-1">
              <div className="relative flex-1 max-w-sm">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search profile name, vendor, model..."
                  value={profileSearch}
                  onChange={(e) => setProfileSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-border bg-background text-xs focus:ring-1 focus:ring-primary outline-none"
                />
              </div>

              <select
                value={profileVendorFilter}
                onChange={(e) => setProfileVendorFilter(e.target.value)}
                className="px-3 py-1.5 rounded-xl border border-border bg-background text-xs focus:ring-1 focus:ring-primary outline-none"
              >
                <option value="all">All Vendors</option>
                <option value="Huawei">Huawei</option>
                <option value="ZTE">ZTE</option>
                <option value="Fiberhome">Fiberhome</option>
                <option value="BDCOM">BDCOM</option>
                <option value="Powertech">Powertech</option>
                <option value="VSOL">VSOL</option>
              </select>
            </div>

            <button
              onClick={() => {
                setEditingProfile({
                  name: '',
                  vendor: 'Huawei',
                  model: '',
                  adapter_type: 'huawei_web',
                  default_protocol: 'http',
                  default_port: 80,
                  login_path: '/',
                  default_username: 'telecomadmin',
                  capabilities: {
                    change_ssid: true,
                    change_password: true,
                    read_wifi: true,
                    verify_changes: true,
                  },
                  wifi_bands: ['2.4GHz', '5GHz'],
                  status: 'needs_testing',
                  tested_capabilities: {
                    connection: false,
                    auth: false,
                    info: false,
                    ssid: false,
                    password: false,
                    verify: false,
                  },
                });
                setProfileModalOpen(true);
              }}
              className="px-3.5 py-1.5 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors shadow-sm flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Model Profile
            </button>
          </div>

          {/* Profiles Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {loadingProfiles ? (
              <div className="col-span-3 p-8 text-center text-muted-foreground">
                <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-primary" />
                Loading model profiles...
              </div>
            ) : profiles.length === 0 ? (
              <div className="col-span-3 p-8 text-center text-muted-foreground border border-dashed border-border rounded-2xl">
                No model profiles configured yet. Click &quot;Add Model Profile&quot; to register one.
              </div>
            ) : (
              profiles.map((prof) => (
                <div
                  key={prof.id}
                  className="p-5 rounded-2xl border border-border bg-card shadow-sm space-y-4 flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span
                        className={cn(
                          'px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border',
                          prof.status === 'active'
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                            : prof.status === 'needs_testing'
                            ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                            : 'bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/20'
                        )}
                      >
                        {prof.status.replace('_', ' ')}
                      </span>

                      <span className="text-[10px] font-mono text-muted-foreground">
                        {prof.default_protocol.toUpperCase()} : {prof.default_port}
                      </span>
                    </div>

                    <div>
                      <h4 className="text-base font-bold text-foreground">{prof.name}</h4>
                      <p className="text-xs text-muted-foreground">
                        {prof.vendor} &bull; {prof.model}
                      </p>
                    </div>

                    <div className="p-2.5 rounded-xl bg-muted/40 text-[11px] space-y-1 font-mono">
                      <div>Adapter: {prof.adapter_type}</div>
                      <div>Default User: {prof.default_username}</div>
                      <div>Bands: {prof.wifi_bands?.join(', ') || '2.4GHz'}</div>
                    </div>

                    {prof.notes && (
                      <p className="text-xs text-muted-foreground italic line-clamp-2">{prof.notes}</p>
                    )}
                  </div>

                  <div className="pt-3 border-t border-border flex items-center justify-between">
                    <button
                      onClick={() => {
                        setEditingProfile(prof);
                        setProfileModalOpen(true);
                      }}
                      className="px-3 py-1.5 rounded-lg border border-border text-xs font-semibold hover:bg-muted transition-colors"
                    >
                      Edit Profile
                    </button>

                    <button
                      onClick={() => {
                        const copy = { ...prof, id: undefined, name: `${prof.name} (Copy)` };
                        setEditingProfile(copy);
                        setProfileModalOpen(true);
                      }}
                      className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                      title="Duplicate this profile"
                    >
                      <Copy className="w-3 h-3" />
                      Duplicate
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. MANAGEMENT CREDENTIALS TAB */}
      {/* ========================================================================= */}
      {activeTab === 'credentials' && (
        <div className="space-y-4 animate-in fade-in">
          {/* Precedence Banner */}
          <div className="p-4 rounded-2xl border border-primary/20 bg-primary/5 flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2.5">
              <ShieldCheck className="w-5 h-5 text-primary flex-shrink-0" />
              <div>
                <strong className="text-foreground">Credential Resolution Hierarchy:</strong>
                <span className="text-muted-foreground block">
                  1. Device Override &rarr; 2. Branch Credentials &rarr; 3. Model Profile Default &rarr; 4. Global Default
                </span>
              </div>
            </div>
            <button
              onClick={() => setCredentialModalOpen(true)}
              className="px-3.5 py-1.5 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors shadow-sm flex items-center gap-1.5 whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Scoped Credential
            </button>
          </div>

          {/* Credentials List */}
          <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-muted/50 border-b border-border text-muted-foreground font-semibold uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="p-3">Profile Name</th>
                    <th className="p-3">Scope</th>
                    <th className="p-3">Scope Target</th>
                    <th className="p-3">Username</th>
                    <th className="p-3">Password</th>
                    <th className="p-3">Notes</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {loadingCredentials ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-muted-foreground">
                        <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-primary" />
                        Loading credentials...
                      </td>
                    </tr>
                  ) : credentials.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-muted-foreground">
                        No scoped credentials registered.
                      </td>
                    </tr>
                  ) : (
                    credentials.map((cred) => (
                      <tr key={cred.id} className="hover:bg-muted/30 transition-colors">
                        <td className="p-3 font-semibold text-foreground">{cred.name}</td>
                        <td className="p-3">
                          <span
                            className={cn(
                              'px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border',
                              cred.scope === 'device' && 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
                              cred.scope === 'branch' && 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
                              cred.scope === 'model' && 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
                              cred.scope === 'global' && 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                            )}
                          >
                            {cred.scope}
                          </span>
                        </td>
                        <td className="p-3 text-muted-foreground">
                          {cred.scope === 'global' && 'All Devices (Fallback)'}
                          {cred.scope === 'model' && (cred.profile_name || `Profile #${cred.profile_id}`)}
                          {cred.scope === 'branch' && (cred.branch_name || `Branch #${cred.branch_id}`)}
                          {cred.scope === 'device' && (cred.onu_serial || `ONU #${cred.onu_id}`)}
                        </td>
                        <td className="p-3 font-mono font-medium text-foreground">{cred.username}</td>
                        <td className="p-3 font-mono text-muted-foreground">{cred.password_masked}</td>
                        <td className="p-3 text-muted-foreground italic">{cred.notes || '—'}</td>
                        <td className="p-3 text-right">
                          <button
                            onClick={async () => {
                              if (confirm(`Remove credential "${cred.name}"?`)) {
                                await fetch(`/api/onu/credentials/${cred.id}`, { method: 'DELETE' });
                                fetchCredentials();
                                showNotice('info', 'Credential profile removed');
                              }
                            }}
                            className="p-1 rounded-lg hover:bg-rose-500/10 text-rose-600 dark:text-rose-400 transition-colors"
                            title="Delete credential"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
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
      )}

      {/* ========================================================================= */}
      {/* 6. ACTIVITY LOGS TAB */}
      {/* ========================================================================= */}
      {activeTab === 'logs' && (
        <div className="space-y-4 animate-in fade-in">
          {/* Filter Bar */}
          <div className="flex items-center justify-between p-3.5 rounded-2xl border border-border bg-card shadow-sm">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-foreground">Filter Status:</span>
              {(['all', 'success', 'failed', 'unsupported'] as const).map((st) => (
                <button
                  key={st}
                  onClick={() => setLogStatusFilter(st)}
                  className={cn(
                    'px-3 py-1 rounded-xl text-xs font-semibold capitalize transition-colors',
                    logStatusFilter === st
                      ? 'bg-primary text-primary-foreground'
                      : 'border border-border text-muted-foreground hover:bg-muted'
                  )}
                >
                  {st}
                </button>
              ))}
            </div>
            <span className="text-xs text-muted-foreground">{logs.length} recent operations</span>
          </div>

          {/* Logs Table */}
          <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-muted/50 border-b border-border text-muted-foreground font-semibold uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="p-3">Timestamp</th>
                    <th className="p-3">Operation</th>
                    <th className="p-3">Target ONU / Customer</th>
                    <th className="p-3">Operator</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Verification</th>
                    <th className="p-3">Details / Errors</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {loadingLogs ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-muted-foreground">
                        <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-primary" />
                        Loading activity logs...
                      </td>
                    </tr>
                  ) : logs.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-muted-foreground">
                        No activity records found.
                      </td>
                    </tr>
                  ) : (
                    logs.map((log) => (
                      <tr key={log.id} className="hover:bg-muted/30 transition-colors">
                        <td className="p-3 text-muted-foreground font-mono">
                          {new Date(log.created_at).toLocaleString()}
                        </td>
                        <td className="p-3 font-semibold text-foreground capitalize">
                          {log.operation_type.replace(/_/g, ' ')}
                        </td>
                        <td className="p-3">
                          <div className="space-y-0.5">
                            <span className="font-mono text-foreground block">
                              {log.onu_serial || `ONU #${log.onu_id}`}
                            </span>
                            {log.customer_username && (
                              <span className="text-[10px] text-muted-foreground">
                                Customer: {log.customer_username}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="p-3 text-muted-foreground">{log.operator_username || 'system'}</td>
                        <td className="p-3">
                          <span
                            className={cn(
                              'px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border',
                              log.status === 'success'
                                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                                : log.status === 'failed'
                                ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20'
                                : 'bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/20'
                            )}
                          >
                            {log.status}
                          </span>
                        </td>
                        <td className="p-3">
                          <span
                            className={cn(
                              'text-[10px] font-medium capitalize',
                              log.verification_status === 'verified'
                                ? 'text-emerald-600 dark:text-emerald-400 font-bold'
                                : log.verification_status === 'failed'
                                ? 'text-rose-600 dark:text-rose-400 font-bold'
                                : 'text-muted-foreground'
                            )}
                          >
                            {log.verification_status.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="p-3 text-muted-foreground">
                          {log.error_message ? (
                            <span className="text-rose-600 dark:text-rose-400 font-mono text-[11px]">
                              {log.error_message}
                            </span>
                          ) : (
                            <span className="text-[11px] font-mono">
                              {log.sanitized_details ? JSON.stringify(log.sanitized_details) : 'Completed'}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: Test Connection / Login Result */}
      {/* ========================================================================= */}
      {testResultModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-base text-foreground flex items-center gap-2">
                <Activity className="w-5 h-5 text-primary" />
                {testResultModal.title}
              </h3>
              <button
                onClick={() => setTestResultModal(null)}
                className="text-muted-foreground hover:text-foreground"
              >
                &times;
              </button>
            </div>

            <div className="p-4 rounded-xl bg-muted/40 text-xs font-mono space-y-2">
              <pre className="whitespace-pre-wrap break-all text-[11px]">
                {JSON.stringify(testResultModal.result, null, 2)}
              </pre>
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => setTestResultModal(null)}
                className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: Create / Edit Model Profile */}
      {/* ========================================================================= */}
      {profileModalOpen && editingProfile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in overflow-y-auto">
          <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-xl space-y-4 my-8">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-base text-foreground">
                {editingProfile.id ? 'Edit Model Profile' : 'Create ONU Model Profile'}
              </h3>
              <button
                onClick={() => setProfileModalOpen(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                &times;
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-muted-foreground font-semibold mb-1">Profile Name</label>
                <input
                  type="text"
                  value={editingProfile.name || ''}
                  onChange={(e) => setEditingProfile({ ...editingProfile, name: e.target.value })}
                  placeholder="e.g. Huawei HG8145V5 Standard"
                  className="w-full px-3 py-2 rounded-xl border border-border bg-background text-xs outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-muted-foreground font-semibold mb-1">Vendor</label>
                  <select
                    value={editingProfile.vendor || 'Huawei'}
                    onChange={(e) => setEditingProfile({ ...editingProfile, vendor: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-border bg-background text-xs outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="Huawei">Huawei</option>
                    <option value="ZTE">ZTE</option>
                    <option value="Fiberhome">Fiberhome</option>
                    <option value="BDCOM">BDCOM</option>
                    <option value="Powertech">Powertech</option>
                    <option value="VSOL">VSOL</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-muted-foreground font-semibold mb-1">Model Name</label>
                  <input
                    type="text"
                    value={editingProfile.model || ''}
                    onChange={(e) => setEditingProfile({ ...editingProfile, model: e.target.value })}
                    placeholder="e.g. HG8145V5"
                    className="w-full px-3 py-2 rounded-xl border border-border bg-background text-xs outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-muted-foreground font-semibold mb-1">Adapter Type</label>
                  <select
                    value={editingProfile.adapter_type || 'huawei_web'}
                    onChange={(e) =>
                      setEditingProfile({
                        ...editingProfile,
                        adapter_type: e.target.value as any,
                      })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-border bg-background text-xs outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="huawei_web">Huawei Web Adapter</option>
                    <option value="zte_web">ZTE Web Adapter</option>
                    <option value="generic_web">Generic Web Adapter</option>
                    <option value="unsupported">Unsupported</option>
                  </select>
                </div>

                <div>
                  <label className="block text-muted-foreground font-semibold mb-1">Support Status</label>
                  <select
                    value={editingProfile.status || 'needs_testing'}
                    onChange={(e) =>
                      setEditingProfile({
                        ...editingProfile,
                        status: e.target.value as any,
                      })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-border bg-background text-xs outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="active">Active (Fully Tested)</option>
                    <option value="needs_testing">Needs Testing</option>
                    <option value="disabled">Disabled</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-muted-foreground font-semibold mb-1">Protocol & Port</label>
                  <div className="flex gap-2">
                    <select
                      value={editingProfile.default_protocol || 'http'}
                      onChange={(e) =>
                        setEditingProfile({
                          ...editingProfile,
                          default_protocol: e.target.value as any,
                        })
                      }
                      className="px-2 py-2 rounded-xl border border-border bg-background text-xs outline-none"
                    >
                      <option value="http">HTTP</option>
                      <option value="https">HTTPS</option>
                    </select>
                    <input
                      type="number"
                      value={editingProfile.default_port || 80}
                      onChange={(e) =>
                        setEditingProfile({
                          ...editingProfile,
                          default_port: parseInt(e.target.value, 10),
                        })
                      }
                      className="flex-1 px-3 py-2 rounded-xl border border-border bg-background text-xs outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-muted-foreground font-semibold mb-1">Default Username</label>
                  <input
                    type="text"
                    value={editingProfile.default_username || 'telecomadmin'}
                    onChange={(e) =>
                      setEditingProfile({
                        ...editingProfile,
                        default_username: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-border bg-background text-xs outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-muted-foreground font-semibold mb-1">Notes / Description</label>
                <textarea
                  value={editingProfile.notes || ''}
                  onChange={(e) => setEditingProfile({ ...editingProfile, notes: e.target.value })}
                  placeholder="Hardware specifications, factory defaults, special considerations..."
                  rows={2}
                  className="w-full px-3 py-2 rounded-xl border border-border bg-background text-xs outline-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-border">
              <button
                onClick={() => setProfileModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-border text-xs font-semibold hover:bg-muted"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  try {
                    const isNew = !editingProfile.id;
                    const url = isNew
                      ? '/api/onu/model-profiles'
                      : `/api/onu/model-profiles/${editingProfile.id}`;
                    const method = isNew ? 'POST' : 'PUT';

                    const res = await fetch(url, {
                      method,
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify(editingProfile),
                    });

                    if (res.ok) {
                      setProfileModalOpen(false);
                      fetchProfiles();
                      showNotice('success', `Model profile ${isNew ? 'created' : 'updated'} successfully`);
                    } else {
                      const json = await res.json();
                      showNotice('error', json.error?.message || 'Failed to save profile');
                    }
                  } catch (err: any) {
                    showNotice('error', err.message);
                  }
                }}
                className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90"
              >
                Save Profile
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: Add Scoped Credential */}
      {/* ========================================================================= */}
      {credentialModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-base text-foreground">Add Scoped Credential</h3>
              <button
                onClick={() => setCredentialModalOpen(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                &times;
              </button>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const form = e.currentTarget;
                const fd = new FormData(form);
                const body: any = {
                  name: fd.get('name'),
                  scope: fd.get('scope'),
                  username: fd.get('username'),
                  password: fd.get('password'),
                  notes: fd.get('notes'),
                };

                const res = await fetch('/api/onu/credentials', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(body),
                });

                if (res.ok) {
                  setCredentialModalOpen(false);
                  fetchCredentials();
                  showNotice('success', 'Scoped credential saved');
                } else {
                  const json = await res.json();
                  showNotice('error', json.error?.message || 'Failed to save credential');
                }
              }}
              className="space-y-3 text-xs"
            >
              <div>
                <label className="block text-muted-foreground font-semibold mb-1">Credential Name</label>
                <input
                  name="name"
                  required
                  placeholder="e.g. Regional Branch Huawei Access"
                  className="w-full px-3 py-2 rounded-xl border border-border bg-background text-xs outline-none"
                />
              </div>

              <div>
                <label className="block text-muted-foreground font-semibold mb-1">Scope Level</label>
                <select
                  name="scope"
                  required
                  className="w-full px-3 py-2 rounded-xl border border-border bg-background text-xs outline-none"
                >
                  <option value="global">Global Default (Lowest Priority Fallback)</option>
                  <option value="model">Model Specific</option>
                  <option value="branch">Branch Specific</option>
                  <option value="device">Device Specific (Highest Priority Override)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-muted-foreground font-semibold mb-1">Username</label>
                  <input
                    name="username"
                    required
                    placeholder="telecomadmin"
                    className="w-full px-3 py-2 rounded-xl border border-border bg-background text-xs outline-none"
                  />
                </div>

                <div>
                  <label className="block text-muted-foreground font-semibold mb-1">Password</label>
                  <input
                    name="password"
                    type="password"
                    required
                    placeholder="admintelecom"
                    className="w-full px-3 py-2 rounded-xl border border-border bg-background text-xs outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-muted-foreground font-semibold mb-1">Notes</label>
                <textarea
                  name="notes"
                  rows={2}
                  placeholder="Description or context..."
                  className="w-full px-3 py-2 rounded-xl border border-border bg-background text-xs outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-border">
                <button
                  type="button"
                  onClick={() => setCredentialModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-border text-xs font-semibold hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90"
                >
                  Save Credential
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
