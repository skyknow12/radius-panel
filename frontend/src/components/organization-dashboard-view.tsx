'use client';

import React from 'react';
import {
  Building2,
  Users,
  Store,
  Wifi,
  DollarSign,
  Wallet,
  CreditCard,
  TrendingUp,
  Clock,
  ShieldCheck,
  Edit3,
  ExternalLink,
  ChevronRight,
  Layers,
  ArrowUpRight,
  X,
  Check,
  AlertCircle
} from 'lucide-react';
import type { OrganizationItem, OrganizationDashboardMetrics } from '@/types/api';

interface OrganizationDashboardViewProps {
  onNavigate: (tab: string, filter?: string) => void;
  currentUser?: any;
}

export function OrganizationDashboardView({ onNavigate, currentUser }: OrganizationDashboardViewProps) {
  const [org, setOrg] = React.useState<OrganizationItem | null>(null);
  const [metrics, setMetrics] = React.useState<OrganizationDashboardMetrics | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [editOpen, setEditOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Edit form state
  const [name, setName] = React.useState('');
  const [phone, setPhone] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [address, setAddress] = React.useState('');
  const [website, setWebsite] = React.useState('');
  const [currency, setCurrency] = React.useState('NPR');
  const [timezone, setTimezone] = React.useState('Asia/Kathmandu');
  const [defaultGracePeriodDays, setDefaultGracePeriodDays] = React.useState<number>(3);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [orgRes, metricsRes] = await Promise.all([
        fetch('/api/organization'),
        fetch('/api/organization/dashboard'),
      ]);

      if (orgRes.ok) {
        const json = await orgRes.json();
        setOrg(json.data);
        if (json.data) {
          setName(json.data.name);
          setPhone(json.data.phone || '');
          setEmail(json.data.email || '');
          setAddress(json.data.address || '');
          setWebsite(json.data.website || '');
          setCurrency(json.data.currency || 'NPR');
          setTimezone(json.data.timezone || 'Asia/Kathmandu');
          setDefaultGracePeriodDays(json.data.default_grace_period_days ?? 3);
        }
      }

      if (metricsRes.ok) {
        const json = await metricsRes.json();
        setMetrics(json.data);
      }
    } catch {
      setError('Failed to load organization metrics');
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchData();
  }, []);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      const res = await fetch('/api/organization', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          phone,
          email,
          address,
          website,
          currency,
          timezone,
          default_grace_period_days: defaultGracePeriodDays,
        }),
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || 'Failed to update organization');
      }
      setEditOpen(false);
      fetchData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-28 rounded-2xl bg-card border border-border" />
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[...Array(10)].map((_, i) => (
            <div key={i} className="h-28 rounded-2xl bg-card border border-border" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Banner: Primary Organization Identity & Controls */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-card via-card/90 to-primary/5 border border-border relative overflow-hidden shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary via-indigo-600 to-purple-600 flex items-center justify-center text-white font-black text-xl shadow-lg shadow-primary/20 flex-shrink-0">
              {org?.code?.slice(0, 3) || 'ISP'}
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-xl font-black text-foreground tracking-tight">
                  {org?.name || 'Sky Radius Broadband ISP'}
                </h1>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 font-bold font-mono">
                  {org?.code || 'SKY-ISP'}
                </span>
                <span className="text-xs px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" /> Head Office Central
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-4 flex-wrap">
                <span>{org?.address || 'Kathmandu, Nepal'}</span>
                <span>•</span>
                <span>{org?.phone || '+977-1-4455667'}</span>
                <span>•</span>
                <span>{org?.email || 'admin@skyradius.net'}</span>
                <span>•</span>
                <span className="font-mono text-primary font-semibold">Currency: {org?.currency}</span>
                <span>•</span>
                <span className="font-mono text-muted-foreground">{org?.timezone}</span>
                <span>•</span>
                <span className="font-mono text-amber-400 font-semibold">Default Grace: {org?.default_grace_period_days ?? 3} Days</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setEditOpen(true)}
              className="px-3.5 py-2 rounded-xl bg-card border border-border hover:bg-muted text-xs font-semibold text-foreground transition-all flex items-center gap-2 shadow-sm"
            >
              <Edit3 className="w-3.5 h-3.5 text-primary" />
              <span>Edit Org Profile</span>
            </button>
            <button
              onClick={() => onNavigate('branches')}
              className="px-3.5 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold shadow-md shadow-primary/20 hover:opacity-90 transition-opacity flex items-center gap-1.5"
            >
              <span>Manage Channels</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          <span>{error}</span>
        </div>
      )}

      {/* 10 Clickable Metric Cards Grid */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
            <Layers className="w-4 h-4 text-primary" /> Head Office Real-Time Network & Financial Metrics
          </h2>
          <span className="text-[11px] text-muted-foreground">Click any card to drill down</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
          {/* 1. Total Branches */}
          <button
            onClick={() => onNavigate('branches')}
            className="p-4 rounded-2xl bg-card border border-border hover:border-blue-500/50 hover:bg-muted/40 transition-all text-left group shadow-sm flex flex-col justify-between"
          >
            <div className="flex items-center justify-between w-full mb-2">
              <span className="text-[11px] font-semibold text-muted-foreground group-hover:text-foreground">Total Branches</span>
              <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400">
                <Building2 className="w-4 h-4" />
              </div>
            </div>
            <div>
              <div className="text-2xl font-black text-foreground tracking-tight">
                {metrics?.totalBranches || 0}
              </div>
              <div className="text-[10px] text-emerald-400 font-semibold mt-0.5 flex items-center gap-1">
                <span>{metrics?.activeBranches || 0} Active Hubs</span>
                <ArrowUpRight className="w-3 h-3 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </div>
          </button>

          {/* 2. Total Resellers */}
          <button
            onClick={() => onNavigate('resellers')}
            className="p-4 rounded-2xl bg-card border border-border hover:border-amber-500/50 hover:bg-muted/40 transition-all text-left group shadow-sm flex flex-col justify-between"
          >
            <div className="flex items-center justify-between w-full mb-2">
              <span className="text-[11px] font-semibold text-muted-foreground group-hover:text-foreground">Total Resellers</span>
              <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400">
                <Store className="w-4 h-4" />
              </div>
            </div>
            <div>
              <div className="text-2xl font-black text-foreground tracking-tight">
                {metrics?.totalResellers || 0}
              </div>
              <div className="text-[10px] text-amber-400 font-semibold mt-0.5 flex items-center gap-1">
                <span>{metrics?.activeResellers || 0} Active Partners</span>
                <ArrowUpRight className="w-3 h-3 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </div>
          </button>

          {/* 3. Total Subscribers */}
          <button
            onClick={() => onNavigate('subscribers')}
            className="p-4 rounded-2xl bg-card border border-border hover:border-primary/50 hover:bg-muted/40 transition-all text-left group shadow-sm flex flex-col justify-between"
          >
            <div className="flex items-center justify-between w-full mb-2">
              <span className="text-[11px] font-semibold text-muted-foreground group-hover:text-foreground">Total Subscribers</span>
              <div className="p-2 rounded-xl bg-primary/10 text-primary">
                <Users className="w-4 h-4" />
              </div>
            </div>
            <div>
              <div className="text-2xl font-black text-foreground tracking-tight">
                {metrics?.totalSubscribers || 0}
              </div>
              <div className="text-[10px] text-muted-foreground font-semibold mt-0.5 flex items-center gap-1">
                <span>Across all channels</span>
                <ArrowUpRight className="w-3 h-3 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </div>
          </button>

          {/* 4. Active Subscribers */}
          <button
            onClick={() => onNavigate('subscribers', 'active')}
            className="p-4 rounded-2xl bg-card border border-border hover:border-emerald-500/50 hover:bg-muted/40 transition-all text-left group shadow-sm flex flex-col justify-between"
          >
            <div className="flex items-center justify-between w-full mb-2">
              <span className="text-[11px] font-semibold text-muted-foreground group-hover:text-foreground">Active Subscribers</span>
              <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
                <ShieldCheck className="w-4 h-4" />
              </div>
            </div>
            <div>
              <div className="text-2xl font-black text-emerald-400 tracking-tight">
                {metrics?.activeSubscribers || 0}
              </div>
              <div className="text-[10px] text-rose-400 font-semibold mt-0.5 flex items-center gap-1">
                <span>{metrics?.expiredSubscribers || 0} Expired</span>
                <ArrowUpRight className="w-3 h-3 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </div>
          </button>

          {/* 5. Online Users */}
          <button
            onClick={() => onNavigate('sessions')}
            className="p-4 rounded-2xl bg-card border border-border hover:border-cyan-500/50 hover:bg-muted/40 transition-all text-left group shadow-sm flex flex-col justify-between"
          >
            <div className="flex items-center justify-between w-full mb-2">
              <span className="text-[11px] font-semibold text-muted-foreground group-hover:text-foreground">Online Users</span>
              <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400">
                <Wifi className="w-4 h-4" />
              </div>
            </div>
            <div>
              <div className="text-2xl font-black text-cyan-400 tracking-tight">
                {metrics?.onlineUsers || 0}
              </div>
              <div className="text-[10px] text-cyan-400 font-semibold mt-0.5 flex items-center gap-1">
                <span>Live RADIUS sessions</span>
                <ArrowUpRight className="w-3 h-3 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </div>
          </button>

          {/* 6. Monthly Revenue */}
          <button
            onClick={() => onNavigate('billing_transactions')}
            className="p-4 rounded-2xl bg-card border border-border hover:border-emerald-500/50 hover:bg-muted/40 transition-all text-left group shadow-sm flex flex-col justify-between"
          >
            <div className="flex items-center justify-between w-full mb-2">
              <span className="text-[11px] font-semibold text-muted-foreground group-hover:text-foreground">Monthly Revenue</span>
              <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
                <DollarSign className="w-4 h-4" />
              </div>
            </div>
            <div>
              <div className="text-xl font-black text-foreground tracking-tight">
                Rs. {(metrics?.monthlyRevenue || 0).toLocaleString()}
              </div>
              <div className="text-[10px] text-emerald-400 font-semibold mt-0.5 flex items-center gap-1">
                <span>MTD Collected</span>
                <ArrowUpRight className="w-3 h-3 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </div>
          </button>

          {/* 7. Total Wallet Balance */}
          <button
            onClick={() => onNavigate('wallets')}
            className="p-4 rounded-2xl bg-card border border-border hover:border-purple-500/50 hover:bg-muted/40 transition-all text-left group shadow-sm flex flex-col justify-between"
          >
            <div className="flex items-center justify-between w-full mb-2">
              <span className="text-[11px] font-semibold text-muted-foreground group-hover:text-foreground">Total Wallet Balance</span>
              <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400">
                <Wallet className="w-4 h-4" />
              </div>
            </div>
            <div>
              <div className="text-xl font-black text-purple-400 tracking-tight">
                Rs. {(metrics?.walletBalance || 0).toLocaleString()}
              </div>
              <div className="text-[10px] text-muted-foreground font-semibold mt-0.5 flex items-center gap-1">
                <span>Branch & Reseller wallets</span>
                <ArrowUpRight className="w-3 h-3 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </div>
          </button>

          {/* 8. Outstanding / Available Credit */}
          <button
            onClick={() => onNavigate('wallets')}
            className="p-4 rounded-2xl bg-card border border-border hover:border-indigo-500/50 hover:bg-muted/40 transition-all text-left group shadow-sm flex flex-col justify-between"
          >
            <div className="flex items-center justify-between w-full mb-2">
              <span className="text-[11px] font-semibold text-muted-foreground group-hover:text-foreground">Available Credit</span>
              <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400">
                <CreditCard className="w-4 h-4" />
              </div>
            </div>
            <div>
              <div className="text-xl font-black text-indigo-400 tracking-tight">
                Rs. {(metrics?.availableCredit || 0).toLocaleString()}
              </div>
              <div className="text-[10px] text-amber-400 font-semibold mt-0.5 flex items-center gap-1">
                <span>Used: Rs. {(metrics?.usedCredit || 0).toLocaleString()}</span>
                <ArrowUpRight className="w-3 h-3 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </div>
          </button>

          {/* 9. Today's Recharge */}
          <button
            onClick={() => onNavigate('billing_transactions')}
            className="p-4 rounded-2xl bg-card border border-border hover:border-teal-500/50 hover:bg-muted/40 transition-all text-left group shadow-sm flex flex-col justify-between"
          >
            <div className="flex items-center justify-between w-full mb-2">
              <span className="text-[11px] font-semibold text-muted-foreground group-hover:text-foreground">Today's Recharge</span>
              <div className="p-2 rounded-xl bg-teal-500/10 text-teal-400">
                <Clock className="w-4 h-4" />
              </div>
            </div>
            <div>
              <div className="text-xl font-black text-teal-400 tracking-tight">
                Rs. {(metrics?.todayRecharge || 0).toLocaleString()}
              </div>
              <div className="text-[10px] text-teal-400 font-semibold mt-0.5 flex items-center gap-1">
                <span>Collected Today</span>
                <ArrowUpRight className="w-3 h-3 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </div>
          </button>

          {/* 10. Monthly Recharge */}
          <button
            onClick={() => onNavigate('billing_transactions')}
            className="p-4 rounded-2xl bg-card border border-border hover:border-pink-500/50 hover:bg-muted/40 transition-all text-left group shadow-sm flex flex-col justify-between"
          >
            <div className="flex items-center justify-between w-full mb-2">
              <span className="text-[11px] font-semibold text-muted-foreground group-hover:text-foreground">Monthly Recharge</span>
              <div className="p-2 rounded-xl bg-pink-500/10 text-pink-400">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
            <div>
              <div className="text-xl font-black text-pink-400 tracking-tight">
                Rs. {(metrics?.monthlyRecharge || 0).toLocaleString()}
              </div>
              <div className="text-[10px] text-muted-foreground font-semibold mt-0.5 flex items-center gap-1">
                <span>Comm: Rs. {(metrics?.monthlyCommission || 0).toLocaleString()}</span>
                <ArrowUpRight className="w-3 h-3 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </div>
          </button>
        </div>
      </div>

      {/* Channel Modules Quick Launchers */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div
          onClick={() => onNavigate('branches')}
          className="p-5 rounded-2xl border border-border bg-card/60 hover:border-primary/50 transition-all cursor-pointer group flex items-start gap-4"
        >
          <div className="p-3 rounded-xl bg-blue-500/10 text-blue-400 group-hover:scale-110 transition-transform">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-foreground flex items-center gap-1.5">
              Branch Management
              <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:translate-x-1 transition-transform" />
            </h3>
            <p className="text-xs text-muted-foreground mt-1">
              Configure regional branches, responsible managers, and branch operational wallets.
            </p>
          </div>
        </div>

        <div
          onClick={() => onNavigate('resellers')}
          className="p-5 rounded-2xl border border-border bg-card/60 hover:border-primary/50 transition-all cursor-pointer group flex items-start gap-4"
        >
          <div className="p-3 rounded-xl bg-amber-500/10 text-amber-400 group-hover:scale-110 transition-transform">
            <Store className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-foreground flex items-center gap-1.5">
              Reseller Partners
              <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:translate-x-1 transition-transform" />
            </h3>
            <p className="text-xs text-muted-foreground mt-1">
              Onboard wholesale resellers, commission models, and independent customer portfolios.
            </p>
          </div>
        </div>

        <div
          onClick={() => onNavigate('wallets')}
          className="p-5 rounded-2xl border border-border bg-card/60 hover:border-primary/50 transition-all cursor-pointer group flex items-start gap-4"
        >
          <div className="p-3 rounded-xl bg-purple-500/10 text-purple-400 group-hover:scale-110 transition-transform">
            <Wallet className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-foreground flex items-center gap-1.5">
              Wallets & Super Top-up
              <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:translate-x-1 transition-transform" />
            </h3>
            <p className="text-xs text-muted-foreground mt-1">
              Super Admin wallet credit control, credit limit assignment, and transaction audit ledger.
            </p>
          </div>
        </div>

        <div
          onClick={() => onNavigate('channel_pricing')}
          className="p-5 rounded-2xl border border-border bg-card/60 hover:border-primary/50 transition-all cursor-pointer group flex items-start gap-4"
        >
          <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-400 group-hover:scale-110 transition-transform">
            <DollarSign className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-foreground flex items-center gap-1.5">
              Channel Pricing & Commission
              <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:translate-x-1 transition-transform" />
            </h3>
            <p className="text-xs text-muted-foreground mt-1">
              Percentage discounts, fixed overrides, and duration-specific reseller commission rules.
            </p>
          </div>
        </div>
      </div>

      {/* Edit Organization Modal */}
      {editOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-card border border-border rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl">
            <div className="p-5 border-b border-border flex items-center justify-between bg-muted/30">
              <div className="flex items-center gap-2.5">
                <Building2 className="w-5 h-5 text-primary" />
                <h3 className="text-sm font-bold text-foreground">Edit Organization Settings</h3>
              </div>
              <button onClick={() => setEditOpen(false)} className="p-1.5 text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveProfile} className="p-5 space-y-4">
              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">Organization Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground block mb-1">Phone</label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground block mb-1">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">Address</label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">Website</label>
                <input
                  type="text"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground block mb-1">Currency Code</label>
                  <input
                    type="text"
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value.toUpperCase())}
                    required
                    className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs text-foreground font-mono focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground block mb-1">Timezone</label>
                  <input
                    type="text"
                    value={timezone}
                    onChange={(e) => setTimezone(e.target.value)}
                    required
                    className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs text-foreground font-mono focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">
                  Organization Default Grace Period (Days)
                </label>
                <input
                  type="number"
                  min="0"
                  max="30"
                  value={defaultGracePeriodDays}
                  onChange={(e) => setDefaultGracePeriodDays(Math.max(0, Math.min(30, parseInt(e.target.value, 10) || 0)))}
                  required
                  className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs text-foreground font-mono focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <p className="text-[10px] text-muted-foreground mt-1">
                  Global organization fallback grace period when a subscriber&apos;s service expires (0–30 days). Default is 3. Set to 0 to disable grace globally.
                </p>
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-border">
                <button
                  type="button"
                  onClick={() => setEditOpen(false)}
                  className="px-4 py-2 rounded-xl border border-border hover:bg-muted text-xs font-semibold text-foreground transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold shadow-md shadow-primary/20 hover:opacity-90 disabled:opacity-50 transition-opacity"
                >
                  {saving ? 'Saving...' : 'Save Settings'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
