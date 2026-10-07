'use client';

import React from 'react';
import {
  Users,
  Wifi,
  Package,
  DollarSign,
  Radio,
  CheckCircle,
  XCircle,
  Server,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { StatCard as StatCardType } from '@/types/api';

const ICONS: Record<string, React.ElementType> = {
  total_subscribers: Users,
  online_users: Wifi,
  active_packages: Package,
  todays_revenue: DollarSign,
  radius_requests: Radio,
  auth_success_rate: CheckCircle,
  auth_failure_rate: XCircle,
  nas_devices: Server,
};

export function StatCardsGrid({ stats }: { stats: StatCardType[] }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat) => {
        const IconComponent = ICONS[stat.key] || Radio;
        const isUp = (stat.changePct ?? 0) >= 0;
        const isPositiveTone = stat.positiveIsGood ? isUp : !isUp;

        return (
          <div
            key={stat.key}
            className="rounded-xl border border-border bg-card p-4 shadow-sm hover:border-primary/40 hover:shadow-md transition-all flex flex-col justify-between group relative overflow-hidden"
          >
            {/* Top row: Label & Icon */}
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">{stat.label}</span>
              <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center text-muted-foreground group-hover:text-primary group-hover:bg-primary/10 transition-colors">
                <IconComponent className="w-4 h-4" />
              </div>
            </div>

            {/* Middle: Main formatted value */}
            <div className="mt-2 flex items-baseline justify-between">
              <div className="text-2xl font-bold tracking-tight text-foreground">
                {stat.unit === 'currency'
                  ? `${stat.currency || 'NPR'} ${stat.value.toLocaleString()}`
                  : stat.unit === 'percent'
                  ? `${stat.value}%`
                  : stat.value.toLocaleString()}
              </div>

              {/* Data source label badge */}
              <span
                className={cn(
                  'text-[9px] uppercase font-mono px-1.5 py-0.5 rounded border',
                  stat.source === 'live'
                    ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                    : 'bg-muted text-muted-foreground border-border'
                )}
                title={`Data source: ${stat.source}`}
              >
                {stat.source}
              </span>
            </div>

            {/* Bottom: Change pill & mini sparkline */}
            <div className="mt-3 flex items-center justify-between text-xs">
              {stat.changePct !== null ? (
                <div
                  className={cn(
                    'flex items-center gap-1 font-medium',
                    isPositiveTone ? 'text-emerald-500' : 'text-rose-500'
                  )}
                >
                  {isUp ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                  <span>
                    {isUp ? '+' : ''}
                    {stat.changePct}%
                  </span>
                  <span className="text-[10px] text-muted-foreground font-normal ml-0.5">vs last wk</span>
                </div>
              ) : (
                <span className="text-[11px] text-muted-foreground">Active capacity</span>
              )}

              {/* Sparkline visualization */}
              {stat.sparkline && stat.sparkline.length > 0 && (
                <div className="flex items-end gap-1 h-4">
                  {stat.sparkline.map((val, idx) => {
                    const min = Math.min(...stat.sparkline!);
                    const max = Math.max(...stat.sparkline!);
                    const heightPct = max === min ? 50 : Math.max(15, Math.round(((val - min) / (max - min)) * 100));
                    return (
                      <div
                        key={idx}
                        className={cn(
                          'w-1 rounded-t transition-all',
                          isPositiveTone ? 'bg-primary/50 group-hover:bg-primary' : 'bg-rose-500/50'
                        )}
                        style={{ height: `${heightPct}%` }}
                      />
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
