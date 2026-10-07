'use client';

import React from 'react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';
import type { AuthStatistics } from '@/types/api';

const COLORS = ['#10b981', '#ef4444', '#f59e0b']; // Green (Success), Red (Reject), Orange (Timeout)

export function AuthDonutChart({ authStats }: { authStats: AuthStatistics }) {
  const chartData = [
    { name: 'Success', value: authStats.successPct, count: authStats.success },
    { name: 'Reject', value: authStats.rejectPct, count: authStats.reject },
    { name: 'Timeout', value: authStats.timeoutPct || 0.1, count: authStats.timeout || 0 },
  ];

  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">Authentication Statistics</h3>
          <span className="text-[10px] bg-muted text-muted-foreground px-2 py-0.5 rounded font-mono uppercase">
            {authStats.range}
          </span>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">Access-Request resolution ratio</p>
      </div>

      {/* Donut Chart with Centered Total */}
      <div className="relative w-full h-48 my-2">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              innerRadius={55}
              outerRadius={75}
              paddingAngle={4}
              dataKey="value"
              stroke="none"
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value: any, name: any) => [`${value}%`, name]}
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                borderColor: 'hsl(var(--border))',
                borderRadius: '0.5rem',
                fontSize: '11px',
              }}
            />
          </PieChart>
        </ResponsiveContainer>
        {/* Center label */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-xl font-bold text-foreground">{authStats.successPct}%</span>
          <span className="text-[10px] text-muted-foreground uppercase font-medium">Success</span>
        </div>
      </div>

      {/* Bottom Breakdown details */}
      <div className="grid grid-cols-3 gap-2 text-center pt-2 border-t border-border/80">
        <div className="p-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
          <p className="text-[10px] text-muted-foreground">Accept</p>
          <p className="text-xs font-bold text-emerald-500">{authStats.successPct}%</p>
          <p className="text-[9px] text-muted-foreground font-mono">{authStats.success.toLocaleString()}</p>
        </div>
        <div className="p-1.5 rounded-lg bg-rose-500/10 border border-rose-500/20">
          <p className="text-[10px] text-muted-foreground">Reject</p>
          <p className="text-xs font-bold text-rose-500">{authStats.rejectPct}%</p>
          <p className="text-[9px] text-muted-foreground font-mono">{authStats.reject.toLocaleString()}</p>
        </div>
        <div className="p-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
          <p className="text-[10px] text-muted-foreground">Timeout</p>
          <p className="text-xs font-bold text-amber-500">{authStats.timeoutPct}%</p>
          <p className="text-[9px] text-muted-foreground font-mono">{authStats.timeout.toLocaleString()}</p>
        </div>
      </div>
    </div>
  );
}
