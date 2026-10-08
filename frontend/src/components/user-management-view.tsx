'use client';

import React from 'react';
import {
  Users,
  UserPlus,
  Shield,
  Key,
  LogOut,
  Ban,
  CheckCircle2,
  Clock,
  Search,
  Filter,
  Eye,
  RefreshCw,
  Building2,
  Store,
  Layers,
  ChevronLeft,
  ChevronRight,
  X,
  Check,
  AlertTriangle,
  History,
  Lock,
  Smartphone
} from 'lucide-react';
import type { UserManagementItem, RoleItem, BranchItem, ResellerItem, LoginHistoryItem, UserSessionItem } from '@/types/api';

interface UserManagementViewProps {
  currentUser?: any;
}

export function UserManagementView({ currentUser }: UserManagementViewProps) {
  const [users, setUsers] = React.useState<UserManagementItem[]>([]);
  const [roles, setRoles] = React.useState<RoleItem[]>([]);
  const [branches, setBranches] = React.useState<BranchItem[]>([]);
  const [resellers, setResellers] = React.useState<ResellerItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [meta, setMeta] = React.useState({ page: 1, limit: 15, total: 0, totalPages: 1 });

  // Filters
  const [search, setSearch] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState('all');
  const [roleFilter, setRoleFilter] = React.useState('all');
  const [scopeFilter, setScopeFilter] = React.useState('all');

  // Modals & Drawers
  const [createModalOpen, setCreateModalOpen] = React.useState(false);
  const [editUser, setEditUser] = React.useState<UserManagementItem | null>(null);
  const [resetPassUser, setResetPassUser] = React.useState<UserManagementItem | null>(null);
  const [detailUser, setDetailUser] = React.useState<UserManagementItem | null>(null);
  const [userPermissions, setUserPermissions] = React.useState<string[]>([]);
  const [loginHistory, setLoginHistory] = React.useState<LoginHistoryItem[]>([]);
  const [sessions, setSessions] = React.useState<UserSessionItem[]>([]);
  const [detailLoading, setDetailLoading] = React.useState(false);

  // Form states
  const [formUsername, setFormUsername] = React.useState('');
  const [formFullName, setFormFullName] = React.useState('');
  const [formEmail, setFormEmail] = React.useState('');
  const [formPhone, setFormPhone] = React.useState('');
  const [formPassword, setFormPassword] = React.useState('');
  const [formRoleIds, setFormRoleIds] = React.useState<number[]>([]);
  const [formDataScope, setFormDataScope] = React.useState<any>('OWN');
  const [formUserType, setFormUserType] = React.useState<any>('isp');
  const [formBranchId, setFormBranchId] = React.useState<number | ''>('');
  const [formResellerId, setFormResellerId] = React.useState<number | ''>('');
  const [formForceReset, setFormForceReset] = React.useState(false);

  // Reset password form
  const [newPassword, setNewPassword] = React.useState('');
  const [forceNextReset, setForceNextReset] = React.useState(true);

  const [submitting, setSubmitting] = React.useState(false);
  const [notice, setNotice] = React.useState<{ text: string; error?: boolean } | null>(null);

  const fetchDependencies = async () => {
    try {
      const [rRes, bRes, resRes] = await Promise.all([
        fetch('/api/roles'),
        fetch('/api/branches'),
        fetch('/api/resellers'),
      ]);
      if (rRes.ok) {
        const j = await rRes.json();
        setRoles(j.data || []);
      }
      if (bRes.ok) {
        const j = await bRes.json();
        setBranches(j.data || []);
      }
      if (resRes.ok) {
        const j = await resRes.json();
        setResellers(j.data || []);
      }
    } catch {}
  };

  const fetchUsers = async (page = meta.page) => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', String(meta.limit));
      if (search.trim()) params.set('search', search.trim());
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (roleFilter !== 'all') params.set('role', roleFilter);
      if (scopeFilter !== 'all') params.set('data_scope', scopeFilter);

      const res = await fetch(`/api/users?${params.toString()}`);
      if (res.ok) {
        const json = await res.json();
        setUsers(json.data || []);
        if (json.meta) setMeta(json.meta);
      }
    } catch {
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchDependencies();
  }, []);

  React.useEffect(() => {
    fetchUsers(1);
  }, [search, statusFilter, roleFilter, scopeFilter]);

  const showNotice = (text: string, error = false) => {
    setNotice({ text, error });
    setTimeout(() => setNotice(null), 4000);
  };

  const openCreateModal = () => {
    setFormUsername('');
    setFormFullName('');
    setFormEmail('');
    setFormPhone('');
    setFormPassword('');
    setFormRoleIds(roles.length > 0 ? [roles[0].id] : []);
    setFormDataScope('OWN');
    setFormUserType('isp');
    setFormBranchId('');
    setFormResellerId('');
    setFormForceReset(false);
    setCreateModalOpen(true);
  };

  const openEditModal = (u: UserManagementItem) => {
    setEditUser(u);
    setFormFullName(u.full_name || '');
    setFormEmail(u.email || '');
    setFormPhone(u.phone || '');
    setFormRoleIds(u.roles.map((r) => r.id));
    setFormDataScope(u.data_scope);
    setFormUserType(u.user_type as any);
    setFormBranchId(u.branch_id || '');
    setFormResellerId(u.reseller_id || '');
    setFormForceReset(u.force_password_reset);
  };

  const openDetailDrawer = async (u: UserManagementItem) => {
    setDetailUser(u);
    setDetailLoading(true);
    try {
      const [uRes, hRes, sRes] = await Promise.all([
        fetch(`/api/users/${u.id}`),
        fetch(`/api/users/${u.id}/login-history`),
        fetch(`/api/users/${u.id}/sessions`),
      ]);
      if (uRes.ok) {
        const uj = await uRes.json();
        setUserPermissions(uj.data?.permissions || []);
      }
      if (hRes.ok) {
        const hj = await hRes.json();
        setLoginHistory(hj.data || []);
      }
      if (sRes.ok) {
        const sj = await sRes.json();
        setSessions(sj.data || []);
      }
    } catch {} finally {
      setDetailLoading(false);
    }
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formUsername || !formFullName || !formPassword) {
      showNotice('Username, full name, and password are required', true);
      return;
    }
    if (formRoleIds.length === 0) {
      showNotice('Please select at least one role', true);
      return;
    }

    try {
      setSubmitting(true);
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: formUsername,
          fullName: formFullName,
          email: formEmail || undefined,
          phone: formPhone || undefined,
          password: formPassword,
          roleIds: formRoleIds,
          dataScope: formDataScope,
          userType: formUserType,
          branchId: formBranchId !== '' ? Number(formBranchId) : undefined,
          resellerId: formResellerId !== '' ? Number(formResellerId) : undefined,
          forcePasswordReset: formForceReset,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        showNotice(json.error?.message || 'Failed to create user', true);
        return;
      }

      showNotice(`Staff user "${formUsername}" created successfully`);
      setCreateModalOpen(false);
      fetchUsers(meta.page);
    } catch (err: any) {
      showNotice(err.message, true);
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editUser) return;

    try {
      setSubmitting(true);
      const res = await fetch(`/api/users/${editUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: formFullName,
          email: formEmail || undefined,
          phone: formPhone || undefined,
          roleIds: formRoleIds,
          dataScope: formDataScope,
          userType: formUserType,
          branchId: formBranchId !== '' ? Number(formBranchId) : null,
          resellerId: formResellerId !== '' ? Number(formResellerId) : null,
          forcePasswordReset: formForceReset,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        showNotice(json.error?.message || 'Failed to update user', true);
        return;
      }

      showNotice('User updated successfully');
      setEditUser(null);
      fetchUsers(meta.page);
    } catch (err: any) {
      showNotice(err.message, true);
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusChange = async (u: UserManagementItem, newStatus: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED') => {
    try {
      const res = await fetch(`/api/users/${u.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) {
        const j = await res.json();
        showNotice(j.error?.message || 'Failed to change status', true);
        return;
      }
      showNotice(`User @${u.username} status set to ${newStatus}`);
      fetchUsers(meta.page);
    } catch (err: any) {
      showNotice(err.message, true);
    }
  };

  const handleForceLogout = async (u: UserManagementItem) => {
    try {
      const res = await fetch(`/api/users/${u.id}/force-logout`, {
        method: 'POST',
      });
      if (!res.ok) {
        const j = await res.json();
        showNotice(j.error?.message || 'Failed to force logout', true);
        return;
      }
      showNotice(`Active sessions terminated for @${u.username}`);
      fetchUsers(meta.page);
    } catch (err: any) {
      showNotice(err.message, true);
    }
  };

  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetPassUser || !newPassword || newPassword.length < 6) {
      showNotice('Password must be at least 6 characters long', true);
      return;
    }

    try {
      setSubmitting(true);
      const res = await fetch(`/api/users/${resetPassUser.id}/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: newPassword, forceNextReset }),
      });
      if (!res.ok) {
        const j = await res.json();
        showNotice(j.error?.message || 'Failed to reset password', true);
        return;
      }
      showNotice(`Password reset for @${resetPassUser.username}`);
      setResetPassUser(null);
      setNewPassword('');
    } catch (err: any) {
      showNotice(err.message, true);
    } finally {
      setSubmitting(false);
    }
  };

  // KPI calculations
  const totalCount = meta.total;
  const activeCount = users.filter((u) => u.status === 'ACTIVE').length;
  const suspendedCount = users.filter((u) => u.status === 'SUSPENDED').length;

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Notice Banner */}
      {notice && (
        <div
          className={`p-3 rounded-xl border text-xs flex items-center justify-between ${
            notice.error
              ? 'bg-rose-500/10 border-rose-500/20 text-rose-400'
              : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
          }`}
        >
          <span>{notice.text}</span>
          <button onClick={() => setNotice(null)}>
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            User & Staff Management
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Administer department staff, operator logins, multi-role assignments, and data-scope permissions.
          </p>
        </div>

        <button
          onClick={openCreateModal}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 shadow-md shadow-primary/20 transition-all self-start sm:self-auto"
        >
          <UserPlus className="w-4 h-4" />
          Create Staff User
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-card border border-border shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Total Staff Users</span>
            <Users className="w-4 h-4 text-primary" />
          </div>
          <div className="mt-2 text-2xl font-bold text-foreground">{totalCount}</div>
          <span className="text-[11px] text-muted-foreground">Configured in system</span>
        </div>

        <div className="p-4 rounded-2xl bg-card border border-border shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Active Staff</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-emerald-400">{activeCount}</div>
          <span className="text-[11px] text-muted-foreground">Authorized to log in</span>
        </div>

        <div className="p-4 rounded-2xl bg-card border border-border shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Suspended Staff</span>
            <Ban className="w-4 h-4 text-rose-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-rose-400">{suspendedCount}</div>
          <span className="text-[11px] text-muted-foreground">Access blocked</span>
        </div>

        <div className="p-4 rounded-2xl bg-card border border-border shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Configured Roles</span>
            <Shield className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-indigo-400">{roles.length}</div>
          <span className="text-[11px] text-muted-foreground">Default & custom roles</span>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by username, full name, email, phone..."
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
          <option value="ACTIVE">Active</option>
          <option value="INACTIVE">Inactive</option>
          <option value="SUSPENDED">Suspended</option>
        </select>

        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="px-3 py-2 rounded-xl bg-card border border-border text-xs font-medium text-foreground outline-none"
        >
          <option value="all">All Roles</option>
          {roles.map((r) => (
            <option key={r.id} value={r.name}>
              {r.display_name}
            </option>
          ))}
        </select>

        <select
          value={scopeFilter}
          onChange={(e) => setScopeFilter(e.target.value)}
          className="px-3 py-2 rounded-xl bg-card border border-border text-xs font-medium text-foreground outline-none"
        >
          <option value="all">All Scopes</option>
          <option value="GLOBAL">Global</option>
          <option value="ORGANIZATION">Organization</option>
          <option value="BRANCH">Branch</option>
          <option value="RESELLER">Reseller</option>
          <option value="OWN">Own Only</option>
        </select>
      </div>

      {/* Users Table */}
      <div className="border border-border rounded-2xl bg-card/60 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-muted/40 border-b border-border text-muted-foreground uppercase text-[10px] tracking-wider font-semibold">
              <tr>
                <th className="py-3 px-3">Username</th>
                <th className="py-3 px-3">Full Name</th>
                <th className="py-3 px-3">Assigned Roles</th>
                <th className="py-3 px-3">Data Scope</th>
                <th className="py-3 px-3">Affiliation</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-3">Last Login</th>
                <th className="py-3 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-muted-foreground">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-primary" />
                    Loading staff users...
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-muted-foreground">
                    No users matching criteria.
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr key={u.id} className="hover:bg-accent/40 transition-colors">
                    <td className="py-3 px-3">
                      <div className="font-mono font-bold text-foreground flex items-center gap-1.5">
                        <span className="cursor-pointer hover:underline text-primary" onClick={() => openDetailDrawer(u)}>
                          @{u.username}
                        </span>
                        {u.force_password_reset && (
                          <span className="text-[10px] px-1 py-0.2 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded font-semibold" title="Password reset required">
                            Reset Required
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-muted-foreground block">{u.email || 'No email registered'}</span>
                    </td>

                    <td className="py-3 px-3 font-medium text-foreground">
                      {u.full_name || '—'}
                      {u.phone && <span className="block text-[10px] text-muted-foreground font-mono">{u.phone}</span>}
                    </td>

                    <td className="py-3 px-3">
                      <div className="flex flex-wrap gap-1">
                        {u.roles.map((r) => (
                          <span
                            key={r.id}
                            className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-primary/10 text-primary border border-primary/20"
                          >
                            {r.display_name}
                          </span>
                        ))}
                      </div>
                    </td>

                    <td className="py-3 px-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                          u.data_scope === 'GLOBAL'
                            ? 'bg-purple-500/10 text-purple-400 border-purple-500/20'
                            : u.data_scope === 'ORGANIZATION'
                            ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                            : u.data_scope === 'BRANCH'
                            ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20'
                            : u.data_scope === 'RESELLER'
                            ? 'bg-pink-500/10 text-pink-400 border-pink-500/20'
                            : 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20'
                        }`}
                      >
                        {u.data_scope}
                      </span>
                    </td>

                    <td className="py-3 px-3">
                      {u.branch_name ? (
                        <span className="inline-flex items-center gap-1 text-[11px] text-blue-400">
                          <Building2 className="w-3 h-3" />
                          {u.branch_name}
                        </span>
                      ) : u.reseller_name ? (
                        <span className="inline-flex items-center gap-1 text-[11px] text-pink-400">
                          <Store className="w-3 h-3" />
                          {u.reseller_name}
                        </span>
                      ) : (
                        <span className="text-[11px] text-muted-foreground">HQ / Organization</span>
                      )}
                    </td>

                    <td className="py-3 px-3">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                          u.status === 'ACTIVE'
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                            : u.status === 'SUSPENDED'
                            ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                            : 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20'
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${u.status === 'ACTIVE' ? 'bg-emerald-400 animate-pulse' : u.status === 'SUSPENDED' ? 'bg-rose-400' : 'bg-zinc-400'}`} />
                        {u.status}
                      </span>
                    </td>

                    <td className="py-3 px-3">
                      {u.last_login_at ? (
                        <div>
                          <span className="font-mono text-[11px] text-foreground">
                            {new Date(u.last_login_at).toLocaleDateString()} {new Date(u.last_login_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          <span className="block text-[10px] text-muted-foreground font-mono">{u.last_login_ip || 'IP N/A'}</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-[11px]">Never logged in</span>
                      )}
                    </td>

                    <td className="py-3 px-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openDetailDrawer(u)}
                          className="p-1.5 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
                          title="View Details & Permissions"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => openEditModal(u)}
                          className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg transition-colors"
                          title="Edit User"
                        >
                          <Shield className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setResetPassUser(u)}
                          className="p-1.5 text-muted-foreground hover:text-amber-400 hover:bg-amber-500/10 rounded-lg transition-colors"
                          title="Reset Password"
                        >
                          <Key className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleForceLogout(u)}
                          className="p-1.5 text-muted-foreground hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
                          title="Force Logout"
                        >
                          <LogOut className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="p-3 border-t border-border flex items-center justify-between text-xs text-muted-foreground bg-muted/20">
          <div>
            Showing <span className="font-semibold text-foreground">{(meta.page - 1) * meta.limit + 1}</span> to{' '}
            <span className="font-semibold text-foreground">{Math.min(meta.page * meta.limit, meta.total)}</span> of{' '}
            <span className="font-semibold text-foreground">{meta.total}</span> users
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => fetchUsers(meta.page - 1)}
              disabled={meta.page <= 1 || loading}
              className="p-1.5 rounded-lg border border-border bg-card hover:bg-accent disabled:opacity-40 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="font-semibold text-foreground px-2">{meta.page}</span>
            <button
              onClick={() => fetchUsers(meta.page + 1)}
              disabled={meta.page >= meta.totalPages || loading}
              className="p-1.5 rounded-lg border border-border bg-card hover:bg-accent disabled:opacity-40 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* CREATE USER MODAL */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-md animate-in fade-in">
          <div className="bg-card border border-border rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-primary" />
                Create New Staff Account
              </h3>
              <button onClick={() => setCreateModalOpen(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-muted-foreground block mb-1">Username *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. noc.aarav"
                    value={formUsername}
                    onChange={(e) => setFormUsername(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-background border border-border focus:ring-2 focus:ring-primary outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="font-semibold text-muted-foreground block mb-1">Full Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Aarav Sharma"
                    value={formFullName}
                    onChange={(e) => setFormFullName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-background border border-border focus:ring-2 focus:ring-primary outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-muted-foreground block mb-1">Email Address</label>
                  <input
                    type="email"
                    placeholder="e.g. aarav@skyfiber.com"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-background border border-border focus:ring-2 focus:ring-primary outline-none"
                  />
                </div>
                <div>
                  <label className="font-semibold text-muted-foreground block mb-1">Mobile Phone</label>
                  <input
                    type="text"
                    placeholder="e.g. 9801234567"
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-background border border-border focus:ring-2 focus:ring-primary outline-none font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-muted-foreground block mb-1">Initial Password * (min. 6 chars)</label>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={formPassword}
                  onChange={(e) => setFormPassword(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-background border border-border focus:ring-2 focus:ring-primary outline-none font-mono"
                />
              </div>

              {/* Roles selection */}
              <div>
                <label className="font-semibold text-muted-foreground block mb-1">Assign Roles * (multi-select)</label>
                <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto p-2 rounded-xl border border-border bg-background">
                  {roles.map((r) => {
                    const checked = formRoleIds.includes(r.id);
                    return (
                      <label key={r.id} className="flex items-center gap-2 cursor-pointer hover:text-foreground text-[11px]">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            if (e.target.checked) setFormRoleIds([...formRoleIds, r.id]);
                            else setFormRoleIds(formRoleIds.filter((id) => id !== r.id));
                          }}
                          className="rounded border-border text-primary focus:ring-primary"
                        />
                        <span>{r.display_name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Scope & User Type */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-muted-foreground block mb-1">Data Scope</label>
                  <select
                    value={formDataScope}
                    onChange={(e) => setFormDataScope(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-background border border-border outline-none font-medium"
                  >
                    <option value="GLOBAL">GLOBAL (Full Access)</option>
                    <option value="ORGANIZATION">ORGANIZATION</option>
                    <option value="BRANCH">BRANCH</option>
                    <option value="RESELLER">RESELLER</option>
                    <option value="OWN">OWN (Self only)</option>
                  </select>
                </div>
                <div>
                  <label className="font-semibold text-muted-foreground block mb-1">User Entity Affiliation</label>
                  <select
                    value={formUserType}
                    onChange={(e) => setFormUserType(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-background border border-border outline-none font-medium"
                  >
                    <option value="isp">ISP Head Office</option>
                    <option value="branch">Branch Office</option>
                    <option value="reseller">Reseller Franchise</option>
                  </select>
                </div>
              </div>

              {formUserType === 'branch' && (
                <div>
                  <label className="font-semibold text-muted-foreground block mb-1">Assigned Branch</label>
                  <select
                    value={formBranchId}
                    onChange={(e) => setFormBranchId(e.target.value ? Number(e.target.value) : '')}
                    className="w-full px-3 py-2 rounded-xl bg-background border border-border outline-none"
                  >
                    <option value="">Select Branch...</option>
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name} ({b.code})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {formUserType === 'reseller' && (
                <div>
                  <label className="font-semibold text-muted-foreground block mb-1">Assigned Reseller</label>
                  <select
                    value={formResellerId}
                    onChange={(e) => setFormResellerId(e.target.value ? Number(e.target.value) : '')}
                    className="w-full px-3 py-2 rounded-xl bg-background border border-border outline-none"
                  >
                    <option value="">Select Reseller...</option>
                    {resellers.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name} ({r.code})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <label className="flex items-center gap-2 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={formForceReset}
                  onChange={(e) => setFormForceReset(e.target.checked)}
                  className="rounded border-border text-primary focus:ring-primary"
                />
                <span className="text-muted-foreground text-[11px]">Require password reset on next login</span>
              </label>

              <div className="flex justify-end gap-2 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-accent font-semibold hover:bg-accent/80"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 rounded-xl bg-primary text-primary-foreground font-semibold hover:opacity-90 disabled:opacity-50"
                >
                  {submitting ? 'Creating...' : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT USER MODAL */}
      {editUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-md animate-in fade-in">
          <div className="bg-card border border-border rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="text-base font-bold text-foreground">Edit Staff User: @{editUser.username}</h3>
              <button onClick={() => setEditUser(null)} className="text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-muted-foreground block mb-1">Full Name</label>
                  <input
                    type="text"
                    value={formFullName}
                    onChange={(e) => setFormFullName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-background border border-border focus:ring-2 focus:ring-primary outline-none"
                  />
                </div>
                <div>
                  <label className="font-semibold text-muted-foreground block mb-1">Phone</label>
                  <input
                    type="text"
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-background border border-border focus:ring-2 focus:ring-primary outline-none font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-muted-foreground block mb-1">Email</label>
                <input
                  type="email"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-background border border-border focus:ring-2 focus:ring-primary outline-none"
                />
              </div>

              <div>
                <label className="font-semibold text-muted-foreground block mb-1">Assigned Roles</label>
                <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto p-2 rounded-xl border border-border bg-background">
                  {roles.map((r) => {
                    const checked = formRoleIds.includes(r.id);
                    return (
                      <label key={r.id} className="flex items-center gap-2 cursor-pointer hover:text-foreground text-[11px]">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            if (e.target.checked) setFormRoleIds([...formRoleIds, r.id]);
                            else setFormRoleIds(formRoleIds.filter((id) => id !== r.id));
                          }}
                          className="rounded border-border text-primary focus:ring-primary"
                        />
                        <span>{r.display_name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-muted-foreground block mb-1">Data Scope</label>
                  <select
                    value={formDataScope}
                    onChange={(e) => setFormDataScope(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-background border border-border outline-none font-medium"
                  >
                    <option value="GLOBAL">GLOBAL</option>
                    <option value="ORGANIZATION">ORGANIZATION</option>
                    <option value="BRANCH">BRANCH</option>
                    <option value="RESELLER">RESELLER</option>
                    <option value="OWN">OWN</option>
                  </select>
                </div>
                <div>
                  <label className="font-semibold text-muted-foreground block mb-1">Account Status</label>
                  <select
                    value={editUser.status}
                    onChange={(e) => handleStatusChange(editUser, e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl bg-background border border-border outline-none font-medium"
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="INACTIVE">INACTIVE</option>
                    <option value="SUSPENDED">SUSPENDED</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setEditUser(null)}
                  className="px-4 py-2 rounded-xl bg-accent font-semibold hover:bg-accent/80"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 rounded-xl bg-primary text-primary-foreground font-semibold hover:opacity-90 disabled:opacity-50"
                >
                  {submitting ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RESET PASSWORD MODAL */}
      {resetPassUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-md animate-in fade-in">
          <div className="bg-card border border-border rounded-2xl w-full max-w-sm p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                <Key className="w-4 h-4 text-amber-400" />
                Reset Password
              </h3>
              <button onClick={() => setResetPassUser(null)} className="text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-muted-foreground">
              Set a new secure password for <strong className="text-foreground">@{resetPassUser.username}</strong>.
            </p>

            <form onSubmit={handleResetPasswordSubmit} className="space-y-4 text-xs">
              <div>
                <label className="font-semibold text-muted-foreground block mb-1">New Password (min 6 characters)</label>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-background border border-border focus:ring-2 focus:ring-primary outline-none font-mono"
                />
              </div>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={forceNextReset}
                  onChange={(e) => setForceNextReset(e.target.checked)}
                  className="rounded border-border text-primary focus:ring-primary"
                />
                <span className="text-muted-foreground text-[11px]">Require change on next login</span>
              </label>

              <div className="flex justify-end gap-2 pt-2 border-t border-border">
                <button
                  type="button"
                  onClick={() => setResetPassUser(null)}
                  className="px-4 py-2 rounded-xl bg-accent font-semibold hover:bg-accent/80"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 rounded-xl bg-amber-500 text-black font-semibold hover:opacity-90 disabled:opacity-50"
                >
                  {submitting ? 'Updating...' : 'Update Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* USER DETAIL & AUDIT DRAWER */}
      {detailUser && (
        <div className="fixed inset-0 z-50 flex justify-end bg-background/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-lg bg-card border-l border-border h-full shadow-2xl flex flex-col p-6 overflow-y-auto space-y-6">
            <div className="flex items-center justify-between border-b border-border pb-4">
              <div>
                <h3 className="text-lg font-bold text-foreground">@{detailUser.username}</h3>
                <span className="text-xs text-muted-foreground">{detailUser.full_name} • {detailUser.email || 'No email'}</span>
              </div>
              <button onClick={() => setDetailUser(null)} className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Account Metadata */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-xl border border-border bg-background">
                <span className="text-muted-foreground block text-[10px] uppercase font-bold">Data Scope</span>
                <span className="font-semibold text-primary">{detailUser.data_scope}</span>
              </div>
              <div className="p-3 rounded-xl border border-border bg-background">
                <span className="text-muted-foreground block text-[10px] uppercase font-bold">Status</span>
                <span className={`font-semibold ${detailUser.status === 'ACTIVE' ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {detailUser.status}
                </span>
              </div>
              <div className="p-3 rounded-xl border border-border bg-background">
                <span className="text-muted-foreground block text-[10px] uppercase font-bold">Session Security</span>
                <span className="font-mono text-muted-foreground">Token Ver: {detailUser.token_version}</span>
              </div>
              <div className="p-3 rounded-xl border border-border bg-background">
                <span className="text-muted-foreground block text-[10px] uppercase font-bold">Affiliation</span>
                <span className="font-medium text-foreground">{detailUser.branch_name || detailUser.reseller_name || 'HQ Core'}</span>
              </div>
            </div>

            {/* Effective Permissions */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-primary" />
                Effective Permissions ({userPermissions.length})
              </h4>
              <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto p-3 rounded-xl border border-border bg-background">
                {userPermissions.map((perm) => (
                  <span
                    key={perm}
                    className="px-2 py-0.5 rounded text-[10px] font-mono bg-primary/10 text-primary border border-primary/20"
                  >
                    {perm}
                  </span>
                ))}
              </div>
            </div>

            {/* Recent Login History */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                <History className="w-3.5 h-3.5 text-indigo-400" />
                Recent Login History
              </h4>
              <div className="divide-y divide-border rounded-xl border border-border bg-background overflow-hidden max-h-48 overflow-y-auto">
                {loginHistory.length === 0 ? (
                  <div className="p-4 text-center text-xs text-muted-foreground">No recent logins recorded</div>
                ) : (
                  loginHistory.map((lh) => (
                    <div key={lh.id} className="p-2.5 text-xs flex items-center justify-between">
                      <div>
                        <span className={`font-bold text-[11px] ${lh.status === 'SUCCESS' ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {lh.status}
                        </span>
                        <span className="text-[10px] text-muted-foreground block font-mono">
                          {lh.ip_address || 'Unknown IP'} {lh.failure_reason ? `(${lh.failure_reason})` : ''}
                        </span>
                      </div>
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(lh.created_at).toLocaleDateString()} {new Date(lh.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Active Sessions */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                <Smartphone className="w-3.5 h-3.5 text-emerald-400" />
                Active Sessions ({sessions.filter((s) => !s.is_revoked).length})
              </h4>
              <div className="space-y-2">
                {sessions.map((s) => (
                  <div key={s.id} className="p-3 rounded-xl border border-border bg-background flex items-center justify-between text-xs">
                    <div>
                      <span className="font-mono text-[11px] text-foreground font-semibold">IP: {s.ip_address || '—'}</span>
                      <span className="text-[10px] text-muted-foreground block truncate max-w-[240px]">{s.user_agent || 'Client'}</span>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${s.is_revoked ? 'bg-zinc-500/10 text-zinc-400' : 'bg-emerald-500/10 text-emerald-400'}`}>
                      {s.is_revoked ? 'Revoked' : 'Active'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
