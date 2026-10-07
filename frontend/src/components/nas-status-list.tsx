'use client';

import React from 'react';
import { Server, CheckCircle2, AlertTriangle, XCircle, ArrowUpRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { NasDevice } from '@/types/api';

export function NasStatusList({ devices }: { devices: NasDevice[] }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Server className="w-4 h-4 text-primary" />
            NAS Devices
          </h3>
          <p className="text-xs text-muted-foreground">Network Access Server status & active subscriber load</p>
        </div>
        <span className="text-xs font-mono text-muted-foreground">{devices.length} registered</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {devices.map((nas) => {
          const isOnline = nas.status === 'online';
          const isWarning = nas.status === 'warning';

          return (
            <div
              key={nas.id}
              className="p-3.5 rounded-xl border border-border bg-muted/30 hover:bg-muted/60 transition-colors flex flex-col justify-between"
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs text-foreground tracking-tight">{nas.name}</span>
                <span
                  className={cn(
                    'inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border',
                    isOnline
                      ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                      : isWarning
                      ? 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                      : 'bg-rose-500/10 text-rose-500 border-rose-500/20'
                  )}
                >
                  {isOnline ? (
                    <CheckCircle2 className="w-2.5 h-2.5" />
                  ) : isWarning ? (
                    <AlertTriangle className="w-2.5 h-2.5" />
                  ) : (
                    <XCircle className="w-2.5 h-2.5" />
                  )}
                  {nas.status.toUpperCase()}
                </span>
              </div>

              <div className="my-2.5">
                <div className="text-lg font-bold text-foreground">
                  {nas.sessions.toLocaleString()}{' '}
                  <span className="text-[11px] font-normal text-muted-foreground">sessions</span>
                </div>
                <div className="text-[11px] font-mono text-muted-foreground mt-0.5">{nas.ipAddress}</div>
              </div>

              <div className="text-[10px] text-muted-foreground/80 flex items-center justify-between border-t border-border/60 pt-2">
                <span>{nas.location || nas.type.toUpperCase()}</span>
                <span>Seen: recent</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
