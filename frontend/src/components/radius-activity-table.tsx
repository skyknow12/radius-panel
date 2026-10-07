'use client';

import React from 'react';
import { Radio, CheckCircle2, XCircle, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { RadiusActivityItem } from '@/types/api';

export function RadiusActivityTable({ items }: { items: RadiusActivityItem[] }) {
  return (
    <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden flex flex-col justify-between">
      <div className="p-4 border-b border-border flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Radio className="w-4 h-4 text-primary" />
            Recent RADIUS Activity
          </h3>
          <p className="text-xs text-muted-foreground">Live stream of incoming Access & Accounting packets</p>
        </div>
        <span className="text-[11px] text-muted-foreground font-mono">Last {items.length} events</span>
      </div>

      <div className="overflow-x-auto flex-1">
        <table className="w-full text-left text-xs">
          <thead className="bg-muted/50 border-b border-border text-muted-foreground font-medium">
            <tr>
              <th className="py-2.5 px-3">Time</th>
              <th className="py-2.5 px-3">Username</th>
              <th className="py-2.5 px-3">NAS</th>
              <th className="py-2.5 px-3">IP Address</th>
              <th className="py-2.5 px-3">Type</th>
              <th className="py-2.5 px-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {items.map((row) => {
              const isSuccess = row.status === 'success';
              return (
                <tr key={row.id} className="hover:bg-muted/40 transition-colors">
                  <td className="py-2.5 px-3 font-mono text-muted-foreground">{row.time}</td>
                  <td className="py-2.5 px-3 font-semibold text-foreground">{row.username}</td>
                  <td className="py-2.5 px-3 font-mono text-muted-foreground">{row.nas}</td>
                  <td className="py-2.5 px-3 font-mono text-muted-foreground">{row.ipAddress}</td>
                  <td className="py-2.5 px-3">
                    <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-muted border border-border/80">
                      {row.type}
                    </span>
                  </td>
                  <td className="py-2.5 px-3">
                    <span
                      className={cn(
                        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border',
                        isSuccess
                          ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                          : 'bg-rose-500/10 text-rose-500 border-rose-500/20'
                      )}
                    >
                      {isSuccess ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                      {isSuccess ? 'Success' : 'Failed'}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="p-2.5 border-t border-border bg-muted/20 text-center">
        <button className="text-xs text-primary font-medium hover:underline inline-flex items-center gap-1">
          View full RADIUS transaction logs <ArrowRight className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}
