'use client';

import React from 'react';
import {
  Box,
  Plus,
  Edit2,
  Trash2,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Zap,
  Clock,
  Tag,
  Users,
  AlertTriangle,
} from 'lucide-react';
import type { PackageItem } from '@/types/api';

export function PackagesView() {
  const [packages, setPackages] = React.useState<PackageItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [modalOpen, setModalOpen] = React.useState(false);
  const [editingPkg, setEditingPkg] = React.useState<PackageItem | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = React.useState<number | null>(null);

  // Form state
  const [formName, setFormName] = React.useState('');
  const [formDl, setFormDl] = React.useState(100);
  const [formUl, setFormUl] = React.useState(100);
  const [formRateLimit, setFormRateLimit] = React.useState('100M/100M');
  const [formValidity, setFormValidity] = React.useState(30);
  const [formPrice, setFormPrice] = React.useState(2000);
  const [formCurrency, setFormCurrency] = React.useState('NPR');
  const [formDesc, setFormDesc] = React.useState('');
  const [formActive, setFormActive] = React.useState(true);
  const [formInterim, setFormInterim] = React.useState('300');
  const [formError, setFormError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  const fetchPackages = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/packages');
      if (res.ok) {
        const json = await res.json();
        setPackages(json.data || []);
      }
    } catch {}
    finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchPackages();
  }, []);

  // Auto-update rate limit when dl or ul change
  React.useEffect(() => {
    if (!editingPkg) {
      setFormRateLimit(`${formDl}M/${formUl}M`);
    }
  }, [formDl, formUl, editingPkg]);

  const openAddModal = () => {
    setEditingPkg(null);
    setFormName('');
    setFormDl(100);
    setFormUl(100);
    setFormRateLimit('100M/100M');
    setFormValidity(30);
    setFormPrice(2000);
    setFormCurrency('NPR');
    setFormDesc('');
    setFormActive(true);
    setFormInterim('300');
    setFormError(null);
    setModalOpen(true);
  };

  const openEditModal = (pkg: PackageItem) => {
    setEditingPkg(pkg);
    setFormName(pkg.name);
    setFormDl(pkg.download_speed_mbps);
    setFormUl(pkg.upload_speed_mbps);
    setFormRateLimit(pkg.rate_limit);
    setFormValidity(pkg.validity_days);
    setFormPrice(Number(pkg.price));
    setFormCurrency(pkg.currency || 'NPR');
    setFormDesc(pkg.description || '');
    setFormActive(pkg.is_active);
    const interimAttr = pkg.attributes?.find((a) => a.attribute === 'Acct-Interim-Interval');
    setFormInterim(interimAttr?.value || '300');
    setFormError(null);
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!formName.trim()) {
      setFormError('Package Name is required');
      return;
    }
    if (formDl <= 0 || formUl <= 0) {
      setFormError('Speeds must be greater than 0 Mbps');
      return;
    }

    try {
      setSubmitting(true);
      const token = typeof window !== 'undefined' ? localStorage.getItem('radius_token') : null;
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const payload = {
        name: formName.trim(),
        download_speed_mbps: Number(formDl),
        upload_speed_mbps: Number(formUl),
        rate_limit: formRateLimit.trim() || `${formDl}M/${formUl}M`,
        validity_days: Number(formValidity),
        price: Number(formPrice),
        currency: formCurrency.trim(),
        description: formDesc.trim() || undefined,
        is_active: formActive,
        attributes: [
          { attribute: 'Mikrotik-Rate-Limit', op: ':=', value: formRateLimit.trim() || `${formDl}M/${formUl}M` },
          { attribute: 'Acct-Interim-Interval', op: ':=', value: formInterim.trim() || '300' },
          { attribute: 'Framed-Protocol', op: ':=', value: 'PPP' },
          { attribute: 'Service-Type', op: ':=', value: 'Framed-User' },
        ],
      };

      const url = editingPkg ? `/api/packages/${editingPkg.id}` : '/api/packages';
      const method = editingPkg ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers,
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error?.message || json.message || 'Failed to save package');
      }

      setModalOpen(false);
      fetchPackages();
    } catch (err: any) {
      setFormError(err.message || 'Failed to save package');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('radius_token') : null;
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`/api/packages/${id}`, { method: 'DELETE', headers });
      if (res.ok) {
        setDeleteConfirmId(null);
        fetchPackages();
      }
    } catch {}
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Box className="w-5 h-5 text-primary" />
            <span>Service Packages & Bandwidth Profiles</span>
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Configure ISP bandwidth tiers with automated MikroTik-Rate-Limit attributes and FreeRADIUS SQL groups.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={fetchPackages}
            disabled={loading}
            className="p-2 rounded-xl border border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground text-xs font-medium flex items-center gap-1.5 transition-colors"
            title="Refresh packages"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
          <button
            onClick={openAddModal}
            className="px-3.5 py-2 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-semibold flex items-center gap-2 shadow-md shadow-primary/20 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Add Package</span>
          </button>
        </div>
      </div>

      {/* Packages Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {loading && packages.length === 0 ? (
          <div className="col-span-full py-12 text-center text-muted-foreground">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-primary" />
            <span>Loading service plans...</span>
          </div>
        ) : packages.length === 0 ? (
          <div className="col-span-full py-12 text-center text-muted-foreground">
            No service packages configured yet. Click &quot;Add Package&quot; to create your first bandwidth plan.
          </div>
        ) : (
          packages.map((pkg) => (
            <div
              key={pkg.id}
              className="rounded-2xl border border-border bg-card p-5 shadow-sm hover:shadow-md hover:border-primary/40 transition-all flex flex-col justify-between group"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                      <Zap className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-foreground">{pkg.name}</h4>
                      <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                        <Clock className="w-3 h-3" /> {pkg.validity_days} Days Validity
                      </span>
                    </div>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                      pkg.is_active
                        ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                        : 'bg-muted text-muted-foreground border-border'
                    }`}
                  >
                    {pkg.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>

                {/* Speed & Rate Limit */}
                <div className="p-3 rounded-xl bg-muted/40 border border-border/80 my-3 space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Download / Upload</span>
                    <span className="font-bold text-foreground">
                      {pkg.download_speed_mbps}M / {pkg.upload_speed_mbps}M
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-muted-foreground">MikroTik Attribute</span>
                    <span className="font-mono text-primary font-semibold">
                      {pkg.rate_limit}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-muted-foreground">Interim Accounting</span>
                    <span className="font-mono text-muted-foreground">300s (5m)</span>
                  </div>
                </div>

                {pkg.description && (
                  <p className="text-[11px] text-muted-foreground line-clamp-2 mb-3">
                    {pkg.description}
                  </p>
                )}
              </div>

              {/* Bottom: Price & Actions */}
              <div className="pt-3 border-t border-border flex items-center justify-between mt-2">
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Price</div>
                  <div className="text-sm font-bold text-foreground">
                    {pkg.currency} {Number(pkg.price).toLocaleString()}
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <span
                    className="flex items-center gap-1 text-[11px] text-muted-foreground mr-1"
                    title="Active Subscribers on this plan"
                  >
                    <Users className="w-3.5 h-3.5" />
                    <span>{pkg.subscribers_count}</span>
                  </span>

                  <button
                    onClick={() => openEditModal(pkg)}
                    className="p-1.5 rounded-lg border border-border hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                    title="Edit Package"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>

                  {deleteConfirmId === pkg.id ? (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleDelete(pkg.id)}
                        className="px-2 py-1 rounded bg-rose-500 text-white font-semibold text-[10px]"
                      >
                        Yes
                      </button>
                      <button
                        onClick={() => setDeleteConfirmId(null)}
                        className="px-2 py-1 rounded bg-muted text-muted-foreground text-[10px]"
                      >
                        No
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setDeleteConfirmId(pkg.id)}
                      className="p-1.5 rounded-lg border border-border hover:bg-rose-500/10 text-muted-foreground hover:text-rose-500 transition-colors"
                      title="Delete Package"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add / Edit Package Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-md animate-in fade-in duration-150">
          <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-border">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                  <Box className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground">
                    {editingPkg ? `Edit Package: ${editingPkg.name}` : 'Create Bandwidth Package'}
                  </h3>
                  <p className="text-[11px] text-muted-foreground">
                    Populates FreeRADIUS radgroupreply with MikroTik-Rate-Limit
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
              <div>
                <label className="block font-medium text-foreground mb-1">
                  Package Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Fiber 100 Mbps"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full bg-muted/50 border border-border rounded-xl px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-medium text-foreground mb-1">
                    Download Speed (Mbps) *
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={formDl}
                    onChange={(e) => setFormDl(parseInt(e.target.value, 10) || 1)}
                    className="w-full bg-muted/50 border border-border rounded-xl px-3 py-2 text-foreground font-mono focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
                  />
                </div>

                <div>
                  <label className="block font-medium text-foreground mb-1">
                    Upload Speed (Mbps) *
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={formUl}
                    onChange={(e) => setFormUl(parseInt(e.target.value, 10) || 1)}
                    className="w-full bg-muted/50 border border-border rounded-xl px-3 py-2 text-foreground font-mono focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-medium text-foreground mb-1">
                    MikroTik-Rate-Limit *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="100M/100M"
                    value={formRateLimit}
                    onChange={(e) => setFormRateLimit(e.target.value)}
                    className="w-full bg-muted/50 border border-border rounded-xl px-3 py-2 text-foreground font-mono text-primary font-semibold focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
                  />
                </div>

                <div>
                  <label className="block font-medium text-foreground mb-1">
                    Interim Accounting (seconds)
                  </label>
                  <input
                    type="text"
                    value={formInterim}
                    onChange={(e) => setFormInterim(e.target.value)}
                    className="w-full bg-muted/50 border border-border rounded-xl px-3 py-2 text-foreground font-mono focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block font-medium text-foreground mb-1">
                    Validity (Days) *
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={formValidity}
                    onChange={(e) => setFormValidity(parseInt(e.target.value, 10) || 30)}
                    className="w-full bg-muted/50 border border-border rounded-xl px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
                  />
                </div>

                <div>
                  <label className="block font-medium text-foreground mb-1">
                    Price *
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    value={formPrice}
                    onChange={(e) => setFormPrice(parseFloat(e.target.value) || 0)}
                    className="w-full bg-muted/50 border border-border rounded-xl px-3 py-2 text-foreground font-mono focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
                  />
                </div>

                <div>
                  <label className="block font-medium text-foreground mb-1">
                    Currency
                  </label>
                  <input
                    type="text"
                    value={formCurrency}
                    onChange={(e) => setFormCurrency(e.target.value)}
                    className="w-full bg-muted/50 border border-border rounded-xl px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
                  />
                </div>
              </div>

              <div>
                <label className="block font-medium text-foreground mb-1">
                  Description / Features
                </label>
                <input
                  type="text"
                  placeholder="High-speed symmetrical FTTH internet"
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  className="w-full bg-muted/50 border border-border rounded-xl px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="pkgActive"
                  checked={formActive}
                  onChange={(e) => setFormActive(e.target.checked)}
                  className="w-4 h-4 rounded text-primary focus:ring-primary/40"
                />
                <label htmlFor="pkgActive" className="text-foreground font-medium cursor-pointer">
                  Plan is currently Active for subscribers
                </label>
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
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 font-semibold shadow-md shadow-primary/20 disabled:opacity-50 transition-all"
                >
                  {submitting ? 'Saving...' : editingPkg ? 'Save Changes' : 'Create Package'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
