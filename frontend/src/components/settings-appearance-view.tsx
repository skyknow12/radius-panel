'use client';

import React, { useState, useRef } from 'react';
import {
  Palette,
  Sparkles,
  RotateCcw,
  Upload,
  Image as ImageIcon,
  Check,
  CheckCircle2,
  AlertCircle,
  Sun,
  Moon,
  Monitor,
  Zap,
  Building2,
  Sliders,
  Eye,
  Info,
  Trash2,
} from 'lucide-react';
import { useAppTheme, THEME_OPTIONS, type AppThemeKey, type AppearanceMode } from '@/context/app-theme-context';

interface SettingsAppearanceViewProps {
  initialTab?: 'theme' | 'branding';
  currentUser?: any;
}

export function SettingsAppearanceView({ initialTab = 'theme', currentUser }: SettingsAppearanceViewProps) {
  const {
    theme,
    appearanceMode,
    logoUrl,
    brandName,
    brandSubtitle,
    orgDefaultTheme,
    setTheme,
    setAppearanceMode,
    setLogoUrl,
    setBrandInfo,
    setOrgDefaultTheme,
    resetToDefault,
    resetLogo,
    saveBrandingToBackend,
  } = useAppTheme();

  const [activeTab, setActiveTab] = useState<'theme' | 'branding'>(initialTab);

  // Branding Form State
  const [tempBrandName, setTempBrandName] = useState(brandName);
  const [tempBrandSubtitle, setTempBrandSubtitle] = useState(brandSubtitle);
  const [tempLogoUrl, setTempLogoUrl] = useState<string | null>(logoUrl);
  const [logoPadding, setLogoPadding] = useState<'none' | 'small' | 'medium'>('small');
  const [logoFit, setLogoFit] = useState<'contain' | 'cover'>('contain');
  const [savingBranding, setSavingBranding] = useState(false);
  const [brandingSuccess, setBrandingSuccess] = useState<string | null>(null);
  const [brandingError, setBrandingError] = useState<string | null>(null);

  // Organization Default Theme State
  const [selectedOrgDefault, setSelectedOrgDefault] = useState<AppThemeKey>(orgDefaultTheme);
  const [savingOrgDefault, setSavingOrgDefault] = useState(false);
  const [orgDefaultSuccess, setOrgDefaultSuccess] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const isAdmin = currentUser
    ? ['super_admin', 'admin', 'organization_admin'].includes(currentUser.role)
    : true;

  // Handle Logo Upload from local machine
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setBrandingError('Please upload an image file (PNG, SVG, JPG, WebP).');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setBrandingError('Image file size exceeds 2 MB. Please upload a smaller logo.');
      return;
    }

    setBrandingError(null);
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      setTempLogoUrl(dataUrl);
      // Auto-preview live
      setLogoUrl(dataUrl);
    };
    reader.readAsDataURL(file);
  };

  // Save branding changes to backend
  const handleSaveBranding = async () => {
    try {
      setSavingBranding(true);
      setBrandingError(null);
      setBrandingSuccess(null);

      await saveBrandingToBackend({
        logo_url: tempLogoUrl,
        brand_name: tempBrandName.trim() || 'SKY RADIUS',
        brand_subtitle: tempBrandSubtitle.trim() || 'ISP Operations',
      });

      setBrandInfo(tempBrandName.trim() || 'SKY RADIUS', tempBrandSubtitle.trim() || 'ISP Operations');
      setBrandingSuccess('Brand logo and appearance settings saved successfully!');
      setTimeout(() => setBrandingSuccess(null), 4000);
    } catch (err: any) {
      setBrandingError(err.message || 'Failed to save branding.');
    } finally {
      setSavingBranding(false);
    }
  };

  // Reset logo
  const handleResetLogo = async () => {
    setTempLogoUrl(null);
    await resetLogo();
    setBrandingSuccess('Logo reset to default.');
    setTimeout(() => setBrandingSuccess(null), 3000);
  };

  // Save organization default theme
  const handleSaveOrgDefault = async () => {
    try {
      setSavingOrgDefault(true);
      await setOrgDefaultTheme(selectedOrgDefault);
      setOrgDefaultSuccess(true);
      setTimeout(() => setOrgDefaultSuccess(false), 3000);
    } catch (err: any) {
      alert(err.message || 'Failed to update organization default theme');
    } finally {
      setSavingOrgDefault(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16 animate-in fade-in duration-200">
      {/* 1. Header with Title & Reset Button */}
      <div className="bg-card border border-border rounded-2xl p-6 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-inner">
              <Palette className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tight text-foreground flex items-center gap-2">
                Appearance & Theme Studio
                <span className="px-2 py-0.5 rounded-full bg-primary/15 text-primary text-[10px] font-bold border border-primary/20">
                  LIVE
                </span>
              </h1>
              <p className="text-xs text-muted-foreground">
                Customize global visual theme, color palette, logo auto-fit, and NOC display preferences.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={resetToDefault}
            className="px-3.5 py-2 rounded-xl bg-card border border-border hover:bg-muted text-xs font-semibold text-foreground transition-all flex items-center gap-1.5 shadow-sm"
            title="Reset theme to Default"
          >
            <RotateCcw className="w-3.5 h-3.5 text-muted-foreground" />
            <span>Reset to Default</span>
          </button>
        </div>
      </div>

      {/* 2. Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-border pb-2">
        <button
          onClick={() => setActiveTab('theme')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'theme'
              ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
          }`}
        >
          <Palette className="w-4 h-4" />
          <span>Themes & Color Schemes (5)</span>
        </button>

        <button
          onClick={() => setActiveTab('branding')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'branding'
              ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
          }`}
        >
          <Sparkles className="w-4 h-4" />
          <span>Brand & Custom Logo Auto-Fit</span>
          {logoUrl && <span className="w-2 h-2 rounded-full bg-emerald-400" />}
        </button>
      </div>

      {/* ===================================================================== */}
      {/* TAB 1: THEMES & COLOR SCHEMES */}
      {/* ===================================================================== */}
      {activeTab === 'theme' && (
        <div className="space-y-6">
          {/* Appearance Mode Bar */}
          <div className="bg-card border border-border rounded-2xl p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                <Sliders className="w-4 h-4 text-primary" />
                Appearance Mode
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Controls the base illumination mode across the theme system.
              </p>
            </div>

            <div className="flex items-center gap-1.5 p-1 bg-muted/60 rounded-xl border border-border/80">
              <button
                type="button"
                onClick={() => setAppearanceMode('dark')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  appearanceMode === 'dark'
                    ? 'bg-card text-foreground shadow-sm font-bold border border-border'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Moon className="w-3.5 h-3.5 text-indigo-400" />
                <span>Dark</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setAppearanceMode('light');
                  setTheme('light-pro');
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  appearanceMode === 'light'
                    ? 'bg-card text-foreground shadow-sm font-bold border border-border'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Sun className="w-3.5 h-3.5 text-amber-400" />
                <span>Light</span>
              </button>

              <button
                type="button"
                onClick={() => setAppearanceMode('system')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  appearanceMode === 'system'
                    ? 'bg-card text-foreground shadow-sm font-bold border border-border'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Monitor className="w-3.5 h-3.5 text-cyan-400" />
                <span>System Sync</span>
              </button>
            </div>
          </div>

          {/* Theme Preview Cards Grid (Section 6 & 7) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <span>Select Theme</span>
                <span className="text-xs font-normal text-muted-foreground/80 lowercase">
                  (changes apply instantly without page refresh)
                </span>
              </h2>
              <span className="text-xs font-bold text-primary font-mono">
                Current: {THEME_OPTIONS.find((t) => t.id === theme)?.name}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {THEME_OPTIONS.map((t) => {
                const isSelected = theme === t.id;

                return (
                  <div
                    key={t.id}
                    onClick={() => setTheme(t.id)}
                    className={`group relative rounded-2xl border transition-all cursor-pointer overflow-hidden flex flex-col justify-between ${
                      isSelected
                        ? 'border-primary ring-2 ring-primary/40 shadow-xl shadow-primary/10 bg-card'
                        : 'border-border/80 bg-card/70 hover:border-border hover:shadow-lg hover:bg-card'
                    }`}
                  >
                    {/* Top Preview Canvas Demo */}
                    <div
                      className="p-4 border-b border-border/80 relative transition-colors"
                      style={{ backgroundColor: t.bgColor }}
                    >
                      {/* Mini Mockup Window */}
                      <div
                        className="rounded-xl border shadow-inner overflow-hidden text-[9px] select-none"
                        style={{
                          backgroundColor: t.cardColor,
                          borderColor: t.borderColor,
                          color: t.textColor,
                        }}
                      >
                        {/* Mini Topbar */}
                        <div
                          className="px-2.5 py-1.5 border-b flex items-center justify-between"
                          style={{ borderColor: t.borderColor }}
                        >
                          <div className="flex items-center gap-1.5">
                            <div
                              className="w-3 h-3 rounded-md flex items-center justify-center font-bold text-[7px]"
                              style={{ backgroundColor: t.primaryColor, color: '#ffffff' }}
                            >
                              ⚡
                            </div>
                            <span className="font-bold tracking-tight">SKY RADIUS</span>
                          </div>
                          <span
                            className="px-1 py-0.2 rounded text-[7px] font-bold"
                            style={{
                              backgroundColor: `${t.primaryColor}22`,
                              color: t.primaryColor,
                            }}
                          >
                            LIVE
                          </span>
                        </div>

                        {/* Mini Dashboard Content */}
                        <div className="p-2.5 space-y-2">
                          {/* 2 Mini Stat Cards */}
                          <div className="grid grid-cols-2 gap-1.5">
                            <div
                              className="p-1.5 rounded-lg border"
                              style={{
                                backgroundColor: `${t.bgColor}88`,
                                borderColor: t.borderColor,
                              }}
                            >
                              <div className="text-[7px] opacity-70">Customers</div>
                              <div className="font-extrabold text-[11px]">1,280</div>
                            </div>
                            <div
                              className="p-1.5 rounded-lg border"
                              style={{
                                backgroundColor: `${t.bgColor}88`,
                                borderColor: t.borderColor,
                              }}
                            >
                              <div className="text-[7px] opacity-70">Online</div>
                              <div className="font-extrabold text-[11px] text-emerald-400">984</div>
                            </div>
                          </div>

                          {/* Mini Table Row */}
                          <div
                            className="p-1.5 rounded-lg border flex items-center justify-between"
                            style={{
                              backgroundColor: `${t.bgColor}55`,
                              borderColor: t.borderColor,
                            }}
                          >
                            <span className="truncate">pppoe_user01</span>
                            <span className="px-1 py-0.2 rounded text-[7px] font-bold bg-emerald-500/20 text-emerald-400">
                              ACTIVE
                            </span>
                          </div>

                          {/* Mini Action Button */}
                          <div className="flex justify-end pt-0.5">
                            <div
                              className="px-2 py-0.5 rounded text-[8px] font-bold shadow-sm"
                              style={{
                                backgroundColor: t.primaryColor,
                                color: '#ffffff',
                              }}
                            >
                              Action
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Selected Floating Badge */}
                      {isSelected && (
                        <div className="absolute top-3 right-3 px-2 py-0.5 rounded-full bg-primary text-primary-foreground font-black text-[10px] shadow-md flex items-center gap-1 animate-in zoom-in-75">
                          <Check className="w-3 h-3 stroke-[3]" />
                          <span>Active</span>
                        </div>
                      )}
                    </div>

                    {/* Bottom Details & Color Palette Dots */}
                    <div className="p-4 space-y-3">
                      <div>
                        <div className="flex items-center justify-between">
                          <h4 className="font-bold text-sm text-foreground">{t.name}</h4>
                          <span className="text-[10px] font-mono font-semibold text-muted-foreground uppercase">
                            {t.category}
                          </span>
                        </div>
                        <p className="text-xs text-primary font-medium">{t.tagline}</p>
                        <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
                          {t.description}
                        </p>
                      </div>

                      {/* Palette Swatches */}
                      <div className="pt-2 border-t border-border/80 flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span
                            className="w-3.5 h-3.5 rounded-full border border-white/20 shadow-sm"
                            style={{ backgroundColor: t.primaryColor }}
                            title="Primary Accent"
                          />
                          <span
                            className="w-3.5 h-3.5 rounded-full border border-white/20 shadow-sm"
                            style={{ backgroundColor: t.cardColor }}
                            title="Card Surface"
                          />
                          <span
                            className="w-3.5 h-3.5 rounded-full border border-white/20 shadow-sm"
                            style={{ backgroundColor: t.bgColor }}
                            title="Background"
                          />
                          <span
                            className="w-3.5 h-3.5 rounded-full border border-white/20 shadow-sm"
                            style={{ backgroundColor: t.borderColor }}
                            title="Border"
                          />
                        </div>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setTheme(t.id);
                          }}
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                            isSelected
                              ? 'bg-primary/10 text-primary border border-primary/20 pointer-events-none'
                              : 'bg-muted hover:bg-primary hover:text-primary-foreground text-foreground'
                          }`}
                        >
                          {isSelected ? 'Selected' : 'Apply Theme'}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Organization Default Theme Section (Section 22 & 23) */}
          {isAdmin && (
            <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-3">
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-bold text-foreground">Organization Default Theme</h3>
              </div>
              <p className="text-xs text-muted-foreground">
                Sets the baseline theme for all newly created staff accounts and unconfigured user sessions.
                Individual user preferences will take precedence over this setting.
              </p>

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <select
                  value={selectedOrgDefault}
                  onChange={(e) => setSelectedOrgDefault(e.target.value as AppThemeKey)}
                  className="px-3 py-2 bg-muted/60 border border-border rounded-xl text-xs text-foreground font-semibold focus:ring-2 focus:ring-primary"
                >
                  {THEME_OPTIONS.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} — {t.tagline}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={handleSaveOrgDefault}
                  disabled={savingOrgDefault}
                  className="px-4 py-2 bg-primary text-primary-foreground text-xs font-bold rounded-xl shadow-md shadow-primary/20 hover:opacity-90 transition-all flex items-center gap-1.5 disabled:opacity-50"
                >
                  {savingOrgDefault ? (
                    <span>Saving...</span>
                  ) : orgDefaultSuccess ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Saved!</span>
                    </>
                  ) : (
                    <span>Save Organization Default</span>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 2: BRAND & CUSTOM LOGO AUTO-FIT */}
      {/* ===================================================================== */}
      {activeTab === 'branding' && (
        <div className="space-y-6">
          {/* Notifications */}
          {brandingSuccess && (
            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold flex items-center gap-2 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4" />
              <span>{brandingSuccess}</span>
            </div>
          )}
          {brandingError && (
            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-semibold flex items-center gap-2 animate-in fade-in">
              <AlertCircle className="w-4 h-4" />
              <span>{brandingError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left: Interactive Controls */}
            <div className="lg:col-span-7 space-y-5">
              {/* Logo Upload Card */}
              <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                      <ImageIcon className="w-4 h-4 text-primary" />
                      Sidebar Brand Logo Upload
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Upload your ISP or carrier logo. It automatically resizes and scales to fit the sidebar header.
                    </p>
                  </div>
                  {tempLogoUrl && (
                    <button
                      type="button"
                      onClick={handleResetLogo}
                      className="text-xs text-rose-400 hover:text-rose-300 font-semibold flex items-center gap-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Remove</span>
                    </button>
                  )}
                </div>

                {/* File Dropzone */}
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-border hover:border-primary/60 rounded-2xl p-6 text-center cursor-pointer transition-all bg-muted/20 hover:bg-muted/40 group"
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/svg+xml,image/webp"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center mx-auto mb-2 group-hover:scale-105 transition-transform">
                    <Upload className="w-6 h-6" />
                  </div>
                  <p className="text-xs font-bold text-foreground">Click to upload logo or drag and drop</p>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Supports PNG, SVG, JPG, WebP (Max 2 MB). Recommended square or emblem icon.
                  </p>
                </div>

                {/* Direct Image URL fallback */}
                <div className="space-y-1.5 pt-2 border-t border-border/80">
                  <label className="text-xs font-semibold text-foreground">Or Enter Direct Image URL</label>
                  <div className="flex gap-2">
                    <input
                      type="url"
                      placeholder="https://example.com/logo.png"
                      value={tempLogoUrl || ''}
                      onChange={(e) => {
                        const val = e.target.value.trim() || null;
                        setTempLogoUrl(val);
                        setLogoUrl(val);
                      }}
                      className="flex-1 px-3 py-2 bg-muted/40 border border-border rounded-xl text-xs text-foreground focus:ring-2 focus:ring-primary"
                    />
                  </div>
                </div>
              </div>

              {/* Text Customization Card */}
              <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4">
                <h3 className="text-sm font-bold text-foreground">Sidebar Brand Titles</h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground">Brand Title</label>
                    <input
                      type="text"
                      maxLength={64}
                      value={tempBrandName}
                      onChange={(e) => {
                        setTempBrandName(e.target.value);
                        setBrandInfo(e.target.value, tempBrandSubtitle);
                      }}
                      placeholder="SKY RADIUS"
                      className="w-full px-3 py-2 bg-muted/40 border border-border rounded-xl text-xs text-foreground font-semibold focus:ring-2 focus:ring-primary"
                    />
                    <p className="text-[10px] text-muted-foreground">Appears alongside the PRO badge</p>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground">Brand Subtitle</label>
                    <input
                      type="text"
                      maxLength={64}
                      value={tempBrandSubtitle}
                      onChange={(e) => {
                        setTempBrandSubtitle(e.target.value);
                        setBrandInfo(tempBrandName, e.target.value);
                      }}
                      placeholder="ISP Operations"
                      className="w-full px-3 py-2 bg-muted/40 border border-border rounded-xl text-xs text-foreground focus:ring-2 focus:ring-primary"
                    />
                    <p className="text-[10px] text-muted-foreground">Appears below the brand title</p>
                  </div>
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={handleSaveBranding}
                    disabled={savingBranding}
                    className="px-5 py-2.5 bg-primary text-primary-foreground text-xs font-bold rounded-xl shadow-md shadow-primary/20 hover:opacity-90 transition-all flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {savingBranding ? (
                      <span>Saving branding...</span>
                    ) : (
                      <>
                        <Check className="w-4 h-4 stroke-[2.5]" />
                        <span>Save & Apply Branding</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Right: Real-time Live Sidebar Header Preview */}
            <div className="lg:col-span-5 space-y-4">
              <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Eye className="w-4 h-4 text-primary" />
                    <h3 className="text-sm font-bold text-foreground">Live Sidebar Header Preview</h3>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-muted text-muted-foreground font-semibold">
                    1 : 1 SCALE
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Exact visual representation of the sidebar header from the application layout:
                </p>

                {/* EXACT SIDEBAR HEADER MOCKUP FROM USER SCREENSHOT */}
                <div className="border border-border/80 rounded-2xl p-4 bg-card/60 backdrop-blur-xl shadow-inner flex items-center gap-3">
                  {/* The w-10 h-10 Logo Container */}
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-600 via-indigo-600 to-primary flex items-center justify-center text-white font-bold shadow-lg shadow-purple-500/20 flex-shrink-0 overflow-hidden relative border border-white/10">
                    {tempLogoUrl ? (
                      <img
                        src={tempLogoUrl}
                        alt="Logo Preview"
                        className={`w-full h-full object-${logoFit} ${
                          logoPadding === 'none' ? 'p-0' : logoPadding === 'small' ? 'p-1' : 'p-2'
                        } rounded-lg`}
                      />
                    ) : (
                      <Zap className="w-5 h-5 fill-white/20 stroke-[2.5]" />
                    )}
                  </div>

                  {/* Brand Typography */}
                  <div className="flex flex-col overflow-hidden">
                    <span className="font-bold tracking-tight text-foreground text-sm uppercase flex items-center gap-1.5 truncate">
                      {tempBrandName || 'SKY RADIUS'}
                      <span className="text-[10px] bg-primary/10 text-primary font-semibold px-1.5 py-0.5 rounded border border-primary/20 flex-shrink-0">
                        PRO
                      </span>
                    </span>
                    <span className="text-[10px] font-medium text-muted-foreground tracking-wider uppercase truncate">
                      {tempBrandSubtitle || 'ISP Operations'}
                    </span>
                  </div>
                </div>

                {/* Collapsed State Preview */}
                <div className="space-y-1.5 pt-3 border-t border-border/80">
                  <span className="text-xs font-semibold text-muted-foreground">Collapsed Sidebar Preview:</span>
                  <div className="w-20 border border-border/80 rounded-2xl p-3 bg-card/60 flex items-center justify-center">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-600 via-indigo-600 to-primary flex items-center justify-center text-white font-bold shadow-lg shadow-purple-500/20 overflow-hidden relative border border-white/10">
                      {tempLogoUrl ? (
                        <img
                          src={tempLogoUrl}
                          alt="Logo Preview"
                          className="w-full h-full object-contain p-1 rounded-lg"
                        />
                      ) : (
                        <Zap className="w-5 h-5 fill-white/20 stroke-[2.5]" />
                      )}
                    </div>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-muted/40 border border-border/80 text-[11px] text-muted-foreground flex gap-2">
                  <Info className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                  <span>
                    When an image logo is uploaded, it is auto-scaled with high DPI rendering to fit cleanly in both expanded and collapsed sidebar navigation bars.
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
