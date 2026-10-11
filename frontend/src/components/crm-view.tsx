'use client';

import React, { useState, useEffect } from 'react';
import {
  Users,
  Search,
  Filter,
  RefreshCw,
  Phone,
  Mail,
  MapPin,
  MessageSquare,
  LifeBuoy,
  Clock,
  ExternalLink,
  Plus,
  Send,
  FileText,
  UserCheck,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { SubscriberItem } from '@/types/api';

interface CrmViewProps {
  currentUser?: any;
  onOpenSubscriber?: (subscriberId: number) => void;
}

export const CrmView: React.FC<CrmViewProps> = ({
  currentUser,
  onOpenSubscriber
}) => {
  const [subscribers, setSubscribers] = useState<SubscriberItem[]>([]);
  const [totalSubscribers, setTotalSubscribers] = useState(0);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Quick Communication Modal
  const [showCommModal, setShowCommModal] = useState(false);
  const [selectedSubForComm, setSelectedSubForComm] = useState<SubscriberItem | null>(null);
  const [commChannel, setCommChannel] = useState<'IN_APP' | 'SMS' | 'EMAIL' | 'WHATSAPP' | 'CALL'>('CALL');
  const [commSubject, setCommSubject] = useState('');
  const [commMessage, setCommMessage] = useState('');
  const [commSubmitting, setCommSubmitting] = useState(false);

  const fetchSubscribers = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (statusFilter !== 'ALL') params.set('status', statusFilter);
      params.set('limit', '50');

      const res = await fetch(`/api/subscribers?${params.toString()}`);
      const data = await res.json();
      if (data.success && data.data) {
        setSubscribers(data.data.subscribers || []);
        setTotalSubscribers(data.data.total || 0);
      }
    } catch (err) {
      console.error('Error fetching subscribers for CRM:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubscribers();
  }, [search, statusFilter]);

  const handleOpenComm = (sub: SubscriberItem) => {
    setSelectedSubForComm(sub);
    setCommChannel('CALL');
    setCommSubject('');
    setCommMessage('');
    setShowCommModal(true);
  };

  const handleSaveCommunication = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSubForComm || !commMessage.trim()) return;

    setCommSubmitting(true);
    try {
      const res = await fetch(`/api/crm/subscribers/${selectedSubForComm.id}/communications`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel: commChannel,
          recipient: selectedSubForComm.phone || selectedSubForComm.email || selectedSubForComm.username,
          subject: commSubject.trim() || undefined,
          message: commMessage.trim(),
        }),
      });
      const data = await res.json();
      if (data.success) {
        setShowCommModal(false);
        alert('Communication log recorded successfully!');
      } else {
        alert(data.error || 'Failed to save communication');
      }
    } catch (err) {
      alert('Network error saving communication');
    } finally {
      setCommSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-card border border-border p-6 rounded-2xl shadow-sm">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-primary/10 border border-primary/20 rounded-xl text-primary">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground tracking-tight">Customer CRM & Interactions</h1>
              <p className="text-muted-foreground text-xs mt-0.5">
                Subscriber communications, notes, interaction logs, and support touchpoints
              </p>
            </div>
          </div>
        </div>
        <div>
          <button
            onClick={() => fetchSubscribers()}
            className="flex items-center gap-2 px-3.5 py-2 bg-card hover:bg-muted text-muted-foreground hover:text-foreground rounded-xl text-xs font-semibold border border-border transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="border card-pastel-1 p-4 rounded-xl flex items-center justify-between shadow-xs">
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Total Managed Accounts</p>
            <p className="text-2xl font-black text-foreground mt-1">{totalSubscribers}</p>
          </div>
          <div className="p-3 bg-card/80 border border-border/50 rounded-xl text-primary">
            <Users className="w-6 h-6" />
          </div>
        </div>

        <div className="border card-pastel-2 p-4 rounded-xl flex items-center justify-between shadow-xs">
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Active Subscribers</p>
            <p className="text-2xl font-black text-emerald-500 mt-1">
              {subscribers.filter(s => s.status === 'active').length}
            </p>
          </div>
          <div className="p-3 bg-card/80 border border-border/50 rounded-xl text-emerald-500">
            <UserCheck className="w-6 h-6" />
          </div>
        </div>

        <div className="border card-pastel-5 p-4 rounded-xl flex items-center justify-between shadow-xs">
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Attention Needed</p>
            <p className="text-2xl font-black text-amber-500 mt-1">
              {subscribers.filter(s => s.status === 'expired' || s.status === 'suspended').length}
            </p>
          </div>
          <div className="p-3 bg-card/80 border border-border/50 rounded-xl text-amber-500">
            <AlertCircle className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-card border border-border rounded-xl p-4 flex flex-col sm:flex-row gap-3 items-center justify-between shadow-xs">
        <div className="relative w-full sm:w-96">
          <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search by username, full name, phone, or email..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-background border border-border rounded-lg pl-9 pr-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
          />
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="bg-background border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary"
          >
            <option value="ALL">All Statuses</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
            <option value="expired">Expired</option>
          </select>
        </div>
      </div>

      {/* Subscribers CRM Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-border bg-muted/50 text-muted-foreground text-[11px] uppercase tracking-wider font-semibold">
                <th className="py-3 px-4">Customer Account</th>
                <th className="py-3 px-4">Contact Info</th>
                <th className="py-3 px-4">Status & Plan</th>
                <th className="py-3 px-4">Affiliation</th>
                <th className="py-3 px-4 text-right">CRM Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-muted-foreground">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-primary" />
                    Loading CRM directory...
                  </td>
                </tr>
              ) : subscribers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-muted-foreground">
                    <Users className="w-8 h-8 mx-auto mb-2 opacity-30 text-primary" />
                    No customers found matching your filter criteria
                  </td>
                </tr>
              ) : (
                subscribers.map((sub) => (
                  <tr key={sub.id} className="hover:bg-muted/40 transition">
                    <td className="py-3.5 px-4">
                      <button
                        onClick={() => {
                          if (onOpenSubscriber) onOpenSubscriber(sub.id);
                        }}
                        className="font-bold text-xs text-primary hover:underline flex items-center gap-1"
                      >
                        {sub.username}
                        <ExternalLink className="w-3 h-3 opacity-60" />
                      </button>
                      <div className="font-medium text-foreground text-xs mt-0.5">
                        {sub.full_name || 'No name registered'}
                      </div>
                      {sub.address && (
                        <div className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                          <MapPin className="w-3 h-3 text-muted-foreground" />
                          {sub.address}
                        </div>
                      )}
                    </td>

                    <td className="py-3.5 px-4 space-y-1">
                      {sub.phone ? (
                        <div className="text-xs text-foreground flex items-center gap-1.5 font-mono">
                          <Phone className="w-3 h-3 text-muted-foreground" />
                          {sub.phone}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground/60">No phone</span>
                      )}
                      {sub.email && (
                        <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                          <Mail className="w-3 h-3 text-muted-foreground" />
                          {sub.email}
                        </div>
                      )}
                    </td>

                    <td className="py-3.5 px-4 space-y-1">
                      <div>
                        {sub.status === 'active' ? (
                          <span className="px-2 py-0.5 text-xs font-semibold rounded bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">Active</span>
                        ) : sub.status === 'suspended' ? (
                          <span className="px-2 py-0.5 text-xs font-semibold rounded bg-amber-500/10 text-amber-500 border border-amber-500/20">Suspended</span>
                        ) : (
                          <span className="px-2 py-0.5 text-xs font-semibold rounded bg-rose-500/10 text-rose-500 border border-rose-500/20">Expired</span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Package: <strong className="text-foreground">{sub.package_name || 'None'}</strong>
                      </div>
                    </td>

                    <td className="py-3.5 px-4 space-y-1 text-xs">
                      {sub.branch_name && (
                        <div className="text-muted-foreground">
                          Branch: <span className="font-semibold text-foreground">{sub.branch_name}</span>
                        </div>
                      )}
                      {sub.reseller_name && (
                        <div className="text-muted-foreground">
                          Reseller: <span className="font-semibold text-foreground">{sub.reseller_name}</span>
                        </div>
                      )}
                      {!sub.branch_name && !sub.reseller_name && (
                        <span className="text-muted-foreground italic">Direct / Global</span>
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleOpenComm(sub)}
                          className="px-2.5 py-1 text-xs bg-card hover:bg-muted text-muted-foreground hover:text-foreground rounded-lg border border-border flex items-center gap-1 transition"
                          title="Log communication / customer touchpoint"
                        >
                          <Phone className="w-3 h-3 text-primary" />
                          Log Touchpoint
                        </button>
                        <button
                          onClick={() => {
                            if (onOpenSubscriber) onOpenSubscriber(sub.id);
                          }}
                          className="px-2.5 py-1 text-xs bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg font-medium transition"
                        >
                          Profile & CRM
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

      {/* QUICK LOG COMMUNICATION MODAL */}
      {showCommModal && selectedSubForComm && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div>
                <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                  <Phone className="w-4 h-4 text-primary" />
                  Log Customer Interaction
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Record touchpoint for <strong>{selectedSubForComm.username}</strong>
                </p>
              </div>
              <button onClick={() => setShowCommModal(false)} className="text-muted-foreground hover:text-foreground">✕</button>
            </div>

            <form onSubmit={handleSaveCommunication} className="space-y-4 text-xs">
              <div>
                <label className="block text-foreground font-medium mb-1">Channel *</label>
                <div className="grid grid-cols-5 gap-1.5">
                  {(['CALL', 'SMS', 'WHATSAPP', 'EMAIL', 'IN_APP'] as const).map(ch => (
                    <button
                      key={ch}
                      type="button"
                      onClick={() => setCommChannel(ch)}
                      className={`py-1.5 px-1 rounded-lg text-[11px] font-semibold border transition text-center ${
                        commChannel === ch
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-card text-muted-foreground border-border hover:bg-muted'
                      }`}
                    >
                      {ch}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-foreground font-medium mb-1">Subject / Reason</label>
                <input
                  type="text"
                  placeholder="e.g. Plan renewal reminder follow-up"
                  value={commSubject}
                  onChange={e => setCommSubject(e.target.value)}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-foreground focus:outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-foreground font-medium mb-1">Interaction Notes / Message *</label>
                <textarea
                  rows={4}
                  placeholder="Record summary of conversation, subscriber requests, promised resolution..."
                  value={commMessage}
                  onChange={e => setCommMessage(e.target.value)}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-foreground focus:outline-none focus:border-primary"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setShowCommModal(false)}
                  className="px-4 py-2 text-muted-foreground hover:text-foreground"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={commSubmitting || !commMessage.trim()}
                  className="px-5 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl font-semibold flex items-center gap-2 transition"
                >
                  {commSubmitting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  Save Touchpoint
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
