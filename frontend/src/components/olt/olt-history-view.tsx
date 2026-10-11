'use client';

import React from 'react';
import {
  Clock,
  History,
  Server,
  User,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Search,
  Filter,
  RefreshCw,
  Terminal,
  ChevronRight,
  Eye,
  X,
  Copy,
  Check,
} from 'lucide-react';
import type { OltOperationHistoryItem, OltItem } from '@/types/olt';

interface OltHistoryViewProps {
  currentUser?: any;
}

export function OltHistoryView({ currentUser }: OltHistoryViewProps) {
  const [history, setHistory] = React.useState<OltOperationHistoryItem[]>([]);
  const [olts, setOlts] = React.useState<OltItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [search, setSearch] = React.useState('');
  const [selectedOlt, setSelectedOlt] = React.useState<string>('all');
  const [selectedType, setSelectedType] = React.useState<string>('all');
  const [selectedStatus, setSelectedStatus] = React.useState<string>('all');
  const [selectedLog, setSelectedLog] = React.useState<OltOperationHistoryItem | null>(null);
  const [copied, setCopied] = React.useState(false);

  const getAuthHeaders = (): Record<string, string> => {
    if (typeof window === 'undefined') return {};
    const token = localStorage.getItem('radius_token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const fetchOlts = async () => {
    try {
      const res = await fetch('/api/olts', { headers: getAuthHeaders() });
      if (res.ok) {
        const json = await res.json();
        setOlts(json.data || []);
      }
    } catch {}
  };

  const fetchHistory = async () => {
    try {
      setLoading(true);
      const sp = new URLSearchParams();
      if (selectedOlt !== 'all') sp.set('olt_id', selectedOlt);
      sp.set('limit', '150');

      const res = await fetch(`/api/olt-operations/history?${sp.toString()}`, {
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        const json = await res.json();
        setHistory(json.data || []);
      }
    } catch {
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchOlts();
  }, []);

  React.useEffect(() => {
    fetchHistory();
  }, [selectedOlt]);

  const handleCopyLog = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const filteredHistory = history.filter((item) => {
    if (selectedType !== 'all' && item.operation_type !== selectedType) return false;
    if (selectedStatus !== 'all' && item.status !== selectedStatus) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const matchSummary = item.sanitized_command_summary?.toLowerCase().includes(q);
      const matchOperator = item.operator_username?.toLowerCase().includes(q);
      const matchOlt = item.olt_name?.toLowerCase().includes(q);
      if (!matchSummary && !matchOperator && !matchOlt) return false;
    }
    return true;
  });

  const getDuration = (start: string, end?: string | null) => {
    if (!end) return 'Running...';
    const s = new Date(start).getTime();
    const e = new Date(end).getTime();
    const diff = Math.max(0, e - s);
    if (diff < 1000) return `${diff}ms`;
    return `${(diff / 1000).toFixed(2)}s`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <History className="w-5 h-5 text-primary" />
            OLT Operation History & Audit Log
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Immutable, password-sanitized audit log of all hardware CLI commands, provisioning events, and diagnostics
          </p>
        </div>

        <button
          onClick={fetchHistory}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-semibold hover:bg-muted transition-colors self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Filters Bar */}
      <div className="bg-card border border-border rounded-xl p-4 shadow-sm flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-1 min-w-[220px]">
          <div className="relative w-full max-w-sm">
            <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search command summary, operator, OLT..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* OLT Filter */}
          <select
            value={selectedOlt}
            onChange={(e) => setSelectedOlt(e.target.value)}
            className="text-xs border border-border rounded-lg px-2.5 py-1.5 bg-background text-foreground"
          >
            <option value="all">All OLTs ({olts.length})</option>
            {olts.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>

          {/* Operation Type Filter */}
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="text-xs border border-border rounded-lg px-2.5 py-1.5 bg-background text-foreground"
          >
            <option value="all">All Operation Types</option>
            <option value="test_connection">CLI Test</option>
            <option value="discover_onus">ONU Discovery (Autofind)</option>
            <option value="sync_inventory">Synchronization</option>
            <option value="provision_onu">Provision ONU</option>
            <option value="delete_onu">Delete ONU</option>
            <option value="check_optical">Optical Telemetry</option>
            <option value="reboot_ont">Reboot ONT</option>
          </select>

          {/* Status Filter */}
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="text-xs border border-border rounded-lg px-2.5 py-1.5 bg-background text-foreground"
          >
            <option value="all">All Statuses</option>
            <option value="success">Success</option>
            <option value="failed">Failed</option>
            <option value="partial_success">Partial Success</option>
            <option value="started">Running / Started</option>
          </select>
        </div>
      </div>

      {/* History Table */}
      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-muted/50 border-b border-border text-muted-foreground font-semibold">
              <tr>
                <th className="py-2.5 px-3">Timestamp</th>
                <th className="py-2.5 px-3">OLT Device</th>
                <th className="py-2.5 px-3">Operation</th>
                <th className="py-2.5 px-3">Operator</th>
                <th className="py-2.5 px-3">Command Summary</th>
                <th className="py-2.5 px-3 text-center">Status</th>
                <th className="py-2.5 px-3 text-center">Duration</th>
                <th className="py-2.5 px-3 text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-muted-foreground">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-primary" />
                    Loading audit trail...
                  </td>
                </tr>
              ) : filteredHistory.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-muted-foreground">
                    No operations match the selected criteria.
                  </td>
                </tr>
              ) : (
                filteredHistory.map((item) => (
                  <tr key={item.id} className="hover:bg-muted/30 transition-colors">
                    <td className="py-3 px-3 text-muted-foreground whitespace-nowrap">
                      <div className="font-medium text-foreground">
                        {new Date(item.started_at).toLocaleTimeString()}
                      </div>
                      <div className="text-[10px]">
                        {new Date(item.started_at).toLocaleDateString()}
                      </div>
                    </td>

                    <td className="py-3 px-3 font-semibold text-foreground whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <Server className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                        <span>{item.olt_name || `OLT #${item.olt_id}`}</span>
                      </div>
                    </td>

                    <td className="py-3 px-3 whitespace-nowrap">
                      <span className="font-mono px-2 py-0.5 rounded bg-muted text-[11px] font-semibold text-foreground border border-border">
                        {item.operation_type}
                      </span>
                    </td>

                    <td className="py-3 px-3 whitespace-nowrap">
                      <div className="flex items-center gap-1 font-medium text-foreground">
                        <User className="w-3 h-3 text-muted-foreground" />
                        <span>{item.operator_username || 'system'}</span>
                      </div>
                    </td>

                    <td className="py-3 px-3 max-w-xs truncate font-mono text-[11px] text-muted-foreground">
                      {item.sanitized_command_summary}
                    </td>

                    <td className="py-3 px-3 text-center whitespace-nowrap">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          item.status === 'success'
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                            : item.status === 'failed'
                            ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                            : item.status === 'partial_success'
                            ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                            : 'bg-muted text-muted-foreground animate-pulse'
                        }`}
                      >
                        {item.status === 'success' ? (
                          <CheckCircle2 className="w-3 h-3" />
                        ) : item.status === 'failed' ? (
                          <XCircle className="w-3 h-3" />
                        ) : (
                          <Clock className="w-3 h-3" />
                        )}
                        {item.status.toUpperCase()}
                      </span>
                    </td>

                    <td className="py-3 px-3 text-center font-mono text-muted-foreground whitespace-nowrap">
                      {getDuration(item.started_at, item.completed_at)}
                    </td>

                    <td className="py-3 px-3 text-right whitespace-nowrap">
                      <button
                        onClick={() => setSelectedLog(item)}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-border hover:bg-muted transition-colors text-[11px] font-medium ml-auto"
                      >
                        <Eye className="w-3 h-3 text-primary" />
                        Inspect
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-xl w-full max-w-2xl shadow-xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-primary" />
                <h3 className="font-semibold text-sm text-foreground">
                  Operation Audit Detail: {selectedLog.operation_type}
                </h3>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                className="p-1 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-4 overflow-y-auto flex-1 text-xs">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-muted/40 p-3 rounded-lg border border-border">
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase font-bold block">OLT</span>
                  <span className="font-semibold text-foreground">{selectedLog.olt_name || `OLT #${selectedLog.olt_id}`}</span>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase font-bold block">Operator</span>
                  <span className="font-semibold text-foreground">{selectedLog.operator_username || 'system'}</span>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase font-bold block">Status</span>
                  <span className="font-semibold text-foreground uppercase">{selectedLog.status}</span>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase font-bold block">Duration</span>
                  <span className="font-mono text-foreground">
                    {getDuration(selectedLog.started_at, selectedLog.completed_at)}
                  </span>
                </div>
              </div>

              <div>
                <span className="text-[11px] font-semibold text-foreground block mb-1">
                  Sanitized Command / Request
                </span>
                <div className="bg-muted font-mono p-2.5 rounded-lg border border-border text-foreground break-all">
                  {selectedLog.sanitized_command_summary}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-semibold text-foreground">
                    Sanitized Result / Terminal Logs
                  </span>
                  {selectedLog.sanitized_result && (
                    <button
                      onClick={() => handleCopyLog(selectedLog.sanitized_result || '')}
                      className="flex items-center gap-1 text-[10px] text-primary hover:underline"
                    >
                      {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                      {copied ? 'Copied' : 'Copy Log'}
                    </button>
                  )}
                </div>
                <div className="bg-black/90 text-emerald-400 font-mono p-3 rounded-lg border border-border text-[11px] whitespace-pre-wrap max-h-64 overflow-y-auto">
                  {selectedLog.sanitized_result || 'No terminal output recorded.'}
                </div>
              </div>
            </div>

            <div className="p-3 border-t border-border flex justify-end">
              <button
                onClick={() => setSelectedLog(null)}
                className="px-3 py-1.5 rounded-lg border border-border text-xs font-medium hover:bg-muted"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
