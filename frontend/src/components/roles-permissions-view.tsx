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
  AlertTriangle
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

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [formName, setFormName] = useState('');
  const [formDisplayName, setFormDisplayName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formPermissions, setFormPermissions] = useState<string[]>([]);
  const [formError, setFormError] = useState<string | null>(null);

  const fetchRolesAndPermissions = async () => {
    setLoading(true);
    try {
      const [resRoles, resPerms] = await Promise.all([
        fetch('/api/roles'),
        fetch('/api/permissions')
      ]);
      const dataRoles = await resRoles.json();
      const dataPerms = await resPerms.json();

      if (dataRoles.success) {
        setRoles(dataRoles.data || []);
        if (dataRoles.data && dataRoles.data.length > 0 && !selectedRole) {
          // fetch full role details with permissions
          fetchRoleDetail(dataRoles.data[0].id);
        }
      }
      if (dataPerms.success) {
        setPermissions(dataPerms.data || []);
      }
    } catch (err) {
      console.error('Failed to load roles and permissions:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchRoleDetail = async (id: number) => {
    try {
      const res = await fetch(`/api/roles/${id}`);
      const data = await res.json();
      if (data.success && data.data) {
        setSelectedRole(data.data);
      }
    } catch (err) {
      console.error('Failed to load role details:', err);
    }
  };

  useEffect(() => {
    fetchRolesAndPermissions();
  }, []);

  // Group permissions by module
  const groupedPermissions = React.useMemo(() => {
    const map: Record<string, PermissionItem[]> = {};
    const filtered = permissions.filter(p =>
      p.key.toLowerCase().includes(searchPerm.toLowerCase()) ||
      (p.description && p.description.toLowerCase().includes(searchPerm.toLowerCase())) ||
      p.module.toLowerCase().includes(searchPerm.toLowerCase())
    );

    filtered.forEach(p => {
      const mod = p.module.toUpperCase();
      if (!map[mod]) map[mod] = [];
      map[mod].push(p);
    });
    return map;
  }, [permissions, searchPerm]);

  const handleOpenCreate = () => {
    setFormName('');
    setFormDisplayName('');
    setFormDescription('');
    setFormPermissions([]);
    setFormError(null);
    setShowCreateModal(true);
  };

  const handleOpenEdit = (role: RoleItem) => {
    setFormName(role.name);
    setFormDisplayName(role.display_name);
    setFormDescription(role.description || '');
    setFormPermissions(role.permissions || []);
    setFormError(null);
    setShowEditModal(true);
  };

  const handleTogglePermission = (key: string) => {
    if (formPermissions.includes(key)) {
      setFormPermissions(formPermissions.filter(k => k !== key));
    } else {
      setFormPermissions([...formPermissions, key]);
    }
  };

  const handleSelectAllModule = (moduleKey: string) => {
    const modPerms = groupedPermissions[moduleKey]?.map(p => p.key) || [];
    const allSelected = modPerms.every(k => formPermissions.includes(k));
    if (allSelected) {
      setFormPermissions(formPermissions.filter(k => !modPerms.includes(k)));
    } else {
      const set = new Set([...formPermissions, ...modPerms]);
      setFormPermissions(Array.from(set));
    }
  };

  const handleSaveRole = async (isEdit: boolean) => {
    setFormError(null);
    if (!formDisplayName.trim()) {
      setFormError('Display name is required');
      return;
    }
    if (!isEdit && !formName.trim()) {
      setFormError('Role machine identifier name is required');
      return;
    }

    setSaving(true);
    try {
      const url = isEdit ? `/api/roles/${selectedRole?.id}` : '/api/roles';
      const method = isEdit ? 'PUT' : 'POST';
      const body: any = {
        display_name: formDisplayName.trim(),
        description: formDescription.trim(),
        permissions: formPermissions
      };
      if (!isEdit) {
        body.name = formName.trim().toUpperCase().replace(/[^A-Z0-9_]/g, '_');
      }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (!data.success) {
        setFormError(data.error || 'Failed to save role');
        return;
      }

      setShowCreateModal(false);
      setShowEditModal(false);
      await fetchRolesAndPermissions();
      if (isEdit && selectedRole) {
        fetchRoleDetail(selectedRole.id);
      }
    } catch (err: any) {
      setFormError(err.message || 'Error occurred');
    } finally {
      setSaving(false);
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
      const res = await fetch(`/api/roles/${role.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!data.success) {
        alert(data.error || 'Failed to delete role');
        return;
      }
      setSelectedRole(null);
      await fetchRolesAndPermissions();
    } catch (err) {
      alert('Network error deleting role');
    }
  };

  const filteredRoles = roles.filter(r =>
    r.name.toLowerCase().includes(searchRole.toLowerCase()) ||
    r.display_name.toLowerCase().includes(searchRole.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-6 rounded-xl shadow-lg">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-500/10 border border-indigo-500/20 rounded-lg text-indigo-400">
              <Shield className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">Roles & Permissions</h1>
              <p className="text-slate-400 text-sm">
                Granular action-level permissions and database-driven role administration
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => fetchRolesAndPermissions()}
            className="flex items-center gap-2 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm border border-slate-700 transition"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={handleOpenCreate}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium shadow-md shadow-indigo-600/20 transition"
          >
            <Plus className="w-4 h-4" />
            Create Role
          </button>
        </div>
      </div>

      {/* Main Grid: Roles List (Left) + Permission Matrix (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Roles List */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                <Layers className="w-4 h-4 text-indigo-400" />
                Defined Roles ({roles.length})
              </h2>
            </div>
            <div className="relative">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Search roles..."
                value={searchRole}
                onChange={e => setSearchRole(e.target.value)}
                className="w-full bg-slate-800/80 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="space-y-2 max-h-[640px] overflow-y-auto pr-1">
              {filteredRoles.map(role => {
                const isSelected = selectedRole?.id === role.id;
                return (
                  <div
                    key={role.id}
                    onClick={() => fetchRoleDetail(role.id)}
                    className={`p-3.5 rounded-lg border transition cursor-pointer ${
                      isSelected
                        ? 'bg-indigo-950/40 border-indigo-500/50 text-white shadow-sm'
                        : 'bg-slate-800/40 border-slate-800 hover:bg-slate-800/80 text-slate-300'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm">{role.display_name}</span>
                          {role.is_system && (
                            <span className="px-1.5 py-0.5 text-[10px] uppercase font-bold tracking-wider rounded bg-slate-700/80 text-slate-300 border border-slate-600 flex items-center gap-1">
                              <Lock className="w-2.5 h-2.5" />
                              System
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-400 font-mono">{role.name}</p>
                      </div>
                      <div className="text-right">
                        <span className="text-xs text-slate-400 bg-slate-800 px-2 py-0.5 rounded border border-slate-700 flex items-center gap-1">
                          <Users className="w-3 h-3 text-slate-400" />
                          {role.user_count || 0}
                        </span>
                      </div>
                    </div>
                    {role.description && (
                      <p className="text-xs text-slate-400 mt-2 line-clamp-2">
                        {role.description}
                      </p>
                    )}
                    <div className="mt-3 flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-800/80">
                      <span>{role.permission_count || role.permissions?.length || 0} permissions</span>
                      <div className="flex items-center gap-1">
                        {!role.is_system && (
                          <>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenEdit(role);
                              }}
                              className="p-1 hover:text-indigo-400 transition"
                              title="Edit role"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteRole(role);
                              }}
                              className="p-1 hover:text-red-400 transition"
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

        {/* Selected Role Permission Matrix */}
        <div className="lg:col-span-8 space-y-4">
          {selectedRole ? (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-6">
              {/* Role Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
                <div>
                  <div className="flex items-center gap-3">
                    <h2 className="text-xl font-bold text-white">{selectedRole.display_name}</h2>
                    {selectedRole.is_system ? (
                      <span className="px-2 py-0.5 text-xs font-semibold rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center gap-1">
                        <Lock className="w-3 h-3" /> System Managed
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 text-xs font-semibold rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        Custom Role
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 font-mono mt-1">CODE: {selectedRole.name}</p>
                  {selectedRole.description && (
                    <p className="text-sm text-slate-300 mt-2">{selectedRole.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  {!selectedRole.is_system && (
                    <button
                      onClick={() => handleOpenEdit(selectedRole)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-400 border border-indigo-500/30 rounded-lg text-xs font-medium transition"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      Configure Permissions
                    </button>
                  )}
                </div>
              </div>

              {/* Permissions Search */}
              <div className="flex items-center justify-between gap-4">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                  <input
                    type="text"
                    placeholder="Search permissions or modules..."
                    value={searchPerm}
                    onChange={e => setSearchPerm(e.target.value)}
                    className="w-full bg-slate-800/80 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div className="text-xs text-slate-400">
                  Assigned:{' '}
                  <span className="font-semibold text-indigo-400">
                    {selectedRole.permissions?.length || 0}
                  </span>{' '}
                  / {permissions.length} total
                </div>
              </div>

              {/* Grouped Modules */}
              <div className="space-y-4 max-h-[580px] overflow-y-auto pr-2">
                {Object.entries(groupedPermissions).map(([moduleName, perms]) => {
                  const assignedInMod = perms.filter(p =>
                    selectedRole.permissions?.includes(p.key)
                  ).length;
                  return (
                    <div
                      key={moduleName}
                      className="bg-slate-800/40 border border-slate-800 rounded-lg p-4 space-y-3"
                    >
                      <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
                        <div className="flex items-center gap-2">
                          <Key className="w-4 h-4 text-indigo-400" />
                          <h3 className="font-bold text-sm text-white tracking-wide">
                            {moduleName}
                          </h3>
                        </div>
                        <span className="text-xs text-slate-400">
                          {assignedInMod} of {perms.length} enabled
                        </span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                        {perms.map(p => {
                          const isAssigned = selectedRole.permissions?.includes(p.key);
                          return (
                            <div
                              key={p.key}
                              className={`p-2.5 rounded-md border flex items-start gap-2.5 transition ${
                                isAssigned
                                  ? 'bg-indigo-950/20 border-indigo-500/30 text-slate-200'
                                  : 'bg-slate-900/40 border-slate-800/60 text-slate-500'
                              }`}
                            >
                              <div className="pt-0.5">
                                {isAssigned ? (
                                  <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                                ) : (
                                  <XCircle className="w-4 h-4 text-slate-600 flex-shrink-0" />
                                )}
                              </div>
                              <div className="min-w-0">
                                <p className={`text-xs font-mono font-medium ${isAssigned ? 'text-indigo-300' : 'text-slate-400'}`}>
                                  {p.key}
                                </p>
                                {p.description && (
                                  <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                                    {p.description}
                                  </p>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-12 text-center text-slate-500">
              <Shield className="w-12 h-12 mx-auto mb-3 opacity-30 text-indigo-400" />
              <p>Select a role on the left to inspect its permissions</p>
            </div>
          )}
        </div>
      </div>

      {/* CREATE / EDIT ROLE MODAL */}
      {(showCreateModal || showEditModal) && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-white">
                  {showEditModal ? `Edit Role: ${formDisplayName}` : 'Create New Custom Role'}
                </h3>
                <p className="text-xs text-slate-400">
                  Assign granular permissions across system modules
                </p>
              </div>
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setShowEditModal(false);
                }}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-5 overflow-y-auto flex-1">
              {formError && (
                <div className="p-3 bg-red-500/10 border border-red-500/30 text-red-400 text-xs rounded-lg flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Display Name *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Senior Billing Officer"
                    value={formDisplayName}
                    onChange={e => setFormDisplayName(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Role Identifier (Key) *
                  </label>
                  <input
                    type="text"
                    disabled={showEditModal}
                    placeholder="e.g. SENIOR_BILLING_OFFICER"
                    value={formName}
                    onChange={e => setFormName(e.target.value.toUpperCase())}
                    className={`w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm font-mono text-slate-200 focus:outline-none focus:border-indigo-500 ${
                      showEditModal ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Description</label>
                <input
                  type="text"
                  placeholder="Explain the role duties and intended operational boundaries..."
                  value={formDescription}
                  onChange={e => setFormDescription(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* Interactive Permissions Matrix */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Permissions Assignment ({formPermissions.length} selected)
                  </h4>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setFormPermissions(permissions.map(p => p.key))}
                      className="text-[11px] text-indigo-400 hover:underline"
                    >
                      Select All
                    </button>
                    <span className="text-slate-600">|</span>
                    <button
                      type="button"
                      onClick={() => setFormPermissions([])}
                      className="text-[11px] text-slate-400 hover:underline"
                    >
                      Deselect All
                    </button>
                  </div>
                </div>

                <div className="space-y-4 max-h-80 overflow-y-auto pr-1">
                  {Object.entries(groupedPermissions).map(([mod, perms]) => {
                    const allModSelected = perms.every(p => formPermissions.includes(p.key));
                    return (
                      <div key={mod} className="bg-slate-800/40 border border-slate-800 rounded-lg p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={allModSelected}
                              onChange={() => handleSelectAllModule(mod)}
                              className="rounded border-slate-700 text-indigo-600 focus:ring-0 bg-slate-900"
                            />
                            <span className="text-xs font-bold text-white uppercase">{mod}</span>
                          </label>
                          <span className="text-[10px] text-slate-400">
                            {perms.filter(p => formPermissions.includes(p.key)).length} / {perms.length}
                          </span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pl-4">
                          {perms.map(p => {
                            const isChecked = formPermissions.includes(p.key);
                            return (
                              <label
                                key={p.key}
                                className={`flex items-start gap-2 p-1.5 rounded cursor-pointer transition ${
                                  isChecked ? 'bg-indigo-950/30 text-indigo-200' : 'text-slate-400 hover:bg-slate-850'
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => handleTogglePermission(p.key)}
                                  className="mt-0.5 rounded border-slate-700 text-indigo-600 focus:ring-0 bg-slate-900"
                                />
                                <div className="text-xs leading-tight">
                                  <div className="font-mono text-[11px]">{p.key}</div>
                                  {p.description && (
                                    <div className="text-[10px] text-slate-500">{p.description}</div>
                                  )}
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-800 flex items-center justify-end gap-3 bg-slate-950/40">
              <button
                type="button"
                onClick={() => {
                  setShowCreateModal(false);
                  setShowEditModal(false);
                }}
                className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => handleSaveRole(showEditModal)}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg text-xs font-medium shadow-md transition flex items-center gap-2"
              >
                {saving && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                {showEditModal ? 'Update Role' : 'Create Role'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
