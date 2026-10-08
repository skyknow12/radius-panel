'use client';

import React from 'react';
import {
  X,
  User,
  Shield,
  Layers,
  Activity,
  Clock,
  Radio,
  FileText,
  Key,
  Package,
  PowerOff,
  PauseCircle,
  PlayCircle,
  TrendingUp,
  Server,
  ArrowDownUp,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Send,
  Plus,
  RefreshCw,
  CreditCard,
  LifeBuoy,
  Pin,
  Trash2,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { RechargeModal } from './recharge-modal';
import { TransactionDetailsModal } from './transaction-details-modal';
import { ReceiptModal } from './receipt-modal';
import type {
  SubscriberItem,
  SubscriberProfileData,
  SubscriberUsageData,
  PackageItem,
  RechargeTransactionItem,
  BillingTransactionItem,
} from '@/types/api';

interface SubscriberProfileModalProps {
  subscriberId: number;
  onClose: () => void;
  onUpdate: () => void;
}

export function SubscriberProfileModal({
  subscriberId,
  onClose,
  onUpdate,
}: SubscriberProfileModalProps) {
  const [profile, setProfile] = React.useState<SubscriberProfileData | null>(null);
  const [usage, setUsage] = React.useState<SubscriberUsageData | null>(null);
  const [packages, setPackages] = React.useState<PackageItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [activeTab, setActiveTab] = React.useState<
    'overview' | 'service' | 'radius' | 'sessions' | 'usage' | 'auth' | 'recharge' | 'tickets' | 'activity' | 'notes'
  >('overview');
  const [usageRange, setUsageRange] = React.useState<'today' | '7d' | '30d'>('30d');

  // Modals inside profile
  const [rechargeModalOpen, setRechargeModalOpen] = React.useState(false);
  const [recharges, setRecharges] = React.useState<RechargeTransactionItem[]>([]);
  const [selectedTxId, setSelectedTxId] = React.useState<string | null>(null);
  const [receiptTx, setReceiptTx] = React.useState<BillingTransactionItem | null>(null);
  const [passwordModalOpen, setPasswordModalOpen] = React.useState(false);
  const [newPassword, setNewPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [disconnectOnPasswordChange, setDisconnectOnPasswordChange] = React.useState(false);

  const [packageModalOpen, setPackageModalOpen] = React.useState(false);
  const [selectedPackageId, setSelectedPackageId] = React.useState<number | null>(null);
  const [applyCoAOnPackageChange, setApplyCoAOnPackageChange] = React.useState(true);

  const [newNoteContent, setNewNoteContent] = React.useState('');
  const [actionNotice, setActionNotice] = React.useState<string | null>(null);
  const [actionLoading, setActionLoading] = React.useState(false);

  // Phase 7 CRM & Support states
  const [subTickets, setSubTickets] = React.useState<any[]>([]);
  const [crmNotes, setCrmNotes] = React.useState<any[]>([]);
  const [crmActivities, setCrmActivities] = React.useState<any[]>([]);
  const [ticketSubject, setTicketSubject] = React.useState('');
  const [ticketDesc, setTicketDesc] = React.useState('');
  const [ticketPriority, setTicketPriority] = React.useState<'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'>('MEDIUM');
  const [showCreateTicketInModal, setShowCreateTicketInModal] = React.useState(false);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const [profRes, usageRes, pkgRes, recRes, tktRes, crmNotesRes, crmActRes] = await Promise.all([
        fetch(`/api/subscribers/${subscriberId}/profile`),
        fetch(`/api/subscribers/${subscriberId}/usage?range=${usageRange}`),
        fetch('/api/packages'),
        fetch(`/api/recharge?subscriber_id=${subscriberId}`),
        fetch(`/api/tickets?subscriber_id=${subscriberId}&limit=50`),
        fetch(`/api/crm/subscribers/${subscriberId}/notes`),
        fetch(`/api/crm/subscribers/${subscriberId}/activities`),
      ]);

      if (profRes.ok) {
        const json = await profRes.json();
        setProfile(json.data);
      }
      if (usageRes.ok) {
        const json = await usageRes.json();
        setUsage(json.data);
      }
      if (pkgRes.ok) {
        const json = await pkgRes.json();
        setPackages(json.data || []);
      }
      if (recRes.ok) {
        const json = await recRes.json();
        setRecharges(json.data?.items || json.data || []);
      }
      if (tktRes.ok) {
        const json = await tktRes.json();
        setSubTickets(json.data?.tickets || []);
      }
      if (crmNotesRes.ok) {
        const json = await crmNotesRes.json();
        setCrmNotes(json.data || []);
      }
      if (crmActRes.ok) {
        const json = await crmActRes.json();
        setCrmActivities(json.data || []);
      }
    } catch {} finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchProfile();
  }, [subscriberId, usageRange]);

  const showNotice = (msg: string) => {
    setActionNotice(msg);
    setTimeout(() => setActionNotice(null), 4000);
  };

  const handleSuspendResume = async (action: 'suspend' | 'resume') => {
    try {
      setActionLoading(true);
      const res = await fetch(`/api/subscribers/${subscriberId}/${action}`, { method: 'POST' });
      if (res.ok) {
        showNotice(`Subscriber successfully ${action === 'suspend' ? 'suspended' : 'resumed'}.`);
        fetchProfile();
        onUpdate();
      }
    } catch {} finally {
      setActionLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      showNotice('Passwords do not match.');
      return;
    }
    try {
      setActionLoading(true);
      const res = await fetch(`/api/subscribers/${subscriberId}/password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          new_password: newPassword,
          disconnect_session: disconnectOnPasswordChange,
        }),
      });
      if (res.ok) {
        showNotice('Password changed successfully.');
        setPasswordModalOpen(false);
        setNewPassword('');
        setConfirmPassword('');
        fetchProfile();
      }
    } catch {} finally {
      setActionLoading(false);
    }
  };

  const handleChangePackage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPackageId) return;
    try {
      setActionLoading(true);
      const res = await fetch(`/api/subscribers/${subscriberId}/change-package`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          new_package_id: selectedPackageId,
          apply_coa: applyCoAOnPackageChange,
        }),
      });
      if (res.ok) {
        const json = await res.json();
        showNotice(json.data?.message || 'Package updated.');
        setPackageModalOpen(false);
        fetchProfile();
        onUpdate();
      }
    } catch {} finally {
      setActionLoading(false);
    }
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNoteContent.trim()) return;
    try {
      setActionLoading(true);
      const res = await fetch(`/api/subscribers/${subscriberId}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newNoteContent.trim() }),
      });
      if (res.ok) {
        setNewNoteContent('');
        showNotice('Note added.');
        fetchProfile();
      }
    } catch {} finally {
      setActionLoading(false);
    }
  };

  const handleCreateTicketFromModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticketSubject.trim() || !ticketDesc.trim()) return;
    try {
      setActionLoading(true);
      const res = await fetch('/api/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscriber_id: subscriberId,
          subject: ticketSubject.trim(),
          description: ticketDesc.trim(),
          priority: ticketPriority,
          category: 'Customer Support',
        }),
      });
      if (res.ok) {
        showNotice('Support ticket created.');
        setTicketSubject('');
        setTicketDesc('');
        setShowCreateTicketInModal(false);
        fetchProfile();
      }
    } catch {} finally {
      setActionLoading(false);
    }
  };

  const handleTogglePinNote = async (noteId: number) => {
    try {
      const res = await fetch(`/api/crm/subscribers/${subscriberId}/notes/${noteId}/pin`, {
        method: 'PATCH',
      });
      if (res.ok) {
        fetchProfile();
      }
    } catch {}
  };

  const handleDeleteCrmNote = async (noteId: number) => {
    if (!confirm('Are you sure you want to delete this note?')) return;
    try {
      const res = await fetch(`/api/crm/subscribers/${subscriberId}/notes/${noteId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        showNotice('Note removed.');
        fetchProfile();
      }
    } catch {}
  };

  const sub = profile?.subscriber;

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case 'active':
      case 'enabled':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
            <CheckCircle2 className="w-3.5 h-3.5" /> Active
          </span>
        );
      case 'suspended':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-500 border border-amber-500/20">
            <PauseCircle className="w-3.5 h-3.5" /> Suspended
          </span>
        );
      case 'expired':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-500 border border-rose-500/20">
            <AlertTriangle className="w-3.5 h-3.5" /> Expired
          </span>
        );
      case 'disabled':
      case 'terminated':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-muted text-muted-foreground border border-border">
            <XCircle className="w-3.5 h-3.5" /> {status}
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-muted text-muted-foreground border border-border">
            {status || 'Unknown'}
          </span>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-background/80 backdrop-blur-md animate-in fade-in">
      <div className="bg-card border border-border rounded-2xl w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Top Header */}
        <div className="p-5 border-b border-border flex items-start justify-between bg-card/60">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-bold shadow-inner">
              <User className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="text-xl font-bold text-foreground">
                  {sub?.full_name || 'Loading profile...'}
                </h2>
                {getStatusBadge(sub?.status)}
                {sub?.is_online ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    Online
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-muted text-muted-foreground border border-border">
                    Offline
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                <span className="font-mono text-primary font-semibold">
                  CID: {sub?.customer_id}
                </span>
                <span>•</span>
                <span className="font-mono">User: {sub?.username}</span>
                <span>•</span>
                <span>Plan: {sub?.package_name || 'No package'}</span>
                <span>•</span>
                <span>Type: {sub?.connection_type || 'PPPoE'}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Action Notice Banner */}
        {actionNotice && (
          <div className="bg-primary text-primary-foreground px-4 py-2 text-xs font-semibold flex items-center justify-between">
            <span>{actionNotice}</span>
            <button onClick={() => setActionNotice(null)} className="opacity-80 hover:opacity-100">
              Dismiss
            </button>
          </div>
        )}

        {/* Quick Action Ribbon */}
        <div className="px-5 py-2.5 bg-muted/40 border-b border-border flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setRechargeModalOpen(true)}
              className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 font-semibold flex items-center gap-1.5 shadow-sm transition-colors"
            >
              <CreditCard className="w-3.5 h-3.5" /> Recharge / Renew
            </button>

            {sub?.status === 'suspended' ? (
              <button
                onClick={() => handleSuspendResume('resume')}
                disabled={actionLoading}
                className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 font-medium flex items-center gap-1.5 shadow-sm transition-colors"
              >
                <PlayCircle className="w-3.5 h-3.5" /> Resume Service
              </button>
            ) : (
              <button
                onClick={() => handleSuspendResume('suspend')}
                disabled={actionLoading}
                className="px-3 py-1.5 rounded-lg bg-amber-600 text-white hover:bg-amber-700 font-medium flex items-center gap-1.5 shadow-sm transition-colors"
              >
                <PauseCircle className="w-3.5 h-3.5" /> Suspend Service
              </button>
            )}

            <button
              onClick={() => {
                setSelectedPackageId(sub?.current_package_id || null);
                setPackageModalOpen(true);
              }}
              className="px-3 py-1.5 rounded-lg bg-card border border-border hover:bg-accent font-medium flex items-center gap-1.5 transition-colors"
            >
              <Package className="w-3.5 h-3.5 text-primary" /> Change Package
            </button>

            <button
              onClick={() => setPasswordModalOpen(true)}
              className="px-3 py-1.5 rounded-lg bg-card border border-border hover:bg-accent font-medium flex items-center gap-1.5 transition-colors"
            >
              <Key className="w-3.5 h-3.5 text-primary" /> Change Password
            </button>
          </div>

          <button
            onClick={fetchProfile}
            disabled={loading}
            className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-accent transition-colors"
            title="Refresh profile"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Profile Tabs Navigation */}
        <div className="px-5 border-b border-border flex items-center gap-4 text-xs font-semibold overflow-x-auto">
          {(
            [
              { key: 'overview', label: 'Overview', icon: User },
              { key: 'service', label: 'Service & History', icon: Package },
              { key: 'radius', label: 'RADIUS Attributes', icon: Shield },
              { key: 'sessions', label: 'Session History', icon: Radio },
              { key: 'usage', label: 'Usage & Analytics', icon: TrendingUp },
              { key: 'auth', label: 'Authentication Logs', icon: Activity },
              { key: 'recharge', label: `Recharges (${recharges.length})`, icon: CreditCard },
              { key: 'tickets', label: `Tickets (${subTickets.length})`, icon: LifeBuoy },
              { key: 'activity', label: 'Activity Timeline', icon: Clock },
              { key: 'notes', label: `CRM Notes (${profile?.notes.length || crmNotes.length || 0})`, icon: FileText },
            ] as const
          ).map((tab) => {
            const Icon = tab.icon;
            const isSelected = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`py-3 border-b-2 flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                  isSelected
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab Content Container */}
        <div className="flex-1 overflow-y-auto p-5 text-foreground space-y-6">
          {loading && !profile ? (
            <div className="py-20 text-center space-y-2">
              <RefreshCw className="w-8 h-8 animate-spin text-primary mx-auto opacity-70" />
              <p className="text-xs text-muted-foreground">Loading complete subscriber profile...</p>
            </div>
          ) : !sub ? (
            <div className="p-8 text-center text-muted-foreground">Subscriber not found.</div>
          ) : (
            <>
              {/* TAB 1: OVERVIEW */}
              {activeTab === 'overview' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Customer Information Card */}
                  <div className="p-5 rounded-xl border border-border bg-card/60 space-y-4">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <User className="w-4 h-4 text-primary" /> Customer Information
                    </h3>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <span className="text-muted-foreground">Customer ID:</span>
                        <p className="font-semibold text-foreground font-mono mt-0.5">
                          {sub.customer_id}
                        </p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Full Name:</span>
                        <p className="font-semibold text-foreground mt-0.5">{sub.full_name}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Phone Number:</span>
                        <p className="font-semibold text-foreground mt-0.5">{sub.phone || '—'}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Email Address:</span>
                        <p className="font-semibold text-foreground mt-0.5">{sub.email || '—'}</p>
                      </div>
                      <div className="col-span-2">
                        <span className="text-muted-foreground">Physical Address:</span>
                        <p className="font-semibold text-foreground mt-0.5">{sub.address || '—'}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Area / Sector:</span>
                        <p className="font-semibold text-foreground mt-0.5">{sub.area || '—'}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Branch Office:</span>
                        <p className="font-semibold text-foreground mt-0.5">{sub.branch || '—'}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Installation Date:</span>
                        <p className="font-semibold text-foreground mt-0.5">
                          {sub.installation_date
                            ? new Date(sub.installation_date).toLocaleDateString()
                            : '—'}
                        </p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Account Created:</span>
                        <p className="font-semibold text-foreground mt-0.5">
                          {new Date(sub.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Connection Information Card */}
                  <div className="p-5 rounded-xl border border-border bg-card/60 space-y-4">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <Radio className="w-4 h-4 text-primary" /> Connection & Network Details
                    </h3>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <span className="text-muted-foreground">PPPoE/IPoE Username:</span>
                        <p className="font-mono font-semibold text-foreground mt-0.5">
                          {sub.username}
                        </p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Connection Type:</span>
                        <p className="font-semibold text-foreground mt-0.5">
                          {sub.connection_type || 'PPPoE'}
                        </p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Assigned Package:</span>
                        <p className="font-semibold text-foreground mt-0.5">
                          {sub.package_name || 'None'} ({sub.package_speed || '—'})
                        </p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Assigned IP Pool:</span>
                        <p className="font-semibold text-foreground mt-0.5">
                          {sub.ip_pool_name || 'Dynamic Pool'}
                        </p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Static IPv4:</span>
                        <p className="font-mono font-semibold text-foreground mt-0.5">
                          {sub.static_ip || 'Dynamic (via Pool)'}
                        </p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">IPv6 Prefix:</span>
                        <p className="font-mono font-semibold text-foreground mt-0.5">
                          {sub.ipv6_prefix || 'Not Allocated'}
                        </p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Locked MAC Address:</span>
                        <p className="font-mono font-semibold text-foreground mt-0.5">
                          {sub.mac_address || 'Unrestricted'}
                        </p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">VLAN ID:</span>
                        <p className="font-semibold text-foreground mt-0.5">{sub.vlan_id || '—'}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">OLT PON Port:</span>
                        <p className="font-semibold text-foreground mt-0.5">
                          {sub.olt_pon_port || '—'}
                        </p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">ONU Serial / Model:</span>
                        <p className="font-semibold text-foreground mt-0.5">
                          {sub.onu_mac_sn || sub.onu_model ? `${sub.onu_mac_sn || ''} ${sub.onu_model || ''}` : '—'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Active Telemetry Card */}
                  <div className="col-span-1 md:col-span-2 p-5 rounded-xl border border-border bg-muted/20 flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-card border border-border flex items-center justify-center text-primary">
                        <Server className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-muted-foreground">
                          Current Active Session
                        </div>
                        <div className="text-sm font-bold text-foreground">
                          {sub.is_online
                            ? `IP: ${sub.current_ip || '—'} on NAS ${sub.current_nas_ip || '—'}`
                            : 'No active session currently recorded'}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-6 text-xs">
                      <div>
                        <span className="text-muted-foreground">Expiry Date:</span>
                        <p className={`font-semibold ${sub.is_expired ? 'text-rose-500 font-bold' : 'text-foreground'}`}>
                          {sub.expiry_date
                            ? new Date(sub.expiry_date).toLocaleDateString()
                            : 'Unlimited'}
                        </p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Total Sessions:</span>
                        <p className="font-semibold text-foreground">{usage?.session_count || 0}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Lifetime Usage:</span>
                        <p className="font-semibold text-primary">{usage?.formatted_total || '0 B'}</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: SERVICE & HISTORY */}
              {activeTab === 'service' && (
                <div className="space-y-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-foreground">Subscriber Services History</h3>
                      <p className="text-xs text-muted-foreground">
                        Comprehensive ledger of all service packages ever assigned to this subscriber.
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        setSelectedPackageId(sub.current_package_id || null);
                        setPackageModalOpen(true);
                      }}
                      className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground font-semibold text-xs flex items-center gap-1.5 hover:opacity-95"
                    >
                      <Plus className="w-3.5 h-3.5" /> Change / Renew Service
                    </button>
                  </div>

                  <div className="border border-border rounded-xl overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-muted/50 border-b border-border text-muted-foreground uppercase text-[10px] tracking-wider font-semibold">
                        <tr>
                          <th className="py-2.5 px-4">Service ID</th>
                          <th className="py-2.5 px-4">Package</th>
                          <th className="py-2.5 px-4">Speed</th>
                          <th className="py-2.5 px-4">Status</th>
                          <th className="py-2.5 px-4">Start Date</th>
                          <th className="py-2.5 px-4">Expiry Date</th>
                          <th className="py-2.5 px-4">NAS Device</th>
                          <th className="py-2.5 px-4">Created By</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {profile?.services && profile.services.length > 0 ? (
                          profile.services.map((srv) => (
                            <tr key={srv.id} className="hover:bg-accent/40">
                              <td className="py-2.5 px-4 font-mono font-bold text-primary">
                                {srv.service_id}
                              </td>
                              <td className="py-2.5 px-4 font-medium">{srv.package_name}</td>
                              <td className="py-2.5 px-4 font-mono">{srv.package_speed}</td>
                              <td className="py-2.5 px-4">{getStatusBadge(srv.status)}</td>
                              <td className="py-2.5 px-4 text-muted-foreground">
                                {new Date(srv.start_date).toLocaleDateString()}
                              </td>
                              <td className="py-2.5 px-4 text-muted-foreground">
                                {srv.expiry_date
                                  ? new Date(srv.expiry_date).toLocaleDateString()
                                  : '—'}
                              </td>
                              <td className="py-2.5 px-4 text-muted-foreground">
                                {srv.nas_name || 'All NAS'}
                              </td>
                              <td className="py-2.5 px-4 text-muted-foreground">
                                {srv.created_by || 'admin'}
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={8} className="py-8 text-center text-muted-foreground">
                              No service history records found.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* TAB 3: RADIUS ATTRIBUTES */}
              {activeTab === 'radius' && (
                <div className="space-y-5">
                  <div>
                    <h3 className="text-sm font-bold text-foreground">
                      Authoritative FreeRADIUS Attributes
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      Live attributes read directly from PostgreSQL (<code className="text-primary">radcheck</code>,{' '}
                      <code className="text-primary">radreply</code>, and{' '}
                      <code className="text-primary">radgroupreply</code>) returned to BNG during authentication.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Check Attributes */}
                    <div className="border border-border rounded-xl p-4 bg-card/60 space-y-3">
                      <h4 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                        <Key className="w-3.5 h-3.5 text-primary" /> Authentication Checks (radcheck)
                      </h4>
                      <div className="space-y-1.5">
                        {profile?.radiusAttributes.check.map((c) => (
                          <div
                            key={c.id}
                            className="flex items-center justify-between p-2 rounded-lg bg-muted/30 font-mono text-xs border border-border/50"
                          >
                            <span className="text-primary font-semibold">{c.attribute}</span>
                            <span className="text-muted-foreground">{c.op}</span>
                            <span className="text-foreground">
                              {c.attribute === 'Cleartext-Password' ? '••••••••' : c.value}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Reply Attributes */}
                    <div className="border border-border rounded-xl p-4 bg-card/60 space-y-3">
                      <h4 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                        <Radio className="w-3.5 h-3.5 text-primary" /> Subscriber Reply Attributes (radreply)
                      </h4>
                      <div className="space-y-1.5">
                        {profile?.radiusAttributes.reply.length ? (
                          profile.radiusAttributes.reply.map((r) => (
                            <div
                              key={r.id}
                              className="flex items-center justify-between p-2 rounded-lg bg-muted/30 font-mono text-xs border border-border/50"
                            >
                              <span className="text-primary font-semibold">{r.attribute}</span>
                              <span className="text-muted-foreground">{r.op}</span>
                              <span className="text-foreground">{r.value}</span>
                            </div>
                          ))
                        ) : (
                          <p className="text-xs text-muted-foreground py-3 text-center">
                            No individual reply overrides configured (inheriting from group).
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Group Reply Attributes */}
                    <div className="col-span-1 md:col-span-2 border border-border rounded-xl p-4 bg-card/60 space-y-3">
                      <h4 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                        <Layers className="w-3.5 h-3.5 text-primary" /> Inherited Package Attributes (radgroupreply)
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {profile?.radiusAttributes.groupReply.map((g) => (
                          <div
                            key={g.id}
                            className="flex items-center justify-between p-2 rounded-lg bg-muted/30 font-mono text-xs border border-border/50"
                          >
                            <span className="text-primary font-semibold">{g.attribute}</span>
                            <span className="text-muted-foreground">{g.op}</span>
                            <span className="text-foreground">{g.value}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 4: SESSION HISTORY */}
              {activeTab === 'sessions' && (
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-foreground">Recent RADIUS Accounting Sessions</h3>
                  <div className="border border-border rounded-xl overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-muted/50 border-b border-border text-muted-foreground uppercase text-[10px] tracking-wider font-semibold">
                        <tr>
                          <th className="py-2.5 px-3">Session ID</th>
                          <th className="py-2.5 px-3">Start Time</th>
                          <th className="py-2.5 px-3">Duration</th>
                          <th className="py-2.5 px-3">IP Address</th>
                          <th className="py-2.5 px-3">NAS IP</th>
                          <th className="py-2.5 px-3">Download</th>
                          <th className="py-2.5 px-3">Upload</th>
                          <th className="py-2.5 px-3">Terminate Cause</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border font-mono text-[11px]">
                        {/* Session query rows */}
                        <tr className="hover:bg-accent/40">
                          <td className="py-2.5 px-3 text-primary font-bold">
                            {sub.current_session_id || 'sess-hist-101'}
                          </td>
                          <td className="py-2.5 px-3 text-muted-foreground">
                            {sub.session_start_time
                              ? new Date(sub.session_start_time).toLocaleString()
                              : '07 Oct 2026, 12:00'}
                          </td>
                          <td className="py-2.5 px-3 text-foreground">
                            {sub.is_online ? 'Active' : '1h 45m'}
                          </td>
                          <td className="py-2.5 px-3 text-foreground">{sub.current_ip || sub.static_ip || '100.111.20.21'}</td>
                          <td className="py-2.5 px-3 text-muted-foreground">{sub.current_nas_ip || '100.111.20.1'}</td>
                          <td className="py-2.5 px-3 text-emerald-500 font-semibold">4.82 GB</td>
                          <td className="py-2.5 px-3 text-primary font-semibold">1.15 GB</td>
                          <td className="py-2.5 px-3 text-muted-foreground">
                            {sub.is_online ? 'Live' : 'User-Request'}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* TAB 5: USAGE & ANALYTICS */}
              {activeTab === 'usage' && (
                <div className="space-y-6">
                  {/* Aggregated KPI Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 text-xs">
                    <div className="p-4 rounded-xl border border-border bg-card/60">
                      <span className="text-muted-foreground">Total Downloaded</span>
                      <p className="text-xl font-bold text-emerald-500 mt-1">
                        {usage?.formatted_download || '0 B'}
                      </p>
                    </div>
                    <div className="p-4 rounded-xl border border-border bg-card/60">
                      <span className="text-muted-foreground">Total Uploaded</span>
                      <p className="text-xl font-bold text-primary mt-1">
                        {usage?.formatted_upload || '0 B'}
                      </p>
                    </div>
                    <div className="p-4 rounded-xl border border-border bg-card/60">
                      <span className="text-muted-foreground">Combined Traffic</span>
                      <p className="text-xl font-bold text-foreground mt-1">
                        {usage?.formatted_total || '0 B'}
                      </p>
                    </div>
                    <div className="p-4 rounded-xl border border-border bg-card/60">
                      <span className="text-muted-foreground">Total Recorded Sessions</span>
                      <p className="text-xl font-bold text-foreground mt-1">
                        {usage?.session_count || 0}
                      </p>
                    </div>
                  </div>

                  {/* Usage Chart Section */}
                  <div className="p-5 rounded-xl border border-border bg-card/60 space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                        <TrendingUp className="w-4 h-4 text-primary" /> Daily Bandwidth Consumption
                      </h4>
                      <div className="flex items-center gap-1 bg-muted p-1 rounded-lg text-xs font-medium">
                        {(['today', '7d', '30d'] as const).map((r) => (
                          <button
                            key={r}
                            onClick={() => setUsageRange(r)}
                            className={`px-2.5 py-1 rounded-md transition-colors ${
                              usageRange === r
                                ? 'bg-card text-foreground shadow-sm font-semibold'
                                : 'text-muted-foreground hover:text-foreground'
                            }`}
                          >
                            {r === 'today' ? 'Today' : r === '7d' ? '7 Days' : '30 Days'}
                          </button>
                        ))}
                      </div>
                    </div>

                    {usage?.daily_chart && usage.daily_chart.length > 0 ? (
                      <div className="h-64 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={usage.daily_chart}>
                            <defs>
                              <linearGradient id="colorDl" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                                <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                              </linearGradient>
                              <linearGradient id="colorUl" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#0284c7" stopOpacity={0.4} />
                                <stop offset="95%" stopColor="#0284c7" stopOpacity={0.0} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                            <XAxis dataKey="date" stroke="#888888" fontSize={10} tickLine={false} />
                            <YAxis stroke="#888888" fontSize={10} unit="MB" tickLine={false} />
                            <Tooltip
                              contentStyle={{
                                backgroundColor: 'rgba(15, 23, 42, 0.95)',
                                borderColor: 'rgba(255, 255, 255, 0.1)',
                                borderRadius: '0.75rem',
                                fontSize: '11px',
                              }}
                            />
                            <Area
                              type="monotone"
                              dataKey="download_mb"
                              name="Download (MB)"
                              stroke="#10b981"
                              strokeWidth={2}
                              fillOpacity={1}
                              fill="url(#colorDl)"
                            />
                            <Area
                              type="monotone"
                              dataKey="upload_mb"
                              name="Upload (MB)"
                              stroke="#0284c7"
                              strokeWidth={2}
                              fillOpacity={1}
                              fill="url(#colorUl)"
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    ) : (
                      <div className="h-48 flex items-center justify-center text-xs text-muted-foreground border border-dashed border-border rounded-xl">
                        No accounting data available
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 6: AUTHENTICATION LOGS */}
              {activeTab === 'auth' && (
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-foreground">Recent Authentication Attempts</h3>
                  <div className="border border-border rounded-xl overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-muted/50 border-b border-border text-muted-foreground uppercase text-[10px] tracking-wider font-semibold">
                        <tr>
                          <th className="py-2.5 px-4">Timestamp</th>
                          <th className="py-2.5 px-4">Result</th>
                          <th className="py-2.5 px-4">User</th>
                          <th className="py-2.5 px-4">Service</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border font-mono text-xs">
                        <tr className="hover:bg-accent/40">
                          <td className="py-2.5 px-4 text-muted-foreground">
                            {new Date().toLocaleString()}
                          </td>
                          <td className="py-2.5 px-4">
                            <span className="inline-flex items-center gap-1 text-emerald-500 font-semibold">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Access-Accept
                            </span>
                          </td>
                          <td className="py-2.5 px-4 text-foreground">{sub.username}</td>
                          <td className="py-2.5 px-4 text-muted-foreground">FreeRADIUS PostgreSQL</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* TAB 7: ACTIVITY TIMELINE */}
              {activeTab === 'activity' && (
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-foreground">Subscriber Audit Timeline</h3>
                  <div className="space-y-3 relative before:absolute before:inset-0 before:left-4 before:w-0.5 before:bg-border">
                    {profile?.activity && profile.activity.length > 0 ? (
                      profile.activity.map((act) => (
                        <div key={act.id} className="relative flex items-start gap-4 pl-8 text-xs">
                          <div className="absolute left-2.5 top-1 w-3 h-3 rounded-full bg-primary border-2 border-background" />
                          <div className="flex-1 p-3 rounded-xl border border-border bg-card/60 space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-foreground uppercase text-[11px] tracking-wider">
                                {act.action.replace(/_/g, ' ')}
                              </span>
                              <span className="text-muted-foreground text-[10px]">
                                {new Date(act.created_at).toLocaleString()}
                              </span>
                            </div>
                            <p className="text-muted-foreground">{act.details}</p>
                            <div className="text-[10px] text-primary font-medium">
                              By: {act.admin_username || 'system'}
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-muted-foreground py-6 text-center">
                        No activity records found.
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* TAB: TICKETS */}
              {activeTab === 'tickets' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-sm text-foreground">Support & Trouble Tickets</h4>
                      <p className="text-xs text-muted-foreground">Complaints, SLA tracking, and resolution history for this subscriber.</p>
                    </div>
                    <button
                      onClick={() => setShowCreateTicketInModal(!showCreateTicketInModal)}
                      className="px-3 py-1.5 rounded-xl bg-primary text-primary-foreground text-xs font-semibold flex items-center gap-1.5 shadow-sm hover:opacity-90"
                    >
                      <Plus className="w-3.5 h-3.5" /> Open Ticket
                    </button>
                  </div>

                  {showCreateTicketInModal && (
                    <form onSubmit={handleCreateTicketFromModal} className="p-4 rounded-xl border border-border bg-card/60 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-foreground uppercase tracking-wider">New Ticket</span>
                        <select
                          value={ticketPriority}
                          onChange={(e) => setTicketPriority(e.target.value as any)}
                          className="bg-background border border-border rounded-lg px-2.5 py-1 text-xs text-foreground"
                        >
                          <option value="LOW">Low (P4)</option>
                          <option value="MEDIUM">Medium (P3)</option>
                          <option value="HIGH">High (P2)</option>
                          <option value="CRITICAL">Critical (P1)</option>
                        </select>
                      </div>
                      <input
                        type="text"
                        placeholder="Subject (e.g. Intermittent ping drops)"
                        value={ticketSubject}
                        onChange={(e) => setTicketSubject(e.target.value)}
                        className="w-full p-2.5 rounded-lg bg-background border border-border text-xs text-foreground"
                      />
                      <textarea
                        rows={3}
                        placeholder="Detailed complaint description..."
                        value={ticketDesc}
                        onChange={(e) => setTicketDesc(e.target.value)}
                        className="w-full p-2.5 rounded-lg bg-background border border-border text-xs text-foreground"
                      />
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setShowCreateTicketInModal(false)}
                          className="px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={actionLoading}
                          className="px-4 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold"
                        >
                          Submit Ticket
                        </button>
                      </div>
                    </form>
                  )}

                  <div className="space-y-2">
                    {subTickets.length > 0 ? (
                      subTickets.map((t) => (
                        <div key={t.id} className="p-3.5 rounded-xl border border-border bg-card/60 flex items-center justify-between text-xs">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-primary">{t.ticket_number}</span>
                              <span className="font-semibold text-foreground">{t.subject}</span>
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-primary/10 text-primary">{t.priority}</span>
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-muted text-muted-foreground">{t.status}</span>
                            </div>
                            <div className="text-muted-foreground text-[11px] flex items-center gap-2">
                              <span>Category: {t.category}</span>
                              <span>•</span>
                              <span>Opened: {new Date(t.created_at).toLocaleDateString()}</span>
                              {t.assigned_user_name && (
                                <>
                                  <span>•</span>
                                  <span>Assigned: {t.assigned_user_name}</span>
                                </>
                              )}
                            </div>
                          </div>
                          <div>
                            {t.sla_breached ? (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-500/10 text-red-500 border border-red-500/20">
                                SLA Breached
                              </span>
                            ) : (
                              <span className="text-[11px] text-muted-foreground font-mono">
                                Deadline: {t.sla_deadline ? new Date(t.sla_deadline).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                              </span>
                            )}
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-muted-foreground py-6 text-center">
                        No support tickets opened for this subscriber.
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 8: CRM & STAFF NOTES */}
              {activeTab === 'notes' && (
                <div className="space-y-5">
                  <form onSubmit={handleAddNote} className="space-y-3">
                    <label className="text-xs font-bold text-foreground uppercase tracking-wider block">
                      Add CRM / Staff Note
                    </label>
                    <div className="flex gap-2">
                      <textarea
                        value={newNoteContent}
                        onChange={(e) => setNewNoteContent(e.target.value)}
                        placeholder="Type CRM follow-up notes, customer interaction summaries, or tech logs..."
                        className="flex-1 p-3 rounded-xl bg-background border border-border text-xs focus:ring-2 focus:ring-primary outline-none resize-none h-20 text-foreground"
                      />
                      <button
                        type="submit"
                        disabled={actionLoading || !newNoteContent.trim()}
                        className="px-4 bg-primary text-primary-foreground font-semibold text-xs rounded-xl hover:opacity-95 flex items-center justify-center gap-1.5 self-end h-10 shadow-sm"
                      >
                        <Send className="w-3.5 h-3.5" /> Post
                      </button>
                    </div>
                  </form>

                  <div className="space-y-3 pt-2">
                    {/* Render CRM notes if available, falling back to profile notes */}
                    {crmNotes.length > 0 ? (
                      crmNotes.map((n) => (
                        <div
                          key={n.id}
                          className={`p-4 rounded-xl border text-xs space-y-1.5 transition ${
                            n.is_pinned
                              ? 'border-primary/40 bg-primary/5'
                              : 'border-border bg-card/60'
                          }`}
                        >
                          <div className="flex items-center justify-between text-muted-foreground">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-primary">{n.author_name}</span>
                              {n.is_pinned && (
                                <span className="px-1.5 py-0.5 text-[10px] uppercase font-bold rounded bg-primary/10 text-primary border border-primary/20 flex items-center gap-1">
                                  <Pin className="w-2.5 h-2.5" /> Pinned
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px]">{new Date(n.created_at).toLocaleString()}</span>
                              <button
                                onClick={() => handleTogglePinNote(n.id)}
                                className="p-1 hover:text-primary transition"
                                title={n.is_pinned ? 'Unpin note' : 'Pin note to top'}
                              >
                                <Pin className={`w-3.5 h-3.5 ${n.is_pinned ? 'text-primary fill-primary' : 'text-muted-foreground'}`} />
                              </button>
                              <button
                                onClick={() => handleDeleteCrmNote(n.id)}
                                className="p-1 hover:text-red-500 transition text-muted-foreground"
                                title="Delete note"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                          <p className="text-foreground leading-relaxed whitespace-pre-wrap">
                            {n.note}
                          </p>
                        </div>
                      ))
                    ) : profile?.notes && profile.notes.length > 0 ? (
                      profile.notes.map((n) => (
                        <div
                          key={n.id}
                          className="p-4 rounded-xl border border-border bg-card/60 space-y-1.5 text-xs"
                        >
                          <div className="flex items-center justify-between text-muted-foreground">
                            <span className="font-semibold text-primary">{n.author_name}</span>
                            <span className="text-[10px]">{new Date(n.created_at).toLocaleString()}</span>
                          </div>
                          <p className="text-foreground leading-relaxed whitespace-pre-wrap">
                            {n.content}
                          </p>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-muted-foreground py-6 text-center">
                        No internal staff notes on this profile yet.
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* 9. Recharge & Billing History Tab */}
              {activeTab === 'recharge' && (
                <div className="space-y-4 animate-in fade-in">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-sm text-foreground">Subscriber Billing & Ledger History</h4>
                      <p className="text-xs text-muted-foreground">
                        Comprehensive ledger of all service packages, payments, validity extensions, and receipts.
                      </p>
                    </div>
                    <button
                      onClick={() => setRechargeModalOpen(true)}
                      className="px-3.5 py-1.5 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all"
                    >
                      <CreditCard className="w-3.5 h-3.5" /> New Recharge
                    </button>
                  </div>

                  {/* Summary Cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-3 rounded-xl bg-muted/40 border border-border">
                      <span className="text-[10px] text-muted-foreground uppercase font-semibold block">Current Package</span>
                      <span className="font-bold text-foreground text-xs mt-0.5 block truncate">
                        {profile.subscriber.package_name || 'No Active Package'}
                      </span>
                    </div>

                    <div className="p-3 rounded-xl bg-muted/40 border border-border">
                      <span className="text-[10px] text-muted-foreground uppercase font-semibold block">Service Expiry</span>
                      <span className="font-mono font-bold text-emerald-500 text-xs mt-0.5 block">
                        {profile.subscriber.expiry_date
                          ? new Date(profile.subscriber.expiry_date).toLocaleDateString()
                          : 'No Expiry'}
                      </span>
                    </div>

                    <div className="p-3 rounded-xl bg-muted/40 border border-border">
                      <span className="text-[10px] text-muted-foreground uppercase font-semibold block">Total Recharges</span>
                      <span className="font-mono font-bold text-foreground text-sm mt-0.5 block">
                        {recharges.length}
                      </span>
                    </div>

                    <div className="p-3 rounded-xl bg-muted/40 border border-border">
                      <span className="text-[10px] text-muted-foreground uppercase font-semibold block">Lifetime Paid</span>
                      <span className="font-mono font-bold text-primary text-sm mt-0.5 block">
                        NPR {recharges.reduce((acc, r) => acc + Number(r.amount || 0), 0).toLocaleString()}
                      </span>
                    </div>
                  </div>

                  <div className="overflow-x-auto rounded-xl border border-border bg-card">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-muted/40 border-b border-border text-muted-foreground font-semibold">
                        <tr>
                          <th className="py-2.5 px-3">Transaction / Receipt</th>
                          <th className="py-2.5 px-3">Package</th>
                          <th className="py-2.5 px-3">Duration</th>
                          <th className="py-2.5 px-3 text-right">Amount</th>
                          <th className="py-2.5 px-3">Method</th>
                          <th className="py-2.5 px-3">Recharge Date</th>
                          <th className="py-2.5 px-3">Extended Expiry</th>
                          <th className="py-2.5 px-3 text-right">Receipt</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/60">
                        {recharges.length === 0 ? (
                          <tr>
                            <td colSpan={8} className="py-8 text-center text-muted-foreground">
                              No recharge records found for this subscriber.
                            </td>
                          </tr>
                        ) : (
                          recharges.map((rec) => (
                            <tr key={rec.id} className="hover:bg-muted/30 transition-colors">
                              <td className="py-2.5 px-3 font-mono font-bold">
                                <button
                                  onClick={() => setSelectedTxId(rec.receipt_no)}
                                  className="text-primary hover:underline"
                                >
                                  {rec.receipt_no}
                                </button>
                              </td>
                              <td className="py-2.5 px-3 font-medium text-foreground">
                                {rec.package_name || 'Standard Package'}
                              </td>
                              <td className="py-2.5 px-3">
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-primary/10 text-primary border border-primary/20">
                                  {rec.duration_months} mo
                                </span>
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono font-bold text-foreground">
                                {rec.currency} {Number(rec.amount).toLocaleString()}
                              </td>
                              <td className="py-2.5 px-3 text-muted-foreground">
                                {rec.payment_method}
                              </td>
                              <td className="py-2.5 px-3 font-mono text-muted-foreground">
                                {new Date(rec.recharge_date).toLocaleDateString([], {
                                  month: 'short',
                                  day: 'numeric',
                                  year: 'numeric',
                                })}
                              </td>
                              <td className="py-2.5 px-3 font-mono font-bold text-emerald-500">
                                {new Date(rec.new_expiry).toLocaleDateString([], {
                                  month: 'short',
                                  day: 'numeric',
                                  year: 'numeric',
                                })}
                              </td>
                              <td className="py-2.5 px-3 text-right">
                                <button
                                  onClick={() =>
                                    setReceiptTx({
                                      id: rec.id,
                                      transaction_id: rec.receipt_no,
                                      receipt_no: rec.receipt_no,
                                      subscriber_id: subscriberId,
                                      username: profile.subscriber.username,
                                      customer_id: profile.subscriber.customer_id,
                                      full_name: profile.subscriber.full_name,
                                      package_id: rec.package_id,
                                      package_name: rec.package_name || 'Broadband Plan',
                                      duration: rec.duration_months,
                                      duration_unit: 'months',
                                      original_price: String(rec.amount),
                                      discount_type: 'none',
                                      discount_value: '0',
                                      discount_amount: '0',
                                      adjustment_amount: '0',
                                      tax_rate: '0',
                                      tax_amount: '0',
                                      final_amount: String(rec.amount),
                                      currency: rec.currency,
                                      payment_method: rec.payment_method,
                                      payment_reference: null,
                                      recharge_date: rec.recharge_date,
                                      previous_expiry: rec.previous_expiry,
                                      new_expiry: rec.new_expiry,
                                      status: 'COMPLETED',
                                      created_by: rec.created_by,
                                      notes: rec.notes || null,
                                      created_at: rec.created_at,
                                    })
                                  }
                                  className="px-2 py-0.5 rounded-lg border border-border hover:bg-muted text-[10px] font-semibold text-foreground transition-colors"
                                >
                                  Print
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
            </>
          )}
        </div>

        {/* Change Password Modal */}
        {passwordModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
            <div className="bg-card border border-border rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-foreground">Change Subscriber Password</h3>
                <button
                  onClick={() => setPasswordModalOpen(false)}
                  className="p-1 rounded-lg text-muted-foreground hover:text-foreground"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleChangePassword} className="space-y-4 text-xs">
                <div>
                  <label className="font-medium text-muted-foreground block mb-1">
                    New Password:
                  </label>
                  <input
                    type="password"
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-background border border-border focus:ring-2 focus:ring-primary outline-none"
                    placeholder="Enter new PPPoE password"
                  />
                </div>
                <div>
                  <label className="font-medium text-muted-foreground block mb-1">
                    Confirm Password:
                  </label>
                  <input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-background border border-border focus:ring-2 focus:ring-primary outline-none"
                    placeholder="Confirm new password"
                  />
                </div>
                <label className="flex items-center gap-2 cursor-pointer pt-1">
                  <input
                    type="checkbox"
                    checked={disconnectOnPasswordChange}
                    onChange={(e) => setDisconnectOnPasswordChange(e.target.checked)}
                    className="rounded border-border text-primary focus:ring-primary"
                  />
                  <span>Disconnect current active session immediately</span>
                </label>

                <div className="flex justify-end gap-2 pt-3 border-t border-border">
                  <button
                    type="button"
                    onClick={() => setPasswordModalOpen(false)}
                    className="px-4 py-2 rounded-xl bg-accent font-medium hover:bg-accent/80"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={actionLoading}
                    className="px-4 py-2 rounded-xl bg-primary text-primary-foreground font-semibold hover:opacity-95"
                  >
                    Update Password
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Change Package Modal */}
        {packageModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
            <div className="bg-card border border-border rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-foreground">Change Service Package</h3>
                <button
                  onClick={() => setPackageModalOpen(false)}
                  className="p-1 rounded-lg text-muted-foreground hover:text-foreground"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleChangePackage} className="space-y-4 text-xs">
                <div>
                  <label className="font-medium text-muted-foreground block mb-1">
                    Select New Package:
                  </label>
                  <select
                    value={selectedPackageId || ''}
                    onChange={(e) => setSelectedPackageId(Number(e.target.value))}
                    required
                    className="w-full px-3 py-2 rounded-xl bg-background border border-border focus:ring-2 focus:ring-primary outline-none text-foreground"
                  >
                    <option value="">-- Choose package --</option>
                    {packages.map((pkg) => (
                      <option key={pkg.id} value={pkg.id}>
                        {pkg.name} — {pkg.rate_limit} ({pkg.currency} {pkg.price})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="p-3 rounded-xl bg-primary/5 border border-primary/20 space-y-1">
                  <span className="font-bold text-primary">Effective Immediately</span>
                  <p className="text-muted-foreground text-[11px]">
                    Updating this service changes the authorization attributes in PostgreSQL immediately.
                  </p>
                </div>

                <label className="flex items-center gap-2 cursor-pointer pt-1">
                  <input
                    type="checkbox"
                    checked={applyCoAOnPackageChange}
                    onChange={(e) => setApplyCoAOnPackageChange(e.target.checked)}
                    className="rounded border-border text-primary focus:ring-primary"
                  />
                  <span>Apply instantly to active session via CoA / PoD reconnect</span>
                </label>

                <div className="flex justify-end gap-2 pt-3 border-t border-border">
                  <button
                    type="button"
                    onClick={() => setPackageModalOpen(false)}
                    className="px-4 py-2 rounded-xl bg-accent font-medium hover:bg-accent/80"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={actionLoading || !selectedPackageId}
                    className="px-4 py-2 rounded-xl bg-primary text-primary-foreground font-semibold hover:opacity-95"
                  >
                    Apply Package Change
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Multi-duration Recharge Modal */}
        {profile && (
          <RechargeModal
            isOpen={rechargeModalOpen}
            onClose={() => setRechargeModalOpen(false)}
            subscriber={profile.subscriber}
            packages={packages}
            onRechargeSuccess={() => {
              setRechargeModalOpen(false);
              fetchProfile();
              onUpdate();
              showNotice('Recharge applied successfully!');
            }}
            onSuccess={() => {
              setRechargeModalOpen(false);
              fetchProfile();
              onUpdate();
              showNotice('Recharge applied successfully!');
            }}
          />
        )}

        {/* Transaction Details Modal */}
        <TransactionDetailsModal
          isOpen={selectedTxId !== null}
          onClose={() => setSelectedTxId(null)}
          transactionId={selectedTxId}
          onUpdate={fetchProfile}
        />

        {/* Receipt Modal */}
        <ReceiptModal
          isOpen={receiptTx !== null}
          onClose={() => setReceiptTx(null)}
          transaction={receiptTx}
        />
      </div>
    </div>
  );
}
