'use client';

import React from 'react';
import {
  Building2,
  Plus,
  Search,
  Filter,
  Users,
  Wallet,
  CreditCard,
  Edit2,
  TrendingUp,
  X,
  Check,
  AlertCircle,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  DollarSign
} from 'lucide-react';
import type { BranchItem, BranchDashboardMetrics } from '@/types/api';

interface BranchesViewProps {
  onViewSubscribers?: (branchId: number) => void;
  onViewWallet?: (branchId: number) => void;
  currentUser?: any;
}

export function BranchesView({ onViewSubscribers, onViewWallet, currentUser }: BranchesViewProps) {
  const [branches, setBranches] = React.useState<BranchItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [search, setSearch] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState('ALL');
  const [createModalOpen, setCreateModalOpen] = React.useState(false);
  const [selectedBranch, setSelectedBranch] = React.useState<BranchItem | null>(null);
  const [branchMetrics, setBranchMetrics] = React.useState<BranchDashboardMetrics | null>(null);
  const [metricsLoading, setMetricsLoading] = React.useState(false);
  const [editModalOpen, setEditModalOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Create form state
  const [name, setName] = React.useState('');
  const [code, setCode] = React.useState('');
  const [managerName, setManagerName] = React.useState('');
  const [contactNumber, setContactNumber] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [address, setAddress] = React.useState('');
  const [notes, setNotes] = React.useState('');
  const [gracePeriodDays, setGracePeriodDays] = React.useState('');
  const [status, setStatus] = React.useState<'ACTIVE' | 'INACTIVE' | 'SUSPENDED'>('ACTIVE');

  const fetchBranches = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('radius_token');
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch('/api/branches', { headers });
      if (res.ok) {
        const json = await res.json();
        setBranches(json.data || []);
      }
    } catch {
      setError('Failed to load branches');
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchBranches();
  }, []);

  const handleOpenBranchDetails = async (branch: BranchItem) => {
    setSelectedBranch(branch);
    try {
      setMetricsLoading(true);
      const token = localStorage.getItem('radius_token');
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch(`/api/branches/${branch.id}/dashboard`, { headers });
      if (res.ok) {
        const json = await res.json();
        setBranchMetrics(json.data);
      }
    } catch {
      // ignore
    } finally {
      setMetricsLoading(false);
    }
  };

  const handleCreateBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      setError(null);
      const token = localStorage.getItem('radius_token');
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch('/api/branches', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          name: name.trim(),
          code: code.trim().toUpperCase(),
          manager_name: managerName.trim(),
          contact_number: contactNumber.trim(),
          email: email.trim(),
          address: address.trim(),
          notes: notes.trim(),
          status,
          grace_period_days: gracePeriodDays ? parseInt(gracePeriodDays, 10) : null,
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || errJson.message || 'Failed to create branch');
      }

      setCreateModalOpen(false);
      setName('');
      setCode('');
      setManagerName('');
      setContactNumber('');
      setEmail('');
      setAddress('');
      setNotes('');
      setGracePeriodDays('');
      fetchBranches();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBranch) return;
    try {
      setSaving(true);
      const token = localStorage.getItem('radius_token');
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch(`/api/branches/${selectedBranch.id}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          name: selectedBranch.name,
          manager_name: selectedBranch.manager_name,
          contact_number: selectedBranch.contact_number,
          email: selectedBranch.email,
          address: selectedBranch.address,
          status: selectedBranch.status,
          notes: selectedBranch.notes,
          grace_period_days:
            selectedBranch.grace_period_days !== undefined &&
            selectedBranch.grace_period_days !== null &&
            (selectedBranch.grace_period_days as any) !== ''
              ? parseInt(String(selectedBranch.grace_period_days), 10)
              : null,
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || errJson.message || 'Failed to update branch');
      }

      setEditModalOpen(false);
      fetchBranches();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const filteredBranches = branches.filter((b) => {
    const matchesSearch =
      b.name.toLowerCase().includes(search.toLowerCase()) ||
      b.code.toLowerCase().includes(search.toLowerCase()) ||
      (b.manager_name && b.manager_name.toLowerCase().includes(search.toLowerCase()));
    const matchesStatus = statusFilter === 'ALL' || b.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-5">
      {/* Header and Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-bold text-foreground flex items-center gap-2">
            <Building2 className="w-5 h-5 text-blue-400" />
            Branch Management
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Regional operational branches with isolated subscriber fleets and dedicated wallets
          </p>
        </div>

        <button
          onClick={() => setCreateModalOpen(true)}
          className="px-3.5 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold shadow-md shadow-primary/20 hover:opacity-90 transition-opacity flex items-center gap-1.5 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>New Branch</span>
        </button>
      </div>

      {error && (
        <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          <span>{error}</span>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-card p-3 rounded-2xl border border-border">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by branch name, code, or manager..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-background border border-border rounded-xl pl-9 pr-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <span className="text-xs text-muted-foreground font-semibold">Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-background border border-border rounded-xl px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="ALL">All Statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
            <option value="SUSPENDED">Suspended</option>
          </select>
        </div>
      </div>

      {/* Branches Table */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-muted/40 text-muted-foreground font-semibold border-b border-border">
              <tr>
                <th className="py-3 px-4">Branch Details</th>
                <th className="py-3 px-4">Manager & Contact</th>
                <th className="py-3 px-4">Subscribers</th>
                <th className="py-3 px-4">Wallet Balance</th>
                <th className="py-3 px-4">Credit Facility</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-muted-foreground animate-pulse">
                    Loading branches...
                  </td>
                </tr>
              ) : filteredBranches.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-muted-foreground">
                    No branches found matching your search.
                  </td>
                </tr>
              ) : (
                filteredBranches.map((b) => (
                  <tr key={b.id} className="hover:bg-muted/30 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-bold text-foreground flex items-center gap-2">
                        <span>{b.name}</span>
                        <span className="px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 font-mono text-[10px] font-semibold border border-blue-500/20">
                          {b.code}
                        </span>
                      </div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">{b.address || 'No address set'}</div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-medium text-foreground">{b.manager_name || 'Unassigned'}</div>
                      <div className="text-[10px] text-muted-foreground font-mono">{b.contact_number || b.email || '—'}</div>
                      <div className="text-[10px] text-amber-500/80 font-medium mt-0.5">
                        Grace: {b.grace_period_days !== null && b.grace_period_days !== undefined ? `${b.grace_period_days}d` : 'Org Default'}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-bold text-foreground">
                        {b.subscriber_count || 0} total
                      </div>
                      <div className="text-[10px] text-emerald-400 font-semibold">
                        {b.active_subscribers || 0} active
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-bold text-purple-400 font-mono">
                        Rs. {(b.wallet_balance || 0).toLocaleString()}
                      </div>
                      <div className="text-[10px] text-muted-foreground">Prepaid Wallet</div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-bold text-indigo-400 font-mono">
                        Rs. {(b.credit_limit || 0).toLocaleString()}
                      </div>
                      <div className="text-[10px] text-muted-foreground">Emergency Line</div>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          b.status === 'ACTIVE'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : b.status === 'SUSPENDED'
                            ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                            : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        {b.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleOpenBranchDetails(b)}
                          className="px-2.5 py-1 rounded-lg bg-card border border-border hover:bg-muted text-[11px] font-semibold text-foreground transition-colors flex items-center gap-1"
                          title="View Branch Metrics"
                        >
                          <TrendingUp className="w-3.5 h-3.5 text-blue-400" />
                          <span>Metrics</span>
                        </button>
                        <button
                          onClick={() => {
                            setSelectedBranch(b);
                            setEditModalOpen(true);
                          }}
                          className="p-1 rounded-lg border border-border hover:bg-muted text-muted-foreground hover:text-foreground"
                          title="Edit Branch"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Branch Metrics & Details Drawer / Modal */}
      {selectedBranch && !editModalOpen && branchMetrics && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-card border border-border rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            <div className="p-5 border-b border-border flex items-center justify-between bg-muted/30">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-400">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                    {selectedBranch.name}
                    <span className="text-xs px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 font-mono">
                      {selectedBranch.code}
                    </span>
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    Manager: {selectedBranch.manager_name || 'N/A'} • {selectedBranch.address || 'Central'}
                  </p>
                </div>
              </div>
              <button onClick={() => setSelectedBranch(null)} className="p-1.5 text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Branch Dashboard 8 Clickable Metric Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 rounded-xl border border-border bg-card">
                  <span className="text-[10px] text-muted-foreground font-semibold uppercase block">Total Subscribers</span>
                  <div className="text-xl font-black text-foreground mt-0.5">{branchMetrics.subscribers}</div>
                  <span className="text-[10px] text-emerald-400 font-semibold">{branchMetrics.activeSubscribers} Active</span>
                </div>

                <div className="p-3.5 rounded-xl border border-border bg-card">
                  <span className="text-[10px] text-muted-foreground font-semibold uppercase block">Monthly Revenue</span>
                  <div className="text-xl font-black text-foreground mt-0.5">
                    Rs. {branchMetrics.monthlyRevenue.toLocaleString()}
                  </div>
                  <span className="text-[10px] text-muted-foreground">MTD Collections</span>
                </div>

                <div className="p-3.5 rounded-xl border border-border bg-card">
                  <span className="text-[10px] text-muted-foreground font-semibold uppercase block">Wallet Balance</span>
                  <div className="text-xl font-black text-purple-400 mt-0.5 font-mono">
                    Rs. {branchMetrics.walletBalance.toLocaleString()}
                  </div>
                  <span className="text-[10px] text-muted-foreground">Prepaid Cash</span>
                </div>

                <div className="p-3.5 rounded-xl border border-border bg-card">
                  <span className="text-[10px] text-muted-foreground font-semibold uppercase block">Remaining Credit</span>
                  <div className="text-xl font-black text-indigo-400 mt-0.5 font-mono">
                    Rs. {branchMetrics.remainingCredit.toLocaleString()}
                  </div>
                  <span className="text-[10px] text-amber-400 font-semibold">Limit: Rs. {branchMetrics.creditLimit.toLocaleString()}</span>
                </div>
              </div>

              {/* Recent Branch Transactions */}
              <div>
                <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2.5">
                  Recent Branch Recharges
                </h3>
                {branchMetrics.recentTransactions.length === 0 ? (
                  <div className="p-4 rounded-xl border border-border/60 bg-muted/20 text-center text-xs text-muted-foreground">
                    No recent recharge transactions recorded for this branch.
                  </div>
                ) : (
                  <div className="border border-border rounded-xl overflow-hidden text-xs">
                    <table className="w-full text-left">
                      <thead className="bg-muted/40 font-semibold text-muted-foreground border-b border-border">
                        <tr>
                          <th className="py-2.5 px-3">Txn ID</th>
                          <th className="py-2.5 px-3">Subscriber</th>
                          <th className="py-2.5 px-3">Package</th>
                          <th className="py-2.5 px-3">Amount</th>
                          <th className="py-2.5 px-3">Date</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {branchMetrics.recentTransactions.map((tx) => (
                          <tr key={tx.id}>
                            <td className="py-2.5 px-3 font-mono text-muted-foreground">{tx.transaction_id}</td>
                            <td className="py-2.5 px-3 font-semibold text-foreground">{tx.username}</td>
                            <td className="py-2.5 px-3">{tx.package_name}</td>
                            <td className="py-2.5 px-3 font-bold font-mono text-emerald-400">Rs. {Number(tx.final_amount).toLocaleString()}</td>
                            <td className="py-2.5 px-3 text-muted-foreground">{new Date(tx.recharge_date).toLocaleDateString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create Branch Modal */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-card border border-border rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl">
            <div className="p-5 border-b border-border flex items-center justify-between bg-muted/30">
              <div className="flex items-center gap-2.5">
                <Building2 className="w-5 h-5 text-blue-400" />
                <h3 className="text-sm font-bold text-foreground">Create New Branch Location</h3>
              </div>
              <button onClick={() => setCreateModalOpen(false)} className="p-1.5 text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateBranch} className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground block mb-1">Branch Name *</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    placeholder="e.g. Pokhara Lakeside Branch"
                    className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground block mb-1">Branch Code *</label>
                  <input
                    type="text"
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    required
                    placeholder="e.g. BRN-PKR"
                    className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs text-foreground font-mono focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground block mb-1">Manager Name</label>
                  <input
                    type="text"
                    value={managerName}
                    onChange={(e) => setManagerName(e.target.value)}
                    placeholder="e.g. Sunil Gurung"
                    className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground block mb-1">Contact Phone</label>
                  <input
                    type="text"
                    value={contactNumber}
                    onChange={(e) => setContactNumber(e.target.value)}
                    placeholder="+977-61-520111"
                    className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground block mb-1">Branch Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="pkr.branch@skyradius.net"
                    className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground block mb-1">Status</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as any)}
                    className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="INACTIVE">INACTIVE</option>
                    <option value="SUSPENDED">SUSPENDED</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">Physical Address</label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Lakeside Ward 6, Pokhara"
                  className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">Notes / Description</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  placeholder="Regional operations center details..."
                  className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">
                  Default Grace Period (Days)
                </label>
                <input
                  type="number"
                  min="0"
                  max="30"
                  value={gracePeriodDays}
                  onChange={(e) => setGracePeriodDays(e.target.value)}
                  placeholder="Inherit from Organization (leave blank)"
                  className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <p className="text-[10px] text-muted-foreground mt-1">
                  Leave empty to inherit organization default. Set to 0 to disable grace for this branch (0–30 days).
                </p>
              </div>

              <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[11px]">
                💡 A dedicated prepaid operational wallet (e.g. <span className="font-mono font-bold">WLT-BRN-{code || 'XXX'}</span>) and credit account will be provisioned automatically for this branch.
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-border">
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-border hover:bg-muted text-xs font-semibold text-foreground transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold shadow-md shadow-primary/20 hover:opacity-90 disabled:opacity-50 transition-opacity"
                >
                  {saving ? 'Creating...' : 'Create Branch'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Branch Modal */}
      {editModalOpen && selectedBranch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-card border border-border rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl">
            <div className="p-5 border-b border-border flex items-center justify-between bg-muted/30">
              <div className="flex items-center gap-2.5">
                <Edit2 className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-bold text-foreground">Edit Branch: {selectedBranch.name}</h3>
              </div>
              <button onClick={() => setEditModalOpen(false)} className="p-1.5 text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleUpdateBranch} className="p-5 space-y-4">
              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">Branch Name</label>
                <input
                  type="text"
                  value={selectedBranch.name}
                  onChange={(e) => setSelectedBranch({ ...selectedBranch, name: e.target.value })}
                  required
                  className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground block mb-1">Manager</label>
                  <input
                    type="text"
                    value={selectedBranch.manager_name || ''}
                    onChange={(e) => setSelectedBranch({ ...selectedBranch, manager_name: e.target.value })}
                    className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground block mb-1">Contact</label>
                  <input
                    type="text"
                    value={selectedBranch.contact_number || ''}
                    onChange={(e) => setSelectedBranch({ ...selectedBranch, contact_number: e.target.value })}
                    className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground block mb-1">Email</label>
                  <input
                    type="email"
                    value={selectedBranch.email || ''}
                    onChange={(e) => setSelectedBranch({ ...selectedBranch, email: e.target.value })}
                    className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground block mb-1">Status</label>
                  <select
                    value={selectedBranch.status}
                    onChange={(e) => setSelectedBranch({ ...selectedBranch, status: e.target.value as any })}
                    className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="INACTIVE">INACTIVE</option>
                    <option value="SUSPENDED">SUSPENDED</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">Address</label>
                <input
                  type="text"
                  value={selectedBranch.address || ''}
                  onChange={(e) => setSelectedBranch({ ...selectedBranch, address: e.target.value })}
                  className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">Notes</label>
                <textarea
                  value={selectedBranch.notes || ''}
                  onChange={(e) => setSelectedBranch({ ...selectedBranch, notes: e.target.value })}
                  rows={2}
                  className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">
                  Default Grace Period (Days)
                </label>
                <input
                  type="number"
                  min="0"
                  max="30"
                  value={selectedBranch.grace_period_days ?? ''}
                  onChange={(e) =>
                    setSelectedBranch({
                      ...selectedBranch,
                      grace_period_days: e.target.value === '' ? null : parseInt(e.target.value, 10),
                    })
                  }
                  placeholder="Inherit from Organization (leave blank)"
                  className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <p className="text-[10px] text-muted-foreground mt-1">
                  Leave empty to inherit organization default. Set to 0 to disable grace for this branch (0–30 days).
                </p>
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-border">
                <button
                  type="button"
                  onClick={() => setEditModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-border hover:bg-muted text-xs font-semibold text-foreground transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold shadow-md shadow-primary/20 hover:opacity-90 disabled:opacity-50 transition-opacity"
                >
                  {saving ? 'Updating...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
