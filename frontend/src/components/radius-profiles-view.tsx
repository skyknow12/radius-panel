'use client';

import React from 'react';
import {
  Shield,
  Plus,
  Edit2,
  Trash2,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Layers,
  Tag,
  AlertTriangle,
  X,
  Server,
  Code2,
  Check,
  Eye,
} from 'lucide-react';
import type { RadiusProfileItem, RadiusCatalogItem } from '@/types/api';

export function RadiusProfilesView() {
  const [profiles, setProfiles] = React.useState<RadiusProfileItem[]>([]);
  const [catalog, setCatalog] = React.useState<RadiusCatalogItem[]>([]);
  const [catalogSearch, setCatalogSearch] = React.useState('');
  const [loading, setLoading] = React.useState(true);
  const [modalOpen, setModalOpen] = React.useState(false);
  const [editingProfile, setEditingProfile] = React.useState<RadiusProfileItem | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = React.useState<number | null>(null);
  const [previewTab, setPreviewTab] = React.useState<'editor' | 'preview'>('editor');

  // Form State
  const [formName, setFormName] = React.useState('');
  const [formDescription, setFormDescription] = React.useState('');
  const [formIsActive, setFormIsActive] = React.useState(true);
  const [formAttrs, setFormAttrs] = React.useState<
    { vendor: string; attribute_name: string; attribute_type: string; op: string; value: string }[]
  >([{ vendor: 'MikroTik', attribute_name: 'Mikrotik-Rate-Limit', attribute_type: 'string', op: ':=', value: '100M/100M' }]);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  const fetchProfiles = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/radius-profiles');
      if (res.ok) {
        const json = await res.json();
        setProfiles(json.data || []);
      }
    } catch {} finally {
      setLoading(false);
    }
  };

  const fetchCatalog = async () => {
    try {
      const res = await fetch('/api/radius/catalog');
      if (res.ok) {
        const json = await res.json();
        setCatalog(json.data || []);
      }
    } catch {}
  };

  React.useEffect(() => {
    fetchProfiles();
    fetchCatalog();
  }, []);

  const handleOpenAdd = () => {
    setEditingProfile(null);
    setFormName('');
    setFormDescription('');
    setFormIsActive(true);
    setPreviewTab('editor');
    setFormAttrs([
      { vendor: 'MikroTik', attribute_name: 'Mikrotik-Rate-Limit', attribute_type: 'string', op: ':=', value: '100M/100M' },
      { vendor: 'Standard', attribute_name: 'Acct-Interim-Interval', attribute_type: 'integer', op: ':=', value: '300' },
      { vendor: 'Juniper', attribute_name: 'Juniper-Ingress-Policy-Name', attribute_type: 'string', op: ':=', value: 'filter-in-100m' },
      { vendor: 'Juniper', attribute_name: 'Juniper-Egress-Policy-Name', attribute_type: 'string', op: ':=', value: 'filter-out-100m' },
    ]);
    setFormError(null);
    setModalOpen(true);
  };

  const handleOpenEdit = (profile: RadiusProfileItem) => {
    setEditingProfile(profile);
    setFormName(profile.name);
    setFormDescription(profile.description || '');
    setFormIsActive(profile.is_active);
    setPreviewTab('editor');
    setFormAttrs(
      profile.attributes.map((a) => ({
        vendor: a.vendor,
        attribute_name: a.attribute_name,
        attribute_type: a.attribute_type,
        op: a.op,
        value: a.value,
      }))
    );
    setFormError(null);
    setModalOpen(true);
  };

  const handleAddAttrRow = () => {
    setFormAttrs([
      ...formAttrs,
      { vendor: 'Standard', attribute_name: '', attribute_type: 'string', op: ':=', value: '' },
    ]);
  };

  const handleSelectCatalogItem = (idx: number, item: RadiusCatalogItem) => {
    const updated = [...formAttrs];
    updated[idx] = {
      vendor: item.vendor === 'juniper' ? 'Juniper' : item.vendor === 'mikrotik' ? 'MikroTik' : item.vendor === 'cisco' ? 'Cisco' : 'Standard',
      attribute_name: item.attribute_name,
      attribute_type: item.data_type,
      op: item.default_op || ':=',
      value: item.sample_value || '',
    };
    setFormAttrs(updated);
  };

  const handleRemoveAttrRow = (idx: number) => {
    setFormAttrs(formAttrs.filter((_, i) => i !== idx));
  };

  const handleAttrChange = (idx: number, field: string, val: string) => {
    const updated = [...formAttrs];
    (updated[idx] as any)[field] = val;
    setFormAttrs(updated);
  };

  const validateAttributes = (): string | null => {
    for (let i = 0; i < formAttrs.length; i++) {
      const a = formAttrs[i];
      if (!a.attribute_name.trim()) continue;
      if (!a.value.trim()) {
        return `Value is required for attribute "${a.attribute_name}"`;
      }
      if (a.attribute_type === 'integer') {
        if (!/^\d+$/.test(a.value.trim())) {
          return `Attribute "${a.attribute_name}" must be an integer, got: "${a.value}"`;
        }
      } else if (a.attribute_type === 'ipaddr') {
        const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
        if (!ipRegex.test(a.value.trim())) {
          return `Attribute "${a.attribute_name}" must be a valid IPv4 address, got: "${a.value}"`;
        }
      }
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      setFormError('Profile name is required');
      return;
    }

    const valError = validateAttributes();
    if (valError) {
      setFormError(valError);
      return;
    }

    try {
      setSubmitting(true);
      setFormError(null);

      const payload = {
        name: formName.trim(),
        description: formDescription.trim() || undefined,
        is_active: formIsActive,
        attributes: formAttrs.filter((a) => a.attribute_name.trim().length > 0),
      };

      const url = editingProfile ? `/api/radius-profiles/${editingProfile.id}` : '/api/radius-profiles';
      const method = editingProfile ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error?.message || 'Failed to save profile');
      }

      setModalOpen(false);
      fetchProfiles();
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      const res = await fetch(`/api/radius-profiles/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setDeleteConfirmId(null);
        fetchProfiles();
      }
    } catch {}
  };

  return (
    <div className="space-y-6">
      {/* View Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold tracking-tight text-foreground">RADIUS Profiles</h2>
            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20">
              {profiles.length} Profiles
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Configure reusable RADIUS attribute templates (MikroTik, Cisco, Juniper, RFC Standard).
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={fetchProfiles}
            disabled={loading}
            className="p-2 rounded-xl border border-border bg-card hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={handleOpenAdd}
            className="px-4 py-2 rounded-xl bg-primary text-primary-foreground font-semibold text-xs flex items-center gap-1.5 hover:opacity-95 shadow-sm transition-all"
          >
            <Plus className="w-4 h-4" /> Add Profile
          </button>
        </div>
      </div>

      {/* Profiles Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {profiles.map((prof) => (
          <div
            key={prof.id}
            className="p-5 rounded-2xl border border-border bg-card/60 hover:border-primary/40 transition-all shadow-sm space-y-4"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-bold">
                  <Shield className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-foreground">{prof.name}</h3>
                  <p className="text-xs text-muted-foreground line-clamp-1">
                    {prof.description || 'No description provided'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => handleOpenEdit(prof)}
                  className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg transition-colors"
                  title="Edit Profile"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setDeleteConfirmId(prof.id)}
                  className="p-1.5 text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors"
                  title="Delete Profile"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Attributes list */}
            <div className="space-y-1.5 pt-1">
              <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center justify-between">
                <span>Attributes ({prof.attributes.length})</span>
                <span>Type</span>
              </div>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {prof.attributes.map((attr, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2 rounded-lg bg-muted/40 font-mono text-xs border border-border/50"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-card border border-border text-muted-foreground">
                        {attr.vendor}
                      </span>
                      <span className="font-semibold text-primary">{attr.attribute_name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">{attr.op}</span>
                      <span className="font-semibold text-foreground">{attr.value}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Add / Edit Profile Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-2xl w-full max-w-2xl p-6 shadow-2xl space-y-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-bold">
                  <Shield className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-foreground">
                    {editingProfile ? `Edit Profile: ${editingProfile.name}` : 'Add New RADIUS Profile'}
                  </h3>
                  <p className="text-[11px] text-muted-foreground">
                    Vendor-aware attribute dictionary supporting Juniper BNG, MikroTik, and RFC standard
                  </p>
                </div>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                className="p-1 rounded-lg text-muted-foreground hover:text-foreground"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Tabs */}
            <div className="flex border-b border-border gap-2">
              <button
                type="button"
                onClick={() => setPreviewTab('editor')}
                className={`px-3 py-1.5 text-xs font-semibold border-b-2 transition-colors ${
                  previewTab === 'editor'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                Attribute Editor ({formAttrs.length})
              </button>
              <button
                type="button"
                onClick={() => setPreviewTab('preview')}
                className={`px-3 py-1.5 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
                  previewTab === 'preview'
                    ? 'border-emerald-500 text-emerald-500'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Simulate Access-Accept</span>
              </button>
            </div>

            {formError && (
              <div className="p-3 rounded-xl border border-rose-500/20 bg-rose-500/10 text-rose-500 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            {previewTab === 'editor' ? (
              <form onSubmit={handleSubmit} className="space-y-4 flex-1 overflow-y-auto pr-1 text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2 sm:col-span-1">
                    <label className="font-medium text-muted-foreground block mb-1">
                      Profile Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      placeholder="e.g. FIBER-100M"
                      className="w-full px-3 py-2 rounded-xl bg-background border border-border focus:ring-2 focus:ring-primary outline-none text-foreground uppercase"
                    />
                  </div>
                  <div className="col-span-2 sm:col-span-1">
                    <label className="font-medium text-muted-foreground block mb-1">
                      Description
                    </label>
                    <input
                      type="text"
                      value={formDescription}
                      onChange={(e) => setFormDescription(e.target.value)}
                      placeholder="e.g. 100Mbps symmetrical with interim updates"
                      className="w-full px-3 py-2 rounded-xl bg-background border border-border focus:ring-2 focus:ring-primary outline-none text-foreground"
                    />
                  </div>
                </div>

                {/* Quick Catalog Search / Insert */}
                {catalog.length > 0 && (
                  <div className="p-3 rounded-xl bg-muted/40 border border-border space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-foreground uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                        <Server className="w-3.5 h-3.5 text-primary" />
                        <span>Quick-Pick from Catalog</span>
                      </span>
                      <span className="text-[10px] text-muted-foreground">{catalog.length} verified VSAs</span>
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Filter catalog by attribute name (e.g. Juniper, Rate, Filter)..."
                        value={catalogSearch}
                        onChange={(e) => setCatalogSearch(e.target.value)}
                        className="flex-1 px-2.5 py-1.5 rounded-lg bg-background border border-border text-xs text-foreground font-mono"
                      />
                    </div>
                    <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pt-1">
                      {catalog
                        .filter((c) =>
                          catalogSearch ? c.attribute_name.toLowerCase().includes(catalogSearch.toLowerCase()) || c.vendor.toLowerCase().includes(catalogSearch.toLowerCase()) : c.is_common
                        )
                        .slice(0, 15)
                        .map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => {
                              setFormAttrs([
                                ...formAttrs,
                                {
                                  vendor: c.vendor === 'juniper' ? 'Juniper' : c.vendor === 'mikrotik' ? 'MikroTik' : c.vendor === 'cisco' ? 'Cisco' : 'Standard',
                                  attribute_name: c.attribute_name,
                                  attribute_type: c.data_type,
                                  op: c.default_op || ':=',
                                  value: c.sample_value || '',
                                },
                              ]);
                            }}
                            className="px-2 py-1 rounded bg-card hover:bg-primary hover:text-primary-foreground border border-border font-mono text-[10px] text-muted-foreground transition-all flex items-center gap-1"
                            title={`${c.description || ''} (Type: ${c.data_type})`}
                          >
                            <span>+ {c.attribute_name}</span>
                            <span className="text-[9px] opacity-70">({c.vendor})</span>
                          </button>
                        ))}
                    </div>
                  </div>
                )}

                {/* Attributes Repeater */}
                <div className="space-y-2 pt-2 border-t border-border">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-foreground uppercase tracking-wider text-[11px]">
                      Configured RADIUS Attributes
                    </span>
                    <button
                      type="button"
                      onClick={handleAddAttrRow}
                      className="px-2.5 py-1 rounded-lg bg-card border border-border hover:bg-accent font-medium text-[11px] flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3 text-primary" /> Add Attribute
                    </button>
                  </div>

                  <div className="space-y-2">
                    {formAttrs.map((attr, idx) => {
                      const meta = catalog.find((c) => c.attribute_name.toLowerCase() === attr.attribute_name.toLowerCase());
                      return (
                        <div key={idx} className="p-2.5 rounded-xl bg-muted/30 border border-border space-y-1.5">
                          <div className="flex items-center gap-2">
                            <select
                              value={attr.vendor}
                              onChange={(e) => handleAttrChange(idx, 'vendor', e.target.value)}
                              className="px-2 py-1.5 rounded-lg bg-background border border-border text-xs text-foreground"
                            >
                              <option value="Standard">Standard</option>
                              <option value="MikroTik">MikroTik</option>
                              <option value="Juniper">Juniper</option>
                              <option value="Cisco">Cisco</option>
                            </select>

                            <input
                              type="text"
                              placeholder="Attribute Name (e.g. Juniper-Ingress-Policy-Name)"
                              value={attr.attribute_name}
                              onChange={(e) => {
                                handleAttrChange(idx, 'attribute_name', e.target.value);
                                const match = catalog.find((c) => c.attribute_name.toLowerCase() === e.target.value.toLowerCase());
                                if (match) {
                                  handleSelectCatalogItem(idx, match);
                                }
                              }}
                              className="flex-1 px-2.5 py-1.5 rounded-lg bg-background border border-border font-mono text-xs text-foreground"
                            />

                            <select
                              value={attr.op}
                              onChange={(e) => handleAttrChange(idx, 'op', e.target.value)}
                              className="px-2 py-1.5 rounded-lg bg-background border border-border font-mono text-xs text-foreground"
                            >
                              <option value=":=">:=</option>
                              <option value="==">==</option>
                              <option value="+=">+=</option>
                            </select>

                            <input
                              type="text"
                              placeholder={`Value (${attr.attribute_type || 'string'})`}
                              value={attr.value}
                              onChange={(e) => handleAttrChange(idx, 'value', e.target.value)}
                              className="flex-1 px-2.5 py-1.5 rounded-lg bg-background border border-border font-mono text-xs text-foreground"
                            />

                            <button
                              type="button"
                              onClick={() => handleRemoveAttrRow(idx)}
                              className="p-1.5 text-rose-500 hover:bg-rose-500/10 rounded-lg"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          {/* Metadata row */}
                          <div className="flex items-center gap-2 text-[10px] text-muted-foreground pl-1">
                            <span className="px-1.5 py-0.2 rounded bg-background border border-border font-mono">
                              Type: {attr.attribute_type || 'string'}
                            </span>
                            {meta?.dynamic_profile_var && (
                              <span className="text-emerald-400 font-mono">
                                Junos: {meta.dynamic_profile_var}
                              </span>
                            )}
                            {meta?.coa_supported && (
                              <span className="text-sky-400">RFC 5176 CoA Supported</span>
                            )}
                            {meta?.description && (
                              <span className="truncate max-w-xs">{meta.description}</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
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
                    disabled={submitting}
                    className="px-4 py-2 rounded-xl bg-primary text-primary-foreground font-semibold hover:opacity-95"
                  >
                    {submitting ? 'Saving...' : editingProfile ? 'Update Profile' : 'Create Profile'}
                  </button>
                </div>
              </form>
            ) : (
              /* Access-Accept Simulated Preview */
              <div className="space-y-3 flex-1 overflow-y-auto pr-1 text-xs">
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-between">
                  <span className="font-semibold">Simulated FreeRADIUS Access-Accept Packet</span>
                  <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-emerald-500/20">Status: ACCEPT</span>
                </div>

                <div className="border border-border rounded-xl overflow-hidden bg-background">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border bg-muted/40 text-muted-foreground text-left font-mono text-[11px]">
                        <th className="p-2.5">Attribute Name</th>
                        <th className="p-2.5">Op</th>
                        <th className="p-2.5">Value</th>
                        <th className="p-2.5">Vendor</th>
                        <th className="p-2.5">Junos Mapping</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {formAttrs.filter((a) => a.attribute_name.trim().length > 0).map((a, idx) => {
                        const meta = catalog.find((c) => c.attribute_name.toLowerCase() === a.attribute_name.toLowerCase());
                        return (
                          <tr key={idx} className="hover:bg-muted/20 font-mono text-[11px]">
                            <td className="p-2.5 font-bold text-foreground">{a.attribute_name}</td>
                            <td className="p-2.5 text-muted-foreground">{a.op}</td>
                            <td className="p-2.5 text-primary font-semibold">{a.value || '<empty>'}</td>
                            <td className="p-2.5">
                              <span className="px-1.5 py-0.5 rounded bg-muted text-[10px] text-muted-foreground">
                                {a.vendor}
                              </span>
                            </td>
                            <td className="p-2.5 text-emerald-400 font-sans text-[11px]">
                              {meta?.dynamic_profile_var || '-'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="p-3 rounded-xl bg-muted/30 border border-border font-mono text-[11px] text-muted-foreground space-y-1">
                  <div className="text-foreground font-semibold">Raw RADIUS Format:</div>
                  <pre className="overflow-x-auto p-2 rounded bg-background border border-border">
{formAttrs
  .filter((a) => a.attribute_name.trim().length > 0)
  .map((a) => `${a.attribute_name} ${a.op} "${a.value}"`)
  .join('\n')}
                  </pre>
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-border">
                  <button
                    type="button"
                    onClick={() => setPreviewTab('editor')}
                    className="px-4 py-2 rounded-xl bg-primary text-primary-foreground font-semibold text-xs"
                  >
                    Back to Editor
                  </button>
                </div>
              </div>
            )}
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
              <h3 className="text-base font-bold text-foreground">Delete RADIUS Profile?</h3>
              <p className="text-xs text-muted-foreground mt-1">
                This will delete the profile and all its associated attribute mappings.
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
                Delete Profile
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
