'use client';

import React from 'react';
import {
  Wallet,
  DollarSign,
  ShieldAlert,
  Percent,
  Plus,
  ArrowLeft,
  Users,
  CreditCard,
  History,
  FileText,
  FileBarChart,
  RotateCcw,
  RefreshCw,
  Search,
  Filter,
  Download,
  AlertCircle,
  CheckCircle2,
  Phone,
  Mail,
  MapPin,
  Calendar,
  Layers,
  Sparkles,
  ChevronRight,
  TrendingUp,
  Clock,
  ShieldCheck,
  Building2,
  ExternalLink,
  Edit2,
  Zap,
} from 'lucide-react';
import type {
  ResellerItem,
  ResellerProfileDashboardData,
  ResellerWalletTxRow,
  ResellerCommissionHistoryItem,
  PackageItem,
} from '@/types/api';
import { ResellerTopupModal } from './reseller-topup-modal';

interface ResellerProfileViewProps {
  resellerId: number;
  onBack?: () => void;
  currentUser?: any;
  onOpenSubscriber?: (subscriberId: number) => void;
}

export function ResellerProfileView({
  resellerId,
  onBack,
  currentUser,
  onOpenSubscriber,
}: ResellerProfileViewProps) {
  const [data, setData] = React.useState<ResellerProfileDashboardData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // Active Tab: overview | customers | wallet | topups | transactions | credit | commission | recharge_history | reports | activity
  const [activeTab, setActiveTab] = React.useState<string>('overview');

  // Modals state
  const [topupModalOpen, setTopupModalOpen] = React.useState(false);
  const [rechargeModalOpen, setRechargeModalOpen] = React.useState(false);
  const [commissionModalOpen, setCommissionModalOpen] = React.useState(false);
  const [creditModalOpen, setCreditModalOpen] = React.useState(false);
  const [reversalModalOpen, setReversalModalOpen] = React.useState(false);
  const [selectedTxForReversal, setSelectedTxForReversal] = React.useState<ResellerWalletTxRow | null>(null);

  // Sub-data for tabs
  const [customers, setCustomers] = React.useState<any[]>([]);
  const [customersLoading, setCustomersLoading] = React.useState(false);
  const [customerSearch, setCustomerSearch] = React.useState('');

  const [transactions, setTransactions] = React.useState<ResellerWalletTxRow[]>([]);
  const [transactionsLoading, setTransactionsLoading] = React.useState(false);
  const [txTypeFilter, setTxTypeFilter] = React.useState<string>('ALL');
  const [txSearch, setTxSearch] = React.useState('');

  const [commissionHistory, setCommissionHistory] = React.useState<ResellerCommissionHistoryItem[]>([]);
  const [packages, setPackages] = React.useState<PackageItem[]>([]);

  // Period for reports tab
  const [reportPeriod, setReportPeriod] = React.useState<string>('this_month');
  const [reportData, setReportData] = React.useState<any | null>(null);
  const [reportLoading, setReportLoading] = React.useState(false);

  // Form states for modals
  const [newCommissionPercent, setNewCommissionPercent] = React.useState('');
  const [commissionReason, setCommissionReason] = React.useState('');
  const [commissionSubmitting, setCommissionSubmitting] = React.useState(false);

  const [newCreditLimit, setNewCreditLimit] = React.useState('');
  const [newCreditStatus, setNewCreditStatus] = React.useState<'ACTIVE' | 'SUSPENDED' | 'EXPIRED'>('ACTIVE');
  const [creditNotes, setCreditNotes] = React.useState('');
  const [creditSubmitting, setCreditSubmitting] = React.useState(false);

  const [reversalReason, setReversalReason] = React.useState('');
  const [reversalSubmitting, setReversalSubmitting] = React.useState(false);

  // Customer recharge form state
  const [rechargeSubId, setRechargeSubId] = React.useState<number | ''>('');
  const [rechargePkgId, setRechargePkgId] = React.useState<number | ''>('');
  const [rechargeDuration, setRechargeDuration] = React.useState(1);
  const [rechargeRemarks, setRechargeRemarks] = React.useState('');
  const [rechargeSubmitting, setRechargeSubmitting] = React.useState(false);
  const [rechargeError, setRechargeError] = React.useState<string | null>(null);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/resellers/${resellerId}/profile`);
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error?.message || json.message || 'Failed to load reseller profile');
      }
      const json = await res.json();
      setData(json.data);
    } catch (err: any) {
      setError(err.message || 'Error loading reseller profile');
    } finally {
      setLoading(false);
    }
  };

  const fetchCustomers = async () => {
    try {
      setCustomersLoading(true);
      const res = await fetch(`/api/resellers/${resellerId}/customers?search=${encodeURIComponent(customerSearch)}`);
      if (res.ok) {
        const json = await res.json();
        setCustomers(json.data || []);
      }
    } catch {} finally {
      setCustomersLoading(false);
    }
  };

  const fetchTransactions = async () => {
    try {
      setTransactionsLoading(true);
      const typeParam = txTypeFilter !== 'ALL' ? `&type=${txTypeFilter}` : '';
      const searchParam = txSearch ? `&search=${encodeURIComponent(txSearch)}` : '';
      const res = await fetch(`/api/resellers/${resellerId}/transactions?limit=100${typeParam}${searchParam}`);
      if (res.ok) {
        const json = await res.json();
        setTransactions(json.data?.transactions || []);
      }
    } catch {} finally {
      setTransactionsLoading(false);
    }
  };

  const fetchCommissionHistory = async () => {
    try {
      const res = await fetch(`/api/resellers/${resellerId}/commission-history`);
      if (res.ok) {
        const json = await res.json();
        setCommissionHistory(json.data || []);
      }
    } catch {}
  };

  const fetchPackages = async () => {
    try {
      const res = await fetch('/api/packages');
      if (res.ok) {
        const json = await res.json();
        setPackages(json.data || []);
      }
    } catch {}
  };

  const fetchReports = async () => {
    try {
      setReportLoading(true);
      const res = await fetch(`/api/resellers/${resellerId}/reports?period=${reportPeriod}`);
      if (res.ok) {
        const json = await res.json();
        setReportData(json.data);
      }
    } catch {} finally {
      setReportLoading(false);
    }
  };

  React.useEffect(() => {
    fetchProfile();
    fetchPackages();
  }, [resellerId]);

  React.useEffect(() => {
    if (activeTab === 'customers') fetchCustomers();
    if (activeTab === 'wallet' || activeTab === 'topups' || activeTab === 'transactions' || activeTab === 'recharge_history') {
      fetchTransactions();
    }
    if (activeTab === 'commission') fetchCommissionHistory();
    if (activeTab === 'reports') fetchReports();
  }, [activeTab, resellerId]);

  const handleUpdateCommission = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setCommissionSubmitting(true);
      const res = await fetch(`/api/resellers/${resellerId}/commission`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          commission_percent: parseFloat(newCommissionPercent),
          reason: commissionReason,
        }),
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error?.message || 'Failed to update commission');
      }
      setCommissionModalOpen(false);
      setNewCommissionPercent('');
      setCommissionReason('');
      fetchProfile();
      fetchCommissionHistory();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setCommissionSubmitting(false);
    }
  };

  const handleUpdateCredit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setCreditSubmitting(true);
      const res = await fetch(`/api/resellers/${resellerId}/credit`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          credit_limit: parseFloat(newCreditLimit),
          credit_status: newCreditStatus,
          notes: creditNotes,
        }),
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error?.message || 'Failed to update credit');
      }
      setCreditModalOpen(false);
      fetchProfile();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setCreditSubmitting(false);
    }
  };

  const handleReversalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTxForReversal) return;
    try {
      setReversalSubmitting(true);
      const res = await fetch(`/api/resellers/${resellerId}/reversal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transaction_id: selectedTxForReversal.transaction_id,
          reason: reversalReason,
        }),
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error?.message || 'Failed to reverse transaction');
      }
      setReversalModalOpen(false);
      setSelectedTxForReversal(null);
      setReversalReason('');
      fetchProfile();
      fetchTransactions();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setReversalSubmitting(false);
    }
  };

  const handleCustomerRechargeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rechargeSubId || !rechargePkgId) {
      setRechargeError('Please select both a customer and a package.');
      return;
    }
    try {
      setRechargeSubmitting(true);
      setRechargeError(null);
      const res = await fetch(`/api/resellers/${resellerId}/customer-recharge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscriber_id: Number(rechargeSubId),
          package_id: Number(rechargePkgId),
          duration_months: rechargeDuration,
          remarks: rechargeRemarks.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error?.message || json.message || 'Customer recharge failed');
      }
      setRechargeModalOpen(false);
      setRechargeSubId('');
      setRechargePkgId('');
      setRechargeRemarks('');
      fetchProfile();
      fetchCustomers();
      fetchTransactions();
    } catch (err: any) {
      setRechargeError(err.message);
    } finally {
      setRechargeSubmitting(false);
    }
  };

  const handleExportCsv = () => {
    window.open(`/api/resellers/${resellerId}/transactions/export`, '_blank');
  };

  if (loading && !data) {
    return (
      <div className="p-8 flex flex-col items-center justify-center min-h-[500px] space-y-4">
        <div className="w-10 h-10 border-4 border-purple-500/20 border-t-purple-500 rounded-full animate-spin" />
        <p className="text-sm font-medium text-muted-foreground">Loading Reseller Profile...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-8 max-w-xl mx-auto my-12 bg-card border border-border rounded-2xl text-center space-y-4 shadow-xl">
        <div className="w-12 h-12 rounded-full bg-red-500/10 text-red-400 flex items-center justify-center mx-auto">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h3 className="text-lg font-bold text-foreground">Reseller Profile Error</h3>
        <p className="text-xs text-muted-foreground">{error || 'Reseller data not found'}</p>
        <button
          onClick={onBack || fetchProfile}
          className="px-4 py-2 bg-muted hover:bg-muted/80 text-foreground text-xs font-semibold rounded-xl transition-all"
        >
          {onBack ? 'Go Back' : 'Retry'}
        </button>
      </div>
    );
  }

  const { reseller, cards } = data;

  // Selected package details for modal preview
  const selectedPkg = packages.find((p) => p.id === Number(rechargePkgId));
  const rechargeCost = selectedPkg ? Number(selectedPkg.price) * rechargeDuration : 0;
  const isInsufficientRechargeBalance = rechargeCost > cards.currentBalance;

  return (
    <div className="space-y-6 pb-16 animate-in fade-in duration-200">
      {/* 1. PROFILE HEADER */}
      <div className="bg-card border border-border rounded-2xl p-6 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl -z-10 pointer-events-none" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-3">
            <div className="flex items-center gap-3 flex-wrap">
              {onBack && (
                <button
                  onClick={onBack}
                  className="w-8 h-8 rounded-xl bg-muted/60 hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-all"
                  title="Back to Resellers List"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
              )}
              <h1 className="text-2xl font-black tracking-tight text-foreground flex items-center gap-2.5">
                {reseller.name}
              </h1>
              <span className="text-xs font-mono font-bold uppercase tracking-wider bg-purple-500/10 text-purple-400 border border-purple-500/20 px-2.5 py-0.5 rounded-full">
                {reseller.code}
              </span>
              <span
                className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                  reseller.status === 'ACTIVE'
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                    : reseller.status === 'SUSPENDED'
                    ? 'bg-red-500/10 text-red-400 border-red-500/20'
                    : 'bg-muted text-muted-foreground border-border'
                }`}
              >
                {reseller.status}
              </span>
            </div>

            {/* Reseller Info Meta */}
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
              {reseller.branch_name && (
                <div className="flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-purple-400" />
                  <span>Branch: {reseller.branch_name}</span>
                </div>
              )}
              {reseller.phone && (
                <div className="flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-purple-400" />
                  <span>{reseller.phone}</span>
                </div>
              )}
              {reseller.email && (
                <div className="flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-purple-400" />
                  <span>{reseller.email}</span>
                </div>
              )}
              {reseller.address && (
                <div className="flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-purple-400" />
                  <span>{reseller.address}</span>
                </div>
              )}
              <div className="flex items-center gap-1.5">
                <Percent className="w-3.5 h-3.5 text-purple-400" />
                <span className="font-bold text-foreground">
                  Commission: {reseller.commission_percent.toFixed(2)}%
                </span>
              </div>
            </div>
          </div>

          {/* Action Buttons with Primary "+ Add Balance / Top-Up" */}
          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={() => {
                setRechargeSubId('');
                setRechargePkgId('');
                setRechargeError(null);
                setRechargeModalOpen(true);
              }}
              className="px-4 py-2.5 rounded-xl border border-purple-500/30 bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 font-bold text-xs transition-all flex items-center gap-2"
            >
              <Zap className="w-4 h-4 text-purple-400" />
              <span>Recharge Customer</span>
            </button>

            {/* MANDATORY PROMINENT BUTTON: + Add Balance / Top-Up */}
            <button
              onClick={() => setTopupModalOpen(true)}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs transition-all shadow-lg shadow-purple-500/25 flex items-center gap-2.5 border border-purple-400/30 active:scale-95"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span className="tracking-wide uppercase font-extrabold">+ ADD BALANCE / TOP-UP</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. TEN CLICKABLE DASHBOARD CARDS (Section 4) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        {/* Card 1: Current Balance */}
        <button
          onClick={() => setActiveTab('wallet')}
          className="p-4 rounded-2xl bg-card border border-border hover:border-purple-500/50 hover:bg-purple-500/5 transition-all text-left flex flex-col justify-between group shadow-sm"
        >
          <div className="flex items-center justify-between w-full mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground group-hover:text-purple-400">
              Current Balance
            </span>
            <Wallet className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-xl font-black text-foreground">
            Rs. {cards.currentBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
          <span className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
            Wallet Value <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
          </span>
        </button>

        {/* Card 2: Total Cash Top-Up */}
        <button
          onClick={() => {
            setTxTypeFilter('RESELLER_TOPUP_CASH');
            setActiveTab('topups');
          }}
          className="p-4 rounded-2xl bg-card border border-border hover:border-emerald-500/50 hover:bg-emerald-500/5 transition-all text-left flex flex-col justify-between group shadow-sm"
        >
          <div className="flex items-center justify-between w-full mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground group-hover:text-emerald-400">
              Total Cash Top-Up
            </span>
            <DollarSign className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-xl font-black text-emerald-400">
            Rs. {cards.totalCashTopup.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
          <span className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
            Actual Cash Paid <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
          </span>
        </button>

        {/* Card 3: Total Credit Top-Up */}
        <button
          onClick={() => {
            setTxTypeFilter('RESELLER_TOPUP_CREDIT');
            setActiveTab('topups');
          }}
          className="p-4 rounded-2xl bg-card border border-border hover:border-amber-500/50 hover:bg-amber-500/5 transition-all text-left flex flex-col justify-between group shadow-sm"
        >
          <div className="flex items-center justify-between w-full mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground group-hover:text-amber-400">
              Total Credit Top-Up
            </span>
            <ShieldAlert className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-xl font-black text-amber-400">
            Rs. {cards.totalCreditTopup.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
          <span className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
            Credit Value Granted <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
          </span>
        </button>

        {/* Card 4: Total Commission Granted */}
        <button
          onClick={() => setActiveTab('commission')}
          className="p-4 rounded-2xl bg-card border border-border hover:border-purple-500/50 hover:bg-purple-500/5 transition-all text-left flex flex-col justify-between group shadow-sm"
        >
          <div className="flex items-center justify-between w-full mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground group-hover:text-purple-400">
              Commission Granted
            </span>
            <Percent className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-xl font-black text-purple-400">
            Rs. {cards.totalCommissionGranted.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
          <span className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
            Top-up Commission <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
          </span>
        </button>

        {/* Card 5: Total Wallet Value Received */}
        <button
          onClick={() => setActiveTab('wallet')}
          className="p-4 rounded-2xl bg-card border border-border hover:border-indigo-500/50 hover:bg-indigo-500/5 transition-all text-left flex flex-col justify-between group shadow-sm"
        >
          <div className="flex items-center justify-between w-full mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground group-hover:text-indigo-400">
              Total Value Received
            </span>
            <Layers className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-xl font-black text-foreground">
            Rs. {cards.totalWalletValueReceived.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
          <span className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
            Wallet Credit Sum <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
          </span>
        </button>

        {/* Card 6: Total Customer Recharge */}
        <button
          onClick={() => setActiveTab('recharge_history')}
          className="p-4 rounded-2xl bg-card border border-border hover:border-blue-500/50 hover:bg-blue-500/5 transition-all text-left flex flex-col justify-between group shadow-sm"
        >
          <div className="flex items-center justify-between w-full mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground group-hover:text-blue-400">
              Customer Recharge
            </span>
            <CreditCard className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-xl font-black text-blue-400">
            Rs. {cards.totalCustomerRecharge.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
          <span className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
            Total Selling Debits <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
          </span>
        </button>

        {/* Card 7: Total Credit Used */}
        <button
          onClick={() => setActiveTab('credit')}
          className="p-4 rounded-2xl bg-card border border-border hover:border-rose-500/50 hover:bg-rose-500/5 transition-all text-left flex flex-col justify-between group shadow-sm"
        >
          <div className="flex items-center justify-between w-full mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground group-hover:text-rose-400">
              Credit Used
            </span>
            <ShieldAlert className="w-4 h-4 text-rose-400" />
          </div>
          <div className="text-xl font-black text-rose-400">
            Rs. {cards.totalCreditUsed.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
          <span className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
            Consumed Credit <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
          </span>
        </button>

        {/* Card 8: Credit Remaining */}
        <button
          onClick={() => setActiveTab('credit')}
          className="p-4 rounded-2xl bg-card border border-border hover:border-cyan-500/50 hover:bg-cyan-500/5 transition-all text-left flex flex-col justify-between group shadow-sm"
        >
          <div className="flex items-center justify-between w-full mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground group-hover:text-cyan-400">
              Credit Remaining
            </span>
            <ShieldCheck className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-xl font-black text-cyan-400">
            Rs. {cards.creditRemaining.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
          <span className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
            Limit: Rs. {reseller.credit_limit.toLocaleString()} <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
          </span>
        </button>

        {/* Card 9: Total Customers */}
        <button
          onClick={() => setActiveTab('customers')}
          className="p-4 rounded-2xl bg-card border border-border hover:border-purple-500/50 hover:bg-purple-500/5 transition-all text-left flex flex-col justify-between group shadow-sm"
        >
          <div className="flex items-center justify-between w-full mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground group-hover:text-purple-400">
              Total Customers
            </span>
            <Users className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-xl font-black text-foreground">
            {cards.customers}
          </div>
          <span className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
            {data.customersSummary.active} Active <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
          </span>
        </button>

        {/* Card 10: Today's Recharge */}
        <button
          onClick={() => setActiveTab('recharge_history')}
          className="p-4 rounded-2xl bg-card border border-border hover:border-emerald-500/50 hover:bg-emerald-500/5 transition-all text-left flex flex-col justify-between group shadow-sm"
        >
          <div className="flex items-center justify-between w-full mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground group-hover:text-emerald-400">
              Today's Recharge
            </span>
            <Clock className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-xl font-black text-emerald-400">
            Rs. {cards.todayRecharge.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
          <span className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
            Today's Selling <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
          </span>
        </button>
      </div>

      {/* 3. RESELLER PROFILE TABS (Section 47) */}
      <div className="space-y-4">
        {/* Tab Buttons Bar */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-2 border-b border-border text-xs scrollbar-none">
          {[
            { id: 'overview', label: 'Overview', icon: Layers },
            { id: 'customers', label: `Customers (${cards.customers})`, icon: Users },
            { id: 'wallet', label: 'Wallet', icon: Wallet },
            { id: 'topups', label: 'Top-Ups', icon: DollarSign },
            { id: 'transactions', label: 'Transactions', icon: History },
            { id: 'credit', label: 'Credit', icon: ShieldAlert },
            { id: 'commission', label: 'Commission', icon: Percent },
            { id: 'recharge_history', label: 'Recharge History', icon: CreditCard },
            { id: 'reports', label: 'Reports', icon: FileBarChart },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl font-bold whitespace-nowrap transition-all ${
                  isActive
                    ? 'bg-purple-600 text-white shadow-md shadow-purple-500/20'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* ======================================================== */}
        {/* TAB 1: OVERVIEW */}
        {/* ======================================================== */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Financial Summary Alert */}
            <div className="p-4 rounded-2xl bg-muted/30 border border-border flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="space-y-1">
                <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-purple-400" />
                  Prepaid Commission & Accounting Separation
                </span>
                <p className="text-xs text-muted-foreground">
                  Cash Revenue reflects actual cash collected (Rs. {cards.totalCashTopup.toLocaleString()}).
                  Wallet value reflects customer-selling balance (Rs. {cards.currentBalance.toLocaleString()}).
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => setCommissionModalOpen(true)}
                  className="px-3 py-1.5 rounded-xl border border-border bg-card text-xs font-semibold text-foreground hover:bg-muted transition-colors flex items-center gap-1.5"
                >
                  <Edit2 className="w-3.5 h-3.5 text-purple-400" />
                  <span>Edit Commission</span>
                </button>
                <button
                  onClick={() => setCreditModalOpen(true)}
                  className="px-3 py-1.5 rounded-xl border border-border bg-card text-xs font-semibold text-foreground hover:bg-muted transition-colors flex items-center gap-1.5"
                >
                  <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
                  <span>Adjust Credit</span>
                </button>
              </div>
            </div>

            {/* Recent Transactions List */}
            <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <History className="w-4 h-4 text-purple-400" />
                  Recent Reseller Activity
                </h3>
                <button
                  onClick={() => setActiveTab('transactions')}
                  className="text-xs text-purple-400 hover:text-purple-300 font-semibold flex items-center gap-1"
                >
                  View All Transactions <ChevronRight className="w-3 h-3" />
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-border/80 text-[11px] font-bold text-muted-foreground uppercase">
                      <th className="pb-2.5">Date</th>
                      <th className="pb-2.5">Transaction ID</th>
                      <th className="pb-2.5">Type</th>
                      <th className="pb-2.5 text-right">Cash / Credit</th>
                      <th className="pb-2.5 text-right">Commission</th>
                      <th className="pb-2.5 text-right">Wallet Value</th>
                      <th className="pb-2.5 text-right">Balance After</th>
                      <th className="pb-2.5">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {data.recentTransactions.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-6 text-center text-muted-foreground">
                          No recent transactions found. Click "+ Add Balance / Top-Up" to start.
                        </td>
                      </tr>
                    ) : (
                      data.recentTransactions.map((tx) => (
                        <tr key={tx.id} className="hover:bg-muted/30 transition-colors">
                          <td className="py-3 text-muted-foreground">
                            {new Date(tx.created_at).toLocaleDateString()}
                          </td>
                          <td className="py-3 font-mono font-medium text-foreground">
                            {tx.transaction_id}
                          </td>
                          <td className="py-3">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                tx.type.includes('CASH')
                                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                  : tx.type.includes('CREDIT')
                                  ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                  : tx.type.includes('RECHARGE')
                                  ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                                  : 'bg-muted text-muted-foreground'
                              }`}
                            >
                              {tx.type.replace('RESELLER_', '')}
                            </span>
                          </td>
                          <td className="py-3 text-right font-medium">
                            {tx.cash_amount > 0 ? (
                              <span className="text-emerald-400">Rs. {tx.cash_amount.toFixed(2)}</span>
                            ) : tx.credit_amount > 0 ? (
                              <span className="text-amber-400">Rs. {tx.credit_amount.toFixed(2)}</span>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </td>
                          <td className="py-3 text-right font-medium text-purple-400">
                            {tx.commission_amount > 0 ? `Rs. ${tx.commission_amount.toFixed(2)}` : '-'}
                          </td>
                          <td className="py-3 text-right font-bold text-foreground">
                            {tx.wallet_value > 0 ? (
                              <span className="text-foreground">+Rs. {tx.wallet_value.toFixed(2)}</span>
                            ) : tx.wallet_debit > 0 ? (
                              <span className="text-rose-400">-Rs. {tx.wallet_debit.toFixed(2)}</span>
                            ) : (
                              '-'
                            )}
                          </td>
                          <td className="py-3 text-right font-medium text-muted-foreground">
                            Rs. {tx.balance_after.toFixed(2)}
                          </td>
                          <td className="py-3">
                            <span className="text-[10px] font-semibold text-emerald-400">
                              {tx.status}
                            </span>
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

        {/* ======================================================== */}
        {/* TAB 2: CUSTOMERS (Section 31 & 57) */}
        {/* ======================================================== */}
        {activeTab === 'customers' && (
          <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="relative flex-1 max-w-sm">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search customer by username, name, phone..."
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && fetchCustomers()}
                  className="w-full pl-9 pr-3 py-1.5 bg-muted/40 border border-border rounded-xl text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={fetchCustomers}
                  className="p-2 rounded-xl border border-border hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                  title="Refresh Customers"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => {
                    setRechargeSubId('');
                    setRechargePkgId('');
                    setRechargeModalOpen(true);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs transition-colors flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Recharge Customer</span>
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-border/80 text-[11px] font-bold text-muted-foreground uppercase">
                    <th className="pb-2.5">Username</th>
                    <th className="pb-2.5">Full Name</th>
                    <th className="pb-2.5">Phone</th>
                    <th className="pb-2.5">Package</th>
                    <th className="pb-2.5">Price</th>
                    <th className="pb-2.5">Expiry Date</th>
                    <th className="pb-2.5">Status</th>
                    <th className="pb-2.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {customersLoading ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-muted-foreground">
                        Loading customers...
                      </td>
                    </tr>
                  ) : customers.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-muted-foreground">
                        No customers assigned to this reseller yet.
                      </td>
                    </tr>
                  ) : (
                    customers.map((c) => (
                      <tr key={c.id} className="hover:bg-muted/30 transition-colors">
                        <td className="py-3">
                          <button
                            type="button"
                            onClick={() => onOpenSubscriber?.(c.id)}
                            className="font-bold text-purple-400 hover:text-purple-300 hover:underline flex items-center gap-1"
                          >
                            <span>{c.username}</span>
                            <ExternalLink className="w-3 h-3" />
                          </button>
                        </td>
                        <td className="py-3 font-medium text-foreground">{c.full_name}</td>
                        <td className="py-3 text-muted-foreground">{c.phone || '-'}</td>
                        <td className="py-3 font-medium text-foreground">{c.package_name || '-'}</td>
                        <td className="py-3 text-muted-foreground">
                          {c.package_price ? `Rs. ${c.package_price.toFixed(2)}` : '-'}
                        </td>
                        <td className="py-3 text-muted-foreground">
                          {c.expiry_date ? new Date(c.expiry_date).toLocaleDateString() : 'No expiry'}
                        </td>
                        <td className="py-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              c.status === 'enabled'
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                : 'bg-red-500/10 text-red-400 border border-red-500/20'
                            }`}
                          >
                            {c.status}
                          </span>
                        </td>
                        <td className="py-3 text-right">
                          <button
                            onClick={() => {
                              setRechargeSubId(c.id);
                              setRechargePkgId(c.package_id || '');
                              setRechargeModalOpen(true);
                            }}
                            className="px-2.5 py-1 rounded-lg border border-purple-500/30 bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 font-bold text-[11px] transition-colors"
                          >
                            Recharge
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 3: WALLET & LEDGER */}
        {/* ======================================================== */}
        {activeTab === 'wallet' && (
          <div className="space-y-4">
            <div className="p-5 rounded-2xl bg-card border border-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">
                  Reseller Wallet Number
                </span>
                <span className="text-lg font-mono font-black text-foreground">
                  {reseller.wallet_number}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={handleExportCsv}
                  className="px-3.5 py-2 rounded-xl border border-border bg-card text-xs font-semibold text-foreground hover:bg-muted transition-colors flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export Ledger CSV</span>
                </button>
                <button
                  onClick={() => setTopupModalOpen(true)}
                  className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs transition-colors flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  <span>+ Add Balance</span>
                </button>
              </div>
            </div>

            {/* Wallet Ledger Table */}
            <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-foreground">Wallet Ledger Entries</h3>
                <span className="text-xs text-muted-foreground">
                  Current Balance: Rs. {cards.currentBalance.toFixed(2)}
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-border/80 text-[11px] font-bold text-muted-foreground uppercase">
                      <th className="pb-2.5">Date</th>
                      <th className="pb-2.5">Tx ID</th>
                      <th className="pb-2.5">Type</th>
                      <th className="pb-2.5 text-right">Debit / Credit</th>
                      <th className="pb-2.5 text-right">Balance Before</th>
                      <th className="pb-2.5 text-right">Balance After</th>
                      <th className="pb-2.5">Reference / Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {transactions.map((tx) => (
                      <tr key={tx.id} className="hover:bg-muted/30 transition-colors">
                        <td className="py-3 text-muted-foreground">
                          {new Date(tx.created_at).toLocaleString()}
                        </td>
                        <td className="py-3 font-mono font-medium text-foreground">
                          {tx.transaction_id}
                        </td>
                        <td className="py-3">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-muted text-foreground">
                            {tx.type.replace('RESELLER_', '')}
                          </span>
                        </td>
                        <td className="py-3 text-right font-bold">
                          {tx.wallet_value > 0 ? (
                            <span className="text-emerald-400">+Rs. {tx.wallet_value.toFixed(2)}</span>
                          ) : tx.wallet_debit > 0 ? (
                            <span className="text-rose-400">-Rs. {tx.wallet_debit.toFixed(2)}</span>
                          ) : (
                            '-'
                          )}
                        </td>
                        <td className="py-3 text-right text-muted-foreground">
                          Rs. {tx.balance_before.toFixed(2)}
                        </td>
                        <td className="py-3 text-right font-semibold text-foreground">
                          Rs. {tx.balance_after.toFixed(2)}
                        </td>
                        <td className="py-3 text-muted-foreground max-w-xs truncate">
                          {tx.reference || tx.remarks || '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 4: TOP-UPS (Section 51) */}
        {/* ======================================================== */}
        {activeTab === 'topups' && (
          <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-muted-foreground">Filter Type:</span>
                <select
                  value={txTypeFilter}
                  onChange={(e) => setTxTypeFilter(e.target.value)}
                  className="px-2.5 py-1.5 bg-muted/40 border border-border rounded-xl text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="ALL">All Top-Ups</option>
                  <option value="RESELLER_TOPUP_CASH">Cash Top-Ups Only</option>
                  <option value="RESELLER_TOPUP_CREDIT">Credit Top-Ups Only</option>
                  <option value="RESELLER_TOPUP_REVERSAL">Reversals Only</option>
                </select>
              </div>

              <button
                onClick={() => setTopupModalOpen(true)}
                className="px-3.5 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs transition-colors flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Add Balance / Top-Up</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-border/80 text-[11px] font-bold text-muted-foreground uppercase">
                    <th className="pb-2.5">Date</th>
                    <th className="pb-2.5">Transaction ID</th>
                    <th className="pb-2.5">Type</th>
                    <th className="pb-2.5 text-right">Cash Paid</th>
                    <th className="pb-2.5 text-right">Credit Amount</th>
                    <th className="pb-2.5 text-right">Comm %</th>
                    <th className="pb-2.5 text-right">Commission Granted</th>
                    <th className="pb-2.5 text-right">Wallet Value Added</th>
                    <th className="pb-2.5">Method</th>
                    <th className="pb-2.5">Status</th>
                    <th className="pb-2.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {transactions
                    .filter((t) => t.type.includes('TOPUP'))
                    .map((tx) => (
                      <tr key={tx.id} className="hover:bg-muted/30 transition-colors">
                        <td className="py-3 text-muted-foreground">
                          {new Date(tx.created_at).toLocaleDateString()}
                        </td>
                        <td className="py-3 font-mono font-medium text-foreground">
                          {tx.transaction_id}
                        </td>
                        <td className="py-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              tx.type.includes('CASH')
                                ? 'bg-emerald-500/10 text-emerald-400'
                                : 'bg-amber-500/10 text-amber-400'
                            }`}
                          >
                            {tx.type.replace('RESELLER_TOPUP_', '')}
                          </span>
                        </td>
                        <td className="py-3 text-right font-medium text-emerald-400">
                          {tx.cash_amount > 0 ? `Rs. ${tx.cash_amount.toFixed(2)}` : '-'}
                        </td>
                        <td className="py-3 text-right font-medium text-amber-400">
                          {tx.credit_amount > 0 ? `Rs. ${tx.credit_amount.toFixed(2)}` : '-'}
                        </td>
                        <td className="py-3 text-right text-muted-foreground">
                          {tx.commission_percent.toFixed(2)}%
                        </td>
                        <td className="py-3 text-right font-bold text-purple-400">
                          Rs. {tx.commission_amount.toFixed(2)}
                        </td>
                        <td className="py-3 text-right font-black text-foreground">
                          Rs. {tx.wallet_value.toFixed(2)}
                        </td>
                        <td className="py-3 text-muted-foreground">{tx.payment_method || '-'}</td>
                        <td className="py-3">
                          <span
                            className={`text-[10px] font-bold uppercase ${
                              tx.status === 'COMPLETED'
                                ? 'text-emerald-400'
                                : tx.status === 'REVERSED'
                                ? 'text-rose-400'
                                : 'text-muted-foreground'
                            }`}
                          >
                            {tx.status}
                          </span>
                        </td>
                        <td className="py-3 text-right">
                          {tx.status === 'COMPLETED' && (
                            <button
                              onClick={() => {
                                setSelectedTxForReversal(tx);
                                setReversalReason('');
                                setReversalModalOpen(true);
                              }}
                              className="px-2 py-1 rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 text-[11px] font-bold transition-colors"
                              title="Reverse Top-Up (Creates immutable reversal record)"
                            >
                              Reverse
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 5: TRANSACTIONS (Complete Immutable Ledger) */}
        {/* ======================================================== */}
        {activeTab === 'transactions' && (
          <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="relative flex-1 max-w-sm">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search by ID, username, reference..."
                  value={txSearch}
                  onChange={(e) => setTxSearch(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && fetchTransactions()}
                  className="w-full pl-9 pr-3 py-1.5 bg-muted/40 border border-border rounded-xl text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <button
                onClick={handleExportCsv}
                className="px-3.5 py-1.5 rounded-xl border border-border bg-card text-xs font-semibold text-foreground hover:bg-muted transition-colors flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export CSV</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-border/80 text-[11px] font-bold text-muted-foreground uppercase">
                    <th className="pb-2.5">Date</th>
                    <th className="pb-2.5">Tx ID</th>
                    <th className="pb-2.5">Type</th>
                    <th className="pb-2.5 text-right">Cash</th>
                    <th className="pb-2.5 text-right">Credit</th>
                    <th className="pb-2.5 text-right">Comm</th>
                    <th className="pb-2.5 text-right">Wallet Added</th>
                    <th className="pb-2.5 text-right">Wallet Debit</th>
                    <th className="pb-2.5 text-right">Balance After</th>
                    <th className="pb-2.5">Customer</th>
                    <th className="pb-2.5">Operator</th>
                    <th className="pb-2.5">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {transactions.map((tx) => (
                    <tr key={tx.id} className="hover:bg-muted/30 transition-colors">
                      <td className="py-3 text-muted-foreground">
                        {new Date(tx.created_at).toLocaleString()}
                      </td>
                      <td className="py-3 font-mono font-medium text-foreground">{tx.transaction_id}</td>
                      <td className="py-3">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-muted text-foreground">
                          {tx.type.replace('RESELLER_', '')}
                        </span>
                      </td>
                      <td className="py-3 text-right text-emerald-400 font-medium">
                        {tx.cash_amount > 0 ? `Rs. ${tx.cash_amount.toFixed(2)}` : '-'}
                      </td>
                      <td className="py-3 text-right text-amber-400 font-medium">
                        {tx.credit_amount > 0 ? `Rs. ${tx.credit_amount.toFixed(2)}` : '-'}
                      </td>
                      <td className="py-3 text-right text-purple-400 font-medium">
                        {tx.commission_amount > 0 ? `Rs. ${tx.commission_amount.toFixed(2)}` : '-'}
                      </td>
                      <td className="py-3 text-right font-bold text-foreground">
                        {tx.wallet_value > 0 ? `+Rs. ${tx.wallet_value.toFixed(2)}` : '-'}
                      </td>
                      <td className="py-3 text-right font-bold text-rose-400">
                        {tx.wallet_debit > 0 ? `-Rs. ${tx.wallet_debit.toFixed(2)}` : '-'}
                      </td>
                      <td className="py-3 text-right font-semibold text-foreground">
                        Rs. {tx.balance_after.toFixed(2)}
                      </td>
                      <td className="py-3">
                        {tx.customer_username ? (
                          <button
                            type="button"
                            onClick={() => tx.customer_id && onOpenSubscriber?.(tx.customer_id)}
                            className="font-bold text-purple-400 hover:underline"
                          >
                            {tx.customer_username}
                          </button>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className="py-3 text-muted-foreground">{tx.created_by}</td>
                      <td className="py-3">
                        <span className="text-[10px] font-bold text-emerald-400">{tx.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 6: CREDIT FACILITY */}
        {/* ======================================================== */}
        {activeTab === 'credit' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4 md:col-span-1">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-amber-400" />
                Credit Account Details
              </h3>

              <div className="space-y-3 text-xs">
                <div className="p-3 rounded-xl bg-muted/40 border border-border flex justify-between items-center">
                  <span className="text-muted-foreground">Credit Facility Status:</span>
                  <span className="font-bold uppercase text-emerald-400">{reseller.credit_status}</span>
                </div>
                <div className="p-3 rounded-xl bg-muted/40 border border-border flex justify-between items-center">
                  <span className="text-muted-foreground">Authorized Credit Limit:</span>
                  <span className="font-bold text-foreground">Rs. {reseller.credit_limit.toLocaleString()}</span>
                </div>
                <div className="p-3 rounded-xl bg-muted/40 border border-border flex justify-between items-center">
                  <span className="text-muted-foreground">Currently Consumed:</span>
                  <span className="font-bold text-rose-400">Rs. {reseller.credit_used.toLocaleString()}</span>
                </div>
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 flex justify-between items-center">
                  <span className="font-semibold text-amber-400">Remaining Available Credit:</span>
                  <span className="font-black text-amber-300">Rs. {cards.creditRemaining.toLocaleString()}</span>
                </div>
              </div>

              <button
                onClick={() => {
                  setNewCreditLimit(String(reseller.credit_limit));
                  setNewCreditStatus((reseller.credit_status as any) || 'ACTIVE');
                  setCreditModalOpen(true);
                }}
                className="w-full py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs transition-colors shadow-md shadow-amber-500/20"
              >
                Adjust Credit Terms
              </button>
            </div>

            <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4 md:col-span-2">
              <h3 className="text-sm font-bold text-foreground">Credit History & Utilisation</h3>
              <p className="text-xs text-muted-foreground">
                All credit top-ups are recorded against the approved limit. Once repaid or adjusted, the remaining capacity restores automatically.
              </p>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-border/80 text-[11px] font-bold text-muted-foreground uppercase">
                      <th className="pb-2.5">Date</th>
                      <th className="pb-2.5">Tx ID</th>
                      <th className="pb-2.5 text-right">Credit Amount</th>
                      <th className="pb-2.5 text-right">Credit Used Before</th>
                      <th className="pb-2.5 text-right">Credit Used After</th>
                      <th className="pb-2.5">Operator</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {transactions
                      .filter((t) => t.credit_amount > 0 || t.type.includes('CREDIT'))
                      .map((tx) => (
                        <tr key={tx.id} className="hover:bg-muted/30">
                          <td className="py-3 text-muted-foreground">
                            {new Date(tx.created_at).toLocaleDateString()}
                          </td>
                          <td className="py-3 font-mono font-medium text-foreground">{tx.transaction_id}</td>
                          <td className="py-3 text-right font-bold text-amber-400">
                            Rs. {tx.credit_amount.toFixed(2)}
                          </td>
                          <td className="py-3 text-right text-muted-foreground">
                            Rs. {tx.credit_used_before.toFixed(2)}
                          </td>
                          <td className="py-3 text-right font-semibold text-foreground">
                            Rs. {tx.credit_used_after.toFixed(2)}
                          </td>
                          <td className="py-3 text-muted-foreground">{tx.created_by}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 7: COMMISSION (Section 14 & 50) */}
        {/* ======================================================== */}
        {activeTab === 'commission' && (
          <div className="space-y-6">
            <div className="p-5 rounded-2xl bg-card border border-border flex items-center justify-between gap-4">
              <div>
                <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">
                  Current Commission Rate
                </span>
                <span className="text-2xl font-black text-purple-400">
                  {reseller.commission_percent.toFixed(2)}%
                </span>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Applied to all new Cash and Credit top-ups. Historical transactions preserve their original rates.
                </p>
              </div>

              <button
                onClick={() => {
                  setNewCommissionPercent(String(reseller.commission_percent));
                  setCommissionReason('');
                  setCommissionModalOpen(true);
                }}
                className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs transition-colors flex items-center gap-1.5 shadow-md shadow-purple-500/20"
              >
                <Edit2 className="w-3.5 h-3.5" />
                <span>Change Commission %</span>
              </button>
            </div>

            {/* Commission History Table (Section 14) */}
            <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                <History className="w-4 h-4 text-purple-400" />
                Commission Rate Audit Log
              </h3>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-border/80 text-[11px] font-bold text-muted-foreground uppercase">
                      <th className="pb-2.5">Date</th>
                      <th className="pb-2.5 text-right">Previous %</th>
                      <th className="pb-2.5 text-right">New %</th>
                      <th className="pb-2.5">Changed By</th>
                      <th className="pb-2.5">Reason / Justification</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {commissionHistory.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-6 text-center text-muted-foreground">
                          No commission adjustments logged yet.
                        </td>
                      </tr>
                    ) : (
                      commissionHistory.map((h) => (
                        <tr key={h.id} className="hover:bg-muted/30">
                          <td className="py-3 text-muted-foreground">
                            {new Date(h.created_at).toLocaleString()}
                          </td>
                          <td className="py-3 text-right font-medium text-muted-foreground">
                            {h.previous_percent.toFixed(2)}%
                          </td>
                          <td className="py-3 text-right font-bold text-purple-400">
                            {h.new_percent.toFixed(2)}%
                          </td>
                          <td className="py-3 font-medium text-foreground">{h.changed_by}</td>
                          <td className="py-3 text-muted-foreground">{h.reason || 'General update'}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 8: RECHARGE HISTORY (Section 15, 16) */}
        {/* ======================================================== */}
        {activeTab === 'recharge_history' && (
          <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-foreground">Customer Package Recharges</h3>
                <p className="text-xs text-muted-foreground">
                  Normal package price debited directly from reseller wallet. Zero secondary commission generated.
                </p>
              </div>
              <button
                onClick={() => {
                  setRechargeSubId('');
                  setRechargePkgId('');
                  setRechargeModalOpen(true);
                }}
                className="px-3.5 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs transition-colors flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Recharge Customer</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-border/80 text-[11px] font-bold text-muted-foreground uppercase">
                    <th className="pb-2.5">Date</th>
                    <th className="pb-2.5">Tx ID</th>
                    <th className="pb-2.5">Customer Username</th>
                    <th className="pb-2.5">Package</th>
                    <th className="pb-2.5">Duration</th>
                    <th className="pb-2.5 text-right">Debit Amount</th>
                    <th className="pb-2.5 text-right">Balance After</th>
                    <th className="pb-2.5">Operator</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {transactions
                    .filter((t) => t.type === 'RESELLER_CUSTOMER_RECHARGE')
                    .map((tx) => (
                      <tr key={tx.id} className="hover:bg-muted/30">
                        <td className="py-3 text-muted-foreground">
                          {new Date(tx.created_at).toLocaleString()}
                        </td>
                        <td className="py-3 font-mono font-medium text-foreground">{tx.transaction_id}</td>
                        <td className="py-3">
                          <button
                            type="button"
                            onClick={() => tx.customer_id && onOpenSubscriber?.(tx.customer_id)}
                            className="font-bold text-purple-400 hover:underline"
                          >
                            {tx.customer_username}
                          </button>
                        </td>
                        <td className="py-3 font-medium text-foreground">{tx.package_name || '-'}</td>
                        <td className="py-3 text-muted-foreground">{tx.duration_months} mo</td>
                        <td className="py-3 text-right font-black text-rose-400">
                          -Rs. {tx.wallet_debit.toFixed(2)}
                        </td>
                        <td className="py-3 text-right font-semibold text-foreground">
                          Rs. {tx.balance_after.toFixed(2)}
                        </td>
                        <td className="py-3 text-muted-foreground">{tx.created_by}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 9: FINANCIAL REPORTS (Section 27, 28, 29) */}
        {/* ======================================================== */}
        {activeTab === 'reports' && (
          <div className="space-y-6">
            <div className="p-4 rounded-2xl bg-card border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-muted-foreground">Reporting Period:</span>
                <select
                  value={reportPeriod}
                  onChange={(e) => setReportPeriod(e.target.value)}
                  className="px-3 py-1.5 bg-muted/40 border border-border rounded-xl text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="today">Today</option>
                  <option value="yesterday">Yesterday</option>
                  <option value="this_week">This Week</option>
                  <option value="last_week">Last Week</option>
                  <option value="this_month">This Month</option>
                  <option value="last_month">Last Month</option>
                  <option value="this_year">This Year</option>
                  <option value="all_time">All Time</option>
                </select>
                <button
                  onClick={fetchReports}
                  className="p-1.5 rounded-xl border border-border hover:bg-muted text-muted-foreground"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              </div>

              <button
                onClick={handleExportCsv}
                className="px-3.5 py-1.5 rounded-xl border border-border bg-card text-xs font-semibold text-foreground hover:bg-muted transition-colors flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export Report CSV</span>
              </button>
            </div>

            {reportLoading ? (
              <div className="p-8 text-center text-xs text-muted-foreground">Loading financial report...</div>
            ) : reportData ? (
              <div className="space-y-6">
                {/* Section 29 Mandatory Financial Distinction Banner */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="p-4 rounded-xl bg-card border border-border">
                    <span className="text-[11px] font-bold text-muted-foreground uppercase">Actual Cash Received</span>
                    <div className="text-xl font-black text-emerald-400 mt-1">
                      Rs. {reportData.totals.totalCashReceived.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </div>
                    <span className="text-[10px] text-emerald-500 font-semibold mt-0.5 block">
                      True Cash Revenue
                    </span>
                  </div>

                  <div className="p-4 rounded-xl bg-card border border-border">
                    <span className="text-[11px] font-bold text-muted-foreground uppercase">Credit Facility Granted</span>
                    <div className="text-xl font-black text-amber-400 mt-1">
                      Rs. {reportData.totals.totalCreditGranted.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </div>
                    <span className="text-[10px] text-amber-500 font-semibold mt-0.5 block">
                      Approved Credit Top-Ups
                    </span>
                  </div>

                  <div className="p-4 rounded-xl bg-card border border-border">
                    <span className="text-[11px] font-bold text-muted-foreground uppercase">Commission Granted</span>
                    <div className="text-xl font-black text-purple-400 mt-1">
                      Rs. {reportData.totals.totalCommissionGranted.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </div>
                    <span className="text-[10px] text-purple-400 font-semibold mt-0.5 block">
                      Top-up Commission Added
                    </span>
                  </div>

                  <div className="p-4 rounded-xl bg-card border border-border">
                    <span className="text-[11px] font-bold text-muted-foreground uppercase">Total Customer Recharges</span>
                    <div className="text-xl font-black text-blue-400 mt-1">
                      Rs. {reportData.totals.totalCustomerRecharge.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </div>
                    <span className="text-[10px] text-blue-400 font-semibold mt-0.5 block">
                      Customer Selling Value
                    </span>
                  </div>
                </div>

                {/* Daily Aggregates Table */}
                <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4">
                  <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">
                    Daily Financial Summary
                  </h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-border/80 text-[11px] font-bold text-muted-foreground uppercase">
                          <th className="pb-2.5">Date</th>
                          <th className="pb-2.5 text-right">Cash Received</th>
                          <th className="pb-2.5 text-right">Credit Granted</th>
                          <th className="pb-2.5 text-right">Commission Granted</th>
                          <th className="pb-2.5 text-right">Wallet Value Added</th>
                          <th className="pb-2.5 text-right">Customer Recharge</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/40">
                        {reportData.timeSeries.map((ts: any) => (
                          <tr key={ts.date} className="hover:bg-muted/30">
                            <td className="py-2.5 font-medium text-foreground">{ts.date}</td>
                            <td className="py-2.5 text-right text-emerald-400">
                              Rs. {ts.cash_received.toFixed(2)}
                            </td>
                            <td className="py-2.5 text-right text-amber-400">
                              Rs. {ts.credit_granted.toFixed(2)}
                            </td>
                            <td className="py-2.5 text-right text-purple-400">
                              Rs. {ts.commission_granted.toFixed(2)}
                            </td>
                            <td className="py-2.5 text-right font-bold text-foreground">
                              Rs. {ts.wallet_added.toFixed(2)}
                            </td>
                            <td className="py-2.5 text-right text-blue-400 font-bold">
                              Rs. {ts.customer_recharge.toFixed(2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        )}
      </div>

      {/* ======================================================== */}
      {/* MODAL 1: ADD BALANCE / TOP-UP MODAL */}
      {/* ======================================================== */}
      <ResellerTopupModal
        isOpen={topupModalOpen}
        onClose={() => setTopupModalOpen(false)}
        reseller={reseller}
        currentUser={currentUser}
        onSuccess={() => {
          fetchProfile();
          fetchTransactions();
        }}
      />

      {/* ======================================================== */}
      {/* MODAL 2: CUSTOMER RECHARGE MODAL */}
      {/* ======================================================== */}
      {rechargeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-card border border-border w-full max-w-md rounded-2xl shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                <Zap className="w-5 h-5 text-purple-400" />
                Customer Recharge
              </h3>
              <button
                onClick={() => setRechargeModalOpen(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                ✕
              </button>
            </div>

            {rechargeError && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
                {rechargeError}
              </div>
            )}

            <form onSubmit={handleCustomerRechargeSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">Select Customer</label>
                <select
                  required
                  value={rechargeSubId}
                  onChange={(e) => setRechargeSubId(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-muted/40 border border-border rounded-xl text-xs text-foreground focus:ring-2 focus:ring-purple-500"
                >
                  <option value="">-- Choose Customer --</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.username} ({c.full_name})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">Select Package</label>
                <select
                  required
                  value={rechargePkgId}
                  onChange={(e) => setRechargePkgId(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-muted/40 border border-border rounded-xl text-xs text-foreground focus:ring-2 focus:ring-purple-500"
                >
                  <option value="">-- Choose Package --</option>
                  {packages.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} - Rs. {Number(p.price).toFixed(2)}/mo
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">Duration (Months)</label>
                <input
                  type="number"
                  min="1"
                  max="36"
                  required
                  value={rechargeDuration}
                  onChange={(e) => setRechargeDuration(parseInt(e.target.value) || 1)}
                  className="w-full px-3 py-2 bg-muted/40 border border-border rounded-xl text-xs text-foreground focus:ring-2 focus:ring-purple-500"
                />
              </div>

              {/* Price Preview */}
              {selectedPkg && (
                <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/20 text-xs flex justify-between items-center">
                  <span className="text-muted-foreground">Wallet Debit:</span>
                  <span className={`font-black ${isInsufficientRechargeBalance ? 'text-red-400' : 'text-foreground'}`}>
                    Rs. {rechargeCost.toFixed(2)}
                  </span>
                </div>
              )}

              {isInsufficientRechargeBalance && (
                <p className="text-xs text-red-400 font-semibold">
                  Insufficient reseller balance (Available: Rs. {cards.currentBalance.toFixed(2)}). Please top up first.
                </p>
              )}

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setRechargeModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-muted-foreground hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={rechargeSubmitting || isInsufficientRechargeBalance}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-purple-600 hover:bg-purple-500 text-white disabled:opacity-50"
                >
                  {rechargeSubmitting ? 'Processing...' : 'Confirm Recharge'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 3: COMMISSION UPDATE MODAL */}
      {/* ======================================================== */}
      {commissionModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-card border border-border w-full max-w-sm rounded-2xl shadow-2xl p-6 space-y-4">
            <h3 className="text-base font-bold text-foreground">Update Reseller Commission</h3>
            <form onSubmit={handleUpdateCommission} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">New Commission %</label>
                <input
                  type="number"
                  min="0"
                  max="99.99"
                  step="0.01"
                  required
                  value={newCommissionPercent}
                  onChange={(e) => setNewCommissionPercent(e.target.value)}
                  placeholder="e.g. 50"
                  className="w-full px-3 py-2 bg-muted/40 border border-border rounded-xl text-sm font-semibold text-foreground focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">Reason for Change</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Annual partner contract adjustment"
                  value={commissionReason}
                  onChange={(e) => setCommissionReason(e.target.value)}
                  className="w-full px-3 py-2 bg-muted/40 border border-border rounded-xl text-xs text-foreground focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setCommissionModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-muted-foreground hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={commissionSubmitting}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-purple-600 hover:bg-purple-500 text-white"
                >
                  {commissionSubmitting ? 'Saving...' : 'Save Commission'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 4: CREDIT TERMS MODAL */}
      {/* ======================================================== */}
      {creditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-card border border-border w-full max-w-sm rounded-2xl shadow-2xl p-6 space-y-4">
            <h3 className="text-base font-bold text-foreground">Adjust Credit Facility</h3>
            <form onSubmit={handleUpdateCredit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">Credit Limit (Rs.)</label>
                <input
                  type="number"
                  min="0"
                  step="100"
                  required
                  value={newCreditLimit}
                  onChange={(e) => setNewCreditLimit(e.target.value)}
                  className="w-full px-3 py-2 bg-muted/40 border border-border rounded-xl text-sm font-semibold text-foreground focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">Credit Status</label>
                <select
                  value={newCreditStatus}
                  onChange={(e) => setNewCreditStatus(e.target.value as any)}
                  className="w-full px-3 py-2 bg-muted/40 border border-border rounded-xl text-xs text-foreground focus:ring-2 focus:ring-amber-500"
                >
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="SUSPENDED">SUSPENDED</option>
                  <option value="EXPIRED">EXPIRED</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">Notes / Justification</label>
                <input
                  type="text"
                  placeholder="e.g. Higher sales volume approval"
                  value={creditNotes}
                  onChange={(e) => setCreditNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-muted/40 border border-border rounded-xl text-xs text-foreground focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setCreditModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-muted-foreground hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creditSubmitting}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-500 text-white"
                >
                  {creditSubmitting ? 'Saving...' : 'Update Credit Terms'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 5: TOP-UP REVERSAL CONFIRMATION (Section 39) */}
      {/* ======================================================== */}
      {reversalModalOpen && selectedTxForReversal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-card border border-border w-full max-w-md rounded-2xl shadow-2xl p-6 space-y-4">
            <div className="flex items-center gap-3 text-red-400">
              <RotateCcw className="w-5 h-5" />
              <h3 className="text-base font-bold text-foreground">Reverse Top-Up Transaction</h3>
            </div>

            <p className="text-xs text-muted-foreground">
              Reversing transaction <span className="font-mono font-bold text-foreground">{selectedTxForReversal.transaction_id}</span> will create an immutable reversal record, deducting <span className="font-bold text-foreground">Rs. {selectedTxForReversal.wallet_value.toFixed(2)}</span> from the reseller's wallet balance.
            </p>

            <form onSubmit={handleReversalSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">Reason for Reversal</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Inadvertent duplicate entry / bounced cheque"
                  value={reversalReason}
                  onChange={(e) => setReversalReason(e.target.value)}
                  className="w-full px-3 py-2 bg-muted/40 border border-border rounded-xl text-xs text-foreground focus:ring-2 focus:ring-red-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setReversalModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-muted-foreground hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={reversalSubmitting}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-red-600 hover:bg-red-500 text-white"
                >
                  {reversalSubmitting ? 'Reversing...' : 'Confirm Reversal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
