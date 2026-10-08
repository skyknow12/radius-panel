'use client';

import React, { useState, useEffect } from 'react';
import {
  Clock,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  Edit2,
  Save,
  X,
  RefreshCw,
  Info,
  Timer,
  Zap,
  ArrowRight
} from 'lucide-react';
import { SlaRuleItem } from '@/types/api';

interface SlaRulesViewProps {
  currentUser?: any;
}

export const SlaRulesView: React.FC<SlaRulesViewProps> = ({ currentUser }) => {
  const [rules, setRules] = useState<SlaRuleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingPriority, setEditingPriority] = useState<string | null>(null);
  const [respHours, setRespHours] = useState<number>(1);
  const [resolHours, setResolHours] = useState<number>(4);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchRules = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/tickets/sla-rules');
      const data = await res.json();
      if (data.success && data.data) {
        setRules(data.data);
      }
    } catch (err) {
      console.error('Failed to load SLA rules:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRules();
  }, []);

  const handleStartEdit = (rule: SlaRuleItem) => {
    setEditingPriority(rule.priority);
    setRespHours(rule.response_time_hours);
    setResolHours(rule.resolution_time_hours);
    setMessage(null);
  };

  const handleCancelEdit = () => {
    setEditingPriority(null);
    setMessage(null);
  };

  const handleSaveRule = async (priority: string) => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/tickets/sla-rules/${priority}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          response_time_hours: Number(respHours),
          resolution_time_hours: Number(resolHours),
        }),
      });
      const data = await res.json();
      if (data.success) {
        setMessage({ type: 'success', text: `SLA rules for ${priority} updated successfully!` });
        setEditingPriority(null);
        await fetchRules();
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to update rule' });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Network error updating rule' });
    } finally {
      setSaving(false);
    }
  };

  const getPriorityTheme = (priority: string) => {
    switch (priority) {
      case 'CRITICAL':
        return {
          bg: 'bg-red-950/20',
          border: 'border-red-500/30',
          text: 'text-red-400',
          badge: 'bg-red-500/10 text-red-400 border-red-500/20',
          badgeLabel: 'P1 — Urgent Outage',
        };
      case 'HIGH':
        return {
          bg: 'bg-amber-950/20',
          border: 'border-amber-500/30',
          text: 'text-amber-400',
          badge: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
          badgeLabel: 'P2 — Severe Degradation',
        };
      case 'MEDIUM':
        return {
          bg: 'bg-blue-950/20',
          border: 'border-blue-500/30',
          text: 'text-blue-400',
          badge: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
          badgeLabel: 'P3 — Single Subscriber',
        };
      case 'LOW':
      default:
        return {
          bg: 'bg-slate-800/40',
          border: 'border-slate-700/60',
          text: 'text-slate-300',
          badge: 'bg-slate-700/50 text-slate-300 border-slate-600',
          badgeLabel: 'P4 — General Inquiry',
        };
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-6 rounded-xl shadow-lg">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-500/10 border border-indigo-500/20 rounded-lg text-indigo-400">
              <Clock className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">Service Level Agreements (SLA)</h1>
              <p className="text-slate-400 text-sm">
                Configurable resolution deadlines, response metrics, and breach triggers
              </p>
            </div>
          </div>
        </div>
        <div>
          <button
            onClick={() => fetchRules()}
            className="flex items-center gap-2 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm border border-slate-700 transition"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh Rules
          </button>
        </div>
      </div>

      {message && (
        <div
          className={`p-4 rounded-xl border text-sm flex items-center justify-between ${
            message.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
              : 'bg-red-500/10 border-red-500/20 text-red-300'
          }`}
        >
          <div className="flex items-center gap-2">
            {message.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
            ) : (
              <AlertTriangle className="w-5 h-5 flex-shrink-0" />
            )}
            <span>{message.text}</span>
          </div>
          <button onClick={() => setMessage(null)} className="text-slate-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Info Card explaining SLA calculation */}
      <div className="bg-indigo-950/20 border border-indigo-500/20 rounded-xl p-5 text-indigo-200 text-sm flex items-start gap-3">
        <Info className="w-5 h-5 text-indigo-400 flex-shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-semibold text-white">How SLA Deadlines Are Tracked</p>
          <p className="text-slate-300 text-xs leading-relaxed">
            Whenever a customer complaint ticket is created, the system reads the corresponding SLA rule for that priority level.
            The ticket's resolution deadline is set to <code className="bg-indigo-950/60 px-1 py-0.5 rounded text-indigo-300 font-mono">NOW() + resolution_time_hours</code>.
            Tickets with under 2 hours remaining are automatically flagged as <strong>Near Breach</strong>, and overdue tickets trigger <strong>Breached SLA</strong> alerts across the NOC and CRM views.
          </p>
        </div>
      </div>

      {/* SLA Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        {rules.map((rule) => {
          const theme = getPriorityTheme(rule.priority);
          const isEditing = editingPriority === rule.priority;

          return (
            <div
              key={rule.priority}
              className={`rounded-xl border p-5 transition flex flex-col justify-between ${theme.bg} ${theme.border}`}
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className={`px-2.5 py-1 text-xs font-bold rounded border ${theme.badge}`}>
                    {theme.badgeLabel}
                  </span>
                  {!isEditing && (
                    <button
                      onClick={() => handleStartEdit(rule)}
                      className="p-1 text-slate-400 hover:text-white transition"
                      title="Edit rule thresholds"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                  )}
                </div>

                <h3 className={`text-xl font-bold tracking-tight mb-1 ${theme.text}`}>
                  {rule.priority} Priority
                </h3>
                <p className="text-xs text-slate-400 mb-6">
                  {rule.priority === 'CRITICAL' && 'Major link down, NAS offline, or city-wide subscriber blackout.'}
                  {rule.priority === 'HIGH' && 'Degraded speeds affecting multiple corporate or residential buildings.'}
                  {rule.priority === 'MEDIUM' && 'Single subscriber LOS, optic fiber cut, or account configuration issue.'}
                  {rule.priority === 'LOW' && 'General plan inquiries, router password change, or bill invoice requests.'}
                </p>

                {/* Thresholds Display or Edit Inputs */}
                {isEditing ? (
                  <div className="space-y-4 bg-slate-900/80 p-4 rounded-lg border border-slate-700/80">
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">
                        First Response Target (Hours)
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="720"
                        value={respHours}
                        onChange={(e) => setRespHours(Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">
                        Full Resolution Target (Hours)
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="720"
                        value={resolHours}
                        onChange={(e) => setResolHours(Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 bg-slate-900/60 rounded-lg border border-slate-800/80">
                      <div className="flex items-center gap-2">
                        <Zap className="w-4 h-4 text-amber-400" />
                        <span className="text-xs text-slate-300">First Response</span>
                      </div>
                      <span className="text-sm font-bold text-white font-mono">
                        {rule.response_time_hours} {rule.response_time_hours === 1 ? 'Hour' : 'Hours'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between p-3 bg-slate-900/60 rounded-lg border border-slate-800/80">
                      <div className="flex items-center gap-2">
                        <Timer className="w-4 h-4 text-emerald-400" />
                        <span className="text-xs text-slate-300">Resolution SLA</span>
                      </div>
                      <span className="text-sm font-bold text-white font-mono">
                        {rule.resolution_time_hours} {rule.resolution_time_hours === 1 ? 'Hour' : 'Hours'}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="mt-6 pt-4 border-t border-slate-800/80 flex items-center justify-between">
                {isEditing ? (
                  <div className="flex items-center gap-2 w-full justify-end">
                    <button
                      onClick={handleCancelEdit}
                      disabled={saving}
                      className="px-3 py-1.5 text-xs text-slate-400 hover:text-white"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => handleSaveRule(rule.priority)}
                      disabled={saving}
                      className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow transition"
                    >
                      {saving ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Save className="w-3.5 h-3.5" />
                      )}
                      Save
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between w-full text-xs text-slate-500">
                    <span>Status: Active Policy</span>
                    <span className="flex items-center gap-1 text-slate-400 font-mono text-[11px]">
                      {rule.updated_at ? new Date(rule.updated_at).toLocaleDateString() : 'System Default'}
                    </span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
