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
          bg: 'bg-rose-500/10',
          border: 'border-rose-500/30',
          text: 'text-rose-600 dark:text-rose-400',
          badge: 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30 font-bold',
          badgeLabel: 'P1 — Urgent Outage',
        };
      case 'HIGH':
        return {
          bg: 'bg-amber-500/10',
          border: 'border-amber-500/30',
          text: 'text-amber-600 dark:text-amber-400',
          badge: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30 font-bold',
          badgeLabel: 'P2 — Severe Degradation',
        };
      case 'MEDIUM':
        return {
          bg: 'bg-blue-500/10',
          border: 'border-blue-500/30',
          text: 'text-blue-600 dark:text-blue-400',
          badge: 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30 font-bold',
          badgeLabel: 'P3 — Single Subscriber',
        };
      case 'LOW':
      default:
        return {
          bg: 'bg-muted/40',
          border: 'border-border',
          text: 'text-foreground',
          badge: 'bg-muted text-foreground border-border font-bold',
          badgeLabel: 'P4 — General Inquiry',
        };
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-card border border-border p-6 rounded-2xl shadow-sm">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-primary/10 border border-primary/20 rounded-xl text-primary">
              <Clock className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground tracking-tight">Service Level Agreements (SLA)</h1>
              <p className="text-muted-foreground text-xs mt-0.5">
                Configurable resolution deadlines, response metrics, and breach triggers
              </p>
            </div>
          </div>
        </div>
        <div>
          <button
            onClick={() => fetchRules()}
            className="flex items-center gap-2 px-3.5 py-2 bg-card hover:bg-muted text-muted-foreground hover:text-foreground rounded-xl text-xs font-semibold border border-border transition"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh Rules
          </button>
        </div>
      </div>

      {message && (
        <div
          className={`p-4 rounded-xl border text-xs flex items-center justify-between ${
            message.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-300'
              : 'bg-rose-500/10 border-rose-500/20 text-rose-600 dark:text-rose-300'
          }`}
        >
          <div className="flex items-center gap-2">
            {message.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            )}
            <span>{message.text}</span>
          </div>
          <button onClick={() => setMessage(null)} className="text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Info Card explaining SLA calculation */}
      <div className="bg-primary/5 border border-primary/20 rounded-2xl p-5 text-foreground text-xs flex items-start gap-3">
        <Info className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-bold text-foreground">How SLA Deadlines Are Tracked</p>
          <p className="text-muted-foreground leading-relaxed">
            Whenever a customer complaint ticket is created, the system reads the corresponding SLA rule for that priority level.
            The ticket's resolution deadline is set to <code className="bg-muted px-1.5 py-0.5 rounded text-primary font-mono text-[11px]">NOW() + resolution_time_hours</code>.
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
              className={`rounded-2xl border p-5 transition flex flex-col justify-between shadow-sm ${theme.bg} ${theme.border}`}
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className={`px-2.5 py-1 text-xs rounded border ${theme.badge}`}>
                    {theme.badgeLabel}
                  </span>
                  {!isEditing && (
                    <button
                      onClick={() => handleStartEdit(rule)}
                      className="p-1 text-muted-foreground hover:text-foreground transition"
                      title="Edit rule thresholds"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                  )}
                </div>

                <h3 className={`text-xl font-bold tracking-tight mb-1 ${theme.text}`}>
                  {rule.priority} Priority
                </h3>
                <p className="text-xs text-muted-foreground mb-6">
                  {rule.priority === 'CRITICAL' && 'Major link down, NAS offline, or city-wide subscriber blackout.'}
                  {rule.priority === 'HIGH' && 'Degraded speeds affecting multiple corporate or residential buildings.'}
                  {rule.priority === 'MEDIUM' && 'Single subscriber LOS, optic fiber cut, or account configuration issue.'}
                  {rule.priority === 'LOW' && 'General plan inquiries, router password change, or bill invoice requests.'}
                </p>

                {/* Thresholds Display or Edit Inputs */}
                {isEditing ? (
                  <div className="space-y-4 bg-card/90 p-4 rounded-xl border border-border">
                    <div>
                      <label className="block text-xs font-medium text-foreground mb-1">
                        First Response Target (Hours)
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="720"
                        value={respHours}
                        onChange={(e) => setRespHours(Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-full bg-background border border-border rounded-lg px-3 py-1.5 text-xs text-foreground focus:outline-none focus:border-primary"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-foreground mb-1">
                        Full Resolution Target (Hours)
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="720"
                        value={resolHours}
                        onChange={(e) => setResolHours(Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-full bg-background border border-border rounded-lg px-3 py-1.5 text-xs text-foreground focus:outline-none focus:border-primary"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 bg-card/80 rounded-xl border border-border/80 shadow-xs">
                      <div className="flex items-center gap-2">
                        <Zap className="w-4 h-4 text-amber-500" />
                        <span className="text-xs text-muted-foreground">First Response</span>
                      </div>
                      <span className="text-sm font-bold text-foreground font-mono">
                        {rule.response_time_hours} {rule.response_time_hours === 1 ? 'Hour' : 'Hours'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between p-3 bg-card/80 rounded-xl border border-border/80 shadow-xs">
                      <div className="flex items-center gap-2">
                        <Timer className="w-4 h-4 text-emerald-500" />
                        <span className="text-xs text-muted-foreground">Resolution SLA</span>
                      </div>
                      <span className="text-sm font-bold text-foreground font-mono">
                        {rule.resolution_time_hours} {rule.resolution_time_hours === 1 ? 'Hour' : 'Hours'}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="mt-6 pt-4 border-t border-border flex items-center justify-between">
                {isEditing ? (
                  <div className="flex items-center gap-2 w-full justify-end">
                    <button
                      onClick={handleCancelEdit}
                      disabled={saving}
                      className="px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => handleSaveRule(rule.priority)}
                      disabled={saving}
                      className="px-4 py-1.5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow transition"
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
                  <div className="flex items-center justify-between w-full text-xs text-muted-foreground">
                    <span>Status: Active Policy</span>
                    <span className="flex items-center gap-1 text-foreground font-mono text-[11px]">
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
            </div>
          );
        })}
      </div>
    </div>
  );
};
