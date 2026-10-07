'use client';

import React from 'react';
import { Radio, CheckCircle2, XCircle, AlertCircle, Play, Loader2, X } from 'lucide-react';

interface RadiusTestModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function RadiusTestModal({ isOpen, onClose }: RadiusTestModalProps) {
  const [username, setUsername] = React.useState('testuser');
  const [password, setPassword] = React.useState('testpassword');
  const [loading, setLoading] = React.useState(false);
  const [result, setResult] = React.useState<any>(null);

  if (!isOpen) return null;

  const handleTest = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);

    try {
      const res = await fetch('/api/radius/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      setResult(data.data || data);
    } catch (err: any) {
      setResult({ success: false, message: `Request failed: ${err.message}` });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-2.5 mb-4">
          <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
            <Radio className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-foreground">FreeRADIUS Authentication Tester</h3>
            <p className="text-xs text-muted-foreground">Sends live PAP Access-Request with BlastRADIUS MA</p>
          </div>
        </div>

        <form onSubmit={handleTest} className="space-y-3.5">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 font-mono"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 font-mono"
              required
            />
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold py-2.5 rounded-xl text-xs shadow-md shadow-primary/25 transition-all disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-current" />}
              <span>Execute radtest Probe</span>
            </button>
          </div>
        </form>

        {/* Live Result feedback */}
        {result && (
          <div
            className={`mt-4 p-3.5 rounded-xl border text-xs animate-in zoom-in-95 duration-150 ${
              result.success
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500'
                : 'bg-rose-500/10 border-rose-500/30 text-rose-500'
            }`}
          >
            <div className="flex items-center gap-2 font-bold">
              {result.success ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
              <span>{result.message}</span>
            </div>
            {result.latencyMs !== undefined && (
              <div className="mt-1 text-[11px] opacity-90 font-mono">
                Round-trip time: {result.latencyMs} ms {result.codeName ? `• Result Code: ${result.codeName}` : ''}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
