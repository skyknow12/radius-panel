'use client';

import React from 'react';
import { Radio, ShieldAlert, Cpu, ArrowUpRight, CheckCircle2, Server, Key, Activity } from 'lucide-react';
import type { ServiceHealth, AuthStatistics, NasDevice } from '@/types/api';

interface RadiusOverviewProps {
  authStats: AuthStatistics;
  nasDevices: NasDevice[];
  systemHealth: { services: ServiceHealth[] } | null;
  onOpenTestModal: () => void;
}

export function RadiusOverviewView({
  authStats,
  nasDevices,
  systemHealth,
  onOpenTestModal,
}: RadiusOverviewProps) {
  const frService = systemHealth?.services.find((s) => s.key === 'freeradius');
  const authService = systemHealth?.services.find((s) => s.key === 'radius_auth');
  const acctService = systemHealth?.services.find((s) => s.key === 'radius_acct');

  return (
    <div className="space-y-6">
      {/* Overview Header banner */}
      <div className="rounded-2xl border border-primary/20 bg-gradient-to-r from-primary/10 via-card to-card p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-wider mb-1">
            <Radio className="w-4 h-4" />
            FreeRADIUS 3.2 Engine
          </div>
          <h2 className="text-xl font-bold text-foreground">RADIUS Operational Overview</h2>
          <p className="text-xs text-muted-foreground mt-1 max-w-xl">
            Centralized AAA subsystem handling PPPoE access authentication, interim accounting updates, and
            RFC 2865 dictionary management.
          </p>
        </div>

        <button
          onClick={onOpenTestModal}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold text-xs shadow-lg shadow-primary/25 hover:bg-primary/90 transition-all"
        >
          <Activity className="w-4 h-4" />
          <span>Launch radtest Probe</span>
        </button>
      </div>

      {/* Protocol Ports & Socket Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground">Authentication Port</span>
            <span className="text-xs font-mono bg-emerald-500/10 text-emerald-500 px-2 py-0.5 rounded border border-emerald-500/20">
              1812 UDP
            </span>
          </div>
          <div className="text-lg font-bold text-foreground mt-2">
            {authService?.status.toUpperCase() || 'ONLINE'}
          </div>
          <p className="text-xs text-muted-foreground mt-1">{authService?.message || 'Access-Requests handled'}</p>
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground">Accounting Port</span>
            <span className="text-xs font-mono bg-emerald-500/10 text-emerald-500 px-2 py-0.5 rounded border border-emerald-500/20">
              1813 UDP
            </span>
          </div>
          <div className="text-lg font-bold text-foreground mt-2">
            {acctService?.status.toUpperCase() || 'ONLINE'}
          </div>
          <p className="text-xs text-muted-foreground mt-1">{acctService?.message || 'Session Start/Interim/Stop'}</p>
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground">PostgreSQL SQL Driver</span>
            <span className="text-xs font-mono bg-blue-500/10 text-blue-500 px-2 py-0.5 rounded border border-blue-500/20">
              rlm_sql_postgresql
            </span>
          </div>
          <div className="text-lg font-bold text-foreground mt-2">Active</div>
          <p className="text-xs text-muted-foreground mt-1">FreeRADIUS schema linked (radacct, radpostauth)</p>
        </div>
      </div>

      {/* Security & Verification Box */}
      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
          <Key className="w-4 h-4 text-primary" />
          Test Client Credentials & Environment
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
          <div className="p-3 rounded-lg bg-muted/40 border border-border">
            <div className="text-muted-foreground">Test User Credentials</div>
            <div className="text-foreground mt-1 font-bold">username: testuser</div>
            <div className="text-foreground">password: testpassword</div>
            <div className="text-emerald-500 text-[11px] mt-1">Expected reply: Access-Accept</div>
          </div>
          <div className="p-3 rounded-lg bg-muted/40 border border-border">
            <div className="text-muted-foreground">Local radtest Shell Command</div>
            <code className="text-foreground mt-1 block bg-card p-1.5 rounded border border-border select-all">
              radtest testuser testpassword 127.0.0.1 0 testing123
            </code>
            <div className="text-muted-foreground text-[11px] mt-1">Protected by BlastRADIUS Message-Authenticator</div>
          </div>
        </div>
      </div>
    </div>
  );
}
