'use client';

import React from 'react';
import { Shield, Lock, User, Eye, EyeOff, Radio, ArrowRight, AlertCircle, CheckCircle2 } from 'lucide-react';
import { ThemeToggle } from './theme-toggle';

interface LoginViewProps {
  onLoginSuccess: (user: any) => void;
}

export function LoginView({ onLoginSuccess }: LoginViewProps) {
  const [username, setUsername] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [showPassword, setShowPassword] = React.useState(false);
  const [remember, setRemember] = React.useState(true);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setError('Please enter both username/email and password.');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: username.trim(),
          password,
          remember,
        }),
      });

      let data: any = null;
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        try {
          data = await res.json();
        } catch {
          data = null;
        }
      }

      if (!res.ok) {
        if (res.status === 502 || res.status === 503 || res.status === 504) {
          throw new Error(
            `Backend API service is currently unreachable (${res.status} Bad Gateway). Please ensure the backend container is started with: docker compose up -d`
          );
        }
        throw new Error(
          data?.error?.message ||
            data?.message ||
            `Authentication failed (HTTP ${res.status}). Please check your username and password.`
        );
      }

      if (!data) {
        throw new Error('Received unexpected non-JSON response from server.');
      }

      if (data.data?.token) {
        localStorage.setItem('radius_token', data.data.token);
        localStorage.setItem('radius_user', JSON.stringify(data.data.user));
      }

      onLoginSuccess(data.data.user);
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Please verify your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col justify-between bg-background text-foreground relative overflow-hidden select-none">
      {/* Background Decorative Gradient & Glow */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/15 via-background to-background pointer-events-none" />
      <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />

      {/* Top Header Bar */}
      <header className="relative z-10 w-full px-6 py-4 flex items-center justify-between border-b border-border/40 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-sm shadow-primary/10">
            <Radio className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm tracking-tight text-foreground">SKY RADIUS</span>
              <span className="text-[10px] font-semibold tracking-wider uppercase px-1.5 py-0.5 rounded bg-primary/15 text-primary border border-primary/25">
                v0.1.0
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground">Carrier ISP AAA & Control Platform</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <ThemeToggle />
        </div>
      </header>

      {/* Main Login Card */}
      <main className="relative z-10 w-full flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <div className="rounded-2xl border border-border bg-card/85 backdrop-blur-xl p-8 shadow-2xl shadow-black/10 transition-all">
            {/* Header */}
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 text-primary mb-4 shadow-inner">
                <Shield className="w-7 h-7" />
              </div>
              <h1 className="text-xl font-bold tracking-tight text-foreground">Sign In to Dashboard</h1>
              <p className="text-xs text-muted-foreground mt-1.5">
                Enter your administrative credentials to access the NOC portal
              </p>
            </div>

            {/* Error Banner */}
            {error && (
              <div className="mb-6 p-3.5 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-500 text-xs flex items-start gap-2.5 animate-in fade-in slide-in-from-top-1 duration-150">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <div className="flex-1 font-medium">{error}</div>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-foreground mb-1.5">
                  Username or Email
                </label>
                <div className="relative">
                  <User className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="admin or admin@example.com"
                    autoComplete="username"
                    autoFocus
                    className="w-full bg-muted/50 border border-border rounded-xl pl-10 pr-4 py-2.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-medium text-foreground">
                    Password
                  </label>
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter password"
                    autoComplete="current-password"
                    className="w-full bg-muted/50 border border-border rounded-xl pl-10 pr-10 py-2.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    aria-label="Toggle password visibility"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs pt-1">
                <label className="flex items-center gap-2 cursor-pointer text-muted-foreground hover:text-foreground">
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={(e) => setRemember(e.target.checked)}
                    className="w-4 h-4 rounded border-border text-primary focus:ring-primary/40 rounded-sm"
                  />
                  <span>Remember session for 30 days</span>
                </label>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl font-medium text-xs bg-primary text-primary-foreground hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary/40 shadow-lg shadow-primary/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {loading ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                    <span>Authenticating...</span>
                  </>
                ) : (
                  <>
                    <span>Authenticate & Access Dashboard</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </form>

            {/* Hint Box for Admin */}
            <div className="mt-6 pt-5 border-t border-border/80 text-[11px] text-muted-foreground">
              <div className="flex items-center gap-2 font-medium text-foreground mb-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                <span>Initial Server Bootstrap</span>
              </div>
              <p className="leading-relaxed">
                Log in using the administrator credentials configured in your server&apos;s <code className="px-1.5 py-0.5 rounded bg-muted text-foreground text-[10px] font-mono">.env</code> file (default username: <strong className="text-foreground">admin</strong>).
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer Status Bar */}
      <footer className="relative z-10 w-full px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-2 border-t border-border/40 text-[11px] text-muted-foreground">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span>
            FreeRADIUS 3.2 RFC 2865
          </span>
          <span>•</span>
          <span>PostgreSQL 16 Engine</span>
          <span>•</span>
          <span>CVE-2024-3596 Hardened</span>
        </div>
        <div>
          <span>SKY RADIUS Management Platform &copy; {new Date().getFullYear()}</span>
        </div>
      </footer>
    </div>
  );
}
