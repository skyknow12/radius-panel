'use client';

import React from 'react';
import { Users, ArrowRight, Download, Upload, Clock } from 'lucide-react';
import { formatBytes, formatSeconds } from '@/lib/utils';
import type { OnlineSession } from '@/types/api';

export function OnlineUsersWidget({
  sessions,
  onViewSubscriber,
  onViewAll,
}: {
  sessions: OnlineSession[];
  onViewSubscriber?: (username: string) => void;
  onViewAll?: () => void;
}) {
  return (
    <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden flex flex-col justify-between">
      <div className="p-4 border-b border-border flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Users className="w-4 h-4 text-emerald-500" />
            Online Users
          </h3>
          <p className="text-xs text-muted-foreground">Active PPPoE / IPoE accounting sessions</p>
        </div>
        <button
          onClick={onViewAll}
          className="text-xs text-primary font-medium hover:underline inline-flex items-center gap-1"
        >
          View All <ArrowRight className="w-3 h-3" />
        </button>
      </div>

      <div className="overflow-x-auto flex-1">
        <table className="w-full text-left text-xs">
          <thead className="bg-muted/50 border-b border-border text-muted-foreground font-medium">
            <tr>
              <th className="py-2.5 px-3">Username</th>
              <th className="py-2.5 px-3">IP Address</th>
              <th className="py-2.5 px-3">NAS</th>
              <th className="py-2.5 px-3">Session Time</th>
              <th className="py-2.5 px-3">Download</th>
              <th className="py-2.5 px-3">Upload</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {sessions.map((sess) => (
              <tr key={sess.id} className="hover:bg-muted/40 transition-colors">
                <td className="py-2.5 px-3 font-semibold text-foreground">
                  {onViewSubscriber ? (
                    <button
                      onClick={() => onViewSubscriber(sess.username)}
                      className="text-primary hover:underline font-semibold text-left"
                    >
                      {sess.username}
                    </button>
                  ) : (
                    sess.username
                  )}
                </td>
                <td className="py-2.5 px-3 font-mono text-muted-foreground">{sess.ipAddress}</td>
                <td className="py-2.5 px-3 font-mono text-muted-foreground">{sess.nas}</td>
                <td className="py-2.5 px-3 font-mono text-muted-foreground flex items-center gap-1">
                  <Clock className="w-3 h-3 text-muted-foreground/70" />
                  {formatSeconds(sess.sessionSeconds)}
                </td>
                <td className="py-2.5 px-3 font-mono text-muted-foreground">
                  <span className="inline-flex items-center gap-1 text-emerald-500 font-medium">
                    <Download className="w-3 h-3" />
                    {formatBytes(sess.downloadBytes)}
                  </span>
                </td>
                <td className="py-2.5 px-3 font-mono text-muted-foreground">
                  <span className="inline-flex items-center gap-1 text-blue-500 font-medium">
                    <Upload className="w-3 h-3" />
                    {formatBytes(sess.uploadBytes)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
