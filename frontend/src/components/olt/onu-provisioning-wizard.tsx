'use client';

import React from 'react';
import {
  Zap,
  Server,
  Radio,
  Sliders,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ChevronRight,
  ChevronLeft,
  RefreshCw,
  Terminal,
  User,
  ExternalLink,
} from 'lucide-react';
import type { OltItem } from '@/types/olt';

interface OnuProvisioningWizardProps {
  initialOltId?: number;
  initialSlot?: number;
  initialPort?: number;
  initialSn?: string;
  onSuccess?: (onuId: number) => void;
  currentUser?: any;
}

export function OnuProvisioningWizard({
  initialOltId,
  initialSlot = 0,
  initialPort = 0,
  initialSn = '',
  onSuccess,
  currentUser,
}: OnuProvisioningWizardProps) {
  const [step, setStep] = React.useState<1 | 2 | 3 | 4 | 5>(1);
  const [olts, setOlts] = React.useState<OltItem[]>([]);

  // Wizard Form States
  const [selectedOltId, setSelectedOltId] = React.useState<number | ''>(initialOltId || '');
  const [slot, setSlot] = React.useState<number>(initialSlot);
  const [port, setPort] = React.useState<number>(initialPort);
  const [serialNumber, setSerialNumber] = React.useState<string>(initialSn);
  const [description, setDescription] = React.useState<string>('');
  const [customerId, setCustomerId] = React.useState<string>('');
  const [customerSearch, setCustomerSearch] = React.useState<string>('');
  const [customerOptions, setCustomerOptions] = React.useState<any[]>([]);

  // Profile and Network config
  const [lineProfileId, setLineProfileId] = React.useState<number>(2);
  const [serviceProfileId, setServiceProfileId] = React.useState<number>(2);
  const [vlanId, setVlanId] = React.useState<number>(738);
  const [userVlanId, setUserVlanId] = React.useState<number>(738);
  const [gemPort, setGemPort] = React.useState<number>(10);
  const [tagTransform, setTagTransform] = React.useState<string>('translate');

  // Execution states
  const [executing, setExecuting] = React.useState(false);
  const [executionResult, setExecutionResult] = React.useState<any | null>(null);
  const [executionError, setExecutionError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<{ text: string; error?: boolean } | null>(null);

  const getAuthHeaders = (): Record<string, string> => {
    if (typeof window === 'undefined') return {};
    const token = localStorage.getItem('radius_token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const showMsg = (text: string, error = false) => {
    setNotice({ text, error });
    setTimeout(() => setNotice(null), 5000);
  };

  // Fetch OLTs
  React.useEffect(() => {
    const fetchOlts = async () => {
      try {
        const res = await fetch('/api/olts', { headers: getAuthHeaders() });
        if (res.ok) {
          const json = await res.json();
          setOlts(json.data || []);
          if (!selectedOltId && json.data?.length > 0) {
            setSelectedOltId(json.data[0].id);
          }
        }
      } catch {}
    };
    fetchOlts();
  }, []);

  // Search customers for association
  React.useEffect(() => {
    const searchSubs = async () => {
      if (!customerSearch.trim() || customerSearch.length < 2) {
        setCustomerOptions([]);
        return;
      }
      try {
        const res = await fetch(`/api/subscribers?search=${encodeURIComponent(customerSearch.trim())}&limit=5`, {
          headers: getAuthHeaders(),
        });
        if (res.ok) {
          const json = await res.json();
          setCustomerOptions(json.data || []);
        }
      } catch {}
    };
    const t = setTimeout(searchSubs, 300);
    return () => clearTimeout(t);
  }, [customerSearch]);

  const selectedOlt = olts.find((o) => o.id === Number(selectedOltId));

  // Build Proposed CLI Commands
  const proposedCommands = [
    'config',
    `interface gpon 0/${slot}`,
    `ont add ${port} sn-auth ${serialNumber.trim() || '<SERIAL-NUMBER>'} omci ont-lineprofile-id ${lineProfileId} ont-srvprofile-id ${serviceProfileId}${description ? ` desc "${description.replace(/[^A-Za-z0-9_-]/g, '')}"` : ''}`,
    'quit',
    `service-port vlan ${vlanId} gpon 0/${slot}/${port} ont <assigned-ont-id> gemport ${gemPort} multi-service user-vlan ${userVlanId} tag-transform ${tagTransform}`,
  ];

  const handleExecute = async () => {
    if (!selectedOltId || !serialNumber.trim()) {
      showMsg('OLT and Serial Number are required', true);
      return;
    }

    try {
      setExecuting(true);
      setExecutionError(null);
      setExecutionResult(null);

      const payload = {
        slot,
        port,
        serialNumber: serialNumber.trim(),
        lineProfileId,
        serviceProfileId,
        description: description.trim() || undefined,
        vlanId,
        userVlanId,
        gemPort,
        tagTransform,
        customerId: customerId ? Number(customerId) : undefined,
      };

      const res = await fetch(`/api/olts/${selectedOltId}/provision`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (res.ok) {
        setExecutionResult(json.data);
        showMsg(`Successfully provisioned ONT ID ${json.data.assignedOntId}!`);
        onSuccess?.(json.data.onuId);
      } else {
        const err = json.error?.message || 'Provisioning failed';
        setExecutionError(err);
        showMsg(err, true);
      }
    } catch (err: any) {
      setExecutionError(err.message || 'Execution exception');
      showMsg('Failed executing provisioning commands', true);
    } finally {
      setExecuting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Toast */}
      {notice && (
        <div
          className={`px-4 py-3 rounded-xl border text-xs font-semibold flex items-center justify-between shadow-lg transition-all animate-in fade-in slide-in-from-top-2 ${
            notice.error
              ? 'bg-rose-50 border-rose-200 text-rose-700 dark:bg-rose-950/40 dark:border-rose-800 dark:text-rose-300'
              : 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-300'
          }`}
        >
          <span>{notice.text}</span>
          <button onClick={() => setNotice(null)} className="ml-3 font-bold hover:opacity-75">
            ✕
          </button>
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-card rounded-2xl border border-border p-6 shadow-sm">
        <div className="flex items-center gap-2">
          <Zap className="w-5 h-5 text-amber-500" />
          <h2 className="text-xl font-bold text-foreground">ONU Provisioning Wizard</h2>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">
          Step-by-step optical terminal registration with automated actual ONT ID binding and service-port translation
        </p>

        {/* Wizard Steps indicator */}
        <div className="grid grid-cols-5 gap-2 mt-6 pt-4 border-t border-border">
          {[
            { num: 1, label: 'OLT & Port' },
            { num: 2, label: 'ONU & Subscriber' },
            { num: 3, label: 'Profiles & VLAN' },
            { num: 4, label: 'Command Review' },
            { num: 5, label: 'Execution' },
          ].map((s) => {
            const isPassed = step > s.num;
            const isCurrent = step === s.num;
            return (
              <div
                key={s.num}
                onClick={() => !executing && setStep(s.num as any)}
                className={`cursor-pointer p-2 rounded-xl text-center transition-all ${
                  isCurrent
                    ? 'bg-primary text-primary-foreground font-bold shadow-md shadow-primary/20'
                    : isPassed
                    ? 'bg-primary/10 text-primary font-semibold'
                    : 'bg-muted/40 text-muted-foreground'
                }`}
              >
                <div className="text-[11px] font-mono">Step {s.num}</div>
                <div className="text-xs truncate">{s.label}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* STEP 1: OLT & PORT */}
      {step === 1 && (
        <div className="bg-card rounded-2xl border border-border p-6 space-y-5 shadow-sm">
          <h3 className="font-bold text-foreground text-sm flex items-center gap-2">
            <Server className="w-4 h-4 text-primary" />
            Step 1: Select Target OLT Chassis & PON Port
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-[11px] font-semibold text-foreground mb-1 block">Target OLT Chassis *</label>
              <select
                value={selectedOltId}
                onChange={(e) => setSelectedOltId(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl bg-card border border-border text-xs font-semibold text-foreground outline-none"
              >
                {olts.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name} ({o.management_ip}) — {o.vendor} {o.model}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[11px] font-semibold text-foreground mb-1 block">GPON Service Slot *</label>
              <select
                value={slot}
                onChange={(e) => setSlot(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl bg-card border border-border text-xs font-semibold text-foreground outline-none font-mono"
              >
                {[0, 2, 3, 5].map((s) => (
                  <option key={s} value={s}>
                    Slot {s} (H805GPFD 16-Port)
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="text-[11px] font-semibold text-foreground mb-1.5 block">PON Port (0 to 15) *</label>
            <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
              {Array.from({ length: 16 }, (_, p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPort(p)}
                  className={`py-2 rounded-xl text-xs font-mono font-bold transition-all border ${
                    port === p
                      ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                      : 'bg-muted/40 border-border text-foreground hover:bg-muted'
                  }`}
                >
                  Port {p}
                </button>
              ))}
            </div>
          </div>

          <div className="pt-4 border-t border-border flex justify-end">
            <button
              onClick={() => setStep(2)}
              className="px-5 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs flex items-center gap-1.5 shadow-md shadow-primary/20"
            >
              Next: ONU Details
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 2: ONU DETAILS & CUSTOMER */}
      {step === 2 && (
        <div className="bg-card rounded-2xl border border-border p-6 space-y-5 shadow-sm">
          <h3 className="font-bold text-foreground text-sm flex items-center gap-2">
            <Radio className="w-4 h-4 text-primary" />
            Step 2: ONU Serial Number & Subscriber Affiliation
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-[11px] font-semibold text-foreground mb-1 block">
                Physical ONU Serial Number (SN) *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. 485754435F9E5B9E or HWTC5F9E5B9E"
                value={serialNumber}
                onChange={(e) => setSerialNumber(e.target.value.toUpperCase())}
                className="w-full px-3 py-2 rounded-xl bg-card border border-border text-xs font-mono font-bold text-foreground outline-none focus:ring-2 focus:ring-primary"
              />
              <span className="text-[10px] text-muted-foreground mt-0.5 block">
                Primary physical equipment ID used in SN authentication
              </span>
            </div>

            <div>
              <label className="text-[11px] font-semibold text-foreground mb-1 block">
                ONU Description (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. customer-phone or username"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-card border border-border text-xs text-foreground outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>

          <div className="pt-2 border-t border-border space-y-2">
            <label className="text-[11px] font-semibold text-foreground block">
              Associate with Existing Subscriber (Optional)
            </label>
            <input
              type="text"
              placeholder="Type customer username or name to search..."
              value={customerSearch}
              onChange={(e) => setCustomerSearch(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-card border border-border text-xs text-foreground outline-none focus:ring-2 focus:ring-primary"
            />

            {customerOptions.length > 0 && (
              <div className="border border-border rounded-xl divide-y divide-border bg-muted/20 overflow-hidden">
                {customerOptions.map((c) => (
                  <div
                    key={c.id}
                    onClick={() => {
                      setCustomerId(String(c.id));
                      setCustomerSearch(`${c.username} (${c.full_name})`);
                      if (!description) setDescription(c.username);
                      setCustomerOptions([]);
                    }}
                    className="p-2.5 hover:bg-muted cursor-pointer text-xs flex items-center justify-between"
                  >
                    <div>
                      <span className="font-bold text-foreground block">{c.username}</span>
                      <span className="text-[11px] text-muted-foreground">{c.full_name} • Phone: {c.phone || 'N/A'}</span>
                    </div>
                    <span className="text-[11px] text-primary font-semibold">Select</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-border flex items-center justify-between">
            <button
              onClick={() => setStep(1)}
              className="px-4 py-2 rounded-xl bg-muted hover:bg-muted/80 text-foreground font-semibold text-xs flex items-center gap-1"
            >
              <ChevronLeft className="w-4 h-4" />
              Back
            </button>
            <button
              onClick={() => setStep(3)}
              disabled={!serialNumber.trim()}
              className="px-5 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs flex items-center gap-1.5 shadow-md shadow-primary/20 disabled:opacity-50"
            >
              Next: Profiles & VLANs
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: PROFILES & VLANS */}
      {step === 3 && (
        <div className="bg-card rounded-2xl border border-border p-6 space-y-5 shadow-sm">
          <h3 className="font-bold text-foreground text-sm flex items-center gap-2">
            <Sliders className="w-4 h-4 text-primary" />
            Step 3: OMCI Profiles & VLAN Service Port Configuration
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-[11px] font-semibold text-foreground mb-1 block">Line Profile ID *</label>
              <input
                type="number"
                value={lineProfileId}
                onChange={(e) => setLineProfileId(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl bg-card border border-border text-xs font-mono font-semibold text-foreground outline-none"
              />
              <span className="text-[10px] text-muted-foreground">Default: 2 (standard GEM port 10 line profile)</span>
            </div>

            <div>
              <label className="text-[11px] font-semibold text-foreground mb-1 block">Service Profile ID *</label>
              <input
                type="number"
                value={serviceProfileId}
                onChange={(e) => setServiceProfileId(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl bg-card border border-border text-xs font-mono font-semibold text-foreground outline-none"
              />
              <span className="text-[10px] text-muted-foreground">Default: 2 (standard multi-service ONT profile)</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-border">
            <div>
              <label className="text-[11px] font-semibold text-foreground mb-1 block">Service VLAN *</label>
              <input
                type="number"
                value={vlanId}
                onChange={(e) => setVlanId(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl bg-card border border-border text-xs font-mono font-semibold text-foreground outline-none"
              />
            </div>

            <div>
              <label className="text-[11px] font-semibold text-foreground mb-1 block">User VLAN *</label>
              <input
                type="number"
                value={userVlanId}
                onChange={(e) => setUserVlanId(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl bg-card border border-border text-xs font-mono font-semibold text-foreground outline-none"
              />
            </div>

            <div>
              <label className="text-[11px] font-semibold text-foreground mb-1 block">GEM Port</label>
              <input
                type="number"
                value={gemPort}
                onChange={(e) => setGemPort(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl bg-card border border-border text-xs font-mono font-semibold text-foreground outline-none"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-border flex items-center justify-between">
            <button
              onClick={() => setStep(2)}
              className="px-4 py-2 rounded-xl bg-muted hover:bg-muted/80 text-foreground font-semibold text-xs flex items-center gap-1"
            >
              <ChevronLeft className="w-4 h-4" />
              Back
            </button>
            <button
              onClick={() => setStep(4)}
              className="px-5 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs flex items-center gap-1.5 shadow-md shadow-primary/20"
            >
              Next: Review Commands
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 4: COMMAND REVIEW */}
      {step === 4 && (
        <div className="bg-card rounded-2xl border border-border p-6 space-y-5 shadow-sm">
          <h3 className="font-bold text-foreground text-sm flex items-center gap-2">
            <Terminal className="w-4 h-4 text-primary" />
            Step 4: Proposed Huawei MA5683T CLI Commands Review
          </h3>
          <p className="text-xs text-muted-foreground">
            Review the exact typed commands that will be dispatched to the OLT. The actual ONT ID returned will be dynamically bound in the service-port command.
          </p>

          <div className="p-4 rounded-xl bg-neutral-900 text-neutral-100 font-mono text-xs space-y-1 overflow-x-auto border border-neutral-800">
            {proposedCommands.map((cmd, idx) => (
              <div key={idx} className="flex gap-2">
                <span className="text-neutral-500 select-none">&gt;</span>
                <span className="text-emerald-400">{cmd}</span>
              </div>
            ))}
          </div>

          <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-700 dark:text-amber-300">
            <strong>Pre-flight Safety Notice:</strong> The OLT session will execute in an isolated CLI channel. If registration completes but service-port generation fails, the system safely retains the allocated ONT ID and allows you to retry without duplicate registration.
          </div>

          <div className="pt-4 border-t border-border flex items-center justify-between">
            <button
              onClick={() => setStep(3)}
              className="px-4 py-2 rounded-xl bg-muted hover:bg-muted/80 text-foreground font-semibold text-xs flex items-center gap-1"
            >
              <ChevronLeft className="w-4 h-4" />
              Back
            </button>
            <button
              onClick={() => {
                setStep(5);
                handleExecute();
              }}
              className="px-6 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs flex items-center gap-2 shadow-lg shadow-primary/20"
            >
              <Zap className="w-4 h-4" />
              Confirm & Execute Provisioning
            </button>
          </div>
        </div>
      )}

      {/* STEP 5: EXECUTION & STATUS */}
      {step === 5 && (
        <div className="bg-card rounded-2xl border border-border p-6 space-y-6 shadow-sm">
          <h3 className="font-bold text-foreground text-sm flex items-center gap-2">
            <Zap className="w-4 h-4 text-primary" />
            Step 5: Execution Status & Telemetry
          </h3>

          {executing ? (
            <div className="py-12 text-center space-y-3">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto text-primary" />
              <p className="font-bold text-foreground text-sm">Communicating with Huawei MA5683T OLT...</p>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                Adding ONT with SN {serialNumber}, parsing assigned ONT ID, and creating service port translation.
              </p>
            </div>
          ) : executionResult ? (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 flex items-center gap-3">
                <CheckCircle2 className="w-6 h-6 flex-shrink-0" />
                <div>
                  <h4 className="font-bold text-sm">Provisioning Completed Successfully!</h4>
                  <p className="text-xs mt-0.5">
                    Allocated ONT ID: <strong>{executionResult.assignedOntId}</strong> • Service Port: <strong>{executionResult.servicePortIndex || 'OK'}</strong>
                  </p>
                </div>
              </div>

              {executionResult.logs && (
                <div className="space-y-1">
                  <span className="text-[11px] font-semibold text-muted-foreground block">Sanitized OLT Response Logs:</span>
                  <pre className="p-3.5 rounded-xl bg-muted/40 border border-border text-[11px] font-mono text-foreground overflow-x-auto max-h-48">
                    {executionResult.logs}
                  </pre>
                </div>
              )}

              <div className="pt-4 border-t border-border flex justify-end gap-2">
                <button
                  onClick={() => {
                    setStep(1);
                    setSerialNumber('');
                    setExecutionResult(null);
                  }}
                  className="px-4 py-2 rounded-xl bg-muted hover:bg-muted/80 text-foreground font-semibold text-xs"
                >
                  Provision Another ONU
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-400 flex items-center gap-3">
                <XCircle className="w-6 h-6 flex-shrink-0" />
                <div>
                  <h4 className="font-bold text-sm">Provisioning Operation Failed</h4>
                  <p className="text-xs mt-0.5">{executionError || 'Hardware returned command failure'}</p>
                </div>
              </div>

              <div className="pt-4 border-t border-border flex justify-end gap-2">
                <button
                  onClick={() => setStep(4)}
                  className="px-4 py-2 rounded-xl bg-muted hover:bg-muted/80 text-foreground font-semibold text-xs"
                >
                  Review Settings
                </button>
                <button
                  onClick={handleExecute}
                  className="px-5 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs flex items-center gap-1.5 shadow-sm"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Retry Execution
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
