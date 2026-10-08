'use client';

import React from 'react';
import {
  Users,
  Plus,
  Search,
  Filter,
  Edit2,
  Trash2,
  PauseCircle,
  PlayCircle,
  PowerOff,
  Radio,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Clock,
  Layers,
  ChevronLeft,
  ChevronRight,
  Shield,
  Eye,
  Activity,
  ArrowUpDown,
  Download,
  CheckSquare,
  Square,
  Package,
  X,
  Building2,
  Store,
  ShieldCheck,
  RotateCcw,
} from 'lucide-react';
import type { SubscriberItem, PackageItem, NasDeviceItem, IpPoolItem } from '@/types/api';
import { SubscriberProfileModal } from './subscriber-profile-modal';
import { SubscriberOwnershipModal } from './subscriber-ownership-modal';

interface SubscribersViewProps {
  onOpenSubscriberDetails?: (sub: SubscriberItem) => void;
  initialStatus?: string;
  initialExpiry?: string;
  initialOnline?: 'all' | 'true' | 'false';
  initialBranch?: string;
  initialPackage?: string;
  initialSearch?: string;
  autoOpenCreate?: boolean;
}

export function SubscribersView({
  onOpenSubscriberDetails,
  initialStatus,
  initialExpiry,
  initialOnline,
  initialBranch,
  initialPackage,
  initialSearch,
  autoOpenCreate,
}: SubscribersViewProps) {
  const [subscribers, setSubscribers] = React.useState<SubscriberItem[]>([]);
  const [packages, setPackages] = React.useState<PackageItem[]>([]);
  const [nasDevices, setNasDevices] = React.useState<NasDeviceItem[]>([]);
  const [ipPools, setIpPools] = React.useState<IpPoolItem[]>([]);
  const [branches, setBranches] = React.useState<{ id: number; name: string }[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [meta, setMeta] = React.useState({ page: 1, limit: 15, total: 0, totalPages: 1 });

  // Filters & Search
  const [search, setSearch] = React.useState(initialSearch || '');
  const [statusFilter, setStatusFilter] = React.useState(initialStatus || 'all');
  const [packageFilter, setPackageFilter] = React.useState<string>(initialPackage || 'all');
  const [ownershipFilter, setOwnershipFilter] = React.useState<string>('all');
  const [onlineFilter, setOnlineFilter] = React.useState<'all' | 'true' | 'false'>(initialOnline || 'all');
  const [connTypeFilter, setConnTypeFilter] = React.useState('all');
  const [branchFilter, setBranchFilter] = React.useState(initialBranch || 'all');
  const [expiryFilter, setExpiryFilter] = React.useState(initialExpiry || 'all');
  const [sortBy, setSortBy] = React.useState('created_at');
  const [sortDir, setSortDir] = React.useState<'asc' | 'desc'>('desc');

  // Bulk Selection
  const [selectedIds, setSelectedIds] = React.useState<number[]>([]);
  const [bulkAction, setBulkAction] = React.useState<'suspend' | 'resume' | 'enable' | 'disable' | 'change_package' | null>(null);
  const [bulkPackageId, setBulkPackageId] = React.useState<number | null>(null);
  const [bulkSubmitting, setBulkSubmitting] = React.useState(false);
  const [bulkResult, setBulkResult] = React.useState<{ successful: number; failed: number; results: any[] } | null>(null);

  // Profile Modal State
  const [profileModalSubId, setProfileModalSubId] = React.useState<number | null>(null);
  const [ownershipModalSub, setOwnershipModalSub] = React.useState<SubscriberItem | null>(null);

  // Modals & Actions
  const [modalOpen, setModalOpen] = React.useState(autoOpenCreate || false);
  const [editingSub, setEditingSub] = React.useState<SubscriberItem | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = React.useState<number | null>(null);
  const [actionNotice, setActionNotice] = React.useState<string | null>(null);

  // Form State
  const [formCustId, setFormCustId] = React.useState('');
  const [formUsername, setFormUsername] = React.useState('');
  const [formFullName, setFormFullName] = React.useState('');
  const [formPassword, setFormPassword] = React.useState('');
  const [formConfirmPassword, setFormConfirmPassword] = React.useState('');
  const [formEmail, setFormEmail] = React.useState('');
  const [formPhone, setFormPhone] = React.useState('');
  const [formStatus, setFormStatus] = React.useState<any>('active');
  const [formConnType, setFormConnType] = React.useState('PPPoE');
  const [formAddress, setFormAddress] = React.useState('');
  const [formArea, setFormArea] = React.useState('');
  const [formBranch, setFormBranch] = React.useState('');
  const [formPackageId, setFormPackageId] = React.useState<number | ''>('');
  const [formPoolId, setFormPoolId] = React.useState<number | ''>('');
  const [formStaticIp, setFormStaticIp] = React.useState('');
  const [formIpv6Prefix, setFormIpv6Prefix] = React.useState('');
  const [formMac, setFormMac] = React.useState('');
  const [formVlan, setFormVlan] = React.useState<number | ''>('');
  const [formNasRestrictionId, setFormNasRestrictionId] = React.useState<number | ''>('');
  const [formOltPon, setFormOltPon] = React.useState('');
  const [formOnuMac, setFormOnuMac] = React.useState('');
  const [formExpiryDate, setFormExpiryDate] = React.useState('');
  const [formNotes, setFormNotes] = React.useState('');
  const [formError, setFormError] = React.useState<string | null>(null);
  const [formSubmitting, setFormSubmitting] = React.useState(false);

  const fetchDependencies = async () => {
    try {
      const [pkgRes, nasRes, poolRes, branchRes] = await Promise.all([
        fetch('/api/packages'),
        fetch('/api/nas'),
        fetch('/api/ip-pools'),
        fetch('/api/branches').catch(() => null),
      ]);
      if (pkgRes.ok) {
        const j = await pkgRes.json();
        setPackages(j.data || []);
      }
      if (nasRes.ok) {
        const j = await nasRes.json();
        setNasDevices(j.data || []);
      }
      if (poolRes.ok) {
        const j = await poolRes.json();
        setIpPools(j.data || []);
      }
      if (branchRes && branchRes.ok) {
        const j = await branchRes.json();
        setBranches(j.data || []);
      }
    } catch {}
  };

  const fetchSubscribers = async (page = meta.page) => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', String(meta.limit));
      if (search.trim()) params.set('search', search.trim());
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (packageFilter !== 'all') params.set('package_id', packageFilter);
      if (ownershipFilter !== 'all') params.set('ownership_type', ownershipFilter);
      if (onlineFilter !== 'all') params.set('is_online', onlineFilter);
      if (connTypeFilter !== 'all') params.set('connection_type', connTypeFilter);
      if (branchFilter !== 'all') params.set('branch', branchFilter);
      if (expiryFilter !== 'all') params.set('expiry_status', expiryFilter);
      params.set('sort_by', sortBy);
      params.set('sort_dir', sortDir);

      const res = await fetch(`/api/subscribers?${params.toString()}`);
      if (res.ok) {
        const json = await res.json();
        setSubscribers(json.data || []);
        if (json.meta) setMeta(json.meta);
      }
    } catch {} finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchDependencies();
  }, []);

  React.useEffect(() => {
    if (initialStatus !== undefined) setStatusFilter(initialStatus || 'all');
  }, [initialStatus]);

  React.useEffect(() => {
    if (initialExpiry !== undefined) setExpiryFilter(initialExpiry || 'all');
  }, [initialExpiry]);

  React.useEffect(() => {
    if (initialOnline !== undefined) setOnlineFilter(initialOnline || 'all');
  }, [initialOnline]);

  React.useEffect(() => {
    if (initialBranch !== undefined) setBranchFilter(initialBranch || 'all');
  }, [initialBranch]);

  React.useEffect(() => {
    if (initialPackage !== undefined) setPackageFilter(initialPackage || 'all');
  }, [initialPackage]);

  React.useEffect(() => {
    if (initialSearch !== undefined) setSearch(initialSearch || '');
  }, [initialSearch]);

  React.useEffect(() => {
    if (autoOpenCreate) {
      setEditingSub(null);
      setModalOpen(true);
    }
  }, [autoOpenCreate]);

  React.useEffect(() => {
    fetchSubscribers(1);
    setSelectedIds([]);
  }, [search, statusFilter, packageFilter, ownershipFilter, onlineFilter, connTypeFilter, branchFilter, expiryFilter, sortBy, sortDir]);

  const toggleSelectAll = () => {
    if (selectedIds.length === subscribers.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(subscribers.map((s) => s.id));
    }
  };

  const toggleSelectOne = (id: number) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter((item) => item !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  const handleExportCsv = () => {
    const params = new URLSearchParams();
    if (search.trim()) params.set('search', search.trim());
    if (statusFilter !== 'all') params.set('status', statusFilter);
    if (packageFilter !== 'all') params.set('package_id', packageFilter);
    if (ownershipFilter !== 'all') params.set('ownership_type', ownershipFilter);
    window.location.href = `/api/subscribers/export/csv?${params.toString()}`;
  };

  const handleExecuteBulk = async () => {
    if (!bulkAction || selectedIds.length === 0) return;
    try {
      setBulkSubmitting(true);
      const res = await fetch('/api/subscribers/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: bulkAction,
          subscriber_ids: selectedIds,
          package_id: bulkPackageId || undefined,
        }),
      });

      if (res.ok) {
        const json = await res.json();
        setBulkResult(json.data);
        fetchSubscribers();
        setSelectedIds([]);
      }
    } catch {} finally {
      setBulkSubmitting(false);
    }
  };

  const openAddModal = () => {
    setEditingSub(null);
    setFormCustId(`FW${Math.floor(100000 + Math.random() * 900000)}`);
    setFormUsername('');
    setFormFullName('');
    setFormPassword('');
    setFormConfirmPassword('');
    setFormEmail('');
    setFormPhone('');
    setFormStatus('active');
    setFormConnType('PPPoE');
    setFormAddress('');
    setFormArea('');
    setFormBranch('');
    setFormPackageId(packages[0]?.id || '');
    setFormPoolId(ipPools[0]?.id || '');
    setFormStaticIp('');
    setFormIpv6Prefix('');
    setFormMac('');
    setFormVlan('');
    setFormNasRestrictionId('');
    setFormOltPon('');
    setFormOnuMac('');
    const d = new Date();
    d.setDate(d.getDate() + 30);
    setFormExpiryDate(d.toISOString().split('T')[0]);
    setFormNotes('');
    setFormError(null);
    setModalOpen(true);
  };

  const openEditModal = (sub: SubscriberItem) => {
    setEditingSub(sub);
    setFormCustId(sub.customer_id);
    setFormUsername(sub.username);
    setFormFullName(sub.full_name);
    setFormPassword('');
    setFormConfirmPassword('');
    setFormEmail(sub.email || '');
    setFormPhone(sub.phone || '');
    setFormStatus(sub.status);
    setFormConnType(sub.connection_type || 'PPPoE');
    setFormAddress(sub.address || '');
    setFormArea(sub.area || '');
    setFormBranch(sub.branch || '');
    setFormPackageId(sub.current_package_id || '');
    setFormPoolId(sub.ip_pool_id || '');
    setFormStaticIp(sub.static_ip || '');
    setFormIpv6Prefix(sub.ipv6_prefix || '');
    setFormMac(sub.mac_address || '');
    setFormVlan(sub.vlan_id || '');
    setFormNasRestrictionId(sub.nas_restriction_id || '');
    setFormOltPon(sub.olt_pon_port || '');
    setFormOnuMac(sub.onu_mac_sn || '');
    setFormExpiryDate(sub.expiry_date ? new Date(sub.expiry_date).toISOString().split('T')[0] : '');
    setFormNotes(sub.notes || '');
    setFormError(null);
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!formCustId.trim() || !formUsername.trim() || !formFullName.trim()) {
      setFormError('Customer ID, Username, and Full Name are required.');
      return;
    }
    if (!editingSub && !formPassword) {
      setFormError('Password is required for new subscribers.');
      return;
    }
    if (formPassword && formPassword !== formConfirmPassword) {
      setFormError('Passwords do not match.');
      return;
    }

    try {
      setFormSubmitting(true);
      const payload = {
        customer_id: formCustId.trim(),
        username: formUsername.trim(),
        full_name: formFullName.trim(),
        password: formPassword || undefined,
        email: formEmail.trim() || undefined,
        phone: formPhone.trim() || undefined,
        status: formStatus,
        connection_type: formConnType,
        address: formAddress.trim() || undefined,
        area: formArea.trim() || undefined,
        branch: formBranch.trim() || undefined,
        current_package_id: formPackageId ? Number(formPackageId) : undefined,
        ip_pool_id: formPoolId ? Number(formPoolId) : undefined,
        static_ip: formStaticIp.trim() || undefined,
        ipv6_prefix: formIpv6Prefix.trim() || undefined,
        mac_address: formMac.trim() || undefined,
        vlan_id: formVlan ? Number(formVlan) : undefined,
        nas_restriction_id: formNasRestrictionId ? Number(formNasRestrictionId) : undefined,
        olt_pon_port: formOltPon.trim() || undefined,
        onu_mac_sn: formOnuMac.trim() || undefined,
        expiry_date: formExpiryDate ? new Date(formExpiryDate).toISOString() : undefined,
        notes: formNotes.trim() || undefined,
      };

      const url = editingSub ? `/api/subscribers/${editingSub.id}` : '/api/subscribers';
      const method = editingSub ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error?.message || 'Failed to save subscriber');
      }

      setModalOpen(false);
      fetchSubscribers();
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      const res = await fetch(`/api/subscribers/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setDeleteConfirmId(null);
        fetchSubscribers();
      }
    } catch {}
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
      case 'enabled':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
            <CheckCircle2 className="w-3.5 h-3.5" /> Active
          </span>
        );
      case 'suspended':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-500 border border-amber-500/20">
            <PauseCircle className="w-3.5 h-3.5" /> Suspended
          </span>
        );
      case 'expired':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-500 border border-rose-500/20">
            <AlertTriangle className="w-3.5 h-3.5" /> Expired
          </span>
        );
      case 'disabled':
      case 'terminated':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-muted text-muted-foreground border border-border">
            <XCircle className="w-3.5 h-3.5" /> {status}
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-muted text-muted-foreground border border-border">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold tracking-tight text-foreground">
              {statusFilter === 'expired' ? 'Expired Customers' : 'Total Customers'}
            </h2>
            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20">
              {meta.total} {statusFilter === 'expired' ? 'Expired' : 'Customers'}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {statusFilter === 'expired'
              ? 'Customer accounts with expired subscriptions pending renewal or follow-up.'
              : 'Complete customer directory with package assignment, static IP provisioning, and FreeRADIUS authentication.'}
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleExportCsv}
            className="px-3.5 py-2 rounded-xl border border-border bg-card hover:bg-accent text-xs font-semibold flex items-center gap-1.5 transition-colors"
            title="Export filtered records to CSV"
          >
            <Download className="w-4 h-4 text-primary" /> Export CSV
          </button>
          <button
            onClick={() => fetchSubscribers(meta.page)}
            disabled={loading}
            className="p-2 rounded-xl border border-border bg-card hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={openAddModal}
            className="px-4 py-2 rounded-xl bg-primary text-primary-foreground font-semibold text-xs flex items-center gap-1.5 hover:opacity-95 shadow-sm transition-all"
          >
            <Plus className="w-4 h-4" /> Add Subscriber
          </button>
        </div>
      </div>

      {/* Bulk Action Ribbon */}
      {selectedIds.length > 0 && (
        <div className="p-3 rounded-2xl bg-primary/10 border border-primary/20 flex flex-wrap items-center justify-between gap-3 animate-in fade-in">
          <div className="flex items-center gap-2 text-xs font-bold text-primary">
            <CheckSquare className="w-4 h-4" />
            <span>Selected {selectedIds.length} subscriber(s)</span>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <button
              onClick={() => {
                setBulkAction('suspend');
              }}
              className="px-3 py-1.5 rounded-xl bg-amber-600 text-white font-medium hover:bg-amber-700 flex items-center gap-1"
            >
              <PauseCircle className="w-3.5 h-3.5" /> Bulk Suspend
            </button>
            <button
              onClick={() => {
                setBulkAction('resume');
              }}
              className="px-3 py-1.5 rounded-xl bg-emerald-600 text-white font-medium hover:bg-emerald-700 flex items-center gap-1"
            >
              <PlayCircle className="w-3.5 h-3.5" /> Bulk Resume
            </button>
            <button
              onClick={() => {
                setBulkAction('change_package');
                setBulkPackageId(packages[0]?.id || null);
              }}
              className="px-3 py-1.5 rounded-xl bg-card border border-border text-foreground font-medium hover:bg-accent flex items-center gap-1"
            >
              <Package className="w-3.5 h-3.5 text-primary" /> Assign Package
            </button>
            <button
              onClick={() => setSelectedIds([])}
              className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="relative col-span-1 sm:col-span-2">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by username, CID, name, phone, IP, MAC..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-xl bg-card border border-border text-xs focus:ring-2 focus:ring-primary outline-none text-foreground placeholder:text-muted-foreground"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 rounded-xl bg-card border border-border text-xs font-medium text-foreground outline-none"
        >
          <option value="all">All Statuses</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
          <option value="expired">Expired</option>
          <option value="disabled">Disabled</option>
        </select>

        <select
          value={packageFilter}
          onChange={(e) => setPackageFilter(e.target.value)}
          className="px-3 py-2 rounded-xl bg-card border border-border text-xs font-medium text-foreground outline-none"
        >
          <option value="all">All Packages</option>
          {packages.map((pkg) => (
            <option key={pkg.id} value={pkg.id}>
              {pkg.name} ({pkg.rate_limit})
            </option>
          ))}
        </select>

        <select
          value={connTypeFilter}
          onChange={(e) => setConnTypeFilter(e.target.value)}
          className="px-3 py-2 rounded-xl bg-card border border-border text-xs font-medium text-foreground outline-none"
        >
          <option value="all">All Connection Types</option>
          <option value="PPPoE">PPPoE</option>
          <option value="IPoE">IPoE</option>
          <option value="Static IP">Static IP</option>
          <option value="Other">Other</option>
        </select>

        <select
          value={ownershipFilter}
          onChange={(e) => setOwnershipFilter(e.target.value)}
          className="px-3 py-2 rounded-xl bg-card border border-border text-xs font-medium text-foreground outline-none"
        >
          <option value="all">All Ownerships</option>
          <option value="head_office">Head Office</option>
          <option value="branch">Branch Owned</option>
          <option value="reseller">Reseller Owned</option>
        </select>

        <select
          value={onlineFilter}
          onChange={(e) => setOnlineFilter(e.target.value as any)}
          className="px-3 py-2 rounded-xl bg-card border border-border text-xs font-medium text-foreground outline-none"
        >
          <option value="all">All Online States</option>
          <option value="true">Online Now</option>
          <option value="false">Offline</option>
        </select>

        <select
          value={expiryFilter}
          onChange={(e) => setExpiryFilter(e.target.value)}
          className="px-3 py-2 rounded-xl bg-card border border-border text-xs font-medium text-foreground outline-none"
        >
          <option value="all">All Expiries</option>
          <option value="7days">Expiring Soon (7 Days)</option>
          <option value="expired">Already Expired</option>
          <option value="today">Expiring Today</option>
          <option value="active">Active (Not Expired)</option>
        </select>

        <select
          value={branchFilter}
          onChange={(e) => setBranchFilter(e.target.value)}
          className="px-3 py-2 rounded-xl bg-card border border-border text-xs font-medium text-foreground outline-none"
        >
          <option value="all">All Branches</option>
          {branches.map((b) => (
            <option key={b.id} value={b.name}>
              {b.name}
            </option>
          ))}
        </select>

        {(search ||
          statusFilter !== 'all' ||
          packageFilter !== 'all' ||
          connTypeFilter !== 'all' ||
          ownershipFilter !== 'all' ||
          onlineFilter !== 'all' ||
          expiryFilter !== 'all' ||
          branchFilter !== 'all') && (
          <button
            onClick={() => {
              setSearch('');
              setStatusFilter('all');
              setPackageFilter('all');
              setConnTypeFilter('all');
              setOwnershipFilter('all');
              setOnlineFilter('all');
              setExpiryFilter('all');
              setBranchFilter('all');
            }}
            className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-border hover:bg-muted text-xs text-rose-500 font-medium transition-colors"
            title="Reset all filters"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Filters</span>
          </button>
        )}
      </div>

      {/* Subscribers Table */}
      <div className="border border-border rounded-2xl bg-card/60 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-muted/40 border-b border-border text-muted-foreground uppercase text-[10px] tracking-wider font-semibold">
              <tr>
                <th className="py-3 px-3 w-8">
                  <input
                    type="checkbox"
                    checked={subscribers.length > 0 && selectedIds.length === subscribers.length}
                    onChange={toggleSelectAll}
                    className="rounded border-border text-primary focus:ring-primary"
                  />
                </th>
                <th className="py-3 px-3">Customer ID</th>
                <th className="py-3 px-3">Username</th>
                <th className="py-3 px-3">Full Name</th>
                <th className="py-3 px-3">Owner / Channel</th>
                <th className="py-3 px-3">Package</th>
                <th className="py-3 px-3">Type</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-3">IP Address</th>
                <th className="py-3 px-3">NAS / Online</th>
                <th className="py-3 px-3">Expiry Date</th>
                <th className="py-3 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={12} className="py-12 text-center text-muted-foreground">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-primary" />
                    Loading subscriber records...
                  </td>
                </tr>
              ) : subscribers.length === 0 ? (
                <tr>
                  <td colSpan={12} className="py-12 text-center text-muted-foreground">
                    No subscribers found matching query filters.
                  </td>
                </tr>
              ) : (
                subscribers.map((sub) => {
                  const isChecked = selectedIds.includes(sub.id);
                  return (
                    <tr
                      key={sub.id}
                      className={`hover:bg-accent/40 transition-colors ${
                        isChecked ? 'bg-primary/5' : ''
                      }`}
                    >
                      <td className="py-3 px-3">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleSelectOne(sub.id)}
                          className="rounded border-border text-primary focus:ring-primary"
                        />
                      </td>
                      <td
                        className="py-3 px-3 font-mono font-bold text-primary cursor-pointer hover:underline"
                        onClick={() => setProfileModalSubId(sub.id)}
                      >
                        {sub.customer_id}
                      </td>
                      <td
                        className="py-3 px-3 font-mono font-medium text-foreground cursor-pointer hover:underline"
                        onClick={() => setProfileModalSubId(sub.id)}
                      >
                        {sub.username}
                      </td>
                      <td className="py-3 px-3 font-semibold text-foreground">{sub.full_name}</td>
                      <td className="py-3 px-3">
                        {sub.ownership_type === 'reseller' ? (
                          <button
                            type="button"
                            onClick={() => setOwnershipModalSub(sub)}
                            className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium bg-purple-500/10 text-purple-400 border border-purple-500/20 hover:bg-purple-500/20 transition-colors"
                            title="Manage Channel Ownership / Transfer"
                          >
                            <Store className="w-3 h-3 text-purple-400" />
                            <span>{sub.reseller_name || 'Reseller'}</span>
                          </button>
                        ) : sub.ownership_type === 'branch' ? (
                          <button
                            type="button"
                            onClick={() => setOwnershipModalSub(sub)}
                            className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20 transition-colors"
                            title="Manage Channel Ownership / Transfer"
                          >
                            <Building2 className="w-3 h-3 text-blue-400" />
                            <span>{sub.branch_name || 'Branch'}</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setOwnershipModalSub(sub)}
                            className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium bg-muted/60 text-muted-foreground border border-border hover:bg-muted transition-colors"
                            title="Manage Channel Ownership / Transfer"
                          >
                            <ShieldCheck className="w-3 h-3 text-emerald-400" />
                            <span>Head Office</span>
                          </button>
                        )}
                      </td>
                      <td className="py-3 px-3">
                        <span className="font-medium text-foreground">{sub.package_name || '—'}</span>
                        <span className="block text-[10px] text-muted-foreground font-mono">
                          {sub.package_speed}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-muted-foreground">{sub.connection_type || 'PPPoE'}</td>
                      <td className="py-3 px-3">{getStatusBadge(sub.status)}</td>
                      <td className="py-3 px-3 font-mono text-[11px]">
                        {sub.is_online ? (
                          <span className="text-emerald-500 font-semibold">{sub.current_ip}</span>
                        ) : sub.static_ip ? (
                          <span className="text-foreground">{sub.static_ip} (Static)</span>
                        ) : (
                          <span className="text-muted-foreground">Dynamic</span>
                        )}
                      </td>
                      <td className="py-3 px-3">
                        {sub.is_online ? (
                          <span className="inline-flex items-center gap-1 text-emerald-500 font-semibold">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            Online
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-[11px]">Offline</span>
                        )}
                        <span className="block text-[10px] text-muted-foreground font-mono">
                          {sub.current_nas_ip || sub.nas_name || '—'}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <span className={sub.is_expired ? 'text-rose-500 font-bold' : 'text-foreground'}>
                          {sub.expiry_date
                            ? new Date(sub.expiry_date).toLocaleDateString()
                            : 'Unlimited'}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => setProfileModalSubId(sub.id)}
                            className="p-1.5 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
                            title="View Full Profile"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setOwnershipModalSub(sub)}
                            className="p-1.5 text-muted-foreground hover:text-purple-400 hover:bg-purple-500/10 rounded-lg transition-colors"
                            title="Transfer Ownership / Channel"
                          >
                            <Building2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => openEditModal(sub)}
                            className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg transition-colors"
                            title="Edit Subscriber"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setDeleteConfirmId(sub.id)}
                            className="p-1.5 text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors"
                            title="Deactivate / Delete"
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

        {/* Pagination Bar */}
        <div className="p-3 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
          <span>
            Showing page {meta.page} of {meta.totalPages} ({meta.total} records)
          </span>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => fetchSubscribers(meta.page - 1)}
              disabled={meta.page <= 1 || loading}
              className="p-1.5 rounded-lg border border-border bg-card hover:bg-accent disabled:opacity-40 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="font-semibold text-foreground px-2">{meta.page}</span>
            <button
              onClick={() => fetchSubscribers(meta.page + 1)}
              disabled={meta.page >= meta.totalPages || loading}
              className="p-1.5 rounded-lg border border-border bg-card hover:bg-accent disabled:opacity-40 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Complete Profile Modal */}
      {profileModalSubId && (
        <SubscriberProfileModal
          subscriberId={profileModalSubId}
          onClose={() => setProfileModalSubId(null)}
          onUpdate={() => fetchSubscribers(meta.page)}
        />
      )}

      {/* Subscriber Channel Ownership / Transfer Modal */}
      {ownershipModalSub && (
        <SubscriberOwnershipModal
          isOpen={!!ownershipModalSub}
          onClose={() => setOwnershipModalSub(null)}
          subscriberId={ownershipModalSub.id}
          username={ownershipModalSub.username}
          currentOwnershipType={ownershipModalSub.ownership_type || 'head_office'}
          currentBranchId={ownershipModalSub.branch_id}
          currentResellerId={ownershipModalSub.reseller_id}
          currentBranchName={ownershipModalSub.branch_name}
          currentResellerName={ownershipModalSub.reseller_name}
          onSuccess={() => {
            fetchSubscribers(meta.page);
          }}
        />
      )}

      {/* Bulk Action Confirmation Modal */}
      {bulkAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-foreground">Confirm Bulk Operation</h3>
            <p className="text-xs text-muted-foreground">
              Are you sure you want to execute <strong className="text-foreground uppercase">{bulkAction.replace('_', ' ')}</strong> on{' '}
              <strong className="text-primary font-bold">{selectedIds.length}</strong> selected subscribers?
            </p>

            {bulkAction === 'change_package' && (
              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">
                  Target Service Package:
                </label>
                <select
                  value={bulkPackageId || ''}
                  onChange={(e) => setBulkPackageId(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl bg-background border border-border text-xs text-foreground outline-none"
                >
                  {packages.map((pkg) => (
                    <option key={pkg.id} value={pkg.id}>
                      {pkg.name} — {pkg.rate_limit}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-border">
              <button
                type="button"
                onClick={() => setBulkAction(null)}
                className="px-4 py-2 rounded-xl bg-accent font-medium text-xs hover:bg-accent/80"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteBulk}
                disabled={bulkSubmitting}
                className="px-4 py-2 rounded-xl bg-primary text-primary-foreground font-semibold text-xs hover:opacity-95"
              >
                {bulkSubmitting ? 'Processing...' : 'Confirm & Execute'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Result Dialog */}
      {bulkResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4 text-center">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-foreground">Bulk Operation Completed</h3>
              <p className="text-xs text-muted-foreground mt-1">
                Successfully processed: <strong className="text-emerald-500">{bulkResult.successful}</strong> | Failed:{' '}
                <strong className="text-rose-500">{bulkResult.failed}</strong>
              </p>
            </div>

            <div className="max-h-48 overflow-y-auto space-y-1 text-left text-xs p-3 rounded-xl bg-muted/40 border border-border font-mono">
              {bulkResult.results.map((r, i) => (
                <div key={i} className="flex items-center justify-between">
                  <span>{r.username}</span>
                  <span className={r.success ? 'text-emerald-500' : 'text-rose-500'}>
                    {r.success ? 'Success' : r.error || 'Failed'}
                  </span>
                </div>
              ))}
            </div>

            <button
              onClick={() => setBulkResult(null)}
              className="w-full py-2 rounded-xl bg-primary text-primary-foreground font-semibold text-xs"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Add / Edit Subscriber Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-background/80 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-2xl w-full max-w-3xl p-6 shadow-2xl space-y-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="text-base font-bold text-foreground">
                {editingSub ? 'Edit Subscriber Profile' : 'Add New Subscriber'}
              </h3>
              <button
                onClick={() => setModalOpen(false)}
                className="p-1 rounded-lg text-muted-foreground hover:text-foreground"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="p-3 rounded-xl border border-rose-500/20 bg-rose-500/10 text-rose-500 text-xs">
                {formError}
              </div>
            )}

            <form onSubmit={handleSave} className="space-y-4 flex-1 overflow-y-auto pr-1 text-xs">
              {/* Customer Information Section */}
              <div className="space-y-3">
                <span className="font-bold text-foreground uppercase tracking-wider text-[11px] block text-primary">
                  1. Customer Details
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="font-medium text-muted-foreground block mb-1">Customer ID *</label>
                    <input
                      type="text"
                      required
                      value={formCustId}
                      onChange={(e) => setFormCustId(e.target.value)}
                      placeholder="e.g. FW100001"
                      className="w-full px-3 py-2 rounded-xl bg-background border border-border focus:ring-2 focus:ring-primary outline-none font-mono"
                    />
                  </div>
                  <div>
                    <label className="font-medium text-muted-foreground block mb-1">Full Name *</label>
                    <input
                      type="text"
                      required
                      value={formFullName}
                      onChange={(e) => setFormFullName(e.target.value)}
                      placeholder="e.g. Aakash Thapa"
                      className="w-full px-3 py-2 rounded-xl bg-background border border-border focus:ring-2 focus:ring-primary outline-none"
                    />
                  </div>
                  <div>
                    <label className="font-medium text-muted-foreground block mb-1">Phone Number</label>
                    <input
                      type="text"
                      value={formPhone}
                      onChange={(e) => setFormPhone(e.target.value)}
                      placeholder="e.g. 9801234567"
                      className="w-full px-3 py-2 rounded-xl bg-background border border-border focus:ring-2 focus:ring-primary outline-none font-mono"
                    />
                  </div>
                  <div>
                    <label className="font-medium text-muted-foreground block mb-1">Email Address</label>
                    <input
                      type="email"
                      value={formEmail}
                      onChange={(e) => setFormEmail(e.target.value)}
                      placeholder="e.g. customer@example.com"
                      className="w-full px-3 py-2 rounded-xl bg-background border border-border focus:ring-2 focus:ring-primary outline-none"
                    />
                  </div>
                  <div>
                    <label className="font-medium text-muted-foreground block mb-1">Area / Sector</label>
                    <input
                      type="text"
                      value={formArea}
                      onChange={(e) => setFormArea(e.target.value)}
                      placeholder="e.g. Baneshwor"
                      className="w-full px-3 py-2 rounded-xl bg-background border border-border focus:ring-2 focus:ring-primary outline-none"
                    />
                  </div>
                  <div>
                    <label className="font-medium text-muted-foreground block mb-1">Branch Office</label>
                    <input
                      type="text"
                      value={formBranch}
                      onChange={(e) => setFormBranch(e.target.value)}
                      placeholder="e.g. Kathmandu Core"
                      className="w-full px-3 py-2 rounded-xl bg-background border border-border focus:ring-2 focus:ring-primary outline-none"
                    />
                  </div>
                  <div className="sm:col-span-3">
                    <label className="font-medium text-muted-foreground block mb-1">Physical Address</label>
                    <input
                      type="text"
                      value={formAddress}
                      onChange={(e) => setFormAddress(e.target.value)}
                      placeholder="e.g. Ward 10, Shanti Nagar Road"
                      className="w-full px-3 py-2 rounded-xl bg-background border border-border focus:ring-2 focus:ring-primary outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* RADIUS Credentials & Network Section */}
              <div className="space-y-3 pt-2 border-t border-border">
                <span className="font-bold text-foreground uppercase tracking-wider text-[11px] block text-primary">
                  2. Connection & RADIUS Configuration
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="font-medium text-muted-foreground block mb-1">PPPoE/IPoE Username *</label>
                    <input
                      type="text"
                      required
                      value={formUsername}
                      onChange={(e) => setFormUsername(e.target.value)}
                      placeholder="e.g. aakash001"
                      className="w-full px-3 py-2 rounded-xl bg-background border border-border focus:ring-2 focus:ring-primary outline-none font-mono"
                    />
                  </div>
                  <div>
                    <label className="font-medium text-muted-foreground block mb-1">
                      {editingSub ? 'Change Password' : 'Password *'}
                    </label>
                    <input
                      type="password"
                      value={formPassword}
                      onChange={(e) => setFormPassword(e.target.value)}
                      placeholder={editingSub ? 'Leave empty to keep' : 'Minimum 4 characters'}
                      className="w-full px-3 py-2 rounded-xl bg-background border border-border focus:ring-2 focus:ring-primary outline-none"
                    />
                  </div>
                  <div>
                    <label className="font-medium text-muted-foreground block mb-1">Confirm Password</label>
                    <input
                      type="password"
                      value={formConfirmPassword}
                      onChange={(e) => setFormConfirmPassword(e.target.value)}
                      placeholder="Confirm password"
                      className="w-full px-3 py-2 rounded-xl bg-background border border-border focus:ring-2 focus:ring-primary outline-none"
                    />
                  </div>
                  <div>
                    <label className="font-medium text-muted-foreground block mb-1">Connection Type</label>
                    <select
                      value={formConnType}
                      onChange={(e) => setFormConnType(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-background border border-border focus:ring-2 focus:ring-primary outline-none"
                    >
                      <option value="PPPoE">PPPoE</option>
                      <option value="IPoE">IPoE</option>
                      <option value="Static IP">Static IP</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="font-medium text-muted-foreground block mb-1">Service Package *</label>
                    <select
                      value={formPackageId}
                      onChange={(e) => setFormPackageId(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-xl bg-background border border-border focus:ring-2 focus:ring-primary outline-none"
                    >
                      {packages.map((pkg) => (
                        <option key={pkg.id} value={pkg.id}>
                          {pkg.name} — {pkg.rate_limit}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="font-medium text-muted-foreground block mb-1">Status</label>
                    <select
                      value={formStatus}
                      onChange={(e) => setFormStatus(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-background border border-border focus:ring-2 focus:ring-primary outline-none"
                    >
                      <option value="active">Active</option>
                      <option value="suspended">Suspended</option>
                      <option value="disabled">Disabled</option>
                    </select>
                  </div>
                  <div>
                    <label className="font-medium text-muted-foreground block mb-1">IP Pool</label>
                    <select
                      value={formPoolId}
                      onChange={(e) => setFormPoolId(e.target.value ? Number(e.target.value) : '')}
                      className="w-full px-3 py-2 rounded-xl bg-background border border-border focus:ring-2 focus:ring-primary outline-none"
                    >
                      <option value="">-- Dynamic Pool --</option>
                      {ipPools.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.network})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="font-medium text-muted-foreground block mb-1">Static IPv4 (Optional)</label>
                    <input
                      type="text"
                      value={formStaticIp}
                      onChange={(e) => setFormStaticIp(e.target.value)}
                      placeholder="e.g. 100.111.20.21"
                      className="w-full px-3 py-2 rounded-xl bg-background border border-border focus:ring-2 focus:ring-primary outline-none font-mono"
                    />
                  </div>
                  <div>
                    <label className="font-medium text-muted-foreground block mb-1">IPv6 Prefix (Optional)</label>
                    <input
                      type="text"
                      value={formIpv6Prefix}
                      onChange={(e) => setFormIpv6Prefix(e.target.value)}
                      placeholder="e.g. 2001:db8:1234::/64"
                      className="w-full px-3 py-2 rounded-xl bg-background border border-border focus:ring-2 focus:ring-primary outline-none font-mono"
                    />
                  </div>
                  <div>
                    <label className="font-medium text-muted-foreground block mb-1">Locked MAC Address</label>
                    <input
                      type="text"
                      value={formMac}
                      onChange={(e) => setFormMac(e.target.value)}
                      placeholder="AA:BB:CC:DD:EE:FF"
                      className="w-full px-3 py-2 rounded-xl bg-background border border-border focus:ring-2 focus:ring-primary outline-none font-mono"
                    />
                  </div>
                  <div>
                    <label className="font-medium text-muted-foreground block mb-1">OLT PON Port</label>
                    <input
                      type="text"
                      value={formOltPon}
                      onChange={(e) => setFormOltPon(e.target.value)}
                      placeholder="e.g. PON 1/2"
                      className="w-full px-3 py-2 rounded-xl bg-background border border-border focus:ring-2 focus:ring-primary outline-none font-mono"
                    />
                  </div>
                  <div>
                    <label className="font-medium text-muted-foreground block mb-1">ONU Serial Number</label>
                    <input
                      type="text"
                      value={formOnuMac}
                      onChange={(e) => setFormOnuMac(e.target.value)}
                      placeholder="e.g. HWTC12345678"
                      className="w-full px-3 py-2 rounded-xl bg-background border border-border focus:ring-2 focus:ring-primary outline-none font-mono"
                    />
                  </div>
                  <div>
                    <label className="font-medium text-muted-foreground block mb-1">Expiry Date</label>
                    <input
                      type="date"
                      value={formExpiryDate}
                      onChange={(e) => setFormExpiryDate(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-background border border-border focus:ring-2 focus:ring-primary outline-none"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="font-medium text-muted-foreground block mb-1">Internal Notes</label>
                    <input
                      type="text"
                      value={formNotes}
                      onChange={(e) => setFormNotes(e.target.value)}
                      placeholder="e.g. Core customer connected via ODF port 4"
                      className="w-full px-3 py-2 rounded-xl bg-background border border-border focus:ring-2 focus:ring-primary outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-border">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-accent font-medium hover:bg-accent/80"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="px-4 py-2 rounded-xl bg-primary text-primary-foreground font-semibold hover:opacity-95"
                >
                  {formSubmitting ? 'Saving...' : editingSub ? 'Update Subscriber' : 'Create Subscriber'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-2xl w-full max-w-sm p-6 shadow-2xl space-y-4 text-center">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-500 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-foreground">Deactivate Subscriber?</h3>
              <p className="text-xs text-muted-foreground mt-1">
                This will terminate the subscriber and remove their active RADIUS credentials. Accounting records will be preserved.
              </p>
            </div>
            <div className="flex justify-center gap-2 pt-2">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="px-4 py-2 rounded-xl bg-accent font-medium text-xs hover:bg-accent/80"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteConfirmId)}
                className="px-4 py-2 rounded-xl bg-rose-600 text-white font-semibold text-xs hover:bg-rose-700 shadow-sm"
              >
                Confirm Deactivation
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
