'use client';

import React from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import type { NetworkOverviewPoint, TimeRange } from '@/types/api';

const RANGES: TimeRange[] = ['1h', '6h', '24h', '7d', '30d'];

interface NetworkOverviewProps {
  data: NetworkOverviewPoint[];
  range: TimeRange;
  setRange: (r: TimeRange) => void;
}

export function NetworkOverviewChart({ data, range, setRange }: NetworkOverviewProps) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      {/* Header & Time Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
        <div>
          <h3 className="text-base font-semibold text-foreground">Network Overview</h3>
          <p className="text-xs text-muted-foreground">
            Subscribers online, authentication traffic load and throughput analysis
          </p>
        </div>

        {/* Time range selector: 1H, 6H, 24H, 7D, 30D */}
        <div className="inline-flex rounded-lg border border-border bg-muted/60 p-0.5">
          {RANGES.map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`px-3 py-1 rounded-md text-xs font-medium uppercase transition-all ${
                range === r
                  ? 'bg-card text-foreground font-semibold shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* Legend summary pills */}
      <div className="flex flex-wrap items-center gap-4 text-xs mb-3">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-primary" />
          <span className="text-muted-foreground">Online Subscribers</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
          <span className="text-muted-foreground">Auth Requests</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
          <span className="text-muted-foreground">Success</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
          <span className="text-muted-foreground">Failure</span>
        </div>
      </div>

      {/* Responsive Recharts Area */}
      <div className="w-full h-72">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="colorOnline" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.0} />
              </linearGradient>
              <linearGradient id="colorAuth" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.6} />
            <XAxis
              dataKey="timestamp"
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
              tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v)}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                borderColor: 'hsl(var(--border))',
                borderRadius: '0.75rem',
                fontSize: '12px',
                color: 'hsl(var(--foreground))',
                boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
              }}
            />
            <Area
              type="monotone"
              dataKey="onlineSubscribers"
              name="Online Subscribers"
              stroke="#8b5cf6"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#colorOnline)"
            />
            <Area
              type="monotone"
              dataKey="authRequests"
              name="Auth Requests"
              stroke="#3b82f6"
              strokeWidth={1.5}
              fillOpacity={1}
              fill="url(#colorAuth)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
