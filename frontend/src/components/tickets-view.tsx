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
        return <span className="px-2 py-0.5 text-xs font-semibold rounded bg-muted text-muted-foreground border border-border">LOW</span>;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'OPEN':
        return <span className="px-2 py-0.5 text-xs font-bold rounded bg-blue-500/10 text-blue-500 border border-blue-500/20">OPEN</span>;
      case 'IN_PROGRESS':
        return <span className="px-2 py-0.5 text-xs font-bold rounded bg-purple-500/10 text-purple-500 border border-purple-500/20">IN PROGRESS</span>;
      case 'WAITING_CUSTOMER':
        return <span className="px-2 py-0.5 text-xs font-semibold rounded bg-amber-500/10 text-amber-500 border border-amber-500/20">WAITING CUSTOMER</span>;
      case 'WAITING_INTERNAL':
        return <span className="px-2 py-0.5 text-xs font-semibold rounded bg-indigo-500/10 text-indigo-500 border border-indigo-500/20">WAITING INTERNAL</span>;
      case 'RESOLVED':
        return <span className="px-2 py-0.5 text-xs font-bold rounded bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">RESOLVED</span>;
      case 'CLOSED':
        return <span className="px-2 py-0.5 text-xs font-semibold rounded bg-muted text-muted-foreground border border-border">CLOSED</span>;
      case 'REOPENED':
        return <span className="px-2 py-0.5 text-xs font-bold rounded bg-rose-500/10 text-rose-500 border border-rose-500/20">REOPENED</span>;
      default:
        return <span className="px-2 py-0.5 text-xs rounded bg-muted text-muted-foreground">{status}</span>;
    }
  };

  const getSlaIndicator = (ticket: TicketItem) => {
    if (ticket.status === 'RESOLVED' || ticket.status === 'CLOSED') {
      return (
        <span className="text-xs text-muted-foreground flex items-center gap-1 font-mono">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> Met
        </span>
      );
    }
    if (ticket.sla_breached) {
      return (
        <span className="px-2 py-0.5 text-xs font-bold rounded bg-red-500/15 text-red-500 border border-red-500/30 flex items-center gap-1 animate-pulse">
          <Flame className="w-3.5 h-3.5" /> BREACHED
        </span>
      );
    }
    const rem = ticket.sla_remaining_minutes;
    if (rem !== null && rem !== undefined) {
      if (rem <= 120) {
        return (
          <span className="px-2 py-0.5 text-xs font-bold rounded bg-amber-500/15 text-amber-500 border border-amber-500/30 flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" /> {Math.max(0, rem)}m (Near Breach)
          </span>
        );
      }
      const hrs = Math.floor(rem / 60);
      return (
        <span className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-mono">
          <Clock className="w-3.5 h-3.5" /> {hrs}h {rem % 60}m left
        </span>
      );
    }
    return <span className="text-xs text-muted-foreground font-mono">—</span>;
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-card border border-border p-6 rounded-xl shadow-xs">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-primary/10 border border-primary/20 rounded-lg text-primary">
              <LifeBuoy className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground tracking-tight">Customer Support & Tickets</h1>
              <p className="text-muted-foreground text-sm">
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
            className="flex items-center gap-2 px-3.5 py-2 bg-card hover:bg-muted text-foreground rounded-lg text-sm border border-border transition"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg text-sm font-medium shadow-xs transition"
          >
            <Plus className="w-4 h-4" />
            Create Ticket
          </button>
        </div>
      </div>

      {/* 6 Metric KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        <div className="card-pastel-1 p-4 rounded-xl flex flex-col justify-between shadow-xs">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Open</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl font-extrabold text-blue-600 dark:text-blue-400">{metrics.openTickets}</span>
            <AlertCircle className="w-5 h-5 text-blue-500/60" />
          </div>
        </div>

        <div className="card-pastel-2 p-4 rounded-xl flex flex-col justify-between shadow-xs">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">In Progress</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl font-extrabold text-purple-600 dark:text-purple-400">{metrics.inProgressTickets}</span>
            <Clock className="w-5 h-5 text-purple-500/60" />
          </div>
        </div>

        <div className="card-pastel-3 p-4 rounded-xl flex flex-col justify-between shadow-xs">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Critical P1</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl font-extrabold text-rose-600 dark:text-red-400">{metrics.criticalTickets}</span>
            <Flame className="w-5 h-5 text-rose-500/60" />
          </div>
        </div>

        <div className="card-pastel-4 p-4 rounded-xl flex flex-col justify-between shadow-xs">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">SLA Near Breach</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl font-extrabold text-amber-600 dark:text-amber-400">{metrics.slaNearBreach}</span>
            <AlertTriangle className="w-5 h-5 text-amber-500/60" />
          </div>
        </div>

        <div className="card-pastel-5 p-4 rounded-xl flex flex-col justify-between shadow-xs">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">SLA Breached</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl font-extrabold text-red-600 dark:text-rose-500">{metrics.slaBreached}</span>
            <ShieldAlert className="w-5 h-5 text-red-500/60" />
          </div>
        </div>

        <div className="card-pastel-6 p-4 rounded-xl flex flex-col justify-between shadow-xs">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Resolved Today</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400">{metrics.resolvedToday}</span>
            <CheckCircle2 className="w-5 h-5 text-emerald-500/60" />
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-card border border-border rounded-xl p-4 flex flex-col md:flex-row gap-3 items-center justify-between shadow-xs">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Search tickets, subscriber, subject..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-background border border-input rounded-lg pl-9 pr-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* Status filter */}
          <select
            value={selectedStatus}
            onChange={e => setSelectedStatus(e.target.value)}
            className="bg-card border border-input rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
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
            className="bg-card border border-input rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
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
            className="bg-card border border-input rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="ALL">All Categories</option>
            {categories.map(c => (
              <option key={c.id} value={c.name}>{c.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Tickets Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/60 text-muted-foreground text-xs uppercase tracking-wider font-semibold">
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
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-muted-foreground">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-primary" />
                    Loading support tickets...
                  </td>
                </tr>
              ) : tickets.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-muted-foreground">
                    <LifeBuoy className="w-8 h-8 mx-auto mb-2 opacity-30 text-primary" />
                    No tickets found matching your query
                  </td>
                </tr>
              ) : (
                tickets.map(t => (
                  <tr
                    key={t.id}
                    onClick={() => handleSelectTicket(t)}
                    className="hover:bg-muted/40 cursor-pointer transition"
                  >
                    <td className="py-3.5 px-4">
                      <div className="font-mono font-bold text-primary text-xs">
                        {t.ticket_number}
                      </div>
                      <div className="font-medium text-foreground text-xs mt-0.5 line-clamp-1 max-w-[240px]">
                        {t.subject}
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (onOpenSubscriber) onOpenSubscriber(t.subscriber_id);
                        }}
                        className="text-xs font-medium text-primary hover:underline flex items-center gap-1"
                      >
                        {t.username}
                        <ExternalLink className="w-3 h-3 opacity-60" />
                      </button>
                      {t.customer_name && (
                        <div className="text-[11px] text-muted-foreground">{t.customer_name}</div>
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-xs text-foreground/80">
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
                        <span className="text-xs text-foreground/90 flex items-center gap-1">
                          <User className="w-3.5 h-3.5 text-muted-foreground" />
                          {t.assigned_user_name}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground italic">Unassigned</span>
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelectTicket(t);
                        }}
                        className="px-2.5 py-1 text-xs bg-muted hover:bg-muted/80 text-foreground rounded border border-border transition"
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
          <div className="bg-card border-l border-border w-full max-w-2xl h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
            {/* Drawer Header */}
            <div className="p-5 border-b border-border flex items-start justify-between bg-muted/40">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-base font-bold text-primary">
                    {selectedTicket.ticket_number}
                  </span>
                  {getPriorityBadge(selectedTicket.priority)}
                  {getStatusBadge(selectedTicket.status)}
                </div>
                <h2 className="text-lg font-bold text-foreground leading-tight">
                  {selectedTicket.subject}
                </h2>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span>Category: <strong className="text-foreground">{selectedTicket.category}</strong></span>
                  <span>•</span>
                  <span>Created {new Date(selectedTicket.created_at).toLocaleString()}</span>
                </div>
              </div>
              <button
                onClick={handleCloseDrawer}
                className="text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-muted transition"
              >
                ✕
              </button>
            </div>

            {/* Drawer Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {detailLoading ? (
                <div className="py-16 text-center text-muted-foreground">
                  <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2 text-primary" />
                  Loading details...
                </div>
              ) : ticketDetails ? (
                <>
                  {/* Customer Information & SLA Panel */}
                  <div className="grid grid-cols-2 gap-4 bg-muted/20 border border-border rounded-xl p-4">
                    <div>
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Customer Account
                      </span>
                      <div className="mt-1">
                        <button
                          onClick={() => {
                            if (onOpenSubscriber) onOpenSubscriber(selectedTicket.subscriber_id);
                          }}
                          className="font-bold text-sm text-primary hover:underline flex items-center gap-1"
                        >
                          {selectedTicket.username}
                          <ExternalLink className="w-3 h-3" />
                        </button>
                        {selectedTicket.customer_name && (
                          <p className="text-xs text-foreground/80 mt-0.5">{selectedTicket.customer_name}</p>
                        )}
                        {selectedTicket.customer_phone && (
                          <p className="text-xs text-muted-foreground mt-0.5">{selectedTicket.customer_phone}</p>
                        )}
                      </div>
                    </div>

                    <div>
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                        SLA Status & Assignment
                      </span>
                      <div className="mt-1 space-y-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-muted-foreground">Deadline:</span>
                          {getSlaIndicator(selectedTicket)}
                        </div>
                        <div className="flex items-center gap-1.5 pt-1">
                          <span className="text-xs text-muted-foreground">Assigned:</span>
                          <select
                            value={selectedTicket.assigned_user_id || ''}
                            onChange={(e) => handleAssignUser(e.target.value)}
                            className="bg-background border border-input rounded px-2 py-0.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
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
                  <div className="bg-muted/15 border border-border rounded-xl p-4 space-y-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Problem Description
                    </span>
                    <p className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">
                      {selectedTicket.description}
                    </p>
                  </div>

                  {/* Status Progression Toolbar */}
                  <div className="bg-muted/30 border border-border rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        Workflow Transitions
                      </span>
                      <button
                        onClick={() => setShowEscalateModal(true)}
                        className="text-xs font-semibold text-amber-500 hover:text-amber-600 flex items-center gap-1"
                      >
                        <ShieldAlert className="w-3.5 h-3.5" />
                        Escalate Priority
                      </button>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {selectedTicket.status !== 'IN_PROGRESS' && selectedTicket.status !== 'RESOLVED' && selectedTicket.status !== 'CLOSED' && (
                        <button
                          onClick={() => handleUpdateStatus('IN_PROGRESS')}
                          className="px-3 py-1.5 bg-purple-600/10 hover:bg-purple-600/20 text-purple-600 dark:text-purple-300 border border-purple-500/30 rounded-lg text-xs font-medium transition"
                        >
                          Start Investigation
                        </button>
                      )}
                      {selectedTicket.status === 'IN_PROGRESS' && (
                        <button
                          onClick={() => handleUpdateStatus('WAITING_CUSTOMER', 'Waiting for customer to verify ONT light')}
                          className="px-3 py-1.5 bg-amber-600/10 hover:bg-amber-600/20 text-amber-600 dark:text-amber-300 border border-amber-500/30 rounded-lg text-xs font-medium transition"
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
                          className="px-3 py-1.5 bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-600 dark:text-emerald-300 border border-emerald-500/30 rounded-lg text-xs font-medium transition"
                        >
                          Resolve Ticket
                        </button>
                      )}
                      {selectedTicket.status === 'RESOLVED' && (
                        <button
                          onClick={() => handleUpdateStatus('CLOSED', 'Verified resolved with customer')}
                          className="px-3 py-1.5 bg-muted hover:bg-muted/80 text-foreground rounded-lg text-xs font-medium transition border border-border"
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
                          className="px-3 py-1.5 bg-rose-600/10 hover:bg-rose-600/20 text-rose-600 dark:text-rose-300 border border-rose-500/30 rounded-lg text-xs font-medium transition"
                        >
                          Reopen Ticket
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Comments Thread */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                        <MessageSquare className="w-4 h-4 text-primary" />
                        Activity & Comments ({ticketDetails.comments.length})
                      </h3>
                    </div>

                    {/* New Comment Input */}
                    <form onSubmit={handleAddComment} className="bg-muted/20 border border-border rounded-xl p-3 space-y-2">
                      <textarea
                        rows={2}
                        placeholder={isInternalComment ? "Add internal note (visible to staff only)..." : "Add public comment (visible to subscriber)..."}
                        value={newComment}
                        onChange={e => setNewComment(e.target.value)}
                        className="w-full bg-background border border-input rounded-lg p-2.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                      />
                      <div className="flex items-center justify-between">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={isInternalComment}
                            onChange={e => setIsInternalComment(e.target.checked)}
                            className="rounded border-input text-primary focus:ring-0 bg-background"
                          />
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Lock className="w-3 h-3 text-amber-500" />
                            Internal Note Only
                          </span>
                        </label>
                        <button
                          type="submit"
                          disabled={commentSubmitting || !newComment.trim()}
                          className="px-3 py-1 bg-primary hover:bg-primary/90 disabled:opacity-50 text-primary-foreground rounded-lg text-xs font-medium transition flex items-center gap-1.5"
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
                              ? 'bg-amber-500/10 border-amber-500/25'
                              : 'bg-muted/30 border-border'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-foreground">{c.author_name}</span>
                              {c.is_internal && (
                                <span className="px-1.5 py-0.5 text-[10px] uppercase font-bold rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 flex items-center gap-1">
                                  <Lock className="w-2.5 h-2.5" /> Internal Note
                                </span>
                              )}
                            </div>
                            <span className="text-muted-foreground text-[11px]">
                              {new Date(c.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <p className="text-foreground/90 leading-relaxed whitespace-pre-wrap">{c.comment}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Status History Audit */}
                  {ticketDetails.statusHistory.length > 0 && (
                    <div className="space-y-2 pt-2 border-t border-border">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                        <History className="w-3.5 h-3.5" /> Lifecycle History
                      </span>
                      <div className="space-y-1">
                        {ticketDetails.statusHistory.map(h => (
                          <div key={h.id} className="text-xs text-muted-foreground flex items-center gap-2">
                            <span className="text-muted-foreground font-mono text-[11px]">
                              {new Date(h.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            <span>•</span>
                            <span>
                              Changed to <strong>{h.to_status}</strong> by {h.changed_by_name}
                              {h.reason && <span className="text-muted-foreground"> ({h.reason})</span>}
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
          <div className="bg-card border border-border rounded-xl shadow-2xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                <LifeBuoy className="w-5 h-5 text-primary" />
                Create Support Ticket
              </h3>
              <button onClick={() => setShowCreateModal(false)} className="text-muted-foreground hover:text-foreground">✕</button>
            </div>

            {createError && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 text-red-500 text-xs rounded-lg flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span>{createError}</span>
              </div>
            )}

            <form onSubmit={handleCreateTicket} className="space-y-4 text-xs">
              <div>
                <label className="block text-foreground/90 font-medium mb-1">Subscriber ID *</label>
                <input
                  type="number"
                  placeholder="e.g. 1"
                  value={formSubscriberId}
                  onChange={e => setFormSubscriberId(e.target.value)}
                  className="w-full bg-background border border-input rounded-lg px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-foreground/90 font-medium mb-1">Category *</label>
                  <select
                    value={formCategory}
                    onChange={e => setFormCategory(e.target.value)}
                    className="w-full bg-background border border-input rounded-lg px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    {categories.map(c => (
                      <option key={c.id} value={c.name}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-foreground/90 font-medium mb-1">Priority *</label>
                  <select
                    value={formPriority}
                    onChange={e => setFormPriority(e.target.value as any)}
                    className="w-full bg-background border border-input rounded-lg px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    <option value="LOW">Low (P4)</option>
                    <option value="MEDIUM">Medium (P3)</option>
                    <option value="HIGH">High (P2)</option>
                    <option value="CRITICAL">Critical (P1)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-foreground/90 font-medium mb-1">Subject *</label>
                <input
                  type="text"
                  placeholder="e.g. Red Optical light flashing on ONT"
                  value={formSubject}
                  onChange={e => setFormSubject(e.target.value)}
                  className="w-full bg-background border border-input rounded-lg px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>

              <div>
                <label className="block text-foreground/90 font-medium mb-1">Description *</label>
                <textarea
                  rows={4}
                  placeholder="Detail symptoms, customer location, ONT model, technician observations..."
                  value={formDescription}
                  onChange={e => setFormDescription(e.target.value)}
                  className="w-full bg-background border border-input rounded-lg px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>

              <div>
                <label className="block text-foreground/90 font-medium mb-1">Assign Operator / Technician</label>
                <select
                  value={formAssignedTo}
                  onChange={e => setFormAssignedTo(e.target.value)}
                  className="w-full bg-background border border-input rounded-lg px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="">Unassigned</option>
                  {staffUsers.map(u => (
                    <option key={u.id} value={u.id}>{u.full_name || u.username}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-muted-foreground hover:text-foreground"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createSubmitting}
                  className="px-5 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg font-semibold flex items-center gap-2 transition shadow-xs"
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
          <div className="bg-card border border-border rounded-xl shadow-2xl max-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-amber-500" />
                Escalate Ticket Priority
              </h3>
              <button onClick={() => setShowEscalateModal(false)} className="text-muted-foreground hover:text-foreground">✕</button>
            </div>

            <form onSubmit={handleEscalate} className="space-y-4 text-xs">
              <div>
                <label className="block text-foreground/90 font-medium mb-1">New Priority</label>
                <select
                  value={escalatePriority}
                  onChange={e => setEscalatePriority(e.target.value as any)}
                  className="w-full bg-background border border-input rounded-lg px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="HIGH">High (P2)</option>
                  <option value="CRITICAL">Critical (P1)</option>
                </select>
              </div>

              <div>
                <label className="block text-foreground/90 font-medium mb-1">Escalation Justification *</label>
                <textarea
                  rows={3}
                  placeholder="Explain why this issue requires elevated priority and immediate supervisor escalation..."
                  value={escalateReason}
                  onChange={e => setEscalateReason(e.target.value)}
                  className="w-full bg-background border border-input rounded-lg px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setShowEscalateModal(false)}
                  className="px-4 py-2 text-muted-foreground hover:text-foreground"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={escalateSubmitting || !escalateReason.trim()}
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg font-semibold flex items-center gap-2 transition shadow-xs"
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
