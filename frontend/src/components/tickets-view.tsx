'use client';

import React, { useState, useEffect } from 'react';
import {
  LifeBuoy,
  AlertCircle,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Flame,
  Search,
  Filter,
  Plus,
  RefreshCw,
  User,
  ArrowUpRight,
  MessageSquare,
  History,
  Send,
  Lock,
  Globe,
  ChevronRight,
  ExternalLink,
  ShieldAlert,
  ArrowRight
} from 'lucide-react';
import {
  TicketItem,
  TicketMetrics,
  TicketCategoryItem,
  TicketCommentItem,
  TicketStatusHistoryItem,
  TicketEscalationItem
} from '@/types/api';

interface TicketsViewProps {
  currentUser?: any;
  onOpenSubscriber?: (subscriberId: number) => void;
}

export const TicketsView: React.FC<TicketsViewProps> = ({
  currentUser,
  onOpenSubscriber
}) => {
  const [metrics, setMetrics] = useState<TicketMetrics>({
    openTickets: 0,
    inProgressTickets: 0,
    criticalTickets: 0,
    slaNearBreach: 0,
    slaBreached: 0,
    resolvedToday: 0,
    totalTickets: 0
  });
  const [tickets, setTickets] = useState<TicketItem[]>([]);
  const [categories, setCategories] = useState<TicketCategoryItem[]>([]);
  const [staffUsers, setStaffUsers] = useState<Array<{ id: string; username: string; full_name?: string }>>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [selectedPriority, setSelectedPriority] = useState<string>('ALL');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

  // Detail Drawer
  const [selectedTicket, setSelectedTicket] = useState<TicketItem | null>(null);
  const [ticketDetails, setTicketDetails] = useState<{
    ticket: TicketItem;
    comments: TicketCommentItem[];
    statusHistory: TicketStatusHistoryItem[];
    escalations: TicketEscalationItem[];
  } | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // New Comment Form
  const [newComment, setNewComment] = useState('');
  const [isInternalComment, setIsInternalComment] = useState(false);
  const [commentSubmitting, setCommentSubmitting] = useState(false);

  // Create Ticket Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [formSubscriberId, setFormSubscriberId] = useState<string>('');
  const [formCategory, setFormCategory] = useState<string>('Connectivity Issues');
  const [formPriority, setFormPriority] = useState<'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'>('MEDIUM');
  const [formSubject, setFormSubject] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formAssignedTo, setFormAssignedTo] = useState<string>('');
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Escalate Modal
  const [showEscalateModal, setShowEscalateModal] = useState(false);
  const [escalatePriority, setEscalatePriority] = useState<'HIGH' | 'CRITICAL'>('HIGH');
  const [escalateReason, setEscalateReason] = useState('');
  const [escalateSubmitting, setEscalateSubmitting] = useState(false);

  // Status Change Prompt
  const [statusReason, setStatusReason] = useState('');
  const [targetStatus, setTargetStatus] = useState<string | null>(null);

  const fetchMetrics = async () => {
    try {
      const res = await fetch('/api/tickets/metrics');
      const data = await res.json();
      if (data.success && data.data) {
        setMetrics(data.data);
      }
    } catch (err) {
      console.error('Error fetching ticket metrics:', err);
    }
  };

  const fetchCategories = async () => {
    try {
      const res = await fetch('/api/tickets/categories');
      const data = await res.json();
      if (data.success && data.data) {
        setCategories(data.data);
      }
    } catch (err) {
      console.error('Error fetching categories:', err);
    }
  };

  const fetchStaffUsers = async () => {
    try {
      const res = await fetch('/api/users?limit=100');
      const data = await res.json();
      if (data.success && data.data?.users) {
        setStaffUsers(data.data.users);
      }
    } catch (err) {
      console.error('Error fetching staff users:', err);
    }
  };

  const fetchTickets = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (selectedStatus !== 'ALL') params.set('status', selectedStatus);
      if (selectedPriority !== 'ALL') params.set('priority', selectedPriority);
      if (selectedCategory !== 'ALL') params.set('category', selectedCategory);
      params.set('limit', '50');

      const res = await fetch(`/api/tickets?${params.toString()}`);
      const data = await res.json();
      if (data.success && data.data) {
        setTickets(data.data.tickets || []);
      }
    } catch (err) {
      console.error('Error fetching tickets:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
    fetchCategories();
    fetchStaffUsers();
  }, []);

  useEffect(() => {
    fetchTickets();
  }, [search, selectedStatus, selectedPriority, selectedCategory]);

  const loadTicketDetail = async (id: number) => {
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/tickets/${id}`);
      const data = await res.json();
      if (data.success && data.data) {
        setTicketDetails(data.data);
        setSelectedTicket(data.data.ticket);
      }
    } catch (err) {
      console.error('Error loading ticket details:', err);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleSelectTicket = (t: TicketItem) => {
    setSelectedTicket(t);
    loadTicketDetail(t.id);
  };

  const handleCloseDrawer = () => {
    setSelectedTicket(null);
    setTicketDetails(null);
  };

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);
    if (!formSubscriberId) {
      setCreateError('Subscriber ID is required');
      return;
    }
    if (!formSubject.trim()) {
      setCreateError('Subject is required');
      return;
    }
    if (!formDescription.trim()) {
      setCreateError('Description is required');
      return;
    }

    setCreateSubmitting(true);
    try {
      const res = await fetch('/api/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscriber_id: parseInt(formSubscriberId, 10),
          category: formCategory,
          priority: formPriority,
          subject: formSubject.trim(),
          description: formDescription.trim(),
          assigned_user_id: formAssignedTo || undefined,
        }),
      });
      const data = await res.json();
      if (!data.success) {
        setCreateError(data.error || 'Failed to create ticket');
        return;
      }

      setShowCreateModal(false);
      setFormSubscriberId('');
      setFormSubject('');
      setFormDescription('');
      setFormAssignedTo('');
      await fetchMetrics();
      await fetchTickets();
    } catch (err: any) {
      setCreateError(err.message || 'Network error');
    } finally {
      setCreateSubmitting(false);
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicket || !newComment.trim()) return;

    setCommentSubmitting(true);
    try {
      const res = await fetch(`/api/tickets/${selectedTicket.id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          comment: newComment.trim(),
          is_internal: isInternalComment,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setNewComment('');
        await loadTicketDetail(selectedTicket.id);
      }
    } catch (err) {
      console.error('Failed to post comment:', err);
    } finally {
      setCommentSubmitting(false);
    }
  };

  const handleUpdateStatus = async (toStatus: string, reason?: string) => {
    if (!selectedTicket) return;
    try {
      const res = await fetch(`/api/tickets/${selectedTicket.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to_status: toStatus,
          reason: reason || undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setTargetStatus(null);
        setStatusReason('');
        await loadTicketDetail(selectedTicket.id);
        await fetchMetrics();
        await fetchTickets();
      }
    } catch (err) {
      console.error('Failed to update ticket status:', err);
    }
  };

  const handleAssignUser = async (userId: string) => {
    if (!selectedTicket) return;
    try {
      const res = await fetch(`/api/tickets/${selectedTicket.id}/assign`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assigned_user_id: userId || null }),
      });
      const data = await res.json();
      if (data.success) {
        await loadTicketDetail(selectedTicket.id);
        await fetchTickets();
      }
    } catch (err) {
      console.error('Failed to assign ticket:', err);
    }
  };

  const handleEscalate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicket || !escalateReason.trim()) return;

    setEscalateSubmitting(true);
    try {
      const res = await fetch(`/api/tickets/${selectedTicket.id}/escalate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to_priority: escalatePriority,
          reason: escalateReason.trim(),
        }),
      });
      const data = await res.json();
      if (data.success) {
        setShowEscalateModal(false);
        setEscalateReason('');
        await loadTicketDetail(selectedTicket.id);
        await fetchMetrics();
        await fetchTickets();
      }
    } catch (err) {
      console.error('Failed to escalate ticket:', err);
    } finally {
      setEscalateSubmitting(false);
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'CRITICAL':
        return <span className="px-2 py-0.5 text-xs font-bold rounded bg-red-500/10 text-red-400 border border-red-500/20">CRITICAL</span>;
      case 'HIGH':
        return <span className="px-2 py-0.5 text-xs font-semibold rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">HIGH</span>;
      case 'MEDIUM':
        return <span className="px-2 py-0.5 text-xs font-semibold rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">MEDIUM</span>;
      default:
        return <span className="px-2 py-0.5 text-xs font-semibold rounded bg-slate-700/60 text-slate-300 border border-slate-600">LOW</span>;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'OPEN':
        return <span className="px-2 py-0.5 text-xs font-bold rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">OPEN</span>;
      case 'IN_PROGRESS':
        return <span className="px-2 py-0.5 text-xs font-bold rounded bg-purple-500/10 text-purple-400 border border-purple-500/20">IN PROGRESS</span>;
      case 'WAITING_CUSTOMER':
        return <span className="px-2 py-0.5 text-xs font-semibold rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">WAITING CUSTOMER</span>;
      case 'WAITING_INTERNAL':
        return <span className="px-2 py-0.5 text-xs font-semibold rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">WAITING INTERNAL</span>;
      case 'RESOLVED':
        return <span className="px-2 py-0.5 text-xs font-bold rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">RESOLVED</span>;
      case 'CLOSED':
        return <span className="px-2 py-0.5 text-xs font-semibold rounded bg-slate-700/80 text-slate-400 border border-slate-600">CLOSED</span>;
      case 'REOPENED':
        return <span className="px-2 py-0.5 text-xs font-bold rounded bg-rose-500/10 text-rose-400 border border-rose-500/20">REOPENED</span>;
      default:
        return <span className="px-2 py-0.5 text-xs rounded bg-slate-800 text-slate-400">{status}</span>;
    }
  };

  const getSlaIndicator = (ticket: TicketItem) => {
    if (ticket.status === 'RESOLVED' || ticket.status === 'CLOSED') {
      return (
        <span className="text-xs text-slate-500 flex items-center gap-1 font-mono">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Met
        </span>
      );
    }
    if (ticket.sla_breached) {
      return (
        <span className="px-2 py-0.5 text-xs font-bold rounded bg-red-500/15 text-red-400 border border-red-500/30 flex items-center gap-1 animate-pulse">
          <Flame className="w-3.5 h-3.5" /> BREACHED
        </span>
      );
    }
    const rem = ticket.sla_remaining_minutes;
    if (rem !== null && rem !== undefined) {
      if (rem <= 120) {
        return (
          <span className="px-2 py-0.5 text-xs font-bold rounded bg-amber-500/15 text-amber-400 border border-amber-500/30 flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" /> {Math.max(0, rem)}m (Near Breach)
          </span>
        );
      }
      const hrs = Math.floor(rem / 60);
      return (
        <span className="text-xs text-emerald-400 flex items-center gap-1 font-mono">
          <Clock className="w-3.5 h-3.5" /> {hrs}h {rem % 60}m left
        </span>
      );
    }
    return <span className="text-xs text-slate-500 font-mono">—</span>;
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-6 rounded-xl shadow-lg">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-500/10 border border-indigo-500/20 rounded-lg text-indigo-400">
              <LifeBuoy className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">Customer Support & Tickets</h1>
              <p className="text-slate-400 text-sm">
                NOC complaint tracking, SLA countdowns, and escalation management
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              fetchMetrics();
              fetchTickets();
            }}
            className="flex items-center gap-2 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm border border-slate-700 transition"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium shadow-md shadow-indigo-600/20 transition"
          >
            <Plus className="w-4 h-4" />
            Create Ticket
          </button>
        </div>
      </div>

      {/* 6 Metric KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex flex-col justify-between">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Open</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl font-extrabold text-blue-400">{metrics.openTickets}</span>
            <AlertCircle className="w-5 h-5 text-blue-400/40" />
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex flex-col justify-between">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">In Progress</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl font-extrabold text-purple-400">{metrics.inProgressTickets}</span>
            <Clock className="w-5 h-5 text-purple-400/40" />
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex flex-col justify-between">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Critical P1</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl font-extrabold text-red-400">{metrics.criticalTickets}</span>
            <Flame className="w-5 h-5 text-red-400/40" />
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex flex-col justify-between">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">SLA Near Breach</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl font-extrabold text-amber-400">{metrics.slaNearBreach}</span>
            <AlertTriangle className="w-5 h-5 text-amber-400/40" />
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex flex-col justify-between">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">SLA Breached</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl font-extrabold text-rose-500">{metrics.slaBreached}</span>
            <ShieldAlert className="w-5 h-5 text-rose-500/40" />
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex flex-col justify-between">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Resolved Today</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl font-extrabold text-emerald-400">{metrics.resolvedToday}</span>
            <CheckCircle2 className="w-5 h-5 text-emerald-400/40" />
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Search tickets, subscriber, subject..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-slate-800/80 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* Status filter */}
          <select
            value={selectedStatus}
            onChange={e => setSelectedStatus(e.target.value)}
            className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
          >
            <option value="ALL">All Statuses</option>
            <option value="OPEN">Open</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="WAITING_CUSTOMER">Waiting Customer</option>
            <option value="WAITING_INTERNAL">Waiting Internal</option>
            <option value="RESOLVED">Resolved</option>
            <option value="CLOSED">Closed</option>
            <option value="REOPENED">Reopened</option>
          </select>

          {/* Priority filter */}
          <select
            value={selectedPriority}
            onChange={e => setSelectedPriority(e.target.value)}
            className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
          >
            <option value="ALL">All Priorities</option>
            <option value="CRITICAL">Critical</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </select>

          {/* Category filter */}
          <select
            value={selectedCategory}
            onChange={e => setSelectedCategory(e.target.value)}
            className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
          >
            <option value="ALL">All Categories</option>
            {categories.map(c => (
              <option key={c.id} value={c.name}>{c.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Tickets Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400 text-xs uppercase tracking-wider font-semibold">
                <th className="py-3.5 px-4">Ticket</th>
                <th className="py-3.5 px-4">Subscriber</th>
                <th className="py-3.5 px-4">Category</th>
                <th className="py-3.5 px-4">Priority</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4">SLA Deadline</th>
                <th className="py-3.5 px-4">Assigned To</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-400" />
                    Loading support tickets...
                  </td>
                </tr>
              ) : tickets.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500">
                    <LifeBuoy className="w-8 h-8 mx-auto mb-2 opacity-30 text-indigo-400" />
                    No tickets found matching your query
                  </td>
                </tr>
              ) : (
                tickets.map(t => (
                  <tr
                    key={t.id}
                    onClick={() => handleSelectTicket(t)}
                    className="hover:bg-slate-800/40 cursor-pointer transition"
                  >
                    <td className="py-3.5 px-4">
                      <div className="font-mono font-bold text-indigo-400 text-xs">
                        {t.ticket_number}
                      </div>
                      <div className="font-medium text-slate-200 text-xs mt-0.5 line-clamp-1 max-w-[240px]">
                        {t.subject}
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (onOpenSubscriber) onOpenSubscriber(t.subscriber_id);
                        }}
                        className="text-xs font-medium text-indigo-300 hover:text-indigo-200 hover:underline flex items-center gap-1"
                      >
                        {t.username}
                        <ExternalLink className="w-3 h-3 opacity-60" />
                      </button>
                      {t.customer_name && (
                        <div className="text-[11px] text-slate-400">{t.customer_name}</div>
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-xs text-slate-300">
                      {t.category}
                    </td>

                    <td className="py-3.5 px-4">
                      {getPriorityBadge(t.priority)}
                    </td>

                    <td className="py-3.5 px-4">
                      {getStatusBadge(t.status)}
                    </td>

                    <td className="py-3.5 px-4">
                      {getSlaIndicator(t)}
                    </td>

                    <td className="py-3.5 px-4">
                      {t.assigned_user_name ? (
                        <span className="text-xs text-slate-300 flex items-center gap-1">
                          <User className="w-3.5 h-3.5 text-slate-500" />
                          {t.assigned_user_name}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-500 italic">Unassigned</span>
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelectTicket(t);
                        }}
                        className="px-2.5 py-1 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700 transition"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* TICKET DETAILS SLIDE-OVER DRAWER */}
      {selectedTicket && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex justify-end">
          <div className="bg-slate-900 border-l border-slate-800 w-full max-w-2xl h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
            {/* Drawer Header */}
            <div className="p-5 border-b border-slate-800 flex items-start justify-between bg-slate-950/60">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-base font-bold text-indigo-400">
                    {selectedTicket.ticket_number}
                  </span>
                  {getPriorityBadge(selectedTicket.priority)}
                  {getStatusBadge(selectedTicket.status)}
                </div>
                <h2 className="text-lg font-bold text-white leading-tight">
                  {selectedTicket.subject}
                </h2>
                <div className="flex items-center gap-3 text-xs text-slate-400">
                  <span>Category: <strong className="text-slate-300">{selectedTicket.category}</strong></span>
                  <span>•</span>
                  <span>Created {new Date(selectedTicket.created_at).toLocaleString()}</span>
                </div>
              </div>
              <button
                onClick={handleCloseDrawer}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
              >
                ✕
              </button>
            </div>

            {/* Drawer Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {detailLoading ? (
                <div className="py-16 text-center text-slate-500">
                  <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2 text-indigo-400" />
                  Loading details...
                </div>
              ) : ticketDetails ? (
                <>
                  {/* Customer Information & SLA Panel */}
                  <div className="grid grid-cols-2 gap-4 bg-slate-800/40 border border-slate-800 rounded-xl p-4">
                    <div>
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                        Customer Account
                      </span>
                      <div className="mt-1">
                        <button
                          onClick={() => {
                            if (onOpenSubscriber) onOpenSubscriber(selectedTicket.subscriber_id);
                          }}
                          className="font-bold text-sm text-indigo-400 hover:underline flex items-center gap-1"
                        >
                          {selectedTicket.username}
                          <ExternalLink className="w-3 h-3" />
                        </button>
                        {selectedTicket.customer_name && (
                          <p className="text-xs text-slate-300 mt-0.5">{selectedTicket.customer_name}</p>
                        )}
                        {selectedTicket.customer_phone && (
                          <p className="text-xs text-slate-400 mt-0.5">{selectedTicket.customer_phone}</p>
                        )}
                      </div>
                    </div>

                    <div>
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                        SLA Status & Assignment
                      </span>
                      <div className="mt-1 space-y-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-slate-400">Deadline:</span>
                          {getSlaIndicator(selectedTicket)}
                        </div>
                        <div className="flex items-center gap-1.5 pt-1">
                          <span className="text-xs text-slate-400">Assigned:</span>
                          <select
                            value={selectedTicket.assigned_user_id || ''}
                            onChange={(e) => handleAssignUser(e.target.value)}
                            className="bg-slate-800 border border-slate-700 rounded px-2 py-0.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                          >
                            <option value="">Unassigned</option>
                            {staffUsers.map(u => (
                              <option key={u.id} value={u.id}>{u.full_name || u.username}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Description */}
                  <div className="bg-slate-800/20 border border-slate-800 rounded-xl p-4 space-y-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      Problem Description
                    </span>
                    <p className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">
                      {selectedTicket.description}
                    </p>
                  </div>

                  {/* Status Progression Toolbar */}
                  <div className="bg-slate-950/40 border border-slate-800 rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                        Workflow Transitions
                      </span>
                      <button
                        onClick={() => setShowEscalateModal(true)}
                        className="text-xs font-semibold text-amber-400 hover:text-amber-300 flex items-center gap-1"
                      >
                        <ShieldAlert className="w-3.5 h-3.5" />
                        Escalate Priority
                      </button>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {selectedTicket.status !== 'IN_PROGRESS' && selectedTicket.status !== 'RESOLVED' && selectedTicket.status !== 'CLOSED' && (
                        <button
                          onClick={() => handleUpdateStatus('IN_PROGRESS')}
                          className="px-3 py-1.5 bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/30 rounded-lg text-xs font-medium transition"
                        >
                          Start Investigation
                        </button>
                      )}
                      {selectedTicket.status === 'IN_PROGRESS' && (
                        <button
                          onClick={() => handleUpdateStatus('WAITING_CUSTOMER', 'Waiting for customer to verify ONT light')}
                          className="px-3 py-1.5 bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/30 rounded-lg text-xs font-medium transition"
                        >
                          Wait for Customer
                        </button>
                      )}
                      {selectedTicket.status !== 'RESOLVED' && selectedTicket.status !== 'CLOSED' && (
                        <button
                          onClick={() => {
                            const res = prompt('Enter resolution summary:');
                            if (res) handleUpdateStatus('RESOLVED', res);
                          }}
                          className="px-3 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 rounded-lg text-xs font-medium transition"
                        >
                          Resolve Ticket
                        </button>
                      )}
                      {selectedTicket.status === 'RESOLVED' && (
                        <button
                          onClick={() => handleUpdateStatus('CLOSED', 'Verified resolved with customer')}
                          className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg text-xs font-medium transition"
                        >
                          Close Ticket
                        </button>
                      )}
                      {(selectedTicket.status === 'RESOLVED' || selectedTicket.status === 'CLOSED') && (
                        <button
                          onClick={() => {
                            const reason = prompt('Reason for reopening ticket:');
                            if (reason) handleUpdateStatus('REOPENED', reason);
                          }}
                          className="px-3 py-1.5 bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 rounded-lg text-xs font-medium transition"
                        >
                          Reopen Ticket
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Comments Thread */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                        <MessageSquare className="w-4 h-4 text-indigo-400" />
                        Activity & Comments ({ticketDetails.comments.length})
                      </h3>
                    </div>

                    {/* New Comment Input */}
                    <form onSubmit={handleAddComment} className="bg-slate-800/40 border border-slate-800 rounded-xl p-3 space-y-2">
                      <textarea
                        rows={2}
                        placeholder={isInternalComment ? "Add internal note (visible to staff only)..." : "Add public comment (visible to subscriber)..."}
                        value={newComment}
                        onChange={e => setNewComment(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700/80 rounded-lg p-2.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                      />
                      <div className="flex items-center justify-between">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={isInternalComment}
                            onChange={e => setIsInternalComment(e.target.checked)}
                            className="rounded border-slate-700 text-indigo-600 focus:ring-0 bg-slate-900"
                          />
                          <span className="text-xs text-slate-400 flex items-center gap-1">
                            <Lock className="w-3 h-3 text-amber-400" />
                            Internal Note Only
                          </span>
                        </label>
                        <button
                          type="submit"
                          disabled={commentSubmitting || !newComment.trim()}
                          className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg text-xs font-medium transition flex items-center gap-1.5"
                        >
                          <Send className="w-3 h-3" />
                          Post
                        </button>
                      </div>
                    </form>

                    {/* Comments List */}
                    <div className="space-y-3">
                      {ticketDetails.comments.map(c => (
                        <div
                          key={c.id}
                          className={`p-3.5 rounded-xl border text-xs space-y-1.5 ${
                            c.is_internal
                              ? 'bg-amber-950/15 border-amber-500/20'
                              : 'bg-slate-800/30 border-slate-800'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-slate-200">{c.author_name}</span>
                              {c.is_internal && (
                                <span className="px-1.5 py-0.5 text-[10px] uppercase font-bold rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center gap-1">
                                  <Lock className="w-2.5 h-2.5" /> Internal Note
                                </span>
                              )}
                            </div>
                            <span className="text-slate-500 text-[11px]">
                              {new Date(c.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <p className="text-slate-300 leading-relaxed whitespace-pre-wrap">{c.comment}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Status History Audit */}
                  {ticketDetails.statusHistory.length > 0 && (
                    <div className="space-y-2 pt-2 border-t border-slate-800">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                        <History className="w-3.5 h-3.5" /> Lifecycle History
                      </span>
                      <div className="space-y-1">
                        {ticketDetails.statusHistory.map(h => (
                          <div key={h.id} className="text-xs text-slate-400 flex items-center gap-2">
                            <span className="text-slate-500 font-mono text-[11px]">
                              {new Date(h.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            <span>•</span>
                            <span>
                              Changed to <strong>{h.to_status}</strong> by {h.changed_by_name}
                              {h.reason && <span className="text-slate-500"> ({h.reason})</span>}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {/* CREATE TICKET MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-2xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <LifeBuoy className="w-5 h-5 text-indigo-400" />
                Create Support Ticket
              </h3>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            {createError && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 text-red-400 text-xs rounded-lg flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span>{createError}</span>
              </div>
            )}

            <form onSubmit={handleCreateTicket} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Subscriber ID *</label>
                <input
                  type="number"
                  placeholder="e.g. 1"
                  value={formSubscriberId}
                  onChange={e => setFormSubscriberId(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Category *</label>
                  <select
                    value={formCategory}
                    onChange={e => setFormCategory(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-indigo-500"
                  >
                    {categories.map(c => (
                      <option key={c.id} value={c.name}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Priority *</label>
                  <select
                    value={formPriority}
                    onChange={e => setFormPriority(e.target.value as any)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="LOW">Low (P4)</option>
                    <option value="MEDIUM">Medium (P3)</option>
                    <option value="HIGH">High (P2)</option>
                    <option value="CRITICAL">Critical (P1)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Subject *</label>
                <input
                  type="text"
                  placeholder="e.g. Red Optical light flashing on ONT"
                  value={formSubject}
                  onChange={e => setFormSubject(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Description *</label>
                <textarea
                  rows={4}
                  placeholder="Detail symptoms, customer location, ONT model, technician observations..."
                  value={formDescription}
                  onChange={e => setFormDescription(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Assign Operator / Technician</label>
                <select
                  value={formAssignedTo}
                  onChange={e => setFormAssignedTo(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-indigo-500"
                >
                  <option value="">Unassigned</option>
                  {staffUsers.map(u => (
                    <option key={u.id} value={u.id}>{u.full_name || u.username}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createSubmitting}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-semibold flex items-center gap-2 transition"
                >
                  {createSubmitting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  Open Ticket
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ESCALATE MODAL */}
      {showEscalateModal && selectedTicket && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-amber-400" />
                Escalate Ticket Priority
              </h3>
              <button onClick={() => setShowEscalateModal(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleEscalate} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">New Priority</label>
                <select
                  value={escalatePriority}
                  onChange={e => setEscalatePriority(e.target.value as any)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-indigo-500"
                >
                  <option value="HIGH">High (P2)</option>
                  <option value="CRITICAL">Critical (P1)</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Escalation Justification *</label>
                <textarea
                  rows={3}
                  placeholder="Explain why this issue requires elevated priority and immediate supervisor escalation..."
                  value={escalateReason}
                  onChange={e => setEscalateReason(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowEscalateModal(false)}
                  className="px-4 py-2 text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={escalateSubmitting || !escalateReason.trim()}
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg font-semibold flex items-center gap-2 transition"
                >
                  {escalateSubmitting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  Confirm Escalation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
