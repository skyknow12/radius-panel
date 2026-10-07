'use client';

import React from 'react';
import {
  Layers,
  Plus,
  Edit2,
  Trash2,
  RefreshCw,
  Server,
  Activity,
  AlertTriangle,
  X,
  CheckCircle2,
} from 'lucide-react';
import type { IpPoolItem } from '@/types/api';

export function IpPoolsView() {
  const [pools, setPools] = React.useState<IpPoolItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [modalOpen, setModalOpen] = React.useState(false);
  const [editingPool, setEditingPool] = React.useState<IpPoolItem | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = React.useState<number | null>(null);

  // Form State
  const [formName, setFormName] = React.useState('');
  const [formNetwork, setFormNetwork] = React.useState('');
  const [formGateway, setFormGateway] = React.useState('');
  const [formStartIp, setFormStartIp] = React.useState('');
  const [formEndIp, setFormEndIp] = React.useState('');
  const [formSubnet, setFormSubnet] = React.useState('255.255.0.0');
  const [formTotalIps, setFormTotalIps] = React.useState(240);
  const [formDescription, setFormDescription] = React.useState('');
  const [formError, setFormError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  const fetchPools = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/ip-pools');
      if (res.ok) {
        const json = await res.json();
        setPools(json.data || []);
      }
    } catch {} finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchPools();
  }, []);

  const handleOpenAdd = () => {
    setEditingPool(null);
    setFormName('');
    setFormNetwork('100.111.0.0/16');
    setFormGateway('100.111.0.1');
    setFormStartIp('100.111.20.10');
    setFormEndIp('100.111.20.250');
    setFormSubnet('255.255.0.0');
    setFormTotalIps(241);
    setFormDescription('');
    setFormError(null);
    setModalOpen(true);
  };

  const handleOpenEdit = (pool: IpPoolItem) => {
    setEditingPool(pool);
    setFormName(pool.name);
    setFormNetwork(pool.network);
    setFormGateway(pool.gateway);
    setFormStartIp(pool.start_ip);
    setFormEndIp(pool.end_ip);
    setFormSubnet(pool.subnet);
    setFormTotalIps(pool.total_ips);
    setFormDescription(pool.description || '');
    setFormError(null);
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formNetwork.trim() || !formGateway.trim()) {
      setFormError('Pool Name, Network, and Gateway are required.');
      return;
    }

    try {
      setSubmitting(true);
      setFormError(null);

      const payload = {
        name: formName.trim(),
        network: formNetwork.trim(),
        gateway: formGateway.trim(),
        start_ip: formStartIp.trim(),
        end_ip: formEndIp.trim(),
        subnet: formSubnet.trim(),
        total_ips: Number(formTotalIps) || 240,
        description: formDescription.trim() || undefined,
      };

      const url = editingPool ? `/api/ip-pools/${editingPool.id}` : '/api/ip-pools';
      const method = editingPool ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error?.message || 'Failed to save IP pool');
      }

      setModalOpen(false);
      fetchPools();
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      const res = await fetch(`/api/ip-pools/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setDeleteConfirmId(null);
        fetchPools();
      }
    } catch {}
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold tracking-tight text-foreground">IP Pools Management</h2>
            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20">
              {pools.length} Pools
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Manage subscriber CGNAT and static IPv4 ranges assigned via FreeRADIUS <code className="text-primary font-mono">Framed-Pool</code>.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={fetchPools}
            disabled={loading}
            className="p-2 rounded-xl border border-border bg-card hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={handleOpenAdd}
            className="px-4 py-2 rounded-xl bg-primary text-primary-foreground font-semibold text-xs flex items-center gap-1.5 hover:opacity-95 shadow-sm transition-all"
          >
            <Plus className="w-4 h-4" /> Add IP Pool
          </button>
        </div>
      </div>

      {/* Pool Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {pools.map((p) => (
          <div
            key={p.id}
            className="p-5 rounded-2xl border border-border bg-card/60 hover:border-primary/40 transition-all shadow-sm space-y-4"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-bold">
                  <Layers className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-foreground font-mono">{p.name}</h3>
                  <p className="text-xs text-muted-foreground line-clamp-1">{p.description || 'CGNAT Dynamic Pool'}</p>
                </div>
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => handleOpenEdit(p)}
                  className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg transition-colors"
                  title="Edit Pool"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setDeleteConfirmId(p.id)}
                  className="p-1.5 text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors"
                  title="Delete Pool"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* IP Details Grid */}
            <div className="grid grid-cols-2 gap-3 text-xs p-3 rounded-xl bg-muted/30 border border-border/50">
              <div>
                <span className="text-muted-foreground">Network CIDR:</span>
                <p className="font-mono font-semibold text-foreground mt-0.5">{p.network}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Gateway:</span>
                <p className="font-mono font-semibold text-foreground mt-0.5">{p.gateway}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Start IP:</span>
                <p className="font-mono font-semibold text-foreground mt-0.5">{p.start_ip}</p>
              </div>
              <div>
                <span className="text-muted-foreground">End IP:</span>
                <p className="font-mono font-semibold text-foreground mt-0.5">{p.end_ip}</p>
              </div>
            </div>

            {/* Utilization Bar */}
            <div className="space-y-1.5 pt-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Allocation Utilization</span>
                <span className="font-mono font-bold text-foreground">
                  {p.used_ips} / {p.total_ips} ({p.utilization_percent}%)
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className={`h-full transition-all duration-500 ${
                    p.utilization_percent > 85
                      ? 'bg-rose-500'
                      : p.utilization_percent > 65
                      ? 'bg-amber-500'
                      : 'bg-emerald-500'
                  }`}
                  style={{ width: `${Math.min(100, Math.max(3, p.utilization_percent))}%` }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Add / Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="text-base font-bold text-foreground">
                {editingPool ? 'Edit IP Pool' : 'Create New IP Pool'}
              </h3>
              <button
                onClick={() => setModalOpen(false)}
                className="p-1 rounded-lg text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {formError && (
              <div className="p-3 rounded-xl border border-rose-500/20 bg-rose-500/10 text-rose-500 text-xs">
                {formError}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="font-medium text-muted-foreground block mb-1">Pool Name *</label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. FW-POOL-100"
                  className="w-full px-3 py-2 rounded-xl bg-background border border-border focus:ring-2 focus:ring-primary outline-none font-mono uppercase"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-medium text-muted-foreground block mb-1">Network (CIDR) *</label>
                  <input
                    type="text"
                    required
                    value={formNetwork}
                    onChange={(e) => setFormNetwork(e.target.value)}
                    placeholder="100.111.0.0/16"
                    className="w-full px-3 py-2 rounded-xl bg-background border border-border focus:ring-2 focus:ring-primary outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="font-medium text-muted-foreground block mb-1">Gateway IP *</label>
                  <input
                    type="text"
                    required
                    value={formGateway}
                    onChange={(e) => setFormGateway(e.target.value)}
                    placeholder="100.111.0.1"
                    className="w-full px-3 py-2 rounded-xl bg-background border border-border focus:ring-2 focus:ring-primary outline-none font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-medium text-muted-foreground block mb-1">Start IP *</label>
                  <input
                    type="text"
                    required
                    value={formStartIp}
                    onChange={(e) => setFormStartIp(e.target.value)}
                    placeholder="100.111.20.10"
                    className="w-full px-3 py-2 rounded-xl bg-background border border-border focus:ring-2 focus:ring-primary outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="font-medium text-muted-foreground block mb-1">End IP *</label>
                  <input
                    type="text"
                    required
                    value={formEndIp}
                    onChange={(e) => setFormEndIp(e.target.value)}
                    placeholder="100.111.20.250"
                    className="w-full px-3 py-2 rounded-xl bg-background border border-border focus:ring-2 focus:ring-primary outline-none font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-medium text-muted-foreground block mb-1">Subnet Mask</label>
                  <input
                    type="text"
                    value={formSubnet}
                    onChange={(e) => setFormSubnet(e.target.value)}
                    placeholder="255.255.0.0"
                    className="w-full px-3 py-2 rounded-xl bg-background border border-border focus:ring-2 focus:ring-primary outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="font-medium text-muted-foreground block mb-1">Total Usable IPs</label>
                  <input
                    type="number"
                    value={formTotalIps}
                    onChange={(e) => setFormTotalIps(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-background border border-border focus:ring-2 focus:ring-primary outline-none font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="font-medium text-muted-foreground block mb-1">Description</label>
                <input
                  type="text"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="e.g. Kathmandu Core DC-1 CGNAT subscriber pool"
                  className="w-full px-3 py-2 rounded-xl bg-background border border-border focus:ring-2 focus:ring-primary outline-none"
                />
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
                  {submitting ? 'Saving...' : editingPool ? 'Update Pool' : 'Create Pool'}
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
              <h3 className="text-base font-bold text-foreground">Delete IP Pool?</h3>
              <p className="text-xs text-muted-foreground mt-1">
                This will delete the pool definition. Assigned IP records will be detached.
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
                Delete Pool
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
