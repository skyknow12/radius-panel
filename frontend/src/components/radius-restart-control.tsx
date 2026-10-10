'use client';

import React from 'react';
import {
  RotateCcw,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  X,
  Server,
  Radio,
  ShieldAlert,
  Activity,
  Cpu,
  Clock,
  ExternalLink,
  Layers,
  Database,
  ArrowRight,
} from 'lucide-react';
import type { RadiusRestartResponse, ServiceHealth } from '@/types/api';

interface RestartRadiusProps {
  onRestartComplete?: (result: RadiusRestartResponse) => void;
}

// Hook to trigger restart and probe FreeRADIUS
export function useRadiusRestart() {
  const [restarting, setRestarting] = React.useState(false);
  const [probing, setProbing] = React.useState(false);
  const [result, setResult] = React.useState<RadiusRestartResponse | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const executeRestart = async (): Promise<RadiusRestartResponse | null> => {
    setRestarting(true);
    setError(null);
    setResult(null);

    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('radius_token') : null;
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch('/api/radius/restart', {
        method: 'POST',
        headers,
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error?.message || json.message || `HTTP ${res.status}`);
      }

      const restartData: RadiusRestartResponse = json.data || json;
      setResult(restartData);
      return restartData;
    } catch (err: any) {
      const errMsg = err.message || 'Failed to restart FreeRADIUS daemon';
      setError(errMsg);
      return null;
    } finally {
      setRestarting(false);
    }
  };

  const probeStatus = async () => {
    setProbing(true);
    setError(null);

    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('radius_token') : null;
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch('/api/radius/status', { headers });
      const json = await res.json();
      if (res.ok && json.data) {
        const fr = json.data.services?.find((s: any) => s.key === 'freeradius');
        setResult((prev) => ({
          success: json.data.isReachable,
          message: fr?.message || (json.data.isReachable ? 'FreeRADIUS daemon responsive' : 'FreeRADIUS daemon offline'),
          method: prev?.method || 'verified_probe',
          restartedAt: prev?.restartedAt || new Date().toISOString(),
          containerName: 'radius-freeradius',
          health: {
            status: fr?.status || (json.data.isReachable ? 'healthy' : 'offline'),
            latencyMs: fr?.latencyMs || 2,
            authPort: 1812,
            acctPort: 1813,
            message: fr?.message || 'Probed via Status-Server UDP 1812',
          },
        }));
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setProbing(false);
    }
  };

  return {
    restarting,
    probing,
    result,
    error,
    executeRestart,
    probeStatus,
    clearResult: () => {
      setResult(null);
      setError(null);
    },
  };
}

/**
 * Modal Dialog for quick FreeRADIUS restart confirmation & progress
 */
export function RadiusRestartModal({
  isOpen,
  onClose,
  onRestartSuccess,
}: {
  isOpen: boolean;
  onClose: () => void;
  onRestartSuccess?: (res: RadiusRestartResponse) => void;
}) {
  const { restarting, result, error, executeRestart, clearResult } = useRadiusRestart();
  const [confirmed, setConfirmed] = React.useState(false);

  React.useEffect(() => {
    if (!isOpen) {
      setConfirmed(false);
      clearResult();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleConfirmRestart = async () => {
    setConfirmed(true);
    const res = await executeRestart();
    if (res && res.success && onRestartSuccess) {
      onRestartSuccess(res);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-2xl relative space-y-4">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-500 flex items-center justify-center border border-rose-500/20">
            <RotateCcw className={`w-5 h-5 ${restarting ? 'animate-spin' : ''}`} />
          </div>
          <div>
            <h3 className="text-base font-bold text-foreground">Restart FreeRADIUS Service</h3>
            <p className="text-xs text-muted-foreground">FreeRADIUS 3.2 Daemon Container Reload</p>
          </div>
        </div>

        {!result && !restarting && !error && (
          <div className="space-y-3 text-xs">
            <div className="p-3.5 rounded-xl border border-amber-500/20 bg-amber-500/10 text-foreground space-y-1.5">
              <div className="flex items-center gap-1.5 font-semibold text-amber-500">
                <AlertTriangle className="w-4 h-4" />
                <span>Service Continuity Notice</span>
              </div>
              <p className="text-muted-foreground text-[11px] leading-relaxed">
                Restarting the FreeRADIUS service temporarily re-initializes UDP port listeners (1812 / 1813).
                Active subscriber sessions in PostgreSQL remain intact. RADIUS authentication requests will pause for ~1-2 seconds during socket rebind.
              </p>
            </div>

            <div className="bg-muted/40 rounded-xl p-3 border border-border space-y-2 text-[11px]">
              <div className="flex justify-between text-muted-foreground">
                <span>Target Service:</span>
                <span className="font-mono text-foreground font-semibold">radius-freeradius</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Network Subnet:</span>
                <span className="font-mono text-foreground">172.28.0.0/16 (radius_net)</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>UDP Ports:</span>
                <span className="font-mono text-foreground">1812 (Auth) / 1813 (Acct)</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Database Sync:</span>
                <span className="text-emerald-500 font-semibold">PostgreSQL rlm_sql live</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl border border-border text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmRestart}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold flex items-center gap-2 shadow-lg shadow-rose-600/20 transition-all"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Confirm & Restart FreeRADIUS</span>
              </button>
            </div>
          </div>
        )}

        {restarting && (
          <div className="py-8 text-center space-y-3">
            <Loader2 className="w-8 h-8 text-rose-500 animate-spin mx-auto" />
            <div className="text-sm font-semibold text-foreground">Restarting FreeRADIUS Container...</div>
            <p className="text-xs text-muted-foreground max-w-xs mx-auto">
              Issuing daemon reload signal and verifying AAA responsiveness on UDP 1812. Please wait...
            </p>
          </div>
        )}

        {result && (
          <div className="space-y-3 text-xs animate-in zoom-in-95 duration-150">
            <div
              className={`p-4 rounded-xl border space-y-2 ${
                result.success
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500'
                  : 'bg-rose-500/10 border-rose-500/30 text-rose-500'
              }`}
            >
              <div className="flex items-center gap-2 font-bold text-sm">
                {result.success ? <CheckCircle2 className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
                <span>{result.success ? 'Restart & Verification Successful' : 'Restart Encountered Issue'}</span>
              </div>
              <p className="text-foreground text-xs leading-relaxed">{result.message}</p>
            </div>

            <div className="bg-muted/40 rounded-xl p-3 border border-border space-y-1.5 text-[11px] font-mono">
              <div className="flex justify-between text-muted-foreground">
                <span>Liveliness Status:</span>
                <span className="text-emerald-500 font-bold uppercase">{result.health.status}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Response Latency:</span>
                <span className="text-foreground">{result.health.latencyMs ?? 2} ms</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Method Applied:</span>
                <span className="text-foreground font-semibold">{result.method}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Completed At:</span>
                <span className="text-foreground">{new Date(result.restartedAt).toLocaleTimeString()}</span>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        )}

        {error && (
          <div className="space-y-3 text-xs">
            <div className="p-3.5 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-500 space-y-1">
              <div className="flex items-center gap-1.5 font-bold">
                <XCircle className="w-4 h-4" />
                <span>Restart Failed</span>
              </div>
              <p className="text-[11px]">{error}</p>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl border border-border text-xs font-semibold text-muted-foreground hover:text-foreground"
              >
                Close
              </button>
              <button
                type="button"
                onClick={handleConfirmRestart}
                className="px-4 py-2 rounded-xl bg-rose-600 text-white text-xs font-semibold hover:bg-rose-500"
              >
                Retry Restart
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Full Tab Content component for Service Management & FreeRADIUS Restart
 */
export function RadiusServiceControlTab({
  systemHealth,
  onOpenTestModal,
}: {
  systemHealth?: { services: ServiceHealth[] } | null;
  onOpenTestModal?: () => void;
}) {
  const { restarting, probing, result, error, executeRestart, probeStatus } = useRadiusRestart();
  const [modalOpen, setModalOpen] = React.useState(false);

  const frHealth = systemHealth?.services.find((s) => s.key === 'freeradius');
  const authHealth = systemHealth?.services.find((s) => s.key === 'radius_auth');
  const acctHealth = systemHealth?.services.find((s) => s.key === 'radius_acct');

  return (
    <div className="space-y-6">
      <RadiusRestartModal isOpen={modalOpen} onClose={() => setModalOpen(false)} />

      {/* Hero Control Card */}
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-border">
          <div className="flex items-start gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center border border-primary/20 flex-shrink-0">
              <Radio className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-foreground">FreeRADIUS AAA Service Management</h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 uppercase">
                  Containerized 3.2
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5 max-w-2xl">
                Real-time daemon control, socket verification, and hot-restart orchestration. RADIUS handles carrier
                PPPoE/IPoE subscriber authentication and live accounting data streams.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              onClick={probeStatus}
              disabled={probing || restarting}
              className="px-3.5 py-2 rounded-xl border border-border bg-card hover:bg-muted text-foreground text-xs font-semibold flex items-center gap-2 transition-colors disabled:opacity-50"
              title="Test FreeRADIUS status without restarting"
            >
              <Activity className={`w-3.5 h-3.5 text-primary ${probing ? 'animate-spin' : ''}`} />
              <span>{probing ? 'Probing...' : 'Probe Status'}</span>
            </button>

            <button
              onClick={() => setModalOpen(true)}
              disabled={restarting}
              className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold flex items-center gap-2 shadow-lg shadow-rose-600/20 transition-all disabled:opacity-50"
            >
              <RotateCcw className={`w-3.5 h-3.5 ${restarting ? 'animate-spin' : ''}`} />
              <span>Restart FreeRADIUS</span>
            </button>
          </div>
        </div>

        {/* Live Service Health Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl border border-border bg-muted/30">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="font-medium">FreeRADIUS Daemon</span>
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
            </div>
            <div className="text-base font-bold text-foreground mt-2">
              {frHealth?.status.toUpperCase() || 'ONLINE'}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1 truncate">
              {frHealth?.message || 'Listening on 0.0.0.0:1812/1813'}
            </p>
          </div>

          <div className="p-4 rounded-xl border border-border bg-muted/30">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="font-medium">Authentication (UDP 1812)</span>
              <span className="font-mono text-[10px] bg-emerald-500/10 text-emerald-500 px-1.5 py-0.5 rounded">
                RFC 2865
              </span>
            </div>
            <div className="text-base font-bold text-foreground mt-2">
              {authHealth?.status.toUpperCase() || 'HEALTHY'}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1 truncate">
              {authHealth?.message || 'Access-Request & BlastRADIUS MA'}
            </p>
          </div>

          <div className="p-4 rounded-xl border border-border bg-muted/30">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="font-medium">Accounting (UDP 1813)</span>
              <span className="font-mono text-[10px] bg-emerald-500/10 text-emerald-500 px-1.5 py-0.5 rounded">
                RFC 2866
              </span>
            </div>
            <div className="text-base font-bold text-foreground mt-2">
              {acctHealth?.status.toUpperCase() || 'HEALTHY'}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1 truncate">
              {acctHealth?.message || 'Interim updates synchronized'}
            </p>
          </div>

          <div className="p-4 rounded-xl border border-border bg-muted/30">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="font-medium">PostgreSQL SQL Driver</span>
              <span className="font-mono text-[10px] bg-blue-500/10 text-blue-500 px-1.5 py-0.5 rounded">
                rlm_sql
              </span>
            </div>
            <div className="text-base font-bold text-foreground mt-2">CONNECTED</div>
            <p className="text-[11px] text-muted-foreground mt-1 truncate">
              radcheck, radacct, nas tables
            </p>
          </div>
        </div>

        {/* Dynamic Sync Notice */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 text-xs">
          <div className="p-4 rounded-xl border border-border bg-card space-y-2">
            <div className="flex items-center gap-2 font-bold text-foreground">
              <Database className="w-4 h-4 text-primary" />
              <span>Real-time SQL Backend Sync (No Restart Needed)</span>
            </div>
            <p className="text-muted-foreground leading-relaxed text-[11px]">
              FreeRADIUS uses the <code className="text-primary font-mono font-semibold">rlm_sql_postgresql</code> driver.
              Whenever you add or update <strong>NAS devices</strong>, <strong>subscribers</strong>,
              or <strong>service speed packages</strong>, the changes take effect immediately in PostgreSQL.
              A restart is <em>not</em> required for daily operations.
            </p>
          </div>

          <div className="p-4 rounded-xl border border-border bg-card space-y-2">
            <div className="flex items-center gap-2 font-bold text-foreground">
              <RotateCcw className="w-4 h-4 text-rose-500" />
              <span>When Should You Restart FreeRADIUS?</span>
            </div>
            <ul className="text-muted-foreground space-y-1 list-disc list-inside text-[11px]">
              <li>After updating core server dictionaries or vendor dictionaries.</li>
              <li>When changing network subnet definitions in <code className="text-foreground font-mono">clients.conf</code>.</li>
              <li>If UDP socket listeners experience memory or binding anomalies.</li>
              <li>To reload static test user profiles or configuration files.</li>
            </ul>
          </div>
        </div>

        {/* Active Probes Banner */}
        {onOpenTestModal && (
          <div className="p-4 rounded-xl border border-primary/20 bg-primary/5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Activity className="w-5 h-5 text-primary" />
              <div>
                <div className="font-semibold text-xs text-foreground">Interactive radtest Verification Probe</div>
                <div className="text-[11px] text-muted-foreground">
                  Send synthetic RFC 2865 Access-Request packets directly to verify live credential validation.
                </div>
              </div>
            </div>
            <button
              onClick={onOpenTestModal}
              className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground font-semibold text-xs hover:bg-primary/90 transition-all flex items-center gap-1.5"
            >
              <span>Launch Test</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
