'use client';

import React, { useState, useEffect } from 'react';
import {
  Shield,
  Key,
  Users,
  Plus,
  Edit2,
  Trash2,
  CheckCircle2,
  XCircle,
  Search,
  Lock,
  Layers,
  Check,
  RefreshCw,
  AlertTriangle,
  Copy,
  ToggleLeft,
  ToggleRight,
  UserCheck,
  Sparkles,
  ChevronDown,
  ChevronRight,
  CheckSquare,
  Square,
} from 'lucide-react';
import { RoleItem, PermissionItem } from '@/types/api';

interface RolesPermissionsViewProps {
  currentUser?: any;
}

export const RolesPermissionsView: React.FC<RolesPermissionsViewProps> = ({ currentUser }) => {
  const [roles, setRoles] = useState<RoleItem[]>([]);
  const [permissions, setPermissions] = useState<PermissionItem[]>([]);
  const [selectedRole, setSelectedRole] = useState<RoleItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchRole, setSearchRole] = useState('');
  const [searchPerm, setSearchPerm] = useState('');
  const [activeSubTab, setActiveSubTab] = useState<'permissions' | 'users'>('permissions');

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [duplicateTarget, setDuplicateTarget] = useState<RoleItem | null>(null);

  // Form states
  const [formName, setFormName] = useState('');
  const [formDisplayName, setFormDisplayName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formPermissions, setFormPermissions] = useState<string[]>([]);
  const [formIsActive, setFormIsActive] = useState<boolean>(true);
  const [formError, setFormError] = useState<string | null>(null);
  const [modalPermSearch, setModalPermSearch] = useState('');
  const [expandedModules, setExpandedModules] = useState<Record<string, boolean>>({});

  // Duplicate form
  const [dupDisplayName, setDupDisplayName] = useState('');
  const [dupName, setDupName] = useState('');
  const [dupDescription, setDupDescription] = useState('');

  const isCallerSuperAdmin =
    currentUser?.role === 'super_admin' ||
    (Array.isArray(currentUser?.roles) && currentUser.roles.includes('super_admin'));

  const getAuthHeaders = (): Record<string, string> => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('radius_token') : null;
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return headers;
  };

  const fetchRolesAndPermissions = async () => {
    setLoading(true);
    try {
      const [resRoles, resPerms] = await Promise.all([
        fetch('/api/roles', { headers: getAuthHeaders(), credentials: 'include' }),
        fetch('/api/permissions', { headers: getAuthHeaders(), credentials: 'include' }),
      ]);
      const dataRoles = await resRoles.json();
      const dataPerms = await resPerms.json();

      let loadedRoles: RoleItem[] = [];
      if ((dataRoles.success || resRoles.ok) && dataRoles.data) {
        loadedRoles = (dataRoles.data || []).filter((r: RoleItem) => {
          if (!isCallerSuperAdmin && (r.name === 'super_admin' || r.is_developer_only)) {
            return false;
          }
          return true;
        });
        setRoles(loadedRoles);
        if (loadedRoles.length > 0 && (!selectedRole || !loadedRoles.some((r) => r.id === selectedRole.id))) {
          fetchRoleDetail(loadedRoles[0].id);
        }
      }
      if ((dataPerms.success || resPerms.ok) && dataPerms.data) {
        if (Array.isArray(dataPerms.data)) {
          setPermissions(dataPerms.data);
        } else if (typeof dataPerms.data === 'object' && dataPerms.data !== null) {
          const all: PermissionItem[] = [];
          Object.values(dataPerms.data).forEach((arr: any) => {
            if (Array.isArray(arr)) all.push(...arr);
          });
          setPermissions(all);
        }
      }
    } catch (err) {
      console.error('Failed to load roles and permissions:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchRoleDetail = async (id: number) => {
    try {
      const res = await fetch(`/api/roles/${id}`, { headers: getAuthHeaders(), credentials: 'include' });
      const data = await res.json();
      if ((data.success || res.ok) && data.data) {
        if (!isCallerSuperAdmin && data.data.name === 'super_admin') {
          return;
        }
        setSelectedRole(data.data);
      }
    } catch (err) {
      console.error('Failed to load role details:', err);
    }
  };

  useEffect(() => {
    fetchRolesAndPermissions();
  }, []);

  // Filter roles visible to caller
  const visibleRoles = React.useMemo(() => {
    return roles.filter((r) => {
      if (!isCallerSuperAdmin && (r.name === 'super_admin' || r.is_developer_only)) {
        return false;
      }
      return true;
    });
  }, [roles, isCallerSuperAdmin]);

  const filteredRoles = React.useMemo(() => {
    const q = searchRole.trim().toLowerCase();
    return visibleRoles.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.display_name.toLowerCase().includes(q)
    );
  }, [visibleRoles, searchRole]);

  // Group permissions by module for main page view
  const groupedPermissions = React.useMemo(() => {
    const map: Record<string, PermissionItem[]> = {};
    const filtered = permissions.filter((p) => {
      if (!isCallerSuperAdmin && (p.module.toLowerCase() === 'system' || p.key.startsWith('system.') || p.key.startsWith('platform.'))) {
        return false;
      }
      const q = searchPerm.toLowerCase();
      return (
        p.key.toLowerCase().includes(q) ||
        (p.description && p.description.toLowerCase().includes(q)) ||
        p.module.toLowerCase().includes(q)
      );
    });

    filtered.forEach((p) => {
      const mod = p.module.toUpperCase();
      if (!map[mod]) map[mod] = [];
      map[mod].push(p);
    });
    return map;
  }, [permissions, searchPerm, isCallerSuperAdmin]);

  // Available permissions for current admin
  const availablePermissions = React.useMemo(() => {
    return permissions.filter((p) => {
      if (!isCallerSuperAdmin && (p.module.toLowerCase() === 'system' || p.key.startsWith('system.') || p.key.startsWith('platform.'))) {
        return false;
      }
      return true;
    });
  }, [permissions, isCallerSuperAdmin]);

  // Group permissions for Modal, filtered by modal search
  const modalGroupedPermissions = React.useMemo(() => {
    const map: Record<string, PermissionItem[]> = {};
    const q = modalPermSearch.trim().toLowerCase();
    const filtered = availablePermissions.filter((p) => {
      if (!q) return true;
      return (
        p.key.toLowerCase().includes(q) ||
        (p.description && p.description.toLowerCase().includes(q)) ||
        p.module.toLowerCase().includes(q)
      );
    });

    filtered.forEach((p) => {
      const mod = p.module.toUpperCase();
      if (!map[mod]) map[mod] = [];
      map[mod].push(p);
    });
    return map;
  }, [availablePermissions, modalPermSearch]);

  const handleOpenCreate = () => {
    setFormName('');
    setFormDisplayName('');
    setFormDescription('');
    setFormPermissions([]);
    setFormIsActive(true);
    setFormError(null);
    setModalPermSearch('');

    const initialExpanded: Record<string, boolean> = {};
    availablePermissions.forEach((p) => {
      initialExpanded[p.module.toUpperCase()] = true;
    });
    setExpandedModules(initialExpanded);
    setShowCreateModal(true);
  };

  const handleOpenEdit = async (role: RoleItem) => {
    if (role.name === 'super_admin' && !isCallerSuperAdmin) {
      alert('Developer Super Admin role cannot be modified by ISP users.');
      return;
    }

    try {
      const res = await fetch(`/api/roles/${role.id}`, { headers: getAuthHeaders(), credentials: 'include' });
      const data = await res.json();
      const targetRole = (data.success || res.ok) && data.data ? data.data : role;

      setFormName(targetRole.name);
      setFormDisplayName(targetRole.display_name);
      setFormDescription(targetRole.description || '');
      setFormPermissions(targetRole.permissions || []);
      setFormIsActive(targetRole.is_active !== false);
      setFormError(null);
      setModalPermSearch('');

      const initialExpanded: Record<string, boolean> = {};
      availablePermissions.forEach((p) => {
        initialExpanded[p.module.toUpperCase()] = true;
      });
      setExpandedModules(initialExpanded);
      setShowEditModal(true);
    } catch {
      setFormName(role.name);
      setFormDisplayName(role.display_name);
      setFormDescription(role.description || '');
      setFormPermissions(role.permissions || []);
      setFormIsActive(role.is_active !== false);
      setFormError(null);
      setModalPermSearch('');
      setShowEditModal(true);
    }
  };

  const handleOpenDuplicate = (role: RoleItem) => {
    setDuplicateTarget(role);
    setDupDisplayName(`${role.display_name} (Copy)`);
    setDupName(`${role.name.toLowerCase()}_copy_${Date.now().toString().slice(-4)}`);
    setDupDescription(role.description ? `Copy of ${role.display_name}: ${role.description}` : `Copy of ${role.display_name}`);
    setFormError(null);
    setShowDuplicateModal(true);
  };

  const handleTogglePermission = (key: string) => {
    if (formPermissions.includes(key)) {
      setFormPermissions(formPermissions.filter((k) => k !== key));
    } else {
      setFormPermissions([...formPermissions, key]);
    }
  };

  const handleSelectAllModule = (moduleKey: string) => {
    const modPerms = modalGroupedPermissions[moduleKey]?.map((p) => p.key) || [];
    const allSelected = modPerms.every((k) => formPermissions.includes(k));
    if (allSelected) {
      setFormPermissions(formPermissions.filter((k) => !modPerms.includes(k)));
    } else {
      const set = new Set([...formPermissions, ...modPerms]);
      setFormPermissions(Array.from(set));
    }
  };

  const toggleModuleAccordion = (mod: string) => {
    setExpandedModules((prev) => ({
      ...prev,
      [mod]: prev[mod] !== undefined ? !prev[mod] : false,
    }));
  };

  const handleExpandAllModules = (expand: boolean) => {
    const next: Record<string, boolean> = {};
    Object.keys(modalGroupedPermissions).forEach((m) => {
      next[m] = expand;
    });
    setExpandedModules(next);
  };

  const handleSaveRole = async (isEdit: boolean) => {
    setFormError(null);
    if (!formDisplayName.trim()) {
      setFormError('Display name is required');
      return;
    }
    if (!isEdit && !formName.trim()) {
      setFormError('Role key name is required');
      return;
    }

    setSaving(true);
    try {
      const targetId = isEdit ? selectedRole?.id : undefined;
      const url = isEdit ? `/api/roles/${targetId}` : '/api/roles';
      const method = isEdit ? 'PUT' : 'POST';
      const body: any = {
        displayName: formDisplayName.trim(),
        description: formDescription.trim(),
        permissionKeys: formPermissions,
        isActive: formIsActive,
      };

      if (!isEdit) {
        body.name = formName.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
      }

      const res = await fetch(url, {
        method,
        headers: getAuthHeaders(),
        credentials: 'include',
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok || data.success === false) {
        setFormError(data.error?.message || data.error || 'Failed to save role');
        return;
      }

      setShowCreateModal(false);
      setShowEditModal(false);
      await fetchRolesAndPermissions();

      const savedRoleId = isEdit ? targetId : data.data?.id;
      if (savedRoleId) {
        await fetchRoleDetail(savedRoleId);
      }
    } catch (err: any) {
      setFormError(err.message || 'Error occurred');
    } finally {
      setSaving(false);
    }
  };

  const handleDuplicateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!duplicateTarget) return;
    setFormError(null);
    if (!dupDisplayName.trim()) {
      setFormError('Display name is required');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/roles/${duplicateTarget.id}/duplicate`, {
        method: 'POST',
        headers: getAuthHeaders(),
        credentials: 'include',
        body: JSON.stringify({
          name: dupName.trim() || undefined,
          displayName: dupDisplayName.trim(),
          description: dupDescription.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.success === false) {
        setFormError(data.error?.message || data.error || 'Failed to duplicate role');
        return;
      }

      setShowDuplicateModal(false);
      await fetchRolesAndPermissions();
      if (data.data?.id) {
        fetchRoleDetail(data.data.id);
      }
    } catch (err: any) {
      setFormError(err.message || 'Error occurred');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleRoleStatus = async (role: RoleItem) => {
    if (role.is_system) {
      alert('System roles cannot be disabled.');
      return;
    }
    const nextActive = role.is_active === false;
    try {
      const res = await fetch(`/api/roles/${role.id}/status`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        credentials: 'include',
        body: JSON.stringify({ isActive: nextActive }),
      });
      const data = await res.json();
      if (!res.ok || data.success === false) {
        alert(data.error?.message || data.error || 'Failed to toggle role status');
        return;
      }
      await fetchRolesAndPermissions();
      if (selectedRole?.id === role.id) {
        fetchRoleDetail(role.id);
      }
    } catch (err) {
      alert('Failed to update role status');
    }
  };

  const handleDeleteRole = async (role: RoleItem) => {
    if (role.is_system) {
      alert('System roles cannot be deleted.');
      return;
    }
    if ((role.user_count || 0) > 0) {
      alert(`Cannot delete role: ${role.user_count} user(s) currently assigned to this role.`);
      return;
    }
    if (!confirm(`Are you sure you want to delete role "${role.display_name}"?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/roles/${role.id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok || data.success === false) {
        alert(data.error?.message || data.error || 'Failed to delete role');
        return;
      }
      setSelectedRole(null);
      await fetchRolesAndPermissions();
    } catch (err) {
      alert('Network error deleting role');
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-card border border-border p-6 rounded-2xl shadow-sm">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-primary/10 border border-primary/20 rounded-xl text-primary">
              <Shield className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground tracking-tight">Roles & Permissions Governance</h1>
              <p className="text-muted-foreground text-sm">
                Granular module permissions, custom role creation, and staff assignment management
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => fetchRolesAndPermissions()}
            className="flex items-center gap-2 px-3.5 py-2 bg-muted hover:bg-accent text-foreground rounded-xl text-sm border border-border transition"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={handleOpenCreate}
            className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl text-sm font-medium shadow-sm transition"
          >
            <Plus className="w-4 h-4" />
            Create Role
          </button>
        </div>
      </div>

      {/* Main Grid: Roles List (Left) + Permission Matrix / Users (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Roles List */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-card border border-border rounded-2xl p-4 space-y-3 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <Layers className="w-4 h-4 text-primary" />
                Defined Roles ({visibleRoles.length})
              </h2>
            </div>
            <div className="relative">
              <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Search roles..."
                value={searchRole}
                onChange={(e) => setSearchRole(e.target.value)}
                className="w-full bg-background border border-border rounded-xl pl-9 pr-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div className="space-y-2 max-h-[640px] overflow-y-auto pr-1">
              {filteredRoles.map((role) => {
                const isSelected = selectedRole?.id === role.id;
                const isDevOnly = role.is_developer_only || role.name === 'super_admin';
                const isDisabled = role.is_active === false;

                return (
                  <div
                    key={role.id}
                    onClick={() => fetchRoleDetail(role.id)}
                    className={`p-3.5 rounded-xl border transition cursor-pointer relative ${
                      isSelected
                        ? 'bg-primary/10 border-primary/50 text-foreground shadow-sm'
                        : isDisabled
                        ? 'bg-muted/40 border-border text-muted-foreground opacity-75'
                        : 'bg-card border-border hover:bg-accent/40 text-foreground'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-sm">{role.display_name}</span>
                          {isDevOnly && (
                            <span className="px-1.5 py-0.5 text-[9px] uppercase font-bold tracking-wider rounded bg-purple-500/15 text-purple-600 dark:text-purple-300 border border-purple-500/30 flex items-center gap-1">
                              <Sparkles className="w-2.5 h-2.5" />
                              Developer
                            </span>
                          )}
                          {role.is_system && !isDevOnly && (
                            <span className="px-1.5 py-0.5 text-[9px] uppercase font-bold tracking-wider rounded bg-muted text-muted-foreground border border-border flex items-center gap-1">
                              <Lock className="w-2.5 h-2.5" />
                              System
                            </span>
                          )}
                          {isDisabled && (
                            <span className="px-1.5 py-0.5 text-[9px] uppercase font-bold tracking-wider rounded bg-rose-500/10 text-rose-500 border border-rose-500/20">
                              Disabled
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground font-mono">{role.name}</p>
                      </div>
                      <div className="text-right">
                        <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-md border border-border flex items-center gap-1">
                          <Users className="w-3 h-3 text-muted-foreground" />
                          {role.user_count || 0}
                        </span>
                      </div>
                    </div>
                    {role.description && (
                      <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{role.description}</p>
                    )}
                    <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground pt-2 border-t border-border">
                      <span>{role.permission_count || role.permissions?.length || 0} permissions</span>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenDuplicate(role);
                          }}
                          className="p-1 hover:text-primary transition"
                          title="Duplicate this role"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        {role.can_edit && (!role.is_developer_only || isCallerSuperAdmin) && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenEdit(role);
                            }}
                            className="p-1 hover:text-primary transition"
                            title="Edit permissions"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {!role.is_system && (
                          <>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleToggleRoleStatus(role);
                              }}
                              className={`p-1 transition ${isDisabled ? 'text-muted-foreground hover:text-emerald-500' : 'text-emerald-500 hover:text-rose-500'}`}
                              title={isDisabled ? 'Enable role' : 'Disable role'}
                            >
                              {isDisabled ? <ToggleLeft className="w-4 h-4" /> : <ToggleRight className="w-4 h-4" />}
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteRole(role);
                              }}
                              className="p-1 hover:text-destructive transition"
                              title="Delete role"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Selected Role Permission Matrix & Assigned Users */}
        <div className="lg:col-span-8 space-y-4">
          {selectedRole ? (
            <div className="bg-card border border-border rounded-2xl p-6 space-y-6 shadow-sm">
              {/* Role Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border">
                <div>
                  <div className="flex items-center gap-3">
                    <h2 className="text-xl font-bold text-foreground">{selectedRole.display_name}</h2>
                    {selectedRole.is_developer_only ? (
                      <span className="px-2 py-0.5 text-xs font-semibold rounded bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 flex items-center gap-1">
                        <Sparkles className="w-3 h-3" /> Developer Platform Owner
                      </span>
                    ) : selectedRole.is_system ? (
                      <span className="px-2 py-0.5 text-xs font-semibold rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 flex items-center gap-1">
                        <Lock className="w-3 h-3" /> System Managed
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 text-xs font-semibold rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                        Custom Role
                      </span>
                    )}
                    {selectedRole.is_active === false && (
                      <span className="px-2 py-0.5 text-xs font-semibold rounded bg-rose-500/10 text-rose-500 border border-rose-500/20">
                        Disabled
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground font-mono mt-1">CODE: {selectedRole.name}</p>
                  {selectedRole.description && (
                    <p className="text-sm text-muted-foreground mt-2">{selectedRole.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleOpenDuplicate(selectedRole)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-muted hover:bg-accent text-foreground border border-border rounded-xl text-xs font-medium transition"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    Duplicate Role
                  </button>
                  {selectedRole.can_edit && (!selectedRole.is_developer_only || isCallerSuperAdmin) && (
                    <button
                      onClick={() => handleOpenEdit(selectedRole)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 rounded-xl text-xs font-medium transition"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      Configure Permissions
                    </button>
                  )}
                </div>
              </div>

              {/* Sub-tabs: Permissions vs Assigned Users */}
              <div className="flex items-center gap-2 border-b border-border pb-2">
                <button
                  onClick={() => setActiveSubTab('permissions')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                    activeSubTab === 'permissions'
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                  }`}
                >
                  Permissions Matrix ({selectedRole.permissions?.length || 0})
                </button>
                <button
                  onClick={() => setActiveSubTab('users')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 ${
                    activeSubTab === 'users'
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                  }`}
                >
                  <Users className="w-3.5 h-3.5" />
                  Assigned Users ({selectedRole.users?.length || selectedRole.user_count || 0})
                </button>
              </div>

              {activeSubTab === 'permissions' ? (
                <>
                  {/* Permissions Search */}
                  <div className="flex items-center justify-between gap-4">
                    <div className="relative flex-1">
                      <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-3" />
                      <input
                        type="text"
                        placeholder="Search permissions or modules..."
                        value={searchPerm}
                        onChange={(e) => setSearchPerm(e.target.value)}
                        className="w-full bg-background border border-border rounded-xl pl-9 pr-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Assigned:{' '}
                      <span className="font-semibold text-primary">
                        {selectedRole.permissions?.length || 0}
                      </span>{' '}
                      / {availablePermissions.length} available
                    </div>
                  </div>

                  {/* Grouped Modules */}
                  <div className="space-y-4 max-h-[520px] overflow-y-auto pr-2">
                    {Object.entries(groupedPermissions).map(([moduleName, perms]) => {
                      const assignedInMod = perms.filter((p) =>
                        selectedRole.permissions?.includes(p.key)
                      ).length;
                      return (
                        <div key={moduleName} className="border border-border rounded-xl p-4 bg-background/50 space-y-3">
                          <div className="flex items-center justify-between border-b border-border pb-2">
                            <span className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
                              <Key className="w-3.5 h-3.5 text-primary" />
                              {moduleName}
                            </span>
                            <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded font-medium">
                              {assignedInMod} / {perms.length} granted
                            </span>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 pt-1">
                            {perms.map((perm) => {
                              const isGranted = selectedRole.permissions?.includes(perm.key);
                              return (
                                <div
                                  key={perm.key}
                                  className={`p-2.5 rounded-lg border text-xs transition ${
                                    isGranted
                                      ? 'bg-primary/10 border-primary/40 text-foreground font-medium'
                                      : 'bg-muted/30 border-border text-muted-foreground opacity-60'
                                  }`}
                                >
                                  <div className="flex items-center gap-2">
                                    {isGranted ? (
                                      <CheckCircle2 className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                                    ) : (
                                      <XCircle className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                                    )}
                                    <div className="min-w-0">
                                      <div className="font-mono text-[11px] truncate">{perm.key}</div>
                                      {perm.description && (
                                        <div className="text-[10px] text-muted-foreground line-clamp-1">{perm.description}</div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : (
                /* Assigned Users Subtab */
                <div className="space-y-3">
                  <div className="text-xs text-muted-foreground">
                    Active staff accounts currently assigned this role ({selectedRole.users?.length || 0})
                  </div>
                  {selectedRole.users && selectedRole.users.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[500px] overflow-y-auto pr-1">
                      {selectedRole.users.map((u) => (
                        <div key={u.id} className="p-3 bg-card border border-border rounded-xl flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-bold text-xs">
                            {(u.full_name || u.username).slice(0, 2).toUpperCase()}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="font-semibold text-xs text-foreground truncate">{u.full_name || u.username}</div>
                            <div className="text-[11px] text-muted-foreground font-mono truncate">@{u.username}</div>
                            {u.email && <div className="text-[10px] text-muted-foreground truncate">{u.email}</div>}
                          </div>
                          <span
                            className={`px-1.5 py-0.5 rounded text-[9px] uppercase font-bold ${
                              u.status === 'ACTIVE'
                                ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                                : 'bg-rose-500/10 text-rose-500 border border-rose-500/20'
                            }`}
                          >
                            {u.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="py-12 text-center text-muted-foreground text-xs bg-muted/20 border border-dashed border-border rounded-xl">
                      <UserCheck className="w-8 h-8 mx-auto mb-2 opacity-40" />
                      No staff accounts are directly assigned to this role.
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="bg-card border border-border rounded-2xl p-12 text-center text-muted-foreground shadow-sm">
              <Shield className="w-12 h-12 mx-auto text-muted-foreground/40 mb-3" />
              <p className="text-sm font-medium">Select a role from the left panel to inspect permissions and assignments.</p>
            </div>
          )}
        </div>
      </div>

      {/* CREATE / EDIT ROLE MODAL */}
      {(showCreateModal || showEditModal) && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl shadow-2xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="p-5 border-b border-border flex items-center justify-between bg-card">
              <div>
                <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                  <Shield className="w-5 h-5 text-primary" />
                  {showEditModal ? `Configure Role: ${formDisplayName}` : 'Create Role'}
                </h3>
                <p className="text-xs text-muted-foreground">
                  Select and configure granular functional permissions across operational modules
                </p>
              </div>
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setShowEditModal(false);
                }}
                className="text-muted-foreground hover:text-foreground text-lg p-1.5 rounded-lg hover:bg-muted transition"
              >
                ✕
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-5 overflow-y-auto flex-1">
              {formError && (
                <div className="p-3 bg-red-500/10 border border-red-500/30 text-red-500 text-xs rounded-xl flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Basic Role Info: Name, Key, Status */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">
                    Display Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Senior Billing Officer"
                    value={formDisplayName}
                    onChange={(e) => setFormDisplayName(e.target.value)}
                    className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">
                    Role Identifier (Key) *
                  </label>
                  <input
                    type="text"
                    disabled={showEditModal}
                    placeholder="e.g. senior_billing_officer"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value.toLowerCase())}
                    className={`w-full bg-background border border-border rounded-xl px-3 py-2 text-sm font-mono text-foreground focus:outline-none focus:ring-2 focus:ring-primary ${
                      showEditModal ? 'opacity-60 cursor-not-allowed bg-muted/50' : ''
                    }`}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">
                    Role Status
                  </label>
                  <select
                    value={formIsActive ? 'ACTIVE' : 'INACTIVE'}
                    onChange={(e) => setFormIsActive(e.target.value === 'ACTIVE')}
                    className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="ACTIVE">Active (Enabled)</option>
                    <option value="INACTIVE">Inactive (Disabled)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">Description</label>
                <input
                  type="text"
                  placeholder="Explain operational responsibilities and authority boundary..."
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              {/* Permission Selection Area */}
              <div className="space-y-3 pt-2 border-t border-border">
                {/* Search & Actions Bar */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-muted/30 p-3 rounded-xl border border-border">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold text-foreground">
                      Permissions ({formPermissions.length} of {availablePermissions.length} selected)
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-primary/10 text-primary border border-primary/20">
                      {Math.round((formPermissions.length / Math.max(availablePermissions.length, 1)) * 100)}% granted
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setFormPermissions(availablePermissions.map((p) => p.key))}
                      className="px-2.5 py-1 text-xs font-medium bg-primary/10 hover:bg-primary/20 text-primary rounded-lg transition border border-primary/20"
                    >
                      Select All Available
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormPermissions([])}
                      className="px-2.5 py-1 text-xs font-medium bg-muted hover:bg-accent text-muted-foreground hover:text-foreground rounded-lg transition border border-border"
                    >
                      Clear Selection
                    </button>
                    <button
                      type="button"
                      onClick={() => handleExpandAllModules(true)}
                      className="px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground"
                    >
                      Expand All
                    </button>
                    <span className="text-border">|</span>
                    <button
                      type="button"
                      onClick={() => handleExpandAllModules(false)}
                      className="px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground"
                    >
                      Collapse All
                    </button>
                  </div>
                </div>

                {/* Filter Search Input */}
                <div className="relative">
                  <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="Search permissions by name, key, or module..."
                    value={modalPermSearch}
                    onChange={(e) => setModalPermSearch(e.target.value)}
                    className="w-full bg-background border border-border rounded-xl pl-9 pr-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                  {modalPermSearch && (
                    <button
                      type="button"
                      onClick={() => setModalPermSearch('')}
                      className="absolute right-3 top-2 text-xs text-muted-foreground hover:text-foreground"
                    >
                      ✕
                    </button>
                  )}
                </div>

                {/* Expandable Module Groups */}
                <div className="space-y-3 max-h-96 overflow-y-auto pr-1 pt-1">
                  {Object.entries(modalGroupedPermissions).length === 0 ? (
                    <div className="py-8 text-center text-xs text-muted-foreground bg-muted/20 rounded-xl border border-dashed border-border">
                      No permissions match &quot;{modalPermSearch}&quot;.
                    </div>
                  ) : (
                    Object.entries(modalGroupedPermissions).map(([mod, perms]) => {
                      const isExpanded = modalPermSearch.trim().length > 0 || expandedModules[mod] !== false;
                      const selectedInMod = perms.filter((p) => formPermissions.includes(p.key)).length;
                      const allModSelected = perms.length > 0 && selectedInMod === perms.length;

                      return (
                        <div key={mod} className="bg-card border border-border rounded-xl overflow-hidden transition shadow-sm">
                          {/* Module Accordion Header */}
                          <div
                            onClick={() => toggleModuleAccordion(mod)}
                            className="p-3 bg-muted/40 hover:bg-muted/70 flex items-center justify-between cursor-pointer select-none transition border-b border-border/50"
                          >
                            <div className="flex items-center gap-2.5">
                              {isExpanded ? (
                                <ChevronDown className="w-4 h-4 text-muted-foreground" />
                              ) : (
                                <ChevronRight className="w-4 h-4 text-muted-foreground" />
                              )}
                              <span className="text-xs font-bold text-foreground uppercase tracking-wider">{mod}</span>
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-muted text-muted-foreground border border-border">
                                {selectedInMod} / {perms.length}
                              </span>
                            </div>

                            <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                              <button
                                type="button"
                                onClick={() => handleSelectAllModule(mod)}
                                className={`text-[11px] font-semibold px-2 py-1 rounded transition border ${
                                  allModSelected
                                    ? 'bg-rose-500/10 text-rose-500 border-rose-500/20 hover:bg-rose-500/20'
                                    : 'bg-primary/10 text-primary border-primary/20 hover:bg-primary/20'
                                }`}
                              >
                                {allModSelected ? 'Deselect Module' : 'Select Module'}
                              </button>
                            </div>
                          </div>

                          {/* Module Permissions Grid */}
                          {isExpanded && (
                            <div className="p-3 bg-background/50 grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {perms.map((p) => {
                                const isChecked = formPermissions.includes(p.key);
                                return (
                                  <label
                                    key={p.key}
                                    className={`flex items-start gap-2.5 p-2 rounded-lg cursor-pointer transition border ${
                                      isChecked
                                        ? 'bg-primary/10 border-primary/30 text-foreground shadow-xs'
                                        : 'bg-card border-border/70 text-muted-foreground hover:bg-muted/40 hover:text-foreground'
                                    }`}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={isChecked}
                                      onChange={() => handleTogglePermission(p.key)}
                                      className="mt-0.5 rounded border-border text-primary focus:ring-0 bg-background cursor-pointer"
                                    />
                                    <div className="min-w-0 flex-1 leading-tight">
                                      <div className="font-mono text-[11px] font-semibold text-foreground truncate">{p.key}</div>
                                      {p.description && (
                                        <div className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">{p.description}</div>
                                      )}
                                    </div>
                                  </label>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-border flex items-center justify-between bg-card">
              <span className="text-xs text-muted-foreground">
                <span className="font-semibold text-foreground">{formPermissions.length}</span> permissions selected
              </span>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    setShowEditModal(false);
                  }}
                  className="px-4 py-2 text-xs font-medium text-muted-foreground hover:text-foreground rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => handleSaveRole(showEditModal)}
                  className="px-5 py-2 bg-primary hover:bg-primary/90 disabled:opacity-50 text-primary-foreground rounded-xl text-xs font-semibold shadow-sm transition flex items-center gap-2"
                >
                  {saving && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  {showEditModal ? 'Save Changes' : 'Create Role'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DUPLICATE ROLE MODAL */}
      {showDuplicateModal && duplicateTarget && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl shadow-2xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                <Copy className="w-4 h-4 text-primary" />
                Duplicate Role: {duplicateTarget.display_name}
              </h3>
              <button onClick={() => setShowDuplicateModal(false)} className="text-muted-foreground hover:text-foreground">
                ✕
              </button>
            </div>

            <form onSubmit={handleDuplicateSubmit} className="space-y-4 text-xs">
              {formError && (
                <div className="p-3 bg-red-500/10 border border-red-500/30 text-red-500 text-xs rounded-xl flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <p className="text-muted-foreground text-xs">
                Create a new custom role pre-loaded with all {duplicateTarget.permission_count || duplicateTarget.permissions?.length || 0} permissions from{' '}
                <span className="text-foreground font-semibold">{duplicateTarget.display_name}</span>.
              </p>

              <div>
                <label className="block text-xs font-medium text-foreground mb-1">New Role Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Branch Operator Tier 2"
                  value={dupDisplayName}
                  onChange={(e) => setDupDisplayName(e.target.value)}
                  className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-foreground mb-1">Role Identifier (Key)</label>
                <input
                  type="text"
                  placeholder="e.g. branch_operator_tier_2"
                  value={dupName}
                  onChange={(e) => setDupName(e.target.value.toLowerCase())}
                  className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm font-mono text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-foreground mb-1">Description</label>
                <input
                  type="text"
                  placeholder="Explain operational boundary..."
                  value={dupDescription}
                  onChange={(e) => setDupDescription(e.target.value)}
                  className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setShowDuplicateModal(false)}
                  className="px-4 py-2 text-xs font-medium text-muted-foreground hover:text-foreground"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 bg-primary hover:bg-primary/90 disabled:opacity-50 text-primary-foreground rounded-xl text-xs font-medium shadow-sm transition flex items-center gap-2"
                >
                  {saving && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  Duplicate & Clone Permissions
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
