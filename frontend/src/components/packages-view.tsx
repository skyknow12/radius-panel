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
  
  // Phase 3 Burst & Profile
  const [formBurstDl, setFormBurstDl] = React.useState<string>('');
  const [formBurstUl, setFormBurstUl] = React.useState<string>('');
  const [formBurstThDl, setFormBurstThDl] = React.useState<string>('');
  const [formBurstThUl, setFormBurstThUl] = React.useState<string>('');
  const [formBurstTime, setFormBurstTime] = React.useState<string>('16');
  const [formRadiusProfileId, setFormRadiusProfileId] = React.useState<string>('');
  const [radiusProfiles, setRadiusProfiles] = React.useState<any[]>([]);

  // Phase 4 Multi-Duration Pricing
  const [formPrice1M, setFormPrice1M] = React.useState<number>(2000);
  const [formPrice3M, setFormPrice3M] = React.useState<number>(5700);
  const [formPrice6M, setFormPrice6M] = React.useState<number>(10800);
  const [formPrice12M, setFormPrice12M] = React.useState<number>(20000);

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

  const fetchProfiles = async () => {
    try {
      const res = await fetch('/api/radius-profiles');
      if (res.ok) {
        const json = await res.json();
        setRadiusProfiles(json.data || []);
      }
    } catch {}
  };

  React.useEffect(() => {
    fetchPackages();
    fetchProfiles();
  }, []);

  // Auto-update rate limit when dl, ul or burst change
  React.useEffect(() => {
    if (!editingPkg) {
      if (formBurstDl && formBurstUl) {
        const thDl = formBurstThDl || Math.round(formDl * 0.8);
        const thUl = formBurstThUl || Math.round(formUl * 0.8);
        const time = formBurstTime || '16';
        setFormRateLimit(`${formDl}M/${formUl}M ${formBurstDl}M/${formBurstUl}M ${thDl}M/${thUl}M ${time}/${time}`);
      } else {
        setFormRateLimit(`${formDl}M/${formUl}M`);
      }
    }
  }, [formDl, formUl, formBurstDl, formBurstUl, formBurstThDl, formBurstThUl, formBurstTime, editingPkg]);

  const openAddModal = () => {
    setEditingPkg(null);
    setFormName('');
    setFormDl(100);
    setFormUl(100);
    setFormRateLimit('100M/100M');
    setFormValidity(30);
    setFormPrice(2000);
    setFormPrice1M(2000);
    setFormPrice3M(5700);
    setFormPrice6M(10800);
    setFormPrice12M(20000);
    setFormCurrency('NPR');
    setFormDesc('');
    setFormActive(true);
    setFormInterim('300');
    setFormBurstDl('');
    setFormBurstUl('');
    setFormBurstThDl('');
    setFormBurstThUl('');
    setFormBurstTime('16');
    setFormRadiusProfileId('');
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
    setFormPrice1M(Number(pkg.price));
    setFormPrice3M(Math.round(Number(pkg.price) * 2.85));
    setFormPrice6M(Math.round(Number(pkg.price) * 5.4));
    setFormPrice12M(Math.round(Number(pkg.price) * 10));
    setFormCurrency(pkg.currency || 'NPR');
    setFormDesc(pkg.description || '');
    setFormActive(pkg.is_active);
    setFormBurstDl(pkg.burst_download_mbps ? String(pkg.burst_download_mbps) : '');
    setFormBurstUl(pkg.burst_upload_mbps ? String(pkg.burst_upload_mbps) : '');
    setFormBurstThDl(pkg.burst_threshold_dl_mbps ? String(pkg.burst_threshold_dl_mbps) : '');
    setFormBurstThUl(pkg.burst_threshold_ul_mbps ? String(pkg.burst_threshold_ul_mbps) : '');
    setFormBurstTime(pkg.burst_time_seconds ? String(pkg.burst_time_seconds) : '16');
    setFormRadiusProfileId(pkg.radius_profile_id ? String(pkg.radius_profile_id) : '');

    // Fetch existing custom duration prices
    fetch(`/api/packages/${pkg.id}/prices`)
      .then((r) => r.json())
      .then((j) => {
        if (j.data?.length) {
          j.data.forEach((p: any) => {
            if (p.duration_months === 1) setFormPrice1M(Number(p.price));
            if (p.duration_months === 3) setFormPrice3M(Number(p.price));
            if (p.duration_months === 6) setFormPrice6M(Number(p.price));
            if (p.duration_months === 12) setFormPrice12M(Number(p.price));
          });
        }
      })
      .catch(() => {});

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
        burst_download_mbps: formBurstDl ? Number(formBurstDl) : null,
        burst_upload_mbps: formBurstUl ? Number(formBurstUl) : null,
        burst_threshold_dl_mbps: formBurstThDl ? Number(formBurstThDl) : null,
        burst_threshold_ul_mbps: formBurstThUl ? Number(formBurstThUl) : null,
        burst_time_seconds: formBurstTime ? Number(formBurstTime) : null,
        radius_profile_id: formRadiusProfileId ? Number(formRadiusProfileId) : null,
        rate_limit: formRateLimit.trim() || `${formDl}M/${formUl}M`,
        validity_days: Number(formValidity),
        price: Number(formPrice1M || formPrice),
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

      // Save independent multi-duration pricing tiers (1M, 3M, 6M, 12M)
      const pkgId = json.data?.id || (editingPkg ? editingPkg.id : null);
      if (pkgId) {
        await Promise.all([
          fetch(`/api/packages/${pkgId}/prices`, { method: 'POST', headers, body: JSON.stringify({ duration_months: 1, price: Number(formPrice1M), currency: formCurrency.trim() }) }),
          fetch(`/api/packages/${pkgId}/prices`, { method: 'POST', headers, body: JSON.stringify({ duration_months: 3, price: Number(formPrice3M), currency: formCurrency.trim() }) }),
          fetch(`/api/packages/${pkgId}/prices`, { method: 'POST', headers, body: JSON.stringify({ duration_months: 6, price: Number(formPrice6M), currency: formCurrency.trim() }) }),
          fetch(`/api/packages/${pkgId}/prices`, { method: 'POST', headers, body: JSON.stringify({ duration_months: 12, price: Number(formPrice12M), currency: formCurrency.trim() }) }),
        ]).catch(() => {});
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
                  {pkg.burst_download_mbps && pkg.burst_upload_mbps ? (
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-amber-500 font-medium">Burst Limit</span>
                      <span className="font-mono text-amber-500 font-semibold">
                        {pkg.burst_download_mbps}M / {pkg.burst_upload_mbps}M ({pkg.burst_time_seconds || 16}s)
                      </span>
                    </div>
                  ) : null}
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-muted-foreground">MikroTik Attribute</span>
                    <span className="font-mono text-primary font-semibold truncate max-w-[150px]" title={pkg.rate_limit}>
                      {pkg.rate_limit}
                    </span>
                  </div>
                  {pkg.radius_profile_name && (
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-muted-foreground">RADIUS Profile</span>
                      <span className="font-semibold text-indigo-400">
                        {pkg.radius_profile_name}
                      </span>
                    </div>
                  )}
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

              {/* Phase 3: Burst Configuration */}
              <div className="p-3.5 rounded-xl bg-amber-500/5 border border-amber-500/20 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-500">
                    <Zap className="w-3.5 h-3.5" />
                    <span>MikroTik Burst Bandwidth (Optional)</span>
                  </div>
                  <span className="text-[10px] text-muted-foreground">Auto-updates rate-limit</span>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-medium text-foreground mb-1">
                      Burst DL (Mbps)
                    </label>
                    <input
                      type="number"
                      min="0"
                      placeholder="e.g. 150"
                      value={formBurstDl}
                      onChange={(e) => setFormBurstDl(e.target.value)}
                      className="w-full bg-background border border-border rounded-lg px-2.5 py-1.5 text-foreground font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-foreground mb-1">
                      Burst UL (Mbps)
                    </label>
                    <input
                      type="number"
                      min="0"
                      placeholder="e.g. 150"
                      value={formBurstUl}
                      onChange={(e) => setFormBurstUl(e.target.value)}
                      className="w-full bg-background border border-border rounded-lg px-2.5 py-1.5 text-foreground font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-foreground mb-1">
                      Burst Time (sec)
                    </label>
                    <input
                      type="number"
                      min="1"
                      placeholder="16"
                      value={formBurstTime}
                      onChange={(e) => setFormBurstTime(e.target.value)}
                      className="w-full bg-background border border-border rounded-lg px-2.5 py-1.5 text-foreground font-mono"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-medium text-muted-foreground mb-1">
                      Threshold DL (Mbps) (optional)
                    </label>
                    <input
                      type="number"
                      min="0"
                      placeholder={formBurstDl ? String(Math.round(formDl * 0.8)) : 'e.g. 80'}
                      value={formBurstThDl}
                      onChange={(e) => setFormBurstThDl(e.target.value)}
                      className="w-full bg-background border border-border rounded-lg px-2.5 py-1.5 text-foreground font-mono text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-muted-foreground mb-1">
                      Threshold UL (Mbps) (optional)
                    </label>
                    <input
                      type="number"
                      min="0"
                      placeholder={formBurstUl ? String(Math.round(formUl * 0.8)) : 'e.g. 80'}
                      value={formBurstThUl}
                      onChange={(e) => setFormBurstThUl(e.target.value)}
                      className="w-full bg-background border border-border rounded-lg px-2.5 py-1.5 text-foreground font-mono text-xs"
                    />
                  </div>
                </div>
              </div>

              {/* Phase 3: RADIUS Profile Link */}
              <div>
                <label className="block font-medium text-foreground mb-1">
                  RADIUS Attribute Profile (Optional)
                </label>
                <select
                  value={formRadiusProfileId}
                  onChange={(e) => setFormRadiusProfileId(e.target.value)}
                  className="w-full bg-muted/50 border border-border rounded-xl px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
                >
                  <option value="">None (Use default package attributes)</option>
                  {radiusProfiles.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} {p.vendor ? `(${p.vendor})` : ''} - {p.attributes?.length || 0} attributes
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-muted-foreground mt-1">
                  Applies additional generic FreeRADIUS reply/check attributes defined in RADIUS Profiles.
                </p>
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

              {/* Multi-duration Pricing Grid */}
              <div className="bg-muted/30 border border-border/80 rounded-xl p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Multi-Duration Pricing ({formCurrency})
                  </label>
                  <span className="text-[11px] text-muted-foreground">Independently configured for recharge</span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1">
                      1 Month
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={formPrice1M}
                      onChange={(e) => setFormPrice1M(parseFloat(e.target.value) || 0)}
                      className="w-full bg-background border border-border rounded-lg px-2.5 py-1.5 text-xs text-foreground font-mono focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1">
                      3 Months
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={formPrice3M}
                      onChange={(e) => setFormPrice3M(parseFloat(e.target.value) || 0)}
                      className="w-full bg-background border border-border rounded-lg px-2.5 py-1.5 text-xs text-foreground font-mono focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1">
                      6 Months
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={formPrice6M}
                      onChange={(e) => setFormPrice6M(parseFloat(e.target.value) || 0)}
                      className="w-full bg-background border border-border rounded-lg px-2.5 py-1.5 text-xs text-foreground font-mono focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1">
                      12 Months
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={formPrice12M}
                      onChange={(e) => setFormPrice12M(parseFloat(e.target.value) || 0)}
                      className="w-full bg-background border border-border rounded-lg px-2.5 py-1.5 text-xs text-foreground font-mono focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
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
