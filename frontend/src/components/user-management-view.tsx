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
  Smartphone,
  Laptop,
  Globe,
  FileText,
  UserCheck,
  Sparkles,
} from 'lucide-react';
import type { UserManagementItem, RoleItem, BranchItem, ResellerItem, LoginHistoryItem, UserSessionItem } from '@/types/api';
import { RolesPermissionsView } from './roles-permissions-view';

interface UserManagementViewProps {
  currentUser?: any;
}

export function UserManagementView({ currentUser }: UserManagementViewProps) {
  // Main Top-level Tab Navigation
  const [activeMainTab, setActiveMainTab] = React.useState<'users' | 'create_user' | 'roles' | 'sessions' | 'history'>('users');

  const [users, setUsers] = React.useState<UserManagementItem[]>([]);
  const [roles, setRoles] = React.useState<RoleItem[]>([]);
  const [branches, setBranches] = React.useState<BranchItem[]>([]);
  const [resellers, setResellers] = React.useState<ResellerItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [meta, setMeta] = React.useState({ page: 1, limit: 15, total: 0, totalPages: 1 });

  // Filters for Users Tab
  const [search, setSearch] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState('all');
  const [roleFilter, setRoleFilter] = React.useState('all');
  const [scopeFilter, setScopeFilter] = React.useState('all');

  // Global Sessions Tab State
  const [sessionsList, setSessionsList] = React.useState<UserSessionItem[]>([]);
  const [sessionsLoading, setSessionsLoading] = React.useState(false);
  const [sessionsSearch, setSessionsSearch] = React.useState('');
  const [sessionsMeta, setSessionsMeta] = React.useState({ page: 1, limit: 20, total: 0, totalPages: 1 });

  // Global Login History Tab State
  const [historyList, setHistoryList] = React.useState<LoginHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = React.useState(false);
  const [historySearch, setHistorySearch] = React.useState('');
  const [historyStatus, setHistoryStatus] = React.useState('all');
  const [historyMeta, setHistoryMeta] = React.useState({ page: 1, limit: 25, total: 0, totalPages: 1 });

  // Modals & Drawers
  const [createModalOpen, setCreateModalOpen] = React.useState(false);
  const [editUser, setEditUser] = React.useState<UserManagementItem | null>(null);
  const [resetPassUser, setResetPassUser] = React.useState<UserManagementItem | null>(null);
  const [detailUser, setDetailUser] = React.useState<UserManagementItem | null>(null);
  const [userPermissions, setUserPermissions] = React.useState<string[]>([]);
  const [userLoginHistory, setUserLoginHistory] = React.useState<LoginHistoryItem[]>([]);
  const [userSessions, setUserSessions] = React.useState<UserSessionItem[]>([]);
  const [detailLoading, setDetailLoading] = React.useState(false);

  // Form states for Create & Edit
  const [formUsername, setFormUsername] = React.useState('');
  const [formFullName, setFormFullName] = React.useState('');
  const [formEmail, setFormEmail] = React.useState('');
  const [formPhone, setFormPhone] = React.useState('');
  const [formPassword, setFormPassword] = React.useState('');
  const [formRoleIds, setFormRoleIds] = React.useState<number[]>([]);
  const [formDataScope, setFormDataScope] = React.useState<string>('ORGANIZATION');
  const [formUserType, setFormUserType] = React.useState<'isp' | 'branch' | 'reseller'>('isp');
  const [formBranchId, setFormBranchId] = React.useState<number | ''>('');
  const [formResellerId, setFormResellerId] = React.useState<number | ''>('');
  const [formStatus, setFormStatus] = React.useState<'ACTIVE' | 'INACTIVE' | 'SUSPENDED'>('ACTIVE');
  const [formForceReset, setFormForceReset] = React.useState(false);
  const [formNotes, setFormNotes] = React.useState('');

  // Reset password form
  const [newPassword, setNewPassword] = React.useState('');
  const [forceNextReset, setForceNextReset] = React.useState(true);

  const [submitting, setSubmitting] = React.useState(false);
  const [notice, setNotice] = React.useState<{ text: string; error?: boolean } | null>(null);

  const isCallerSuperAdmin =
    currentUser?.role === 'super_admin' ||
    (Array.isArray(currentUser?.roles) && currentUser.roles.includes('super_admin'));

  // Filter roles: Hide Super Admin from non-super_admins
  const visibleRoles = React.useMemo(() => {
    return roles.filter((r) => {
      if (!isCallerSuperAdmin && (r.name === 'super_admin' || r.is_developer_only)) {
        return false;
      }
      return true;
    });
  }, [roles, isCallerSuperAdmin]);

  // Determine dynamic role type from selected roles
  const selectedRoleEntities = React.useMemo(() => {
    const selected = roles.filter((r) => formRoleIds.includes(r.id));
    const isBranchRole = selected.some((r) => r.name === 'branch_admin' || r.name === 'branch_operator');
    const isResellerRole = selected.some((r) => r.name === 'reseller_admin' || r.name === 'reseller_operator');
    return { selected, isBranchRole, isResellerRole };
  }, [roles, formRoleIds]);

  // Auto-adapt branch or reseller scope when role selection changes
  const handleRoleToggle = (roleId: number, checked: boolean) => {
    let nextRoleIds: number[];
    if (checked) {
      nextRoleIds = [...formRoleIds, roleId];
    } else {
      nextRoleIds = formRoleIds.filter((id) => id !== roleId);
    }
    setFormRoleIds(nextRoleIds);

    const activeRoles = roles.filter((r) => nextRoleIds.includes(r.id));
    const hasBranchRole = activeRoles.some((r) => r.name === 'branch_admin' || r.name === 'branch_operator');
    const hasResellerRole = activeRoles.some((r) => r.name === 'reseller_admin' || r.name === 'reseller_operator');

    if (hasBranchRole) {
      setFormUserType('branch');
      setFormDataScope('BRANCH');
      setFormResellerId('');
    } else if (hasResellerRole) {
      setFormUserType('reseller');
      setFormDataScope('RESELLER');
      setFormBranchId('');
    } else {
      setFormUserType('isp');
      if (formDataScope === 'BRANCH' || formDataScope === 'RESELLER') {
        setFormDataScope('ORGANIZATION');
      }
      setFormBranchId('');
      setFormResellerId('');
    }
  };

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

  const fetchGlobalSessions = async (page = sessionsMeta.page) => {
    try {
      setSessionsLoading(true);
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', String(sessionsMeta.limit));
      if (sessionsSearch.trim()) params.set('search', sessionsSearch.trim());

      const res = await fetch(`/api/user-sessions?${params.toString()}`);
      if (res.ok) {
        const json = await res.json();
        setSessionsList(json.data || []);
        if (json.meta) setSessionsMeta(json.meta);
      }
    } catch {} finally {
      setSessionsLoading(false);
    }
  };

  const fetchGlobalHistory = async (page = historyMeta.page) => {
    try {
      setHistoryLoading(true);
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', String(historyMeta.limit));
      if (historySearch.trim()) params.set('search', historySearch.trim());
      if (historyStatus !== 'all') params.set('status', historyStatus);

      const res = await fetch(`/api/login-history?${params.toString()}`);
      if (res.ok) {
        const json = await res.json();
        setHistoryList(json.data || []);
        if (json.meta) setHistoryMeta(json.meta);
      }
    } catch {} finally {
      setHistoryLoading(false);
    }
  };

  React.useEffect(() => {
    fetchDependencies();
  }, []);

  React.useEffect(() => {
    if (activeMainTab === 'users') {
      fetchUsers(1);
    } else if (activeMainTab === 'sessions') {
      fetchGlobalSessions(1);
    } else if (activeMainTab === 'history') {
      fetchGlobalHistory(1);
    }
  }, [activeMainTab, search, statusFilter, roleFilter, scopeFilter, sessionsSearch, historySearch, historyStatus]);

  const showNotice = (text: string, error = false) => {
    setNotice({ text, error });
    setTimeout(() => setNotice(null), 4000);
  };

  const resetFormFields = () => {
    setFormUsername('');
    setFormFullName('');
    setFormEmail('');
    setFormPhone('');
    setFormPassword('');
    setFormRoleIds(visibleRoles.length > 0 ? [visibleRoles[0].id] : []);
    setFormDataScope('ORGANIZATION');
    setFormUserType('isp');
    setFormBranchId('');
    setFormResellerId('');
    setFormStatus('ACTIVE');
    setFormForceReset(false);
    setFormNotes('');
  };

  const openCreateModal = () => {
    resetFormFields();
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
    setFormStatus(u.status);
    setFormForceReset(u.force_password_reset);
    setFormNotes(u.notes || '');
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
        setUserLoginHistory(hj.data || []);
      }
      if (sRes.ok) {
        const sj = await sRes.json();
        setUserSessions(sj.data || []);
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

    if (selectedRoleEntities.isBranchRole && !formBranchId) {
      showNotice('Branch role requires an assigned branch', true);
      return;
    }

    if (selectedRoleEntities.isResellerRole && !formResellerId) {
      showNotice('Reseller role requires an assigned reseller', true);
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
          notes: formNotes || undefined,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        showNotice(json.error?.message || json.error || 'Failed to create user', true);
        return;
      }

      showNotice(`Staff user "${formUsername}" created successfully`);
      setCreateModalOpen(false);
      resetFormFields();
      if (activeMainTab === 'create_user') {
        setActiveMainTab('users');
      }
      fetchUsers(1);
    } catch (err: any) {
      showNotice(err.message, true);
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editUser) return;

    if (selectedRoleEntities.isBranchRole && !formBranchId) {
      showNotice('Branch role requires an assigned branch', true);
      return;
    }

    if (selectedRoleEntities.isResellerRole && !formResellerId) {
      showNotice('Reseller role requires an assigned reseller', true);
      return;
    }

    try {
      setSubmitting(true);
      const res = await fetch(`/api/users/${editUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: formFullName,
          email: formEmail || undefined,
          phone: formPhone || undefined,
          status: formStatus,
          roleIds: formRoleIds,
          dataScope: formDataScope,
          userType: formUserType,
          branchId: formBranchId !== '' ? Number(formBranchId) : null,
          resellerId: formResellerId !== '' ? Number(formResellerId) : null,
          forcePasswordReset: formForceReset,
          notes: formNotes || null,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        showNotice(json.error?.message || json.error || 'Failed to update user', true);
        return;
      }

      showNotice('Staff user updated successfully');
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
      if (activeMainTab === 'sessions') fetchGlobalSessions(sessionsMeta.page);
    } catch (err: any) {
      showNotice(err.message, true);
    }
  };

  const handleRevokeSession = async (sessionId: string) => {
    try {
      const res = await fetch(`/api/user-sessions/${sessionId}/revoke`, {
        method: 'POST',
      });
      if (!res.ok) {
        const j = await res.json();
        showNotice(j.error?.message || 'Failed to revoke session', true);
        return;
      }
      showNotice('Session revoked successfully');
      if (activeMainTab === 'sessions') fetchGlobalSessions(sessionsMeta.page);
      if (detailUser) {
        openDetailDrawer(detailUser);
      }
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
      showNotice(`Password reset successfully for @${resetPassUser.username}`);
      setResetPassUser(null);
      setNewPassword('');
    } catch (err: any) {
      showNotice(err.message, true);
    } finally {
      setSubmitting(false);
    }
  };

  // Group user effective permissions by module
  const groupedUserPermissions = React.useMemo(() => {
    const map: Record<string, string[]> = {};
    userPermissions.forEach((p) => {
      const parts = p.split('.');
      const mod = (parts[0] || 'GENERAL').toUpperCase();
      if (!map[mod]) map[mod] = [];
      map[mod].push(p);
    });
    return map;
  }, [userPermissions]);

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

      {/* Header & Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            User & Staff Governance
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Administer ISP administrators, branch staff, reseller operators, permissions, and active sessions.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {activeMainTab === 'users' && (
            <button
              onClick={openCreateModal}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 shadow-md shadow-primary/20 transition-all"
            >
              <UserPlus className="w-4 h-4" />
              Create Staff User
            </button>
          )}
        </div>
      </div>

      {/* Primary Navigation Tabs */}
      <div className="flex items-center gap-1 border-b border-border pb-2 overflow-x-auto">
        <button
          onClick={() => setActiveMainTab('users')}
          className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 whitespace-nowrap ${
            activeMainTab === 'users'
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground hover:bg-accent'
          }`}
        >
          <Users className="w-4 h-4" />
          Users Directory
        </button>

        <button
          onClick={() => {
            resetFormFields();
            setActiveMainTab('create_user');
          }}
          className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 whitespace-nowrap ${
            activeMainTab === 'create_user'
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground hover:bg-accent'
          }`}
        >
          <UserPlus className="w-4 h-4" />
          Create User
        </button>

        <button
          onClick={() => setActiveMainTab('roles')}
          className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 whitespace-nowrap ${
            activeMainTab === 'roles'
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground hover:bg-accent'
          }`}
        >
          <Shield className="w-4 h-4" />
          Roles & Permissions
        </button>

        <button
          onClick={() => setActiveMainTab('sessions')}
          className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 whitespace-nowrap ${
            activeMainTab === 'sessions'
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground hover:bg-accent'
          }`}
        >
          <Laptop className="w-4 h-4" />
          Active Sessions
        </button>

        <button
          onClick={() => setActiveMainTab('history')}
          className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 whitespace-nowrap ${
            activeMainTab === 'history'
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground hover:bg-accent'
          }`}
        >
          <History className="w-4 h-4" />
          Login History
        </button>
      </div>

      {/* TAB 1: USERS DIRECTORY */}
      {activeMainTab === 'users' && (
        <div className="space-y-6">
          {/* KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 rounded-2xl bg-card border border-border shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">Total Staff Users</span>
                <Users className="w-4 h-4 text-primary" />
              </div>
              <div className="mt-2 text-2xl font-bold text-foreground">{totalCount}</div>
              <span className="text-[11px] text-muted-foreground">Configured across organization</span>
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
                <span className="text-xs font-medium text-muted-foreground">Operational Roles</span>
                <Shield className="w-4 h-4 text-indigo-400" />
              </div>
              <div className="mt-2 text-2xl font-bold text-indigo-400">{roles.length}</div>
              <span className="text-[11px] text-muted-foreground">Configured roles</span>
            </div>
          </div>

          {/* Filter & Search Bar */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search staff by username, name, email, phone..."
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
              {visibleRoles.map((r) => (
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
              {isCallerSuperAdmin && <option value="PLATFORM">PLATFORM (Developer)</option>}
              <option value="ORGANIZATION">ORGANIZATION</option>
              <option value="HEAD_OFFICE">HEAD_OFFICE</option>
              <option value="BRANCH">BRANCH</option>
              <option value="RESELLER">RESELLER</option>
              <option value="OWN_RECORDS">OWN_RECORDS</option>
            </select>
          </div>

          {/* Users Table */}
          <div className="border border-border rounded-2xl bg-card/60 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/40 border-b border-border text-muted-foreground uppercase text-[10px] tracking-wider font-semibold">
                  <tr>
                    <th className="py-3 px-3">Username & Contact</th>
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
                        No staff users matching criteria.
                      </td>
                    </tr>
                  ) : (
                    users.map((u) => (
                      <tr key={u.id} className="hover:bg-accent/40 transition-colors">
                        <td className="py-3 px-3">
                          <div className="font-mono font-bold text-foreground flex items-center gap-1.5">
                            <span
                              className="cursor-pointer hover:underline text-primary"
                              onClick={() => openDetailDrawer(u)}
                            >
                              @{u.username}
                            </span>
                            {u.force_password_reset && (
                              <span
                                className="text-[9px] px-1.5 py-0.2 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded font-semibold"
                                title="Password reset required on next login"
                              >
                                Reset Req
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
                            {u.roles.map((r) => {
                              const isDevRole = r.name === 'super_admin';
                              return (
                                <span
                                  key={r.id}
                                  className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                                    isDevRole
                                      ? 'bg-purple-500/20 text-purple-300 border-purple-500/30'
                                      : 'bg-primary/10 text-primary border-primary/20'
                                  }`}
                                >
                                  {r.display_name}
                                </span>
                              );
                            })}
                          </div>
                        </td>

                        <td className="py-3 px-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                              u.data_scope === 'PLATFORM'
                                ? 'bg-purple-500/20 text-purple-300 border-purple-500/30'
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
                            <span className="text-[11px] text-muted-foreground">Head Office</span>
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
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                u.status === 'ACTIVE'
                                  ? 'bg-emerald-400 animate-pulse'
                                  : u.status === 'SUSPENDED'
                                  ? 'bg-rose-400'
                                  : 'bg-zinc-400'
                              }`}
                            />
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
        </div>
      )}

      {/* TAB 2: CREATE USER VIEW */}
      {activeMainTab === 'create_user' && (
        <div className="max-w-3xl mx-auto p-6 rounded-2xl bg-card border border-border shadow-md space-y-6">
          <div className="border-b border-border pb-4">
            <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-primary" />
              Onboard Staff Member / Operator
            </h3>
            <p className="text-xs text-muted-foreground mt-1">
              Configure credentials, multi-role privileges, dynamic branch/reseller assignments, and access scope boundaries.
            </p>
          </div>

          <form onSubmit={handleCreateSubmit} className="space-y-5 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="font-semibold text-foreground block mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Aarav Sharma"
                  value={formFullName}
                  onChange={(e) => setFormFullName(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-background border border-border focus:ring-2 focus:ring-primary outline-none"
                />
              </div>

              <div>
                <label className="font-semibold text-foreground block mb-1">Username *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. aarav.sharma"
                  value={formUsername}
                  onChange={(e) => setFormUsername(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-background border border-border focus:ring-2 focus:ring-primary outline-none font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="font-semibold text-foreground block mb-1">Email Address</label>
                <input
                  type="email"
                  placeholder="e.g. aarav@skyfiber.com"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-background border border-border focus:ring-2 focus:ring-primary outline-none"
                />
              </div>

              <div>
                <label className="font-semibold text-foreground block mb-1">Mobile Phone</label>
                <input
                  type="text"
                  placeholder="e.g. 9801234567"
                  value={formPhone}
                  onChange={(e) => setFormPhone(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-background border border-border focus:ring-2 focus:ring-primary outline-none font-mono"
                />
              </div>
            </div>

            <div>
              <label className="font-semibold text-foreground block mb-1">Password * (min. 6 characters)</label>
              <input
                type="password"
                required
                placeholder="••••••••"
                value={formPassword}
                onChange={(e) => setFormPassword(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-background border border-border focus:ring-2 focus:ring-primary outline-none font-mono"
              />
            </div>

            {/* Roles Selection */}
            <div>
              <label className="font-semibold text-foreground block mb-1">Role Assignment * (filtered by privileges)</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 max-h-48 overflow-y-auto p-3 rounded-xl border border-border bg-background">
                {visibleRoles.map((r) => {
                  const checked = formRoleIds.includes(r.id);
                  return (
                    <label
                      key={r.id}
                      className={`flex items-start gap-2.5 p-2 rounded-lg cursor-pointer transition border ${
                        checked
                          ? 'bg-primary/10 border-primary/30 text-foreground'
                          : 'border-transparent text-muted-foreground hover:bg-accent'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => handleRoleToggle(r.id, e.target.checked)}
                        className="mt-0.5 rounded border-border text-primary focus:ring-primary"
                      />
                      <div className="min-w-0">
                        <span className="font-semibold text-xs block">{r.display_name}</span>
                        <span className="text-[10px] text-muted-foreground font-mono block">{r.name}</span>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Dynamic Access Scope & Hierarchy */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="font-semibold text-foreground block mb-1">Access Scope</label>
                <select
                  value={formDataScope}
                  onChange={(e) => setFormDataScope(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-background border border-border outline-none font-medium"
                >
                  {isCallerSuperAdmin && <option value="PLATFORM">PLATFORM (Developer Owner)</option>}
                  <option value="ORGANIZATION">ORGANIZATION (Entire ISP)</option>
                  <option value="HEAD_OFFICE">HEAD_OFFICE (Central Office)</option>
                  <option value="BRANCH">BRANCH (Assigned Branch Only)</option>
                  <option value="RESELLER">RESELLER (Assigned Reseller Only)</option>
                  <option value="OWN_RECORDS">OWN_RECORDS (Self Records Only)</option>
                </select>
              </div>

              <div>
                <label className="font-semibold text-foreground block mb-1">Status</label>
                <select
                  value={formStatus}
                  onChange={(e) => setFormStatus(e.target.value as any)}
                  className="w-full px-3 py-2.5 rounded-xl bg-background border border-border outline-none font-medium"
                >
                  <option value="ACTIVE">Active (Can log in)</option>
                  <option value="INACTIVE">Inactive (Disabled)</option>
                  <option value="SUSPENDED">Suspended (Blocked)</option>
                </select>
              </div>
            </div>

            {/* Dynamic Branch selector (Shown and REQUIRED when Branch role or BRANCH scope is chosen) */}
            {(selectedRoleEntities.isBranchRole || formDataScope === 'BRANCH') && (
              <div className="p-3.5 bg-cyan-500/5 border border-cyan-500/20 rounded-xl space-y-1">
                <label className="font-semibold text-cyan-400 flex items-center gap-1.5 block">
                  <Building2 className="w-4 h-4" />
                  Assigned Branch Office *
                </label>
                <p className="text-[11px] text-muted-foreground mb-2">
                  This user is branch-scoped. Operational access will be strictly restricted to this branch.
                </p>
                <select
                  required
                  value={formBranchId}
                  onChange={(e) => setFormBranchId(e.target.value ? Number(e.target.value) : '')}
                  className="w-full px-3 py-2 rounded-xl bg-background border border-border outline-none font-medium"
                >
                  <option value="">Select Branch Office...</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.code})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Dynamic Reseller selector (Shown and REQUIRED when Reseller role or RESELLER scope is chosen) */}
            {(selectedRoleEntities.isResellerRole || formDataScope === 'RESELLER') && (
              <div className="p-3.5 bg-pink-500/5 border border-pink-500/20 rounded-xl space-y-1">
                <label className="font-semibold text-pink-400 flex items-center gap-1.5 block">
                  <Store className="w-4 h-4" />
                  Assigned Reseller Entity *
                </label>
                <p className="text-[11px] text-muted-foreground mb-2">
                  A reseller is an independent channel entity under the organization. The user will manage this reseller's customers and wallet.
                </p>
                <select
                  required
                  value={formResellerId}
                  onChange={(e) => setFormResellerId(e.target.value ? Number(e.target.value) : '')}
                  className="w-full px-3 py-2 rounded-xl bg-background border border-border outline-none font-medium"
                >
                  <option value="">Select Reseller Partner...</option>
                  {resellers.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name} ({r.code})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Remarks / Notes */}
            <div>
              <label className="font-semibold text-foreground block mb-1">Remarks & Administrative Notes</label>
              <textarea
                rows={2}
                placeholder="Optional internal notes on staff duties, department, or onboarding approval..."
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-background border border-border focus:ring-2 focus:ring-primary outline-none"
              />
            </div>

            {/* Password Reset Toggle */}
            <label className="flex items-center gap-2.5 cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={formForceReset}
                onChange={(e) => setFormForceReset(e.target.checked)}
                className="rounded border-border text-primary focus:ring-primary"
              />
              <span className="text-foreground text-xs font-medium">Require temporary password reset upon first login</span>
            </label>

            <div className="flex justify-end gap-3 pt-4 border-t border-border">
              <button
                type="button"
                onClick={() => setActiveMainTab('users')}
                className="px-4 py-2.5 rounded-xl bg-accent font-semibold hover:bg-accent/80 transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-6 py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold shadow-md shadow-primary/25 hover:opacity-90 disabled:opacity-50 transition flex items-center gap-2"
              >
                {submitting && <RefreshCw className="w-4 h-4 animate-spin" />}
                Create Staff User
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB 3: ROLES & PERMISSIONS */}
      {activeMainTab === 'roles' && (
        <div className="space-y-4">
          <RolesPermissionsView currentUser={currentUser} />
        </div>
      )}

      {/* TAB 4: SESSIONS DIRECTORY */}
      {activeMainTab === 'sessions' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                <Laptop className="w-5 h-5 text-primary" />
                Active Staff Sessions
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Monitor live logged-in staff tokens, client IP addresses, and enforce immediate session termination.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => fetchGlobalSessions(sessionsMeta.page)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-card border border-border text-xs text-foreground hover:bg-accent"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${sessionsLoading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>
          </div>

          <div className="border border-border rounded-2xl bg-card/60 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/40 border-b border-border text-muted-foreground uppercase text-[10px] tracking-wider font-semibold">
                  <tr>
                    <th className="py-3 px-3">Staff User</th>
                    <th className="py-3 px-3">IP Address</th>
                    <th className="py-3 px-3">User Agent</th>
                    <th className="py-3 px-3">Last Activity</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {sessionsLoading ? (
                    <tr>
                      <td colSpan={6} className="py-10 text-center text-muted-foreground">
                        <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-primary" />
                        Loading active staff sessions...
                      </td>
                    </tr>
                  ) : sessionsList.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-10 text-center text-muted-foreground">
                        No active login sessions found.
                      </td>
                    </tr>
                  ) : (
                    sessionsList.map((s) => (
                      <tr key={s.id} className="hover:bg-accent/40 transition-colors">
                        <td className="py-3 px-3 font-semibold text-foreground">
                          {s.username ? `@${s.username}` : `User #${s.user_id}`}
                          {s.full_name && <span className="block text-[10px] text-muted-foreground">{s.full_name}</span>}
                        </td>
                        <td className="py-3 px-3 font-mono text-muted-foreground">{s.ip_address || '—'}</td>
                        <td className="py-3 px-3 text-muted-foreground max-w-xs truncate" title={s.user_agent || undefined}>
                          {s.user_agent || 'Unknown browser'}
                        </td>
                        <td className="py-3 px-3 text-muted-foreground">
                          {new Date(s.last_activity).toLocaleString()}
                        </td>
                        <td className="py-3 px-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                              s.is_revoked
                                ? 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20'
                                : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                            }`}
                          >
                            {s.is_revoked ? 'Revoked' : 'Active'}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right">
                          {!s.is_revoked && (
                            <button
                              onClick={() => handleRevokeSession(s.id)}
                              className="px-2.5 py-1 rounded-lg text-[11px] font-semibold text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 transition"
                            >
                              Revoke
                            </button>
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

      {/* TAB 5: LOGIN HISTORY */}
      {activeMainTab === 'history' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                <History className="w-5 h-5 text-primary" />
                Staff Authentication Audit Log
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Audit trail of successful logins, password failures, and temporary account lockouts.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <select
                value={historyStatus}
                onChange={(e) => setHistoryStatus(e.target.value)}
                className="px-3 py-2 rounded-xl bg-card border border-border text-xs font-medium text-foreground outline-none"
              >
                <option value="all">All Events</option>
                <option value="SUCCESS">Success</option>
                <option value="FAILED">Failed</option>
                <option value="LOCKED">Locked</option>
              </select>

              <button
                onClick={() => fetchGlobalHistory(historyMeta.page)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-card border border-border text-xs text-foreground hover:bg-accent"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${historyLoading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>
          </div>

          <div className="border border-border rounded-2xl bg-card/60 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/40 border-b border-border text-muted-foreground uppercase text-[10px] tracking-wider font-semibold">
                  <tr>
                    <th className="py-3 px-3">Timestamp</th>
                    <th className="py-3 px-3">Username</th>
                    <th className="py-3 px-3">IP Address</th>
                    <th className="py-3 px-3">Device / User Agent</th>
                    <th className="py-3 px-3">Outcome</th>
                    <th className="py-3 px-3">Failure Reason</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {historyLoading ? (
                    <tr>
                      <td colSpan={6} className="py-10 text-center text-muted-foreground">
                        <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-primary" />
                        Loading login history audit trail...
                      </td>
                    </tr>
                  ) : historyList.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-10 text-center text-muted-foreground">
                        No login events found.
                      </td>
                    </tr>
                  ) : (
                    historyList.map((h) => (
                      <tr key={h.id} className="hover:bg-accent/40 transition-colors">
                        <td className="py-3 px-3 font-mono text-muted-foreground">
                          {new Date(h.created_at).toLocaleString()}
                        </td>
                        <td className="py-3 px-3 font-semibold text-foreground">@{h.username}</td>
                        <td className="py-3 px-3 font-mono text-muted-foreground">{h.ip_address || '—'}</td>
                        <td className="py-3 px-3 text-muted-foreground max-w-xs truncate" title={h.user_agent || undefined}>
                          {h.user_agent || 'Unknown'}
                        </td>
                        <td className="py-3 px-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                              h.status === 'SUCCESS'
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                : h.status === 'LOCKED'
                                ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                                : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                            }`}
                          >
                            {h.status}
                          </span>
                        </td>
                        <td className="py-3 px-3 font-mono text-muted-foreground text-[11px]">
                          {h.failure_reason || '—'}
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

      {/* EDIT USER MODAL */}
      {editUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-md animate-in fade-in">
          <div className="bg-card border border-border rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                <Shield className="w-4 h-4 text-primary" />
                Edit Staff Member: @{editUser.username}
              </h3>
              <button onClick={() => setEditUser(null)} className="text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-muted-foreground block mb-1">Full Name *</label>
                  <input
                    type="text"
                    required
                    value={formFullName}
                    onChange={(e) => setFormFullName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-background border border-border focus:ring-2 focus:ring-primary outline-none"
                  />
                </div>
                <div>
                  <label className="font-semibold text-muted-foreground block mb-1">Account Status</label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl bg-background border border-border outline-none font-medium"
                  >
                    <option value="ACTIVE">Active (Authorized)</option>
                    <option value="INACTIVE">Inactive (Disabled)</option>
                    <option value="SUSPENDED">Suspended (Blocked)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                  <label className="font-semibold text-muted-foreground block mb-1">Phone</label>
                  <input
                    type="text"
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-background border border-border focus:ring-2 focus:ring-primary outline-none font-mono"
                  />
                </div>
              </div>

              {/* Roles selection */}
              <div>
                <label className="font-semibold text-muted-foreground block mb-1">Role Privileges (multi-select)</label>
                <div className="grid grid-cols-2 gap-2 max-h-36 overflow-y-auto p-2 rounded-xl border border-border bg-background">
                  {visibleRoles.map((r) => {
                    const checked = formRoleIds.includes(r.id);
                    return (
                      <label key={r.id} className="flex items-center gap-2 cursor-pointer hover:text-foreground text-[11px]">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => handleRoleToggle(r.id, e.target.checked)}
                          className="rounded border-border text-primary focus:ring-primary"
                        />
                        <span>{r.display_name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Scope */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-muted-foreground block mb-1">Data Scope</label>
                  <select
                    value={formDataScope}
                    onChange={(e) => setFormDataScope(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-background border border-border outline-none font-medium"
                  >
                    {isCallerSuperAdmin && <option value="PLATFORM">PLATFORM (Developer)</option>}
                    <option value="ORGANIZATION">ORGANIZATION</option>
                    <option value="HEAD_OFFICE">HEAD_OFFICE</option>
                    <option value="BRANCH">BRANCH</option>
                    <option value="RESELLER">RESELLER</option>
                    <option value="OWN_RECORDS">OWN_RECORDS</option>
                  </select>
                </div>
                <div>
                  <label className="font-semibold text-muted-foreground block mb-1">Affiliation</label>
                  <select
                    value={formUserType}
                    onChange={(e) => setFormUserType(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl bg-background border border-border outline-none font-medium"
                  >
                    <option value="isp">Head Office</option>
                    <option value="branch">Branch Office</option>
                    <option value="reseller">Reseller Partner</option>
                  </select>
                </div>
              </div>

              {/* Dynamic Branch or Reseller */}
              {(selectedRoleEntities.isBranchRole || formDataScope === 'BRANCH') && (
                <div>
                  <label className="font-semibold text-cyan-400 block mb-1">Assigned Branch *</label>
                  <select
                    required
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

              {(selectedRoleEntities.isResellerRole || formDataScope === 'RESELLER') && (
                <div>
                  <label className="font-semibold text-pink-400 block mb-1">Assigned Reseller *</label>
                  <select
                    required
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

              {/* Notes */}
              <div>
                <label className="font-semibold text-muted-foreground block mb-1">Remarks & Notes</label>
                <textarea
                  rows={2}
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-background border border-border focus:ring-2 focus:ring-primary outline-none"
                />
              </div>

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

            <form onSubmit={handleResetPasswordSubmit} className="space-y-4 text-xs">
              <p className="text-muted-foreground">
                Set a new password for user <span className="font-semibold text-foreground">@{resetPassUser.username}</span>.
                All active sessions will be terminated immediately.
              </p>

              <div>
                <label className="font-semibold text-muted-foreground block mb-1">New Password * (min. 6 chars)</label>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-background border border-border focus:ring-2 focus:ring-primary outline-none font-mono"
                />
              </div>

              <label className="flex items-center gap-2 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={forceNextReset}
                  onChange={(e) => setForceNextReset(e.target.checked)}
                  className="rounded border-border text-primary focus:ring-primary"
                />
                <span className="text-muted-foreground text-[11px]">Require user to change password on next login</span>
              </label>

              <div className="flex justify-end gap-2 pt-3 border-t border-border">
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
                  className="px-4 py-2 rounded-xl bg-amber-500 text-amber-950 font-semibold hover:opacity-90 disabled:opacity-50"
                >
                  {submitting ? 'Resetting...' : 'Reset Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* USER DETAILS DRAWER */}
      {detailUser && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex justify-end animate-in fade-in">
          <div className="bg-card border-l border-border w-full max-w-xl h-full shadow-2xl p-6 overflow-y-auto space-y-6">
            <div className="flex items-center justify-between border-b border-border pb-4">
              <div>
                <h3 className="text-lg font-bold text-foreground">@{detailUser.username}</h3>
                <span className="text-xs text-muted-foreground">{detailUser.full_name || 'Staff User'}</span>
              </div>
              <button onClick={() => setDetailUser(null)} className="text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Profile Overview */}
            <div className="grid grid-cols-2 gap-3 p-4 rounded-xl bg-muted/30 border border-border text-xs">
              <div>
                <span className="text-muted-foreground text-[10px] uppercase font-semibold">Email</span>
                <p className="font-medium text-foreground">{detailUser.email || '—'}</p>
              </div>
              <div>
                <span className="text-muted-foreground text-[10px] uppercase font-semibold">Phone</span>
                <p className="font-medium font-mono text-foreground">{detailUser.phone || '—'}</p>
              </div>
              <div>
                <span className="text-muted-foreground text-[10px] uppercase font-semibold">Data Scope</span>
                <p className="font-semibold text-primary">{detailUser.data_scope}</p>
              </div>
              <div>
                <span className="text-muted-foreground text-[10px] uppercase font-semibold">Affiliation</span>
                <p className="font-medium text-foreground">
                  {detailUser.branch_name || detailUser.reseller_name || 'Head Office'}
                </p>
              </div>
              {detailUser.notes && (
                <div className="col-span-2 pt-2 border-t border-border/60">
                  <span className="text-muted-foreground text-[10px] uppercase font-semibold">Remarks & Notes</span>
                  <p className="text-foreground mt-0.5">{detailUser.notes}</p>
                </div>
              )}
            </div>

            {/* Quick Actions */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  const u = detailUser;
                  setDetailUser(null);
                  openEditModal(u);
                }}
                className="px-3 py-1.5 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition"
              >
                Edit Account
              </button>
              <button
                onClick={() => {
                  const u = detailUser;
                  setDetailUser(null);
                  setResetPassUser(u);
                }}
                className="px-3 py-1.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 text-xs font-semibold hover:bg-amber-500/20 transition"
              >
                Reset Password
              </button>
              <button
                onClick={() => handleForceLogout(detailUser)}
                className="px-3 py-1.5 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20 text-xs font-semibold hover:bg-rose-500/20 transition"
              >
                Terminate Sessions
              </button>
            </div>

            {/* Unified Effective Permissions */}
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-border pb-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Key className="w-3.5 h-3.5 text-primary" />
                  Effective Permissions ({userPermissions.length})
                </h4>
              </div>

              {detailLoading ? (
                <div className="py-6 text-center text-muted-foreground text-xs">
                  <RefreshCw className="w-4 h-4 animate-spin mx-auto mb-1 text-primary" />
                  Loading permissions...
                </div>
              ) : (
                <div className="space-y-3 max-h-56 overflow-y-auto pr-1">
                  {Object.entries(groupedUserPermissions).map(([mod, perms]) => (
                    <div key={mod} className="p-2.5 rounded-xl border border-border bg-background space-y-1.5">
                      <span className="text-[10px] font-bold uppercase text-primary tracking-wider">{mod}</span>
                      <div className="flex flex-wrap gap-1">
                        {perms.map((p) => (
                          <span
                            key={p}
                            className="px-2 py-0.5 rounded text-[10px] font-mono bg-muted text-foreground border border-border"
                          >
                            {p}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Active Sessions for this user */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Laptop className="w-3.5 h-3.5 text-indigo-400" />
                Active Sessions ({userSessions.filter((s) => !s.is_revoked).length})
              </h4>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {userSessions.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No sessions recorded.</p>
                ) : (
                  userSessions.map((s) => (
                    <div
                      key={s.id}
                      className="p-2.5 rounded-xl border border-border bg-background flex items-center justify-between text-xs"
                    >
                      <div>
                        <span className="font-mono text-foreground font-semibold">{s.ip_address || 'IP N/A'}</span>
                        <span className="text-[10px] text-muted-foreground block truncate max-w-xs">{s.user_agent}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {s.is_revoked ? (
                          <span className="text-[10px] text-zinc-500">Revoked</span>
                        ) : (
                          <button
                            onClick={() => handleRevokeSession(s.id)}
                            className="text-[10px] px-2 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20 font-semibold"
                          >
                            Revoke
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Recent Login History */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <History className="w-3.5 h-3.5 text-emerald-400" />
                Recent Login History
              </h4>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {userLoginHistory.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No login events recorded.</p>
                ) : (
                  userLoginHistory.slice(0, 10).map((h) => (
                    <div
                      key={h.id}
                      className="p-2.5 rounded-xl border border-border bg-background flex items-center justify-between text-xs"
                    >
                      <div>
                        <span className="font-mono text-[11px] text-foreground">
                          {new Date(h.created_at).toLocaleString()}
                        </span>
                        <span className="text-[10px] text-muted-foreground block font-mono">{h.ip_address}</span>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                          h.status === 'SUCCESS'
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                            : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                        }`}
                      >
                        {h.status}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
