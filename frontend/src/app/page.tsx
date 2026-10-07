'use client';

import React from 'react';
import { Sidebar } from '@/components/sidebar';
import { Topbar } from '@/components/topbar';
import { StatCardsGrid } from '@/components/stat-cards';
import { NetworkOverviewChart } from '@/components/network-overview-chart';
import { AuthDonutChart } from '@/components/auth-donut-chart';
import { RadiusActivityTable } from '@/components/radius-activity-table';
import { OnlineUsersWidget } from '@/components/online-users-widget';
import { NasStatusList } from '@/components/nas-status-list';
import { SystemHealthSection } from '@/components/system-health-section';
import { RadiusOverviewView } from '@/components/radius-overview-view';
import { RadiusTestModal } from '@/components/radius-test-modal';
import { LoginView } from '@/components/login-view';
import { Sparkles, Calendar, Clock, AlertCircle, Shield } from 'lucide-react';
import type { TimeRange } from '@/types/api';

export default function DashboardPage() {
  const [currentUser, setCurrentUser] = React.useState<any>(null);
  const [checkingAuth, setCheckingAuth] = React.useState(true);
  const [collapsed, setCollapsed] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState('dashboard');
  const [range, setRange] = React.useState<TimeRange>('24h');
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [testModalOpen, setTestModalOpen] = React.useState(false);
  const [notice, setNotice] = React.useState<string | null>(null);

  // Live state from backend
  const [dashboardData, setDashboardData] = React.useState<any>(null);
  const [healthData, setHealthData] = React.useState<any>(null);

  // Time & Greeting
  const [currentTime, setCurrentTime] = React.useState('');
  const [currentDate, setCurrentDate] = React.useState('');

  // Check existing session on mount
  React.useEffect(() => {
    const verifySession = async () => {
      try {
        const token = localStorage.getItem('radius_token');
        const savedUser = localStorage.getItem('radius_user');

        const res = await fetch('/api/auth/me', {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });

        if (res.ok) {
          const json = await res.json();
          setCurrentUser(json.data || (savedUser ? JSON.parse(savedUser) : { username: 'admin' }));
        } else {
          localStorage.removeItem('radius_token');
          localStorage.removeItem('radius_user');
          setCurrentUser(null);
        }
      } catch {
        setCurrentUser(null);
      } finally {
        setCheckingAuth(false);
      }
    };
    verifySession();
  }, []);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {}
    localStorage.removeItem('radius_token');
    localStorage.removeItem('radius_user');
    setCurrentUser(null);
  };

  React.useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      setCurrentDate(now.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    if (!currentUser) return;
    try {
      setLoading(true);
      setError(null);
      const token = typeof window !== 'undefined' ? localStorage.getItem('radius_token') : null;
      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const [dashRes, healthRes] = await Promise.all([
        fetch(`/api/dashboard?range=${range}`, { headers }),
        fetch('/api/system/health', { headers }),
      ]);

      if (dashRes.status === 401 || healthRes.status === 401) {
        handleLogout();
        return;
      }

      if (!dashRes.ok || !healthRes.ok) {
        throw new Error('Failed to fetch telemetry data from backend');
      }

      const dashJson = await dashRes.json();
      const healthJson = await healthRes.json();

      setDashboardData(dashJson.data);
      setHealthData(healthJson.data);
    } catch (err: any) {
      setError(err.message || 'Error connecting to RADIUS PRO backend');
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    if (currentUser) {
      fetchData();
      const poll = setInterval(fetchData, 30000); // 30s live refresh
      return () => clearInterval(poll);
    }
  }, [range, currentUser]);

  const handleNextModuleNotice = (moduleName: string) => {
    setNotice(`The module "${moduleName}" is coming in the next phase.`);
    setTimeout(() => setNotice(null), 4000);
  };

  if (checkingAuth) {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center bg-background text-foreground">
        <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary mb-3 shadow-inner">
          <Shield className="w-6 h-6 animate-pulse" />
        </div>
        <p className="text-xs text-muted-foreground font-medium animate-pulse">Initializing SKY RADIUS Console...</p>
      </div>
    );
  }

  if (!currentUser) {
    return <LoginView onLoginSuccess={(user) => setCurrentUser(user)} />;
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar Navigation */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        collapsed={collapsed}
        onNavigateNotice={handleNextModuleNotice}
      />

      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {/* Topbar */}
        <Topbar
          collapsed={collapsed}
          setCollapsed={setCollapsed}
          systemHealth={healthData}
          currentUser={currentUser}
          onLogout={handleLogout}
          onOpenTestModal={() => setTestModalOpen(true)}
        />

        {/* Notice toast banner */}
        {notice && (
          <div className="bg-primary/95 text-primary-foreground px-4 py-2.5 text-xs font-semibold flex items-center justify-between shadow-md transition-all animate-in slide-in-from-top-2">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4" />
              <span>{notice}</span>
            </div>
            <button onClick={() => setNotice(null)} className="opacity-80 hover:opacity-100 text-xs">
              Dismiss
            </button>
          </div>
        )}

        {/* Scrollable Main Area */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-6">
          {/* Header section */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/60 pb-5">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight text-foreground">
                  Welcome back, {currentUser?.fullName || currentUser?.username || 'Administrator'}
                </h1>
                <span className="text-xl">☀️</span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Here's what's happening with your network today.
              </p>
            </div>

            <div className="flex items-center gap-3 text-xs font-medium text-muted-foreground bg-card/60 border border-border px-3 py-1.5 rounded-xl shadow-sm">
              <div className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-primary" />
                <span>{currentDate}</span>
              </div>
              <span className="text-border">|</span>
              <div className="flex items-center gap-1.5 font-mono">
                <Clock className="w-3.5 h-3.5 text-primary" />
                <span className="text-foreground">{currentTime}</span>
              </div>
            </div>
          </div>

          {/* Error notification if backend unreachable */}
          {error && (
            <div className="p-4 rounded-xl border border-rose-500/20 bg-rose-500/10 text-rose-500 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              <span>{error}</span>
            </div>
          )}

          {/* Conditional View: Dashboard vs RADIUS Overview */}
          {activeTab === 'dashboard' ? (
            loading && !dashboardData ? (
              /* Loading Skeletons */
              <div className="space-y-6 animate-pulse">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {[...Array(8)].map((_, i) => (
                    <div key={i} className="h-28 rounded-xl bg-card border border-border" />
                  ))}
                </div>
                <div className="h-80 rounded-xl bg-card border border-border" />
              </div>
            ) : dashboardData ? (
              <>
                {/* 1. Statistic Cards */}
                <StatCardsGrid stats={dashboardData.stats} />

                {/* 2. Network Overview Chart & Authentication Statistics */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div className="lg:col-span-2">
                    <NetworkOverviewChart
                      data={dashboardData.networkOverview}
                      range={range}
                      setRange={setRange}
                    />
                  </div>
                  <div>
                    <AuthDonutChart authStats={dashboardData.authStatistics} />
                  </div>
                </div>

                {/* 3. Recent RADIUS Activity & Online Users */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <RadiusActivityTable items={dashboardData.activity} />
                  <OnlineUsersWidget sessions={dashboardData.onlineUsers} />
                </div>

                {/* 4. NAS Devices */}
                <NasStatusList devices={dashboardData.nasDevices} />

                {/* 5. System Health Section */}
                {healthData && (
                  <SystemHealthSection
                    services={healthData.services}
                    onRefresh={fetchData}
                    loading={loading}
                  />
                )}
              </>
            ) : null
          ) : (
            /* Functional RADIUS Overview tab */
            dashboardData && (
              <RadiusOverviewView
                authStats={dashboardData.authStatistics}
                nasDevices={dashboardData.nasDevices}
                systemHealth={healthData}
                onOpenTestModal={() => setTestModalOpen(true)}
              />
            )
          )}
        </main>
      </div>

      {/* Interactive radtest modal */}
      <RadiusTestModal isOpen={testModalOpen} onClose={() => setTestModalOpen(false)} />
    </div>
  );
}
