'use client';

import React from 'react';
import {
  Store,
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
  Building2,
  DollarSign
} from 'lucide-react';
import type { ResellerItem, ResellerDashboardMetrics, BranchItem } from '@/types/api';
import { ResellerTopupModal } from './reseller-topup-modal';
import { ResellerProfileView } from './reseller-profile-view';

interface ResellersViewProps {
  onViewCustomers?: (resellerId: number) => void;
  onViewWallet?: (resellerId: number) => void;
  onOpenSubscriber?: (subscriberId: number) => void;
  initialResellerId?: number | null;
  currentUser?: any;
}

export function ResellersView({
  onViewCustomers,
  onViewWallet,
  onOpenSubscriber,
  initialResellerId,
  currentUser,
}: ResellersViewProps) {
  const [viewingProfileResellerId, setViewingProfileResellerId] = React.useState<number | null>(
    initialResellerId || null
  );
  const [topupModalReseller, setTopupModalReseller] = React.useState<ResellerItem | null>(null);
  const [resellers, setResellers] = React.useState<ResellerItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [search, setSearch] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState('ALL');
  const [createModalOpen, setCreateModalOpen] = React.useState(false);
  const [selectedReseller, setSelectedReseller] = React.useState<ResellerItem | null>(null);
  const [resellerMetrics, setResellerMetrics] = React.useState<ResellerDashboardMetrics | null>(null);
  const [metricsLoading, setMetricsLoading] = React.useState(false);
  const [editModalOpen, setEditModalOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Create form state
  const [name, setName] = React.useState('');
  const [code, setCode] = React.useState('');
  const [contactPerson, setContactPerson] = React.useState('');
  const [phone, setPhone] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [address, setAddress] = React.useState('');
  const [commissionPercent, setCommissionPercent] = React.useState('50');
  const [creditLimit, setCreditLimit] = React.useState('50000');
  const [commissionModel, setCommissionModel] = React.useState<'discount' | 'commission'>('commission');
  const [notes, setNotes] = React.useState('');
  const [status, setStatus] = React.useState<'ACTIVE' | 'INACTIVE' | 'SUSPENDED'>('ACTIVE');

  const fetchDependencies = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('radius_token');
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const resRes = await fetch('/api/resellers', { headers });

      if (resRes.ok) {
        const json = await resRes.json();
        setResellers(json.data || []);
      }
    } catch {
      setError('Failed to load resellers');
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchDependencies();
  }, []);

  const handleOpenResellerDetails = async (reseller: ResellerItem) => {
    setSelectedReseller(reseller);
    try {
      setMetricsLoading(true);
      const token = localStorage.getItem('radius_token');
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch(`/api/resellers/${reseller.id}/dashboard`, { headers });
      if (res.ok) {
        const json = await res.json();
        setResellerMetrics(json.data);
      }
    } catch {
      // ignore
    } finally {
      setMetricsLoading(false);
    }
  };

  const handleCreateReseller = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      setError(null);

      const commVal = parseFloat(commissionPercent);
      if (isNaN(commVal) || commVal < 0 || commVal >= 100) {
        throw new Error('Commission percentage must be between 0% and 99.99%');
      }

      const credVal = parseFloat(creditLimit);
      if (isNaN(credVal) || credVal < 0) {
        throw new Error('Credit limit must be a non-negative number');
      }

      const token = localStorage.getItem('radius_token');
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch('/api/resellers', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          name: name.trim(),
          code: code.trim().toUpperCase(),
          branch_id: null, // Resellers belong to Organization, NOT Branch
          contact_person: contactPerson.trim() || undefined,
          phone: phone.trim(),
          email: email.trim() || undefined,
          address: address.trim() || undefined,
          commission_model: commissionModel,
          commission_percent: commVal,
          credit_limit: credVal,
          notes: notes.trim() || undefined,
          status,
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || errJson.message || 'Failed to create reseller');
      }

      setCreateModalOpen(false);
      setName('');
      setCode('');
      setContactPerson('');
      setPhone('');
      setEmail('');
      setAddress('');
      setCommissionPercent('50');
      setCreditLimit('50000');
      setNotes('');
      fetchDependencies();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateReseller = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReseller) return;
    try {
      setSaving(true);
      const token = localStorage.getItem('radius_token');
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`/api/resellers/${selectedReseller.id}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          name: selectedReseller.name,
          contact_person: selectedReseller.contact_person,
          phone: selectedReseller.phone,
          email: selectedReseller.email,
          address: selectedReseller.address,
          commission_model: selectedReseller.commission_model,
          status: selectedReseller.status,
          notes: selectedReseller.notes,
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || errJson.message || 'Failed to update reseller');
      }

      setEditModalOpen(false);
      fetchDependencies();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const filteredResellers = resellers.filter((r) => {
    const matchesSearch =
      r.name.toLowerCase().includes(search.toLowerCase()) ||
      r.code.toLowerCase().includes(search.toLowerCase()) ||
      (r.contact_person && r.contact_person.toLowerCase().includes(search.toLowerCase()));
    const matchesStatus = statusFilter === 'ALL' || r.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  if (viewingProfileResellerId) {
    return (
      <ResellerProfileView
        resellerId={viewingProfileResellerId}
        onBack={() => setViewingProfileResellerId(null)}
        currentUser={currentUser}
        onOpenSubscriber={onOpenSubscriber}
      />
    );
  }

  return (
    <div className="space-y-5">
      {/* Header and Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-bold text-foreground flex items-center gap-2">
            <Store className="w-5 h-5 text-amber-400" />
            Reseller Management
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Channel wholesale partners with isolated customer accounts, wallet credit, and commission tracking
          </p>
        </div>

        <button
          onClick={() => setCreateModalOpen(true)}
          className="px-3.5 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold shadow-md shadow-primary/20 hover:opacity-90 transition-opacity flex items-center gap-1.5 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>New Reseller</span>
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
            placeholder="Search by reseller name, code, contact..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-background border border-border rounded-xl pl-9 pr-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
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

      {/* Resellers Table */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-muted/40 text-muted-foreground font-semibold border-b border-border">
              <tr>
                <th className="py-3 px-4">Reseller</th>
                <th className="py-3 px-4">Code</th>
                <th className="py-3 px-4">Commission</th>
                <th className="py-3 px-4">Balance</th>
                <th className="py-3 px-4">Credit Used</th>
                <th className="py-3 px-4">Credit Remaining</th>
                <th className="py-3 px-4">Customers</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-muted-foreground animate-pulse">
                    Loading resellers...
                  </td>
                </tr>
              ) : filteredResellers.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-muted-foreground">
                    No resellers found matching your search.
                  </td>
                </tr>
              ) : (
                filteredResellers.map((r) => {
                  const creditLimitNum = Number(r.credit_limit ?? 50000);
                  const creditUsedNum = Number(r.used_credit ?? (r as any).credit_used ?? 0);
                  const creditRemainingNum = Math.max(0, creditLimitNum - creditUsedNum);

                  return (
                    <tr key={r.id} className="hover:bg-muted/30 transition-colors">
                      <td className="py-3 px-4">
                        <button
                          type="button"
                          onClick={() => setViewingProfileResellerId(r.id)}
                          className="hover:text-purple-400 hover:underline text-left font-bold text-foreground block"
                        >
                          {r.name}
                        </button>
                        <div className="text-[11px] text-muted-foreground mt-0.5">
                          {r.contact_person ? `${r.contact_person} • ` : ''}{r.phone || 'No phone'}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-400 font-mono text-[11px] font-bold border border-purple-500/20">
                          {r.code}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-bold text-purple-400">
                        {(r.commission_percent ?? 50).toFixed(0)}%
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-foreground font-mono">
                          Rs. {(r.wallet_balance || 0).toLocaleString()}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-amber-400 font-mono">
                          Rs. {creditUsedNum.toLocaleString()}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-cyan-400 font-mono">
                          Rs. {creditRemainingNum.toLocaleString()}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-foreground">
                          {r.customer_count || 0}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            r.status === 'ACTIVE'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : r.status === 'SUSPENDED'
                              ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                              : 'bg-muted text-muted-foreground'
                          }`}
                        >
                          {r.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setTopupModalReseller(r)}
                            className="px-2.5 py-1 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-[11px] shadow-sm flex items-center gap-1 active:scale-95"
                            title="Add Balance / Top-Up"
                          >
                            <Plus className="w-3 h-3 stroke-[3]" />
                            <span>+ Top-Up</span>
                          </button>
                          <button
                            onClick={() => setViewingProfileResellerId(r.id)}
                            className="px-2.5 py-1 rounded-lg bg-card border border-border hover:bg-muted text-[11px] font-semibold text-foreground transition-colors"
                            title="View Reseller Profile & Ledger"
                          >
                            Profile
                          </button>
                          <button
                            onClick={() => {
                              setSelectedReseller(r);
                              setEditModalOpen(true);
                            }}
                            className="p-1 rounded-lg border border-border hover:bg-muted text-muted-foreground hover:text-foreground"
                            title="Edit Reseller"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Reseller Dashboard Metrics Drawer / Modal */}
      {selectedReseller && !editModalOpen && resellerMetrics && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-card border border-border rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            <div className="p-5 border-b border-border flex items-center justify-between bg-muted/30">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400">
                  <Store className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                    {selectedReseller.name}
                    <span className="text-xs px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 font-mono">
                      {selectedReseller.code}
                    </span>
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    Contact: {selectedReseller.contact_person || 'N/A'} • {selectedReseller.phone || 'No phone'}
                  </p>
                </div>
              </div>
              <button onClick={() => setSelectedReseller(null)} className="p-1.5 text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Reseller Dashboard Metric Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 rounded-xl border border-border bg-card">
                  <span className="text-[10px] text-muted-foreground font-semibold uppercase block">Total Customers</span>
                  <div className="text-xl font-black text-foreground mt-0.5">{resellerMetrics.customers}</div>
                  <span className="text-[10px] text-emerald-400 font-semibold">{resellerMetrics.activeCustomers} Active</span>
                </div>

                <div className="p-3.5 rounded-xl border border-border bg-card">
                  <span className="text-[10px] text-muted-foreground font-semibold uppercase block">Monthly Revenue</span>
                  <div className="text-xl font-black text-foreground mt-0.5">
                    Rs. {resellerMetrics.monthlyRevenue.toLocaleString()}
                  </div>
                  <span className="text-[10px] text-emerald-400 font-semibold">
                    Comm: Rs. {resellerMetrics.commission.toLocaleString()}
                  </span>
                </div>

                <div className="p-3.5 rounded-xl border border-border bg-card">
                  <span className="text-[10px] text-muted-foreground font-semibold uppercase block">Wallet Balance</span>
                  <div className="text-xl font-black text-purple-400 mt-0.5 font-mono">
                    Rs. {resellerMetrics.walletBalance.toLocaleString()}
                  </div>
                  <span className="text-[10px] text-muted-foreground">Prepaid Cash</span>
                </div>

                <div className="p-3.5 rounded-xl border border-border bg-card">
                  <span className="text-[10px] text-muted-foreground font-semibold uppercase block">Remaining Credit</span>
                  <div className="text-xl font-black text-indigo-400 mt-0.5 font-mono">
                    Rs. {resellerMetrics.remainingCredit.toLocaleString()}
                  </div>
                  <span className="text-[10px] text-amber-400 font-semibold">Limit: Rs. {resellerMetrics.creditLimit.toLocaleString()}</span>
                </div>
              </div>

              {/* Recent Reseller Transactions */}
              <div>
                <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2.5">
                  Recent Reseller Customer Recharges
                </h3>
                {resellerMetrics.recentTransactions.length === 0 ? (
                  <div className="p-4 rounded-xl border border-border/60 bg-muted/20 text-center text-xs text-muted-foreground">
                    No recent recharge transactions recorded for this reseller.
                  </div>
                ) : (
                  <div className="border border-border rounded-xl overflow-hidden text-xs">
                    <table className="w-full text-left">
                      <thead className="bg-muted/40 font-semibold text-muted-foreground border-b border-border">
                        <tr>
                          <th className="py-2.5 px-3">Txn ID</th>
                          <th className="py-2.5 px-3">Subscriber</th>
                          <th className="py-2.5 px-3">Package</th>
                          <th className="py-2.5 px-3">Net Paid</th>
                          <th className="py-2.5 px-3">Commission</th>
                          <th className="py-2.5 px-3">Date</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {resellerMetrics.recentTransactions.map((tx) => (
                          <tr key={tx.id}>
                            <td className="py-2.5 px-3 font-mono text-muted-foreground">{tx.transaction_id}</td>
                            <td className="py-2.5 px-3 font-semibold text-foreground">{tx.username}</td>
                            <td className="py-2.5 px-3">{tx.package_name}</td>
                            <td className="py-2.5 px-3 font-bold font-mono text-emerald-400">Rs. {Number(tx.final_amount).toLocaleString()}</td>
                            <td className="py-2.5 px-3 font-mono text-amber-400">Rs. {Number(tx.commission_amount).toLocaleString()}</td>
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

      {/* Create Reseller Modal */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-card border border-border rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl">
            <div className="p-5 border-b border-border flex items-center justify-between bg-muted/30">
              <div className="flex items-center gap-2.5">
                <Store className="w-5 h-5 text-purple-400" />
                <div>
                  <h3 className="text-sm font-bold text-foreground">Add Reseller</h3>
                  <p className="text-[11px] text-muted-foreground">Direct Organizational Partner</p>
                </div>
              </div>
              <button onClick={() => setCreateModalOpen(false)} className="p-1.5 text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateReseller} className="p-5 space-y-4">
              {/* Organization association badge (Section 30) */}
              <div className="p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/20 text-xs flex items-center justify-between">
                <span className="text-muted-foreground font-medium">Organization:</span>
                <span className="font-bold text-foreground">Direct ISP Head Organization</span>
              </div>

              {/* Basic Information (Section 6) */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground block mb-1">Reseller Name *</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    placeholder="e.g. ABC Telecom"
                    className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground block mb-1">Reseller Code *</label>
                  <input
                    type="text"
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    required
                    placeholder="e.g. RES-001"
                    className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs text-foreground font-mono focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground block mb-1">Phone Number *</label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    required
                    placeholder="+977-9841000001"
                    className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground block mb-1">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="info@abctelecom.com"
                    className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground block mb-1">Contact Person</label>
                  <input
                    type="text"
                    value={contactPerson}
                    onChange={(e) => setContactPerson(e.target.value)}
                    placeholder="Anil Thapa"
                    className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground block mb-1">Status *</label>
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
                  placeholder="e.g. Prithvi Chowk, Pokhara"
                  className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              {/* Commercial Configuration (Section 6 & 7) */}
              <div className="p-3.5 rounded-xl bg-card border border-border space-y-3">
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block">
                  Commercial Configuration
                </span>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground block mb-1">
                      Commission Percentage * (%)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="99.99"
                      step="0.1"
                      value={commissionPercent}
                      onChange={(e) => setCommissionPercent(e.target.value)}
                      required
                      placeholder="50"
                      className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs text-foreground font-mono focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                    <span className="text-[10px] text-muted-foreground mt-0.5 block">
                      Min 0%, Max &lt;100% (e.g. 50%)
                    </span>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground block mb-1">
                      Credit Limit (Rs.)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="1000"
                      value={creditLimit}
                      onChange={(e) => setCreditLimit(e.target.value)}
                      placeholder="50000"
                      className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs text-foreground font-mono focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                    <span className="text-[10px] text-muted-foreground mt-0.5 block">
                      Approved limit (e.g. 50,000)
                    </span>
                  </div>
                </div>
              </div>

              {/* Notes (Section 6) */}
              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">Notes</label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Optional internal remarks or agreements..."
                  className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                />
              </div>

              <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-300 text-[11px]">
                💡 Dedicated wholesale wallet (<span className="font-mono font-bold">WLT-RES-{code || '001'}</span>) and credit account will be auto-provisioned.
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
                  {saving ? 'Creating...' : 'Create Reseller'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Reseller Modal */}
      {editModalOpen && selectedReseller && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-card border border-border rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl">
            <div className="p-5 border-b border-border flex items-center justify-between bg-muted/30">
              <div className="flex items-center gap-2.5">
                <Edit2 className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-bold text-foreground">Edit Reseller: {selectedReseller.name}</h3>
              </div>
              <button onClick={() => setEditModalOpen(false)} className="p-1.5 text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleUpdateReseller} className="p-5 space-y-4">
              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">Reseller Name</label>
                <input
                  type="text"
                  value={selectedReseller.name}
                  onChange={(e) => setSelectedReseller({ ...selectedReseller, name: e.target.value })}
                  required
                  className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground block mb-1">Contact Person</label>
                  <input
                    type="text"
                    value={selectedReseller.contact_person || ''}
                    onChange={(e) => setSelectedReseller({ ...selectedReseller, contact_person: e.target.value })}
                    className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground block mb-1">Phone</label>
                  <input
                    type="text"
                    value={selectedReseller.phone || ''}
                    onChange={(e) => setSelectedReseller({ ...selectedReseller, phone: e.target.value })}
                    className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground block mb-1">Email</label>
                  <input
                    type="email"
                    value={selectedReseller.email || ''}
                    onChange={(e) => setSelectedReseller({ ...selectedReseller, email: e.target.value })}
                    className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground block mb-1">Status</label>
                  <select
                    value={selectedReseller.status}
                    onChange={(e) => setSelectedReseller({ ...selectedReseller, status: e.target.value as any })}
                    className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="INACTIVE">INACTIVE</option>
                    <option value="SUSPENDED">SUSPENDED</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">Commission Model</label>
                <select
                  value={selectedReseller.commission_model}
                  onChange={(e) => setSelectedReseller({ ...selectedReseller, commission_model: e.target.value as any })}
                  className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="discount">Discount Model (Wholesale Purchase)</option>
                  <option value="commission">Commission Model (Percentage Incentive)</option>
                </select>
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
      {/* Topup Modal */}
      {topupModalReseller && (
        <ResellerTopupModal
          isOpen={!!topupModalReseller}
          onClose={() => setTopupModalReseller(null)}
          reseller={topupModalReseller}
          currentUser={currentUser}
          onSuccess={() => {
            fetchDependencies();
          }}
        />
      )}
    </div>
  );
}
