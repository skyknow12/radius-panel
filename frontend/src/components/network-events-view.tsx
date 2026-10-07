'use client';

import React from 'react';
import { Activity, Clock, RefreshCw, Filter, Layers, User, Zap } from 'lucide-react';
import type { NetworkEventItem } from '@/types/api';

interface NetworkEventsViewProps {
  onViewSubscriber?: (username: string) => void;
}

export function NetworkEventsView({ onViewSubscriber }: NetworkEventsViewProps = {}) {
  const [events, setEvents] = React.useState<NetworkEventItem[]>([]);
  const [loading, setLoading] = React.useState<boolean>(true);
  const [severityFilter, setSeverityFilter] = React.useState<string>('all');

  const fetchEvents = async () => {
    try {
      setLoading(true);
      const token = typeof window !== 'undefined' ? localStorage.getItem('radius_token') : null;
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      let url = '/api/network-events?limit=100';
      if (severityFilter !== 'all') url += `&severity=${severityFilter}`;

      const res = await fetch(url, { headers });
      if (res.ok) {
        const json = await res.json();
        setEvents(json.data?.items || json.data || []);
      }
    } catch {} finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchEvents();
  }, [severityFilter]);

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Activity className="w-5 h-5 text-indigo-500" />
            <span>Centralized Network Events Timeline</span>
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Audit history of all operational events, including NAS status changes, BNG session disconnects, speed changes, and recharges.
          </p>
        </div>

        <button
          onClick={fetchEvents}
          disabled={loading}
          className="p-2 rounded-xl border border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground text-xs font-medium flex items-center gap-1.5 transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="p-4 rounded-2xl border border-border bg-card shadow-sm flex items-center gap-3 text-xs">
        <Filter className="w-3.5 h-3.5 text-muted-foreground" />
        <span className="font-semibold text-foreground">Filter Severity:</span>
        {['all', 'critical', 'warning', 'info'].map((s) => (
          <button
            key={s}
            onClick={() => setSeverityFilter(s)}
            className={`px-2.5 py-1 rounded-lg capitalize font-medium transition-colors ${
              severityFilter === s
                ? 'bg-primary text-primary-foreground font-semibold shadow-sm'
                : 'bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground'
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Events Table */}
      <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-muted/30 border-b border-border text-muted-foreground">
              <tr>
                <th className="py-3 px-4 font-medium">Timestamp</th>
                <th className="py-3 px-4 font-medium">Event Type</th>
                <th className="py-3 px-4 font-medium">Severity</th>
                <th className="py-3 px-4 font-medium">Actor</th>
                <th className="py-3 px-4 font-medium">Target</th>
                <th className="py-3 px-4 font-medium">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {loading && events.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-muted-foreground">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-primary" />
                    <span>Loading network events...</span>
                  </td>
                </tr>
              ) : events.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-muted-foreground">
                    No network events recorded.
                  </td>
                </tr>
              ) : (
                events.map((e) => (
                  <tr key={e.id} className="hover:bg-muted/40 transition-colors">
                    <td className="py-3 px-4 font-mono text-muted-foreground whitespace-nowrap">
                      {new Date(e.created_at).toLocaleString([], {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </td>
                    <td className="py-3 px-4 font-mono font-semibold text-foreground">
                      {e.event_type}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${
                          e.severity === 'critical'
                            ? 'bg-rose-500/10 text-rose-500 border-rose-500/20'
                            : e.severity === 'warning'
                            ? 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                            : 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
                        }`}
                      >
                        {e.severity}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-muted-foreground font-mono">
                      {e.actor}
                    </td>
                    <td className="py-3 px-4 text-foreground font-medium">
                      {e.target && onViewSubscriber ? (
                        <button
                          onClick={() => onViewSubscriber(e.target!)}
                          className="text-primary hover:underline font-semibold text-left"
                        >
                          {e.target}
                        </button>
                      ) : (
                        e.target || '—'
                      )}
                    </td>
                    <td className="py-3 px-4 text-muted-foreground max-w-md">
                      {e.description}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
