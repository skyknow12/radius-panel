'use client';

import React from 'react';
import { ShieldCheck, CheckCircle2, AlertTriangle, XCircle, RefreshCw, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ServiceHealth } from '@/types/api';

interface SystemHealthSectionProps {
  services: ServiceHealth[];
  onRefresh?: () => void;
  loading?: boolean;
}

export function SystemHealthSection({ services, onRefresh, loading }: SystemHealthSectionProps) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            System Health & Service Daemon Status
          </h3>
          <p className="text-xs text-muted-foreground">
            Live diagnostic polling of backend database, FreeRADIUS daemon, and UDP sockets
          </p>
        </div>

        <button
          onClick={onRefresh}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-card hover:bg-muted text-xs font-medium text-muted-foreground hover:text-foreground transition-all disabled:opacity-50"
        >
          <RefreshCw className={cn('w-3.5 h-3.5', loading && 'animate-spin text-primary')} />
          <span>Refresh</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {services.map((svc) => {
          const isHealthy = svc.status === 'healthy';
          const isWarning = svc.status === 'warning';

          return (
            <div
              key={svc.key}
              className="p-3 rounded-xl border border-border bg-muted/20 flex flex-col justify-between"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-foreground truncate pr-1">{svc.name}</span>
                <span
                  className={cn(
                    'w-2 h-2 rounded-full flex-shrink-0',
                    isHealthy ? 'bg-emerald-500' : isWarning ? 'bg-amber-500' : 'bg-rose-500'
                  )}
                />
              </div>

              <div className="my-2">
                <div
                  className={cn(
                    'inline-flex items-center gap-1 text-xs font-bold',
                    isHealthy ? 'text-emerald-500' : isWarning ? 'text-amber-500' : 'text-rose-500'
                  )}
                >
                  {isHealthy ? (
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  ) : isWarning ? (
                    <AlertTriangle className="w-3.5 h-3.5" />
                  ) : (
                    <XCircle className="w-3.5 h-3.5" />
                  )}
                  <span>{svc.status.toUpperCase()}</span>
                </div>
                <p className="text-[10px] text-muted-foreground mt-1 line-clamp-2 leading-tight">
                  {svc.message}
                </p>
              </div>

              <div className="text-[10px] text-muted-foreground font-mono flex items-center justify-between pt-1.5 border-t border-border/60">
                <span>Latency</span>
                <span className="text-foreground">{svc.latencyMs !== null ? `${svc.latencyMs} ms` : '—'}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
