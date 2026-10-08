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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-6 rounded-xl shadow-lg">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-500/10 border border-indigo-500/20 rounded-lg text-indigo-400">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">Customer CRM & Interactions</h1>
              <p className="text-slate-400 text-sm">
                Subscriber communications, notes, interaction logs, and support touchpoints
              </p>
            </div>
          </div>
        </div>
        <div>
          <button
            onClick={() => fetchSubscribers()}
            className="flex items-center gap-2 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm border border-slate-700 transition"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Managed Accounts</p>
            <p className="text-2xl font-bold text-white mt-1">{totalSubscribers}</p>
          </div>
          <div className="p-3 bg-indigo-500/10 rounded-xl text-indigo-400">
            <Users className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Active Subscribers</p>
            <p className="text-2xl font-bold text-emerald-400">
              {subscribers.filter(s => s.status === 'active').length}
            </p>
          </div>
          <div className="p-3 bg-emerald-500/10 rounded-xl text-emerald-400">
            <UserCheck className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Attention Needed</p>
            <p className="text-2xl font-bold text-amber-400">
              {subscribers.filter(s => s.status === 'expired' || s.status === 'suspended').length}
            </p>
          </div>
          <div className="p-3 bg-amber-500/10 rounded-xl text-amber-400">
            <AlertCircle className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-96">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Search by username, full name, phone, or email..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-slate-800/80 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
          >
            <option value="ALL">All Statuses</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
            <option value="expired">Expired</option>
          </select>
        </div>
      </div>

      {/* Subscribers CRM Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400 text-xs uppercase tracking-wider font-semibold">
                <th className="py-3.5 px-4">Customer Account</th>
                <th className="py-3.5 px-4">Contact Info</th>
                <th className="py-3.5 px-4">Status & Plan</th>
                <th className="py-3.5 px-4">Affiliation</th>
                <th className="py-3.5 px-4 text-right">CRM Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-500">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-400" />
                    Loading CRM directory...
                  </td>
                </tr>
              ) : subscribers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-500">
                    <Users className="w-8 h-8 mx-auto mb-2 opacity-30 text-indigo-400" />
                    No customers found matching your filter criteria
                  </td>
                </tr>
              ) : (
                subscribers.map((sub) => (
                  <tr key={sub.id} className="hover:bg-slate-800/40 transition">
                    <td className="py-3.5 px-4">
                      <button
                        onClick={() => {
                          if (onOpenSubscriber) onOpenSubscriber(sub.id);
                        }}
                        className="font-bold text-xs text-indigo-400 hover:text-indigo-300 hover:underline flex items-center gap-1"
                      >
                        {sub.username}
                        <ExternalLink className="w-3 h-3 opacity-60" />
                      </button>
                      <div className="font-medium text-slate-200 text-xs mt-0.5">
                        {sub.full_name || 'No name registered'}
                      </div>
                      {sub.address && (
                        <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                          <MapPin className="w-3 h-3 text-slate-500" />
                          {sub.address}
                        </div>
                      )}
                    </td>

                    <td className="py-3.5 px-4 space-y-1">
                      {sub.phone ? (
                        <div className="text-xs text-slate-300 flex items-center gap-1.5 font-mono">
                          <Phone className="w-3 h-3 text-slate-500" />
                          {sub.phone}
                        </div>
                      ) : (
                        <span className="text-xs text-slate-600">No phone</span>
                      )}
                      {sub.email && (
                        <div className="text-xs text-slate-400 flex items-center gap-1.5">
                          <Mail className="w-3 h-3 text-slate-500" />
                          {sub.email}
                        </div>
                      )}
                    </td>

                    <td className="py-3.5 px-4 space-y-1">
                      <div>
                        {sub.status === 'active' ? (
                          <span className="px-2 py-0.5 text-xs font-semibold rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Active</span>
                        ) : sub.status === 'suspended' ? (
                          <span className="px-2 py-0.5 text-xs font-semibold rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">Suspended</span>
                        ) : (
                          <span className="px-2 py-0.5 text-xs font-semibold rounded bg-red-500/10 text-red-400 border border-red-500/20">Expired</span>
                        )}
                      </div>
                      <div className="text-xs text-slate-400">
                        Package: <strong className="text-slate-300">{sub.package_name || 'None'}</strong>
                      </div>
                    </td>

                    <td className="py-3.5 px-4 space-y-1 text-xs">
                      {sub.branch_name && (
                        <div className="text-slate-300">
                          Branch: <span className="font-semibold text-slate-200">{sub.branch_name}</span>
                        </div>
                      )}
                      {sub.reseller_name && (
                        <div className="text-slate-400">
                          Reseller: <span className="font-semibold text-slate-300">{sub.reseller_name}</span>
                        </div>
                      )}
                      {!sub.branch_name && !sub.reseller_name && (
                        <span className="text-slate-500 italic">Direct / Global</span>
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleOpenComm(sub)}
                          className="px-2.5 py-1 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700 flex items-center gap-1 transition"
                          title="Log communication / customer touchpoint"
                        >
                          <Phone className="w-3 h-3 text-indigo-400" />
                          Log Touchpoint
                        </button>
                        <button
                          onClick={() => {
                            if (onOpenSubscriber) onOpenSubscriber(sub.id);
                          }}
                          className="px-2.5 py-1 text-xs bg-indigo-600 hover:bg-indigo-500 text-white rounded font-medium transition"
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
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Phone className="w-4 h-4 text-indigo-400" />
                  Log Customer Interaction
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Record touchpoint for <strong>{selectedSubForComm.username}</strong>
                </p>
              </div>
              <button onClick={() => setShowCommModal(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleSaveCommunication} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Channel *</label>
                <div className="grid grid-cols-5 gap-1.5">
                  {(['CALL', 'SMS', 'WHATSAPP', 'EMAIL', 'IN_APP'] as const).map(ch => (
                    <button
                      key={ch}
                      type="button"
                      onClick={() => setCommChannel(ch)}
                      className={`py-1.5 px-1 rounded text-[11px] font-semibold border transition text-center ${
                        commChannel === ch
                          ? 'bg-indigo-600 text-white border-indigo-500'
                          : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700'
                      }`}
                    >
                      {ch}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Subject / Reason</label>
                <input
                  type="text"
                  placeholder="e.g. Plan renewal reminder follow-up"
                  value={commSubject}
                  onChange={e => setCommSubject(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Interaction Notes / Message *</label>
                <textarea
                  rows={4}
                  placeholder="Record summary of conversation, subscriber requests, promised resolution..."
                  value={commMessage}
                  onChange={e => setCommMessage(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCommModal(false)}
                  className="px-4 py-2 text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={commSubmitting || !commMessage.trim()}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-semibold flex items-center gap-2 transition"
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
