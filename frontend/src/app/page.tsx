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
import { NasView } from '@/components/nas-view';
import { SubscribersView } from '@/components/subscribers-view';
import { CustomerDashboardView } from '@/components/customer-dashboard-view';
import { OnlineCustomersView } from '@/components/online-customers-view';
import { PackagesView } from '@/components/packages-view';
import { OnlineUsersView } from '@/components/online-users-view';
import { AuthLogsView } from '@/components/auth-logs-view';
import { RadiusProfilesView } from '@/components/radius-profiles-view';
import { IpPoolsView } from '@/components/ip-pools-view';
import { IpAddressesView } from '@/components/ip-addresses-view';
import { NocDashboardView } from '@/components/noc-dashboard-view';
import { AlertsView } from '@/components/alerts-view';
import { NetworkEventsView } from '@/components/network-events-view';
import { ReportsView } from '@/components/reports-view';
import { BillingDashboardView } from '@/components/billing-dashboard-view';
import { BillingTransactionsView } from '@/components/billing-transactions-view';
import { BillingExpiryView } from '@/components/billing-expiry-view';
import { PaymentMethodsView } from '@/components/payment-methods-view';
import { FinancialReportsView } from '@/components/financial-reports-view';
import { OrganizationDashboardView } from '@/components/organization-dashboard-view';
import { BranchesView } from '@/components/branches-view';
import { ResellersView } from '@/components/resellers-view';
import { WalletsView } from '@/components/wallets-view';
import { ChannelPricingView } from '@/components/channel-pricing-view';
import { ResellerCommissionView } from '@/components/reseller-commission-view';
import { ResellerProfileView } from '@/components/reseller-profile-view';
import { ResellerReportsView } from '@/components/reseller-reports-view';
import { UserManagementView } from '@/components/user-management-view';
import { RolesPermissionsView } from '@/components/roles-permissions-view';
import { TicketsView } from '@/components/tickets-view';
import { CrmView } from '@/components/crm-view';
import { SlaRulesView } from '@/components/sla-rules-view';
import { SettingsAppearanceView } from '@/components/settings-appearance-view';
import { GlobalSearchDialog } from '@/components/global-search-dialog';
import { SubscriberProfileModal } from '@/components/subscriber-profile-modal';
import { Sparkles, Calendar, Clock, AlertCircle, Shield } from 'lucide-react';
import type { TimeRange } from '@/types/api';

export default function DashboardPage() {
  const [currentUser, setCurrentUser] = React.useState<any>(null);
  const [checkingAuth, setCheckingAuth] = React.useState(true);
  const [collapsed, setCollapsed] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState('dashboard');
  const [urlParams, setUrlParams] = React.useState<Record<string, string>>({});
  const [range, setRange] = React.useState<TimeRange>('24h');
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [testModalOpen, setTestModalOpen] = React.useState(false);
  const [searchOpen, setSearchOpen] = React.useState(false);
  const [subscriberProfileId, setSubscriberProfileId] = React.useState<number | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [nasFilterForSessions, setNasFilterForSessions] = React.useState<string | null>(null);
  const [billingExpiryFilter, setBillingExpiryFilter] = React.useState<string>('today');
  const [selectedResellerId, setSelectedResellerId] = React.useState<number | null>(null);

  // Sync state with URL params on mount & popstate
  React.useEffect(() => {
    const handleUrlChange = () => {
      if (typeof window === 'undefined') return;
      const searchParams = new URLSearchParams(window.location.search);
      const tab = searchParams.get('tab');
      if (tab) setActiveTab(tab);

      const paramsObj: Record<string, string> = {};
      searchParams.forEach((val, key) => {
        if (key !== 'tab') paramsObj[key] = val;
      });
      setUrlParams(paramsObj);
    };

    handleUrlChange();
    window.addEventListener('popstate', handleUrlChange);
    return () => window.removeEventListener('popstate', handleUrlChange);
  }, []);

  const handleNavigate = (tab: string, queryParams?: Record<string, string>) => {
    setActiveTab(tab);
    setUrlParams(queryParams || {});

    if (typeof window !== 'undefined') {
      const sp = new URLSearchParams();
      sp.set('tab', tab);
      if (queryParams) {
        Object.entries(queryParams).forEach(([k, v]) => {
          if (v) sp.set(k, v);
        });
      }
      const newUrl = `${window.location.pathname}?${sp.toString()}`;
      window.history.pushState(null, '', newUrl);
    }
  };

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

  // Global search keyboard shortcut (Cmd+K / Ctrl+K)
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleOpenSubscriberByUsername = async (username: string) => {
    if (!username || username === '-') return;
    try {
      const res = await fetch(`/api/subscribers/by-username/${encodeURIComponent(username)}`);
      if (res.ok) {
        const json = await res.json();
        if (json.data?.id) {
          setSubscriberProfileId(json.data.id);
          return;
        }
      }
      // If not exact match, search
      const sRes = await fetch(`/api/subscribers?search=${encodeURIComponent(username)}`);
      if (sRes.ok) {
        const sJson = await sRes.json();
        const found = sJson.data?.items?.[0] || sJson.data?.[0];
        if (found?.id) {
          setSubscriberProfileId(found.id);
          return;
        }
      }
      setNotice(`Subscriber "${username}" not found in database.`);
      setTimeout(() => setNotice(null), 3500);
    } catch {
      setNotice(`Could not fetch details for "${username}".`);
      setTimeout(() => setNotice(null), 3500);
    }
  };

  const handleOpenSubscriberById = (id: number) => {
    setSubscriberProfileId(id);
  };

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
        setActiveTab={handleNavigate}
        collapsed={collapsed}
        currentUser={currentUser}
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
          onOpenSearch={() => setSearchOpen(true)}
          onNavigate={handleNavigate}
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

          {/* Conditional View: Dashboard vs Operations vs Billing Tabs */}
          {activeTab === 'customers_dashboard' ? (
            <CustomerDashboardView
              onNavigate={handleNavigate}
              onOpenSubscriber={(id) => setSubscriberProfileId(id)}
              onOpenCreateCustomer={() => handleNavigate('create_customer')}
              onOpenSearch={() => setSearchOpen(true)}
            />
          ) : activeTab === 'online_customers' ? (
            <OnlineCustomersView
              filterNasIp={nasFilterForSessions}
              onClearNasFilter={() => setNasFilterForSessions(null)}
              onViewSubscriber={handleOpenSubscriberByUsername}
            />
          ) : activeTab === 'create_customer' ? (
            <SubscribersView
              key="create_customer"
              autoOpenCreate={true}
              onOpenSubscriberDetails={(sub) => setSubscriberProfileId(sub.id)}
            />
          ) : activeTab === 'customers_expiring_soon' ? (
            <SubscribersView
              key="customers_expiring_soon"
              initialExpiry="7days"
              onOpenSubscriberDetails={(sub) => setSubscriberProfileId(sub.id)}
            />
          ) : activeTab === 'customers_expired' ? (
            <SubscribersView
              key="customers_expired"
              initialStatus="expired"
              onOpenSubscriberDetails={(sub) => setSubscriberProfileId(sub.id)}
            />
          ) : activeTab === 'customers_search' ? (
            <SubscribersView
              key="customers_search"
              initialSearch={urlParams.search}
              onOpenSubscriberDetails={(sub) => setSubscriberProfileId(sub.id)}
            />
          ) : activeTab === 'subscribers' || activeTab === 'total_customers' ? (
            <SubscribersView
              key="subscribers"
              initialStatus={urlParams.status}
              initialExpiry={urlParams.expiry_status}
              initialOnline={urlParams.online as any}
              initialBranch={urlParams.branch}
              initialPackage={urlParams.package_id}
              initialSearch={urlParams.search}
              autoOpenCreate={urlParams.create === 'true'}
              onOpenSubscriberDetails={(sub) => setSubscriberProfileId(sub.id)}
            />
          ) : activeTab === 'billing_dashboard' ? (
            <BillingDashboardView
              onNavigate={(tab, filter) => {
                if (filter) setBillingExpiryFilter(filter);
                handleNavigate(tab);
              }}
              onViewSubscriber={handleOpenSubscriberByUsername}
            />
          ) : activeTab === 'billing_transactions' ? (
            <BillingTransactionsView
              onViewSubscriber={handleOpenSubscriberByUsername}
            />
          ) : activeTab === 'billing_expiry' ? (
            <BillingExpiryView
              onViewSubscriber={handleOpenSubscriberByUsername}
              initialFilter={billingExpiryFilter}
            />
          ) : activeTab === 'payment_methods' ? (
            <PaymentMethodsView />
          ) : activeTab === 'billing_reports' ? (
            <FinancialReportsView />
          ) : activeTab === 'noc_dashboard' ? (
            <NocDashboardView
              onViewSubscriber={handleOpenSubscriberByUsername}
              onNavigate={(tab) => handleNavigate(tab)}
            />
          ) : activeTab === 'alerts' ? (
            <AlertsView />
          ) : activeTab === 'network_events' ? (
            <NetworkEventsView onViewSubscriber={handleOpenSubscriberByUsername} />
          ) : activeTab === 'reports' || activeTab === 'audit_logs' ? (
            <ReportsView currentUser={currentUser} onNavigate={handleNavigate} />
          ) : activeTab === 'nas_devices' ? (
            <NasView
              onViewSessions={(ip) => {
                setNasFilterForSessions(ip);
                handleNavigate('sessions');
              }}
            />
          ) : activeTab === 'organization_dashboard' ? (
            <OrganizationDashboardView
              onNavigate={(tab) => handleNavigate(tab)}
              currentUser={currentUser}
            />
          ) : activeTab === 'branches' ? (
            <BranchesView
              onViewSubscribers={() => handleNavigate('subscribers')}
              onViewWallet={() => handleNavigate('wallets')}
              currentUser={currentUser}
            />
          ) : activeTab === 'resellers' ? (
            <ResellersView
              onViewCustomers={() => handleNavigate('subscribers')}
              onViewWallet={() => handleNavigate('wallets')}
              onOpenSubscriber={(id) => setSubscriberProfileId(id)}
              initialResellerId={selectedResellerId}
              currentUser={currentUser}
            />
          ) : activeTab === 'reseller_profile' ? (
            <ResellerProfileView
              resellerId={selectedResellerId || 1}
              onBack={() => handleNavigate('resellers')}
              currentUser={currentUser}
              onOpenSubscriber={(id) => setSubscriberProfileId(id)}
            />
          ) : activeTab === 'reseller_dashboard' || activeTab === 'reseller_reports' ? (
            <ResellerReportsView
              currentUser={currentUser}
              onOpenResellerProfile={(id) => {
                setSelectedResellerId(id);
                handleNavigate('reseller_profile');
              }}
            />
          ) : activeTab === 'reseller_transactions' || activeTab === 'reseller_wallet' ? (
            <ResellerProfileView
              resellerId={selectedResellerId || 1}
              initialTab="balance_transactions"
              onBack={() => handleNavigate('resellers')}
              currentUser={currentUser}
              onOpenSubscriber={(id) => setSubscriberProfileId(id)}
            />
          ) : activeTab === 'reseller_credit' ? (
            <ResellerProfileView
              resellerId={selectedResellerId || 1}
              initialTab="credit"
              onBack={() => handleNavigate('resellers')}
              currentUser={currentUser}
              onOpenSubscriber={(id) => setSubscriberProfileId(id)}
            />
          ) : activeTab === 'wallets' ? (
            <WalletsView currentUser={currentUser} />
          ) : activeTab === 'channel_pricing' ? (
            <ChannelPricingView />
          ) : activeTab === 'commission_report' ? (
            <ResellerCommissionView />
          ) : activeTab === 'crm' ? (
            <CrmView
              currentUser={currentUser}
              onOpenSubscriber={(id) => setSubscriberProfileId(id)}
            />
          ) : activeTab === 'tickets' ? (
            <TicketsView
              currentUser={currentUser}
              onOpenSubscriber={(id) => setSubscriberProfileId(id)}
            />
          ) : activeTab === 'sla_rules' ? (
            <SlaRulesView currentUser={currentUser} />
          ) : activeTab === 'users' ? (
            <UserManagementView currentUser={currentUser} />
          ) : activeTab === 'roles' ? (
            <RolesPermissionsView currentUser={currentUser} />
          ) : activeTab === 'packages' ? (
            <PackagesView />
          ) : activeTab === 'radius_profiles' ? (
            <RadiusProfilesView />
          ) : activeTab === 'ip_pools' ? (
            <IpPoolsView />
          ) : activeTab === 'ip_addresses' ? (
            <IpAddressesView />
          ) : activeTab === 'sessions' ? (
            <OnlineUsersView
              filterNasIp={nasFilterForSessions}
              onClearNasFilter={() => setNasFilterForSessions(null)}
              onViewSubscriber={handleOpenSubscriberByUsername}
            />
          ) : activeTab === 'auth_logs' ? (
            <AuthLogsView onViewSubscriber={handleOpenSubscriberByUsername} />
          ) : activeTab === 'settings_appearance' || activeTab === 'settings' ? (
            <SettingsAppearanceView initialTab="theme" currentUser={currentUser} />
          ) : activeTab === 'settings_branding' ? (
            <SettingsAppearanceView initialTab="branding" currentUser={currentUser} />
          ) : activeTab === 'radius' || activeTab === 'radius_overview' || activeTab === 'system_health' ? (
            dashboardData && (
              <RadiusOverviewView
                authStats={dashboardData.authStatistics}
                nasDevices={dashboardData.nasDevices}
                systemHealth={healthData}
                onOpenTestModal={() => setTestModalOpen(true)}
              />
            )
          ) : (
            /* Dashboard tab */
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
                <StatCardsGrid
                  stats={dashboardData.stats}
                  onNavigate={handleNavigate}
                />

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
                  <RadiusActivityTable
                    items={dashboardData.activity}
                    onViewSubscriber={handleOpenSubscriberByUsername}
                  />
                  <OnlineUsersWidget
                    sessions={dashboardData.onlineUsers}
                    onViewSubscriber={handleOpenSubscriberByUsername}
                    onViewAll={() => handleNavigate('online_customers')}
                  />
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
          )}
        </main>
      </div>

      {/* Interactive radtest modal */}
      <RadiusTestModal isOpen={testModalOpen} onClose={() => setTestModalOpen(false)} />

      {/* Global Search Dialog */}
      <GlobalSearchDialog
        isOpen={searchOpen}
        onClose={() => setSearchOpen(false)}
        onNavigate={handleNavigate}
        onSelectSubscriber={handleOpenSubscriberById}
        onSelectNas={() => {
          setActiveTab('nas_devices');
        }}
        onSelectPackage={() => {
          setActiveTab('packages');
        }}
      />

      {/* Subscriber Profile Modal */}
      {subscriberProfileId !== null && (
        <SubscriberProfileModal
          subscriberId={subscriberProfileId}
          onClose={() => setSubscriberProfileId(null)}
          onUpdate={() => {
            fetchData();
          }}
        />
      )}
    </div>
  );
}
