'use client';

import React from 'react';
import {
  Terminal,
  Activity,
  Server,
  Database,
  Cpu,
  Clock,
  Radio,
  CheckCircle2,
  RefreshCw,
  ShieldAlert,
  Layers,
  Wrench,
  AlertTriangle,
} from 'lucide-react';

interface DeveloperToolsViewProps {
  currentUser?: any;
  initialTab?: 'diagnostics' | 'config';
}

export function DeveloperToolsView({ currentUser, initialTab = 'diagnostics' }: DeveloperToolsViewProps) {
  const [activeTab, setActiveTab] = React.useState<'diagnostics' | 'config'>(initialTab);
  const [diagnostics, setDiagnostics] = React.useState<any>(null);
  const [configData, setConfigData] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const fetchDevData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [diagRes, confRes] = await Promise.all([
        fetch('/api/system/diagnostics'),
        fetch('/api/system/developer-config'),
      ]);

      if (diagRes.status === 403 || confRes.status === 403) {
        setError('Access denied: Developer Super Admin role required to access this console.');
        return;
      }

      if (diagRes.ok) {
        const dj = await diagRes.json();
        setDiagnostics(dj.data);
      }
      if (confRes.ok) {
        const cj = await confRes.json();
        setConfigData(cj.data);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch developer telemetry');
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchDevData();
  }, []);

  if (error) {
    return (
      <div className="p-8 rounded-2xl bg-card border border-rose-500/30 text-center space-y-3">
        <ShieldAlert className="w-10 h-10 text-rose-400 mx-auto" />
        <h3 className="text-base font-bold text-foreground">Restricted Developer Console</h3>
        <p className="text-xs text-muted-foreground max-w-md mx-auto">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Terminal className="w-5 h-5 text-purple-400" />
            Developer Platform Console
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Technical platform architecture, socket telemetry, runtime memory, and low-level configuration.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex bg-muted p-1 rounded-xl text-xs font-semibold">
            <button
              onClick={() => setActiveTab('diagnostics')}
              className={`px-3 py-1.5 rounded-lg transition ${
                activeTab === 'diagnostics' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Runtime Diagnostics
            </button>
            <button
              onClick={() => setActiveTab('config')}
              className={`px-3 py-1.5 rounded-lg transition ${
                activeTab === 'config' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Platform Config
            </button>
          </div>

          <button
            onClick={fetchDevData}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-card border border-border text-xs text-foreground hover:bg-accent transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {loading && !diagnostics ? (
        <div className="p-12 text-center text-muted-foreground text-xs">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-primary" />
          Querying low-level platform diagnostics...
        </div>
      ) : activeTab === 'diagnostics' && diagnostics ? (
        <div className="space-y-6">
          {/* Runtime Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 rounded-2xl bg-card border border-border shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">Engine Status</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="mt-2 text-2xl font-bold text-emerald-400 uppercase font-mono">
                {diagnostics.status}
              </div>
              <span className="text-[11px] text-muted-foreground">Core Node daemon active</span>
            </div>

            <div className="p-4 rounded-2xl bg-card border border-border shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">Process Uptime</span>
                <Clock className="w-4 h-4 text-blue-400" />
              </div>
              <div className="mt-2 text-2xl font-bold text-foreground font-mono">{diagnostics.uptime}</div>
              <span className="text-[11px] text-muted-foreground">{diagnostics.processUptimeSeconds}s total uptime</span>
            </div>

            <div className="p-4 rounded-2xl bg-card border border-border shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">Heap Memory</span>
                <Cpu className="w-4 h-4 text-purple-400" />
              </div>
              <div className="mt-2 text-2xl font-bold text-foreground font-mono">
                {diagnostics.memory?.heapUsedMb} MB
              </div>
              <span className="text-[11px] text-muted-foreground">
                of {diagnostics.memory?.heapTotalMb} MB allocated heap
              </span>
            </div>

            <div className="p-4 rounded-2xl bg-card border border-border shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">Resident Memory (RSS)</span>
                <Layers className="w-4 h-4 text-indigo-400" />
              </div>
              <div className="mt-2 text-2xl font-bold text-indigo-400 font-mono">
                {diagnostics.memory?.rssMb} MB
              </div>
              <span className="text-[11px] text-muted-foreground">OS resident set size</span>
            </div>
          </div>

          {/* System Specs */}
          <div className="p-5 rounded-2xl bg-card border border-border shadow-sm space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <Server className="w-4 h-4 text-primary" />
              Environment Specs & Architecture
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
              <div className="p-3 rounded-xl bg-background border border-border">
                <span className="text-[10px] text-muted-foreground uppercase font-semibold">Node Version</span>
                <p className="font-mono font-bold text-foreground mt-0.5">{diagnostics.nodeVersion}</p>
              </div>
              <div className="p-3 rounded-xl bg-background border border-border">
                <span className="text-[10px] text-muted-foreground uppercase font-semibold">Platform</span>
                <p className="font-mono font-bold text-foreground mt-0.5">{diagnostics.platform}</p>
              </div>
              <div className="p-3 rounded-xl bg-background border border-border">
                <span className="text-[10px] text-muted-foreground uppercase font-semibold">CPU Architecture</span>
                <p className="font-mono font-bold text-foreground mt-0.5">{diagnostics.arch}</p>
              </div>
              <div className="p-3 rounded-xl bg-background border border-border">
                <span className="text-[10px] text-muted-foreground uppercase font-semibold">Timestamp</span>
                <p className="font-mono text-muted-foreground text-[11px] mt-0.5">
                  {new Date(diagnostics.timestamp).toLocaleTimeString()}
                </p>
              </div>
            </div>
          </div>
        </div>
      ) : activeTab === 'config' && configData ? (
        <div className="space-y-6">
          {/* Socket Ports */}
          <div className="p-5 rounded-2xl bg-card border border-border shadow-sm space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <Radio className="w-4 h-4 text-primary" />
              RADIUS & Network Sockets
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs font-mono">
              <div className="p-3 rounded-xl bg-background border border-border">
                <span className="text-[10px] text-muted-foreground uppercase font-semibold">RADIUS Host</span>
                <p className="font-bold text-foreground mt-0.5">{configData.radiusHost}</p>
              </div>
              <div className="p-3 rounded-xl bg-background border border-border">
                <span className="text-[10px] text-muted-foreground uppercase font-semibold">Authentication (UDP)</span>
                <p className="font-bold text-emerald-400 mt-0.5">{configData.radiusAuthPort}</p>
              </div>
              <div className="p-3 rounded-xl bg-background border border-border">
                <span className="text-[10px] text-muted-foreground uppercase font-semibold">Accounting (UDP)</span>
                <p className="font-bold text-blue-400 mt-0.5">{configData.radiusAcctPort}</p>
              </div>
              <div className="p-3 rounded-xl bg-background border border-border">
                <span className="text-[10px] text-muted-foreground uppercase font-semibold">CoA / PoD (UDP)</span>
                <p className="font-bold text-purple-400 mt-0.5">{configData.radiusCoaPort}</p>
              </div>
            </div>
          </div>

          {/* Database Specs */}
          <div className="p-5 rounded-2xl bg-card border border-border shadow-sm space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <Database className="w-4 h-4 text-primary" />
              PostgreSQL Database Configuration
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs font-mono">
              <div className="p-3 rounded-xl bg-background border border-border">
                <span className="text-[10px] text-muted-foreground uppercase font-semibold">Database Host</span>
                <p className="font-bold text-foreground mt-0.5">{configData.dbHost}</p>
              </div>
              <div className="p-3 rounded-xl bg-background border border-border">
                <span className="text-[10px] text-muted-foreground uppercase font-semibold">Database Name</span>
                <p className="font-bold text-foreground mt-0.5">{configData.dbName}</p>
              </div>
              <div className="p-3 rounded-xl bg-background border border-border">
                <span className="text-[10px] text-muted-foreground uppercase font-semibold">Database Port</span>
                <p className="font-bold text-foreground mt-0.5">{configData.dbPort}</p>
              </div>
            </div>
          </div>

          {/* Active Features */}
          <div className="p-5 rounded-2xl bg-card border border-border shadow-sm space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <Wrench className="w-4 h-4 text-primary" />
              Platform Feature Status
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              {Object.entries(configData.features || {}).map(([feat, enabled]) => (
                <div key={feat} className="p-3 rounded-xl bg-background border border-border flex items-center justify-between">
                  <span className="font-medium text-foreground">{feat}</span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${enabled ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                    {enabled ? 'Active' : 'Disabled'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
