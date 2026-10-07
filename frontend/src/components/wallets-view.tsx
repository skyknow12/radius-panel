'use client';

import React from 'react';
import {
  Wallet,
  CreditCard,
  TrendingUp,
  TrendingDown,
  Clock,
  Plus,
  ArrowUpRight,
  ArrowDownRight,
  Sliders,
  FileText,
  Download,
  Search,
  Filter,
  Building2,
  Store,
  ShieldAlert,
  ShieldCheck,
  AlertCircle,
  X,
  Check,
  RefreshCw,
  Info
} from 'lucide-react';
import type { WalletItem, WalletTransactionItem, WalletDashboardMetrics } from '@/types/api';

export function WalletsView() {
  const [metrics, setMetrics] = React.useState<WalletDashboardMetrics | null>(null);
  const [wallets, setWallets] = React.useState<WalletItem[]>([]);
  const [ledger, setLedger] = React.useState<WalletTransactionItem[]>([]);
  const [ledgerTotal, setLedgerTotal] = React.useState(0);
  const [activeTab, setActiveTab] = React.useState<'wallets' | 'ledger'>('wallets');
  const [entityFilter, setEntityFilter] = React.useState<'all' | 'branch' | 'reseller'>('all');
  const [search, setSearch] = React.useState('');
  const [loading, setLoading] = React.useState(true);
  const [ledgerLoading, setLedgerLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Modals state
  const [topupModalOpen, setTopupModalOpen] = React.useState(false);
  const [creditModalOpen, setCreditModalOpen] = React.useState(false);
  const [adjustModalOpen, setAdjustModalOpen] = React.useState(false);
  const [selectedWallet, setSelectedWallet] = React.useState<WalletItem | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  // Top-up Form
  const [topupAmount, setTopupAmount] = React.useState('');
  const [topupPaymentMethod, setTopupPaymentMethod] = React.useState('BANK_TRANSFER');
  const [topupReference, setTopupReference] = React.useState('');
  const [topupRemarks, setTopupRemarks] = React.useState('');

  // Credit Form
  const [creditEnabled, setCreditEnabled] = React.useState(true);
  const [creditLimit, setCreditLimit] = React.useState('');
  const [creditStartDate, setCreditStartDate] = React.useState('');
  const [creditExpiryDate, setCreditExpiryDate] = React.useState('');
  const [creditStatus, setCreditStatus] = React.useState<'ACTIVE' | 'SUSPENDED' | 'EXPIRED'>('ACTIVE');
  const [creditNotes, setCreditNotes] = React.useState('');

  // Adjust Form
  const [adjustAmount, setAdjustAmount] = React.useState('');
  const [adjustDirection, setAdjustDirection] = React.useState<'credit' | 'debit'>('credit');
  const [adjustReason, setAdjustReason] = React.useState('');

  const fetchData = async () => {
    try {
      setLoading(true);
      const [metRes, wltRes] = await Promise.all([
        fetch('/api/wallets/dashboard'),
        fetch('/api/wallets'),
      ]);

      if (metRes.ok) {
        const json = await metRes.json();
        setMetrics(json.data);
      }
      if (wltRes.ok) {
        const json = await wltRes.json();
        setWallets(json.data || []);
      }
    } catch {
      setError('Failed to load wallet dashboard');
    } finally {
      setLoading(false);
    }
  };

  const fetchLedger = async (walletId?: number) => {
    try {
      setLedgerLoading(true);
      const url = walletId ? `/api/wallets/${walletId}/ledger?limit=100` : '/api/wallets/ledger/all?limit=100';
      const res = await fetch(url);
      if (res.ok) {
        const json = await res.json();
        setLedger(json.data || []);
        setLedgerTotal(json.meta?.total || 0);
      }
    } catch {
      setError('Failed to load ledger transactions');
    } finally {
      setLedgerLoading(false);
    }
  };

  React.useEffect(() => {
    fetchData();
  }, []);

  React.useEffect(() => {
    if (activeTab === 'ledger') {
      fetchLedger(selectedWallet ? selectedWallet.id : undefined);
    }
  }, [activeTab, selectedWallet]);

  // Open Top-up Modal
  const handleOpenTopup = (w: WalletItem) => {
    setSelectedWallet(w);
    setTopupAmount('');
    setTopupPaymentMethod('BANK_TRANSFER');
    setTopupReference('');
    setTopupRemarks('');
    setError(null);
    setTopupModalOpen(true);
  };

  // Open Credit Modal
  const handleOpenCredit = (w: WalletItem) => {
    setSelectedWallet(w);
    setCreditEnabled(w.credit_enabled ?? false);
    setCreditLimit(String(w.credit_limit || 0));
    setCreditStartDate('');
    setCreditExpiryDate(w.credit_expiry ? new Date(w.credit_expiry).toISOString().slice(0, 10) : '');
    setCreditStatus((w.credit_status as any) || 'ACTIVE');
    setCreditNotes('');
    setError(null);
    setCreditModalOpen(true);
  };

  // Open Adjust Modal
  const handleOpenAdjust = (w: WalletItem) => {
    setSelectedWallet(w);
    setAdjustAmount('');
    setAdjustDirection('credit');
    setAdjustReason('');
    setError(null);
    setAdjustModalOpen(true);
  };

  // Execute Top-up (Super Admin Only)
  const handleExecuteTopup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedWallet) return;
    const amt = Number(topupAmount);
    if (!amt || amt <= 0) {
      setError('Top-up amount must be strictly greater than 0');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      const res = await fetch(`/api/wallets/${selectedWallet.id}/topup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: amt,
          paymentMethod: topupPaymentMethod,
          paymentReference: topupReference.trim() || undefined,
          remarks: topupRemarks.trim() || 'Super Admin Top-up',
          idempotencyKey: `topup-${selectedWallet.id}-${Date.now()}`,
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || 'Failed to top-up wallet');
      }

      setTopupModalOpen(false);
      fetchData();
      if (activeTab === 'ledger') fetchLedger();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Update Credit Account
  const handleSaveCredit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedWallet) return;

    try {
      setSubmitting(true);
      setError(null);
      const res = await fetch(`/api/wallets/${selectedWallet.id}/credit`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          creditEnabled,
          creditLimit: Number(creditLimit) || 0,
          startDate: creditStartDate || null,
          expiryDate: creditExpiryDate || null,
          status: creditStatus,
          notes: creditNotes.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || 'Failed to update credit');
      }

      setCreditModalOpen(false);
      fetchData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Execute Adjustment
  const handleExecuteAdjust = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedWallet) return;
    const amt = Number(adjustAmount);
    if (!amt || amt <= 0) {
      setError('Adjustment amount must be positive');
      return;
    }
    if (!adjustReason.trim()) {
      setError('Audit reason is mandatory for manual balance adjustment');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      const res = await fetch(`/api/wallets/${selectedWallet.id}/adjust`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: amt,
          direction: adjustDirection,
          reason: adjustReason.trim(),
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || 'Adjustment failed');
      }

      setAdjustModalOpen(false);
      fetchData();
      if (activeTab === 'ledger') fetchLedger();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const filteredWallets = wallets.filter((w) => {
    const matchesEntity = entityFilter === 'all' || w.entity_type === entityFilter;
    const matchesSearch =
      w.wallet_number.toLowerCase().includes(search.toLowerCase()) ||
      (w.entity_name && w.entity_name.toLowerCase().includes(search.toLowerCase())) ||
      (w.entity_code && w.entity_code.toLowerCase().includes(search.toLowerCase()));
    return matchesEntity && matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-bold text-foreground flex items-center gap-2">
            <Wallet className="w-5 h-5 text-purple-400" />
            Wallet & Credit Management
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Immutable balance ledger, Super Admin cash top-ups, and pre-approved credit lines
          </p>
        </div>

        <div className="flex items-center gap-2">
          <a
            href="/api/reports/wallet/export"
            download
            className="px-3 py-2 rounded-xl border border-border hover:bg-muted text-xs font-semibold text-foreground transition-colors flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Ledger CSV</span>
          </a>
        </div>
      </div>

      {error && (
        <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          <span>{error}</span>
        </div>
      )}

      {/* 7 Clickable Wallet Dashboard Metrics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        <div className="p-3.5 rounded-2xl bg-card border border-border">
          <span className="text-[10px] text-muted-foreground font-semibold uppercase block">Total Balance</span>
          <div className="text-base font-black text-purple-400 mt-1 font-mono">
            Rs. {(metrics?.totalWalletBalance || 0).toLocaleString()}
          </div>
          <span className="text-[10px] text-muted-foreground">Prepaid Float</span>
        </div>

        <div className="p-3.5 rounded-2xl bg-card border border-border">
          <span className="text-[10px] text-muted-foreground font-semibold uppercase block">Credit Limit</span>
          <div className="text-base font-black text-indigo-400 mt-1 font-mono">
            Rs. {(metrics?.totalCreditLimit || 0).toLocaleString()}
          </div>
          <span className="text-[10px] text-muted-foreground">Authorized Lines</span>
        </div>

        <div className="p-3.5 rounded-2xl bg-card border border-border">
          <span className="text-[10px] text-muted-foreground font-semibold uppercase block">Used Credit</span>
          <div className="text-base font-black text-amber-400 mt-1 font-mono">
            Rs. {(metrics?.usedCredit || 0).toLocaleString()}
          </div>
          <span className="text-[10px] text-muted-foreground">Outstanding</span>
        </div>

        <div className="p-3.5 rounded-2xl bg-card border border-border">
          <span className="text-[10px] text-muted-foreground font-semibold uppercase block">Available Credit</span>
          <div className="text-base font-black text-emerald-400 mt-1 font-mono">
            Rs. {(metrics?.availableCredit || 0).toLocaleString()}
          </div>
          <span className="text-[10px] text-emerald-400 font-semibold">Ready to Use</span>
        </div>

        <div className="p-3.5 rounded-2xl bg-card border border-border">
          <span className="text-[10px] text-muted-foreground font-semibold uppercase block">Today's Top-ups</span>
          <div className="text-base font-black text-teal-400 mt-1 font-mono">
            Rs. {(metrics?.todayTopups || 0).toLocaleString()}
          </div>
          <span className="text-[10px] text-teal-400 font-semibold">Credited Today</span>
        </div>

        <div className="p-3.5 rounded-2xl bg-card border border-border">
          <span className="text-[10px] text-muted-foreground font-semibold uppercase block">Today's Debits</span>
          <div className="text-base font-black text-rose-400 mt-1 font-mono">
            Rs. {(metrics?.todayDebits || 0).toLocaleString()}
          </div>
          <span className="text-[10px] text-rose-400 font-semibold">Spent Today</span>
        </div>

        <div className="p-3.5 rounded-2xl bg-card border border-border">
          <span className="text-[10px] text-muted-foreground font-semibold uppercase block">Monthly Usage</span>
          <div className="text-base font-black text-foreground mt-1 font-mono">
            Rs. {(metrics?.monthlyWalletUsage || 0).toLocaleString()}
          </div>
          <span className="text-[10px] text-muted-foreground">MTD Debited</span>
        </div>
      </div>

      {/* Tabs and Filters */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2 p-1 rounded-xl bg-card border border-border self-start">
          <button
            onClick={() => setActiveTab('wallets')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'wallets'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Entity Wallets ({wallets.length})
          </button>
          <button
            onClick={() => setActiveTab('ledger')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'ledger'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Transaction Ledger
          </button>
        </div>

        {activeTab === 'wallets' && (
          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search wallet, code, entity..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-background border border-border rounded-xl pl-9 pr-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <select
              value={entityFilter}
              onChange={(e) => setEntityFilter(e.target.value as any)}
              className="bg-background border border-border rounded-xl px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="all">All Channels</option>
              <option value="branch">Branches Only</option>
              <option value="reseller">Resellers Only</option>
            </select>
          </div>
        )}
      </div>

      {/* TAB 1: Wallets Table */}
      {activeTab === 'wallets' && (
        <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-muted/40 text-muted-foreground font-semibold border-b border-border">
                <tr>
                  <th className="py-3 px-4">Wallet ID</th>
                  <th className="py-3 px-4">Entity / Channel</th>
                  <th className="py-3 px-4">Prepaid Balance</th>
                  <th className="py-3 px-4">Credit Line</th>
                  <th className="py-3 px-4">Purchasing Capacity</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Super Admin Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-muted-foreground animate-pulse">
                      Loading wallets...
                    </td>
                  </tr>
                ) : filteredWallets.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-muted-foreground">
                      No wallets found matching your filter.
                    </td>
                  </tr>
                ) : (
                  filteredWallets.map((w) => (
                    <tr key={w.id} className="hover:bg-muted/30 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-foreground">
                        {w.wallet_number}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-foreground flex items-center gap-1.5">
                          {w.entity_type === 'branch' ? (
                            <Building2 className="w-3.5 h-3.5 text-blue-400" />
                          ) : (
                            <Store className="w-3.5 h-3.5 text-amber-400" />
                          )}
                          <span>{w.entity_name}</span>
                          <span className="text-[10px] font-mono px-1 py-0.2 rounded bg-muted text-muted-foreground">
                            {w.entity_code}
                          </span>
                        </div>
                        <div className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
                          {w.entity_type} Channel
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-purple-400 font-mono text-sm">
                          Rs. {w.balance.toLocaleString()}
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                          Top-up: Rs. {w.total_topup.toLocaleString()}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        {w.credit_enabled ? (
                          <div>
                            <div className="font-bold text-indigo-400 font-mono">
                              Limit: Rs. {(w.credit_limit || 0).toLocaleString()}
                            </div>
                            <div className="text-[10px] text-amber-400 font-mono">
                              Used: Rs. {(w.used_credit || 0).toLocaleString()} (Rem: Rs. {(w.remaining_credit || 0).toLocaleString()})
                            </div>
                          </div>
                        ) : (
                          <span className="text-muted-foreground italic">Credit Disabled</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-emerald-400 font-mono text-sm">
                          Rs. {(w.total_available || 0).toLocaleString()}
                        </div>
                        <div className="text-[10px] text-muted-foreground">Cash + Avail Credit</div>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            w.status === 'ACTIVE'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                          }`}
                        >
                          {w.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Super Admin Top-up */}
                          <button
                            onClick={() => handleOpenTopup(w)}
                            className="px-2.5 py-1 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 text-[11px] font-semibold transition-colors flex items-center gap-1 shadow-sm"
                            title="Super Admin Top-up"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Top Up</span>
                          </button>

                          {/* Credit Control */}
                          <button
                            onClick={() => handleOpenCredit(w)}
                            className="p-1 rounded-lg border border-border hover:bg-muted text-muted-foreground hover:text-foreground"
                            title="Configure Credit Facility"
                          >
                            <CreditCard className="w-3.5 h-3.5 text-indigo-400" />
                          </button>

                          {/* Manual Adjust */}
                          <button
                            onClick={() => handleOpenAdjust(w)}
                            className="p-1 rounded-lg border border-border hover:bg-muted text-muted-foreground hover:text-foreground"
                            title="Manual Balance Adjustment"
                          >
                            <Sliders className="w-3.5 h-3.5 text-amber-400" />
                          </button>

                          {/* View Ledger */}
                          <button
                            onClick={() => {
                              setSelectedWallet(w);
                              setActiveTab('ledger');
                            }}
                            className="p-1 rounded-lg border border-border hover:bg-muted text-muted-foreground hover:text-foreground"
                            title="View Wallet Ledger"
                          >
                            <FileText className="w-3.5 h-3.5 text-blue-400" />
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
      )}

      {/* TAB 2: Immutable Transaction Ledger */}
      {activeTab === 'ledger' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Ledger Filter:</span>
              {selectedWallet ? (
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-primary/10 border border-primary/20 text-primary text-xs font-semibold">
                  <span>Wallet: {selectedWallet.wallet_number} ({selectedWallet.entity_name})</span>
                  <button onClick={() => setSelectedWallet(null)} className="hover:opacity-75">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <span className="text-xs font-semibold text-foreground">All Channels Ledger ({ledgerTotal})</span>
              )}
            </div>

            <button
              onClick={() => fetchLedger(selectedWallet ? selectedWallet.id : undefined)}
              className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg border border-border hover:bg-muted"
              title="Refresh Ledger"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${ledgerLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-muted/40 text-muted-foreground font-semibold border-b border-border">
                  <tr>
                    <th className="py-3 px-4">Date / Time</th>
                    <th className="py-3 px-4">Transaction ID</th>
                    <th className="py-3 px-4">Wallet</th>
                    <th className="py-3 px-4">Type</th>
                    <th className="py-3 px-4">Amount</th>
                    <th className="py-3 px-4">Balance Before → After</th>
                    <th className="py-3 px-4">Reference & Reason</th>
                    <th className="py-3 px-4">Operator</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {ledgerLoading ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-muted-foreground animate-pulse">
                        Loading transaction ledger...
                      </td>
                    </tr>
                  ) : ledger.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-muted-foreground">
                        No transactions recorded in this ledger.
                      </td>
                    </tr>
                  ) : (
                    ledger.map((tx) => (
                      <tr key={tx.id} className="hover:bg-muted/30 transition-colors">
                        <td className="py-3 px-4 text-muted-foreground whitespace-nowrap">
                          {new Date(tx.created_at).toLocaleString([], {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </td>
                        <td className="py-3 px-4 font-mono font-semibold text-foreground">
                          {tx.transaction_id}
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-semibold text-foreground">{tx.wallet_number}</div>
                          <div className="text-[10px] text-muted-foreground">{tx.entity_name}</div>
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              tx.type === 'TOP_UP'
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                : tx.type === 'DEBIT'
                                ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                                : tx.type === 'REFUND'
                                ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'
                                : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                            }`}
                          >
                            {tx.type}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-mono font-bold">
                          <span className={tx.type === 'DEBIT' ? 'text-rose-400' : 'text-emerald-400'}>
                            {tx.type === 'DEBIT' ? '-' : '+'} Rs. {tx.amount.toLocaleString()}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-mono text-[11px]">
                          <span className="text-muted-foreground">Rs. {tx.balance_before.toLocaleString()}</span>
                          <span className="mx-1 text-muted-foreground">→</span>
                          <span className="text-foreground font-semibold">Rs. {tx.balance_after.toLocaleString()}</span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-medium text-foreground">{tx.reference || '—'}</div>
                          <div className="text-[10px] text-muted-foreground italic truncate max-w-xs">{tx.reason}</div>
                        </td>
                        <td className="py-3 px-4 font-mono text-muted-foreground">
                          {tx.created_by}
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

      {/* MODAL 1: Super Admin Wallet Top-up */}
      {topupModalOpen && selectedWallet && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-card border border-border rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="p-5 border-b border-border flex items-center justify-between bg-muted/30">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-primary/10 text-primary">
                  <Plus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground">Super Admin Wallet Top-Up</h3>
                  <p className="text-[11px] text-muted-foreground font-mono">
                    {selectedWallet.wallet_number} • {selectedWallet.entity_name}
                  </p>
                </div>
              </div>
              <button onClick={() => setTopupModalOpen(false)} className="p-1.5 text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleExecuteTopup} className="p-5 space-y-4">
              <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-between text-xs">
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase font-bold block">Current Balance</span>
                  <span className="font-mono font-bold text-purple-400 text-sm">
                    Rs. {selectedWallet.balance.toLocaleString()}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-muted-foreground uppercase font-bold block">New Balance</span>
                  <span className="font-mono font-bold text-emerald-400 text-sm">
                    Rs. {(selectedWallet.balance + (Number(topupAmount) || 0)).toLocaleString()}
                  </span>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">
                  Top-up Amount (NPR) *
                </label>
                <input
                  type="number"
                  min="1"
                  step="any"
                  value={topupAmount}
                  onChange={(e) => setTopupAmount(e.target.value)}
                  required
                  placeholder="e.g. 50000"
                  className="w-full bg-background border border-border rounded-xl px-3.5 py-2 text-sm font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">
                  Payment Method *
                </label>
                <select
                  value={topupPaymentMethod}
                  onChange={(e) => setTopupPaymentMethod(e.target.value)}
                  className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="BANK_TRANSFER">Bank Wire / Deposit</option>
                  <option value="CASH">Physical Cash at NOC / HQ</option>
                  <option value="QR">Fonepay / QR Instant Transfer</option>
                  <option value="ONLINE_PAYMENT">eSewa / Khalti Digital Wallet</option>
                  <option value="CHEQUE">Bank Cheque / Draft</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">
                  Bank / Voucher Reference
                </label>
                <input
                  type="text"
                  value={topupReference}
                  onChange={(e) => setTopupReference(e.target.value)}
                  placeholder="e.g. TXN-NABIL-998812"
                  className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs text-foreground font-mono focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">
                  Super Admin Audit Remarks
                </label>
                <input
                  type="text"
                  value={topupRemarks}
                  onChange={(e) => setTopupRemarks(e.target.value)}
                  placeholder="e.g. Approved monthly wholesale replenishment"
                  className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-border">
                <button
                  type="button"
                  onClick={() => setTopupModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-border hover:bg-muted text-xs font-semibold text-foreground transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold shadow-md shadow-primary/20 hover:opacity-90 disabled:opacity-50 transition-opacity"
                >
                  {submitting ? 'Crediting...' : 'Confirm Super Admin Top-Up'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Credit Facility Configuration */}
      {creditModalOpen && selectedWallet && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-card border border-border rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="p-5 border-b border-border flex items-center justify-between bg-muted/30">
              <div className="flex items-center gap-2.5">
                <CreditCard className="w-5 h-5 text-indigo-400" />
                <div>
                  <h3 className="text-sm font-bold text-foreground">Configure Credit Facility</h3>
                  <p className="text-[11px] text-muted-foreground font-mono">
                    {selectedWallet.wallet_number}
                  </p>
                </div>
              </div>
              <button onClick={() => setCreditModalOpen(false)} className="p-1.5 text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveCredit} className="p-5 space-y-4">
              <div className="flex items-center justify-between p-3 rounded-xl border border-border bg-card">
                <div>
                  <span className="text-xs font-bold text-foreground block">Enable Credit Limit</span>
                  <span className="text-[10px] text-muted-foreground">Allow purchasing past cash balance</span>
                </div>
                <input
                  type="checkbox"
                  checked={creditEnabled}
                  onChange={(e) => setCreditEnabled(e.target.checked)}
                  className="w-4 h-4 rounded text-primary focus:ring-primary"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">
                  Credit Limit (NPR) *
                </label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={creditLimit}
                  onChange={(e) => setCreditLimit(e.target.value)}
                  required
                  placeholder="e.g. 50000"
                  className="w-full bg-background border border-border rounded-xl px-3.5 py-2 text-sm font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground block mb-1">Credit Status</label>
                  <select
                    value={creditStatus}
                    onChange={(e) => setCreditStatus(e.target.value as any)}
                    className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="SUSPENDED">SUSPENDED</option>
                    <option value="EXPIRED">EXPIRED</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground block mb-1">Expiry Date</label>
                  <input
                    type="date"
                    value={creditExpiryDate}
                    onChange={(e) => setCreditExpiryDate(e.target.value)}
                    className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">Notes</label>
                <textarea
                  value={creditNotes}
                  onChange={(e) => setCreditNotes(e.target.value)}
                  rows={2}
                  placeholder="Terms, authorized guarantor, or limit reason..."
                  className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-border">
                <button
                  type="button"
                  onClick={() => setCreditModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-border hover:bg-muted text-xs font-semibold text-foreground transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold shadow-md shadow-primary/20 hover:opacity-90 disabled:opacity-50 transition-opacity"
                >
                  {submitting ? 'Saving...' : 'Save Credit Terms'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: Manual Adjustment */}
      {adjustModalOpen && selectedWallet && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-card border border-border rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="p-5 border-b border-border flex items-center justify-between bg-muted/30">
              <div className="flex items-center gap-2.5">
                <Sliders className="w-5 h-5 text-amber-400" />
                <div>
                  <h3 className="text-sm font-bold text-foreground">Manual Balance Adjustment</h3>
                  <p className="text-[11px] text-muted-foreground font-mono">
                    {selectedWallet.wallet_number}
                  </p>
                </div>
              </div>
              <button onClick={() => setAdjustModalOpen(false)} className="p-1.5 text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleExecuteAdjust} className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setAdjustDirection('credit')}
                  className={`p-2.5 rounded-xl border text-center text-xs font-semibold transition-all ${
                    adjustDirection === 'credit'
                      ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400 font-bold'
                      : 'border-border text-muted-foreground hover:bg-muted'
                  }`}
                >
                  + Add Credit
                </button>
                <button
                  type="button"
                  onClick={() => setAdjustDirection('debit')}
                  className={`p-2.5 rounded-xl border text-center text-xs font-semibold transition-all ${
                    adjustDirection === 'debit'
                      ? 'border-rose-500 bg-rose-500/10 text-rose-400 font-bold'
                      : 'border-border text-muted-foreground hover:bg-muted'
                  }`}
                >
                  - Deduct Debit
                </button>
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">
                  Adjustment Amount (NPR) *
                </label>
                <input
                  type="number"
                  min="0.01"
                  step="any"
                  value={adjustAmount}
                  onChange={(e) => setAdjustAmount(e.target.value)}
                  required
                  placeholder="e.g. 1500"
                  className="w-full bg-background border border-border rounded-xl px-3.5 py-2 text-sm font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">
                  Audit Reason for Reconciliation *
                </label>
                <textarea
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  required
                  rows={2}
                  placeholder="e.g. Discrepancy correction following bank audit report"
                  className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-border">
                <button
                  type="button"
                  onClick={() => setAdjustModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-border hover:bg-muted text-xs font-semibold text-foreground transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold shadow-md shadow-primary/20 hover:opacity-90 disabled:opacity-50 transition-opacity"
                >
                  {submitting ? 'Applying...' : 'Apply Adjustment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
