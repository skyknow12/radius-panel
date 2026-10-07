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
} from 'lucide-react';
import type { SubscriberItem, PackageItem, NasDeviceItem } from '@/types/api';

interface SubscribersViewProps {
  onOpenSubscriberDetails?: (sub: SubscriberItem) => void;
}

export function SubscribersView({ onOpenSubscriberDetails }: SubscribersViewProps) {
  const [subscribers, setSubscribers] = React.useState<SubscriberItem[]>([]);
  const [packages, setPackages] = React.useState<PackageItem[]>([]);
  const [nasDevices, setNasDevices] = React.useState<NasDeviceItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [meta, setMeta] = React.useState({ page: 1, limit: 15, total: 0, totalPages: 1 });

  // Filters & Search
  const [search, setSearch] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState('all');
  const [packageFilter, setPackageFilter] = React.useState<string>('all');
  const [onlineFilter, setOnlineFilter] = React.useState<'all' | 'true' | 'false'>('all');
  const [sortBy, setSortBy] = React.useState('created_at');
  const [sortDir, setSortDir] = React.useState<'asc' | 'desc'>('desc');

  // Modals & Actions
  const [modalOpen, setModalOpen] = React.useState(false);
  const [editingSub, setEditingSub] = React.useState<SubscriberItem | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = React.useState<number | null>(null);
  const [disconnectConfirm, setDisconnectConfirm] = React.useState<{ id: string; username: string } | null>(null);
  const [actionNotice, setActionNotice] = React.useState<string | null>(null);

  // Form State
  const [formCustId, setFormCustId] = React.useState('');
  const [formUsername, setFormUsername] = React.useState('');
  const [formFullName, setFormFullName] = React.useState('');
  const [formPassword, setFormPassword] = React.useState('');
  const [formConfirmPassword, setFormConfirmPassword] = React.useState('');
  const [formEmail, setFormEmail] = React.useState('');
  const [formPhone, setFormPhone] = React.useState('');
  const [formStatus, setFormStatus] = React.useState<'enabled' | 'disabled' | 'suspended'>('enabled');
  const [formPackageId, setFormPackageId] = React.useState<number | ''>('');
  const [formStaticIp, setFormStaticIp] = React.useState('');
  const [formMac, setFormMac] = React.useState('');
  const [formVlan, setFormVlan] = React.useState<number | ''>('');
  const [formNasRestrictionId, setFormNasRestrictionId] = React.useState<number | ''>('');
  const [formExpiryDate, setFormExpiryDate] = React.useState('');
  const [formNotes, setFormNotes] = React.useState('');
  const [formError, setFormError] = React.useState<string | null>(null);
  const [formSubmitting, setFormSubmitting] = React.useState(false);

  // Detail Modal state
  const [selectedSub, setSelectedSub] = React.useState<SubscriberItem | null>(null);
  const [subSessions, setSubSessions] = React.useState<any[]>([]);
  const [subAuthLogs, setSubAuthLogs] = React.useState<any[]>([]);
  const [detailLoading, setDetailLoading] = React.useState(false);

  const fetchDependencies = async () => {
    try {
      const [pkgRes, nasRes] = await Promise.all([fetch('/api/packages'), fetch('/api/nas')]);
      if (pkgRes.ok) {
        const j = await pkgRes.json();
        setPackages(j.data || []);
      }
      if (nasRes.ok) {
        const j = await nasRes.json();
        setNasDevices(j.data || []);
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
      if (onlineFilter !== 'all') params.set('is_online', onlineFilter);
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
    fetchSubscribers(1);
  }, [search, statusFilter, packageFilter, onlineFilter, sortBy, sortDir]);

  const openAddModal = () => {
    setEditingSub(null);
    setFormCustId(`FW${Math.floor(100000 + Math.random() * 900000)}`);
    setFormUsername('');
    setFormFullName('');
    setFormPassword('');
    setFormConfirmPassword('');
    setFormEmail('');
    setFormPhone('');
    setFormStatus('enabled');
    setFormPackageId(packages[0]?.id || '');
    setFormStaticIp('');
    setFormMac('');
    setFormVlan('');
    setFormNasRestrictionId('');
    // 30 days from now
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
    setFormPackageId(sub.current_package_id || '');
    setFormStaticIp(sub.static_ip || '');
    setFormMac(sub.mac_address || '');
    setFormVlan(sub.vlan_id || '');
    setFormNasRestrictionId(sub.nas_restriction_id || '');
    setFormExpiryDate(sub.expiry_date ? new Date(sub.expiry_date).toISOString().split('T')[0] : '');
    setFormNotes(sub.notes || '');
    setFormError(null);
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!formCustId.trim() || !formUsername.trim() || !formFullName.trim()) {
      setFormError('Customer ID, Username, and Full Name are required');
      return;
    }
    if (!editingSub && !formPassword) {
      setFormError('Password is required for new subscribers');
      return;
    }
    if (formPassword && formPassword !== formConfirmPassword) {
      setFormError('Passwords do not match');
      return;
    }

    try {
      setFormSubmitting(true);
      const token = typeof window !== 'undefined' ? localStorage.getItem('radius_token') : null;
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const payload = {
        customer_id: formCustId.trim(),
        username: formUsername.trim(),
        full_name: formFullName.trim(),
        password: formPassword || undefined,
        email: formEmail.trim() || undefined,
        phone: formPhone.trim() || undefined,
        status: formStatus,
        current_package_id: formPackageId ? Number(formPackageId) : undefined,
        static_ip: formStaticIp.trim() || undefined,
        mac_address: formMac.trim() || undefined,
        vlan_id: formVlan ? Number(formVlan) : undefined,
        nas_restriction_id: formNasRestrictionId ? Number(formNasRestrictionId) : undefined,
        expiry_date: formExpiryDate ? new Date(formExpiryDate).toISOString() : undefined,
        notes: formNotes.trim() || undefined,
      };

      const url = editingSub ? `/api/subscribers/${editingSub.id}` : '/api/subscribers';
      const method = editingSub ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers,
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error?.message || json.message || 'Failed to save subscriber');
      }

      setModalOpen(false);
      setActionNotice(editingSub ? 'Subscriber updated successfully' : 'Subscriber created successfully');
      setTimeout(() => setActionNotice(null), 4000);
      fetchSubscribers();
    } catch (err: any) {
      setFormError(err.message || 'Failed to save subscriber');
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleStatusToggle = async (sub: SubscriberItem, newStatus: 'enabled' | 'suspended' | 'disabled') => {
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('radius_token') : null;
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`/api/subscribers/${sub.id}/status`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ status: newStatus, disconnect_active: true }),
      });

      if (res.ok) {
        setActionNotice(`Subscriber ${sub.username} marked as ${newStatus}`);
        setTimeout(() => setActionNotice(null), 4000);
        fetchSubscribers();
      }
    } catch {}
  };

  const handleDelete = async (id: number) => {
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('radius_token') : null;
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`/api/subscribers/${id}`, { method: 'DELETE', headers });
      if (res.ok) {
        setDeleteConfirmId(null);
        setActionNotice('Subscriber deleted successfully');
        setTimeout(() => setActionNotice(null), 4000);
        fetchSubscribers();
      }
    } catch {}
  };

  const handleDisconnect = async (sessionId: string) => {
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('radius_token') : null;
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`/api/radius/sessions/${sessionId}/disconnect`, {
        method: 'POST',
        headers,
      });
      const json = await res.json();
      setDisconnectConfirm(null);
      setActionNotice(json.data?.message || 'Disconnect request dispatched');
      setTimeout(() => setActionNotice(null), 4000);
      fetchSubscribers();
    } catch {}
  };

  const openDetailsModal = async (sub: SubscriberItem) => {
    setSelectedSub(sub);
    setDetailLoading(true);
    try {
      const [sessRes, authRes] = await Promise.all([
        fetch(`/api/subscribers/${sub.id}/sessions`),
        fetch(`/api/subscribers/${sub.id}/auth-logs`),
      ]);
      if (sessRes.ok) {
        const j = await sessRes.json();
        setSubSessions(j.data || []);
      }
      if (authRes.ok) {
        const j = await authRes.json();
        setSubAuthLogs(j.data || []);
      }
    } catch {} finally {
      setDetailLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            <span>Subscriber Accounts</span>
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Carrier subscriber inventory, PPPoE/IPoE AAA provisioning, and real-time session status.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => fetchSubscribers()}
            disabled={loading}
            className="p-2 rounded-xl border border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground text-xs font-medium flex items-center gap-1.5 transition-colors"
            title="Refresh subscriber list"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
          <button
            onClick={openAddModal}
            className="px-3.5 py-2 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-semibold flex items-center gap-2 shadow-md shadow-primary/20 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Add Subscriber</span>
          </button>
        </div>
      </div>

      {/* Action Notice Toast */}
      {actionNotice && (
        <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-xs flex items-center justify-between animate-in fade-in slide-in-from-top-1">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            <span>{actionNotice}</span>
          </div>
          <button onClick={() => setActionNotice(null)} className="opacity-70 hover:opacity-100 font-semibold">
            ✕
          </button>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="p-3.5 rounded-2xl border border-border bg-card/60 backdrop-blur-sm space-y-3">
        <div className="flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="relative w-full md:max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by username, customer ID, name, or IP..."
              className="w-full bg-muted/50 border border-border rounded-xl pl-9 pr-4 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto text-xs">
            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-muted/50 border border-border rounded-xl px-2.5 py-1.5 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
            >
              <option value="all">All Statuses</option>
              <option value="enabled">Enabled</option>
              <option value="suspended">Suspended</option>
              <option value="disabled">Disabled</option>
            </select>

            {/* Package Filter */}
            <select
              value={packageFilter}
              onChange={(e) => setPackageFilter(e.target.value)}
              className="bg-muted/50 border border-border rounded-xl px-2.5 py-1.5 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
            >
              <option value="all">All Packages</option>
              {packages.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>

            {/* Online Filter */}
            <select
              value={onlineFilter}
              onChange={(e) => setOnlineFilter(e.target.value as any)}
              className="bg-muted/50 border border-border rounded-xl px-2.5 py-1.5 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
            >
              <option value="all">All Connectivity</option>
              <option value="true">Online Only</option>
              <option value="false">Offline Only</option>
            </select>
          </div>
        </div>
      </div>

      {/* Subscribers Table */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-muted-foreground font-semibold">
                <th className="py-3 px-4">Customer ID</th>
                <th className="py-3 px-4">Username / Subscriber</th>
                <th className="py-3 px-4">Package</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Assigned / Active IP</th>
                <th className="py-3 px-4">NAS Gateway</th>
                <th className="py-3 px-4">Connectivity</th>
                <th className="py-3 px-4">Expiry Date</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {loading && subscribers.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-muted-foreground">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-primary" />
                    <span>Loading subscriber database...</span>
                  </td>
                </tr>
              ) : subscribers.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-muted-foreground">
                    No subscribers found matching your search and filter criteria.
                  </td>
                </tr>
              ) : (
                subscribers.map((sub) => {
                  const isEnabled = sub.status === 'enabled';
                  const isSuspended = sub.status === 'suspended';
                  const isExpired = sub.is_expired;

                  return (
                    <tr key={sub.id} className="hover:bg-muted/40 transition-colors group">
                      <td className="py-3 px-4 font-mono font-medium text-foreground">
                        {sub.customer_id}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-foreground flex items-center gap-1.5">
                          <span>{sub.username}</span>
                          {sub.is_online && (
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" title="Active Online Session" />
                          )}
                        </div>
                        <div className="text-[11px] text-muted-foreground">{sub.full_name}</div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-medium text-foreground">{sub.package_name || 'No Plan'}</span>
                        {sub.package_speed && (
                          <div className="text-[10px] font-mono text-primary">{sub.package_speed}</div>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                            isSuspended
                              ? 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                              : isEnabled
                              ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                              : 'bg-rose-500/10 text-rose-500 border-rose-500/20'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              isSuspended ? 'bg-amber-500' : isEnabled ? 'bg-emerald-500' : 'bg-rose-500'
                            }`}
                          />
                          <span className="capitalize">{sub.status}</span>
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono text-muted-foreground">
                        {sub.current_ip ? (
                          <span className="text-emerald-500 font-semibold">{sub.current_ip}</span>
                        ) : sub.static_ip ? (
                          <span>{sub.static_ip} (Static)</span>
                        ) : (
                          <span>Dynamic (Pool)</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-muted-foreground">
                        {sub.nas_name || sub.current_nas_ip || 'Auto-Route'}
                      </td>
                      <td className="py-3 px-4">
                        {sub.is_online ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                            Online
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-[11px]">Offline</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        {sub.expiry_date ? (
                          <div className={isExpired ? 'text-rose-500 font-semibold flex items-center gap-1' : 'text-muted-foreground'}>
                            {new Date(sub.expiry_date).toLocaleDateString([], {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                            })}
                            {isExpired && <span className="text-[9px] uppercase px-1 rounded bg-rose-500/10 border border-rose-500/20">Expired</span>}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">Never</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* View details drawer/modal */}
                          <button
                            onClick={() => openDetailsModal(sub)}
                            className="p-1.5 rounded-lg border border-border hover:bg-muted text-muted-foreground hover:text-primary transition-colors"
                            title="View Sessions & Auth History"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          {/* Disconnect button if online */}
                          {sub.is_online && sub.current_session_id && (
                            <button
                              onClick={() => setDisconnectConfirm({ id: sub.current_session_id!, username: sub.username })}
                              className="p-1.5 rounded-lg border border-rose-500/20 bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 transition-colors"
                              title="Send RADIUS Disconnect-Request"
                            >
                              <PowerOff className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {/* Suspend / Resume Toggle */}
                          {isSuspended ? (
                            <button
                              onClick={() => handleStatusToggle(sub, 'enabled')}
                              className="p-1.5 rounded-lg border border-emerald-500/20 hover:bg-emerald-500/10 text-emerald-500 transition-colors"
                              title="Resume Subscriber"
                            >
                              <PlayCircle className="w-3.5 h-3.5" />
                            </button>
                          ) : (
                            <button
                              onClick={() => handleStatusToggle(sub, 'suspended')}
                              className="p-1.5 rounded-lg border border-border hover:bg-amber-500/10 text-muted-foreground hover:text-amber-500 transition-colors"
                              title="Suspend Subscriber"
                            >
                              <PauseCircle className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {/* Edit */}
                          <button
                            onClick={() => openEditModal(sub)}
                            className="p-1.5 rounded-lg border border-border hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                            title="Edit Subscriber"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          {/* Delete */}
                          {deleteConfirmId === sub.id ? (
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => handleDelete(sub.id)}
                                className="px-2 py-1 rounded bg-rose-500 text-white font-semibold text-[10px]"
                              >
                                Del
                              </button>
                              <button
                                onClick={() => setDeleteConfirmId(null)}
                                className="px-2 py-1 rounded bg-muted text-muted-foreground text-[10px]"
                              >
                                Esc
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setDeleteConfirmId(sub.id)}
                              className="p-1.5 rounded-lg border border-border hover:bg-rose-500/10 text-muted-foreground hover:text-rose-500 transition-colors"
                              title="Delete Subscriber"
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

        {/* Server-Side Pagination Bar */}
        <div className="p-3.5 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
          <div>
            Showing <span className="font-semibold text-foreground">{subscribers.length}</span> of{' '}
            <span className="font-semibold text-foreground">{meta.total}</span> subscribers
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchSubscribers(meta.page - 1)}
              disabled={meta.page <= 1}
              className="p-1.5 rounded-lg border border-border hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              title="Previous Page"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="font-medium text-foreground">
              Page {meta.page} of {meta.totalPages}
            </span>
            <button
              onClick={() => fetchSubscribers(meta.page + 1)}
              disabled={meta.page >= meta.totalPages}
              className="p-1.5 rounded-lg border border-border hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              title="Next Page"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Disconnect Confirmation Modal */}
      {disconnectConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-md animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 text-rose-500 mb-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center">
                <PowerOff className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-foreground">Confirm Subscriber Disconnect</h3>
                <p className="text-[11px] text-muted-foreground">RADIUS CoA / Disconnect-Request</p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mb-6 leading-relaxed">
              Disconnect subscriber <strong className="text-foreground">{disconnectConfirm.username}</strong> from the
              network immediately? This will send an RFC 3576 Disconnect-Request to their termination BNG router.
            </p>
            <div className="flex items-center justify-end gap-2.5">
              <button
                onClick={() => setDisconnectConfirm(null)}
                className="px-4 py-2 rounded-xl border border-border text-xs font-medium hover:bg-muted"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDisconnect(disconnectConfirm.id)}
                className="px-5 py-2 rounded-xl bg-rose-500 text-white text-xs font-semibold hover:bg-rose-600 shadow-md shadow-rose-500/20"
              >
                Disconnect Subscriber
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Subscriber Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-md animate-in fade-in duration-150 overflow-y-auto">
          <div className="w-full max-w-2xl rounded-2xl border border-border bg-card p-6 shadow-2xl animate-in zoom-in-95 duration-150 my-8">
            <div className="flex items-center justify-between pb-4 border-b border-border">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                  <Users className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground">
                    {editingSub ? `Edit Subscriber: ${editingSub.username}` : 'Add New Subscriber'}
                  </h3>
                  <p className="text-[11px] text-muted-foreground">
                    Synchronizes Cleartext-Password, Expiration, and Rate-Limit into FreeRADIUS SQL
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
                  <label className="block font-medium text-foreground mb-1">Customer ID *</label>
                  <input
                    type="text"
                    required
                    value={formCustId}
                    onChange={(e) => setFormCustId(e.target.value)}
                    className="w-full bg-muted/50 border border-border rounded-xl px-3 py-2 text-foreground font-mono focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
                  />
                </div>

                <div>
                  <label className="block font-medium text-foreground mb-1">Full Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="Aakash Thapa"
                    value={formFullName}
                    onChange={(e) => setFormFullName(e.target.value)}
                    className="w-full bg-muted/50 border border-border rounded-xl px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-medium text-foreground mb-1">RADIUS Username *</label>
                  <input
                    type="text"
                    required
                    disabled={Boolean(editingSub)}
                    placeholder="aakash001"
                    value={formUsername}
                    onChange={(e) => setFormUsername(e.target.value)}
                    className="w-full bg-muted/50 border border-border rounded-xl px-3 py-2 text-foreground font-mono disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
                  />
                </div>

                <div>
                  <label className="block font-medium text-foreground mb-1">Service Package *</label>
                  <select
                    value={formPackageId}
                    onChange={(e) => setFormPackageId(e.target.value ? Number(e.target.value) : '')}
                    className="w-full bg-muted/50 border border-border rounded-xl px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
                  >
                    <option value="">Select Package</option>
                    {packages.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.rate_limit})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Password */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-medium text-foreground mb-1">
                    Password {editingSub ? '(Leave blank to keep current)' : '*'}
                  </label>
                  <input
                    type="password"
                    required={!editingSub}
                    placeholder="Enter PPPoE password"
                    value={formPassword}
                    onChange={(e) => setFormPassword(e.target.value)}
                    className="w-full bg-muted/50 border border-border rounded-xl px-3 py-2 text-foreground font-mono focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
                  />
                </div>

                <div>
                  <label className="block font-medium text-foreground mb-1">Confirm Password</label>
                  <input
                    type="password"
                    placeholder="Re-enter password"
                    value={formConfirmPassword}
                    onChange={(e) => setFormConfirmPassword(e.target.value)}
                    className="w-full bg-muted/50 border border-border rounded-xl px-3 py-2 text-foreground font-mono focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block font-medium text-foreground mb-1">Status</label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as any)}
                    className="w-full bg-muted/50 border border-border rounded-xl px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
                  >
                    <option value="enabled">Enabled</option>
                    <option value="suspended">Suspended</option>
                    <option value="disabled">Disabled</option>
                  </select>
                </div>

                <div>
                  <label className="block font-medium text-foreground mb-1">Expiry Date</label>
                  <input
                    type="date"
                    value={formExpiryDate}
                    onChange={(e) => setFormExpiryDate(e.target.value)}
                    className="w-full bg-muted/50 border border-border rounded-xl px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
                  />
                </div>

                <div>
                  <label className="block font-medium text-foreground mb-1">Static Framed IP (Optional)</label>
                  <input
                    type="text"
                    placeholder="100.111.20.21"
                    value={formStaticIp}
                    onChange={(e) => setFormStaticIp(e.target.value)}
                    className="w-full bg-muted/50 border border-border rounded-xl px-3 py-2 text-foreground font-mono focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block font-medium text-foreground mb-1">MAC Lock (Optional)</label>
                  <input
                    type="text"
                    placeholder="A4:83:E7:22:90:1A"
                    value={formMac}
                    onChange={(e) => setFormMac(e.target.value)}
                    className="w-full bg-muted/50 border border-border rounded-xl px-3 py-2 text-foreground font-mono focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
                  />
                </div>

                <div>
                  <label className="block font-medium text-foreground mb-1">VLAN ID (Optional)</label>
                  <input
                    type="number"
                    placeholder="100"
                    value={formVlan}
                    onChange={(e) => setFormVlan(e.target.value ? parseInt(e.target.value, 10) : '')}
                    className="w-full bg-muted/50 border border-border rounded-xl px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
                  />
                </div>

                <div>
                  <label className="block font-medium text-foreground mb-1">NAS Restriction (Optional)</label>
                  <select
                    value={formNasRestrictionId}
                    onChange={(e) => setFormNasRestrictionId(e.target.value ? Number(e.target.value) : '')}
                    className="w-full bg-muted/50 border border-border rounded-xl px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
                  >
                    <option value="">Any NAS Gateway</option>
                    {nasDevices.map((n) => (
                      <option key={n.id} value={n.id}>
                        {n.name} ({n.ip_address})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-medium text-foreground mb-1">Notes / Installation Address</label>
                <input
                  type="text"
                  placeholder="Apartment 4B, Kathmandu"
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
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
                  {formSubmitting ? 'Saving...' : editingSub ? 'Save Changes' : 'Create Subscriber'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Subscriber History & Details Modal */}
      {selectedSub && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-md animate-in fade-in duration-150 overflow-y-auto">
          <div className="w-full max-w-3xl rounded-2xl border border-border bg-card p-6 shadow-2xl animate-in zoom-in-95 duration-150 my-8">
            <div className="flex items-center justify-between pb-4 border-b border-border">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-foreground">{selectedSub.username}</h3>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-muted border border-border">
                      {selectedSub.customer_id}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">{selectedSub.full_name}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedSub(null)}
                className="text-muted-foreground hover:text-foreground text-sm p-1.5 rounded-lg hover:bg-muted"
              >
                ✕
              </button>
            </div>

            {/* Overview Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-4">
              <div className="p-3 rounded-xl bg-muted/40 border border-border/80">
                <span className="text-[10px] uppercase text-muted-foreground font-semibold">Package</span>
                <p className="text-xs font-bold text-foreground mt-0.5">{selectedSub.package_name || 'None'}</p>
                <p className="text-[10px] font-mono text-primary">{selectedSub.package_speed}</p>
              </div>
              <div className="p-3 rounded-xl bg-muted/40 border border-border/80">
                <span className="text-[10px] uppercase text-muted-foreground font-semibold">Status</span>
                <p className="text-xs font-bold capitalize mt-0.5 text-foreground">{selectedSub.status}</p>
                <p className="text-[10px] text-muted-foreground">{selectedSub.is_online ? 'Session Active' : 'Offline'}</p>
              </div>
              <div className="p-3 rounded-xl bg-muted/40 border border-border/80">
                <span className="text-[10px] uppercase text-muted-foreground font-semibold">Framed IP</span>
                <p className="text-xs font-mono font-bold text-foreground mt-0.5">
                  {selectedSub.current_ip || selectedSub.static_ip || 'Dynamic'}
                </p>
                <p className="text-[10px] text-muted-foreground">{selectedSub.mac_address || 'Any MAC'}</p>
              </div>
              <div className="p-3 rounded-xl bg-muted/40 border border-border/80">
                <span className="text-[10px] uppercase text-muted-foreground font-semibold">Expiry</span>
                <p className="text-xs font-bold text-foreground mt-0.5">
                  {selectedSub.expiry_date
                    ? new Date(selectedSub.expiry_date).toLocaleDateString([], {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })
                    : 'Unlimited'}
                </p>
                <p className="text-[10px] text-muted-foreground">{selectedSub.is_expired ? 'Expired' : 'Active'}</p>
              </div>
            </div>

            {/* Session History Table */}
            <div className="mt-5 space-y-2">
              <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-primary" />
                <span>Recent Accounting Sessions (radacct)</span>
              </h4>
              <div className="rounded-xl border border-border overflow-hidden">
                <table className="w-full text-left text-[11px]">
                  <thead className="bg-muted/40 text-muted-foreground font-semibold border-b border-border">
                    <tr>
                      <th className="py-2 px-3">Session ID</th>
                      <th className="py-2 px-3">IP Address</th>
                      <th className="py-2 px-3">NAS Gateway</th>
                      <th className="py-2 px-3">Duration</th>
                      <th className="py-2 px-3">Traffic (Rx/Tx)</th>
                      <th className="py-2 px-3">Termination</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {detailLoading ? (
                      <tr>
                        <td colSpan={6} className="py-4 text-center text-muted-foreground">
                          Loading session history...
                        </td>
                      </tr>
                    ) : subSessions.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-4 text-center text-muted-foreground">
                          No accounting history recorded yet.
                        </td>
                      </tr>
                    ) : (
                      subSessions.map((s, i) => (
                        <tr key={i} className="hover:bg-muted/30 font-mono">
                          <td className="py-2 px-3">{s.acctsessionid}</td>
                          <td className="py-2 px-3">{s.framed_ip || '-'}</td>
                          <td className="py-2 px-3 font-sans">{s.nas_name || s.nas_ip}</td>
                          <td className="py-2 px-3 font-sans">
                            {Math.round((s.acctsessiontime || 0) / 60)} mins
                          </td>
                          <td className="py-2 px-3">
                            {(Number(s.acctoutputoctets || 0) / 1e9).toFixed(1)}G / {(Number(s.acctinputoctets || 0) / 1e9).toFixed(1)}G
                          </td>
                          <td className="py-2 px-3 font-sans text-muted-foreground">
                            {s.acctterminatecause || (s.acctstoptime ? 'Stopped' : 'Active')}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Authentication Logs Table */}
            <div className="mt-5 space-y-2">
              <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-primary" />
                <span>Recent Authentication Attempts (radpostauth)</span>
              </h4>
              <div className="rounded-xl border border-border overflow-hidden">
                <table className="w-full text-left text-[11px]">
                  <thead className="bg-muted/40 text-muted-foreground font-semibold border-b border-border">
                    <tr>
                      <th className="py-2 px-3">Timestamp</th>
                      <th className="py-2 px-3">Result</th>
                      <th className="py-2 px-3">NAS Gateway</th>
                      <th className="py-2 px-3">Client Calling-ID</th>
                      <th className="py-2 px-3">Reason</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {detailLoading ? (
                      <tr>
                        <td colSpan={5} className="py-4 text-center text-muted-foreground">
                          Loading auth logs...
                        </td>
                      </tr>
                    ) : subAuthLogs.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-4 text-center text-muted-foreground">
                          No recent authentication attempts recorded.
                        </td>
                      </tr>
                    ) : (
                      subAuthLogs.map((log, i) => (
                        <tr key={i} className="hover:bg-muted/30">
                          <td className="py-2 px-3 font-mono">
                            {new Date(log.authdate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                          </td>
                          <td className="py-2 px-3">
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                                log.reply === 'Access-Accept'
                                  ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                                  : 'bg-rose-500/10 text-rose-500 border border-rose-500/20'
                              }`}
                            >
                              {log.reply}
                            </span>
                          </td>
                          <td className="py-2 px-3">{log.nas_name || log.calledstationid || '-'}</td>
                          <td className="py-2 px-3 font-mono text-muted-foreground">{log.callingstationid || '-'}</td>
                          <td className="py-2 px-3 text-muted-foreground">{log.reason || '-'}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-border flex justify-end">
              <button
                onClick={() => setSelectedSub(null)}
                className="px-4 py-2 rounded-xl bg-muted text-foreground text-xs font-semibold hover:bg-muted/80"
              >
                Close Drawer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
