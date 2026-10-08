'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';

export type AppThemeKey = 'default' | 'dark-pro' | 'light-pro' | 'colorful' | 'noc';
export type AppearanceMode = 'dark' | 'light' | 'system';

export interface ThemeOption {
  id: AppThemeKey;
  name: string;
  tagline: string;
  category: 'dark' | 'light' | 'vibrant' | 'high-contrast';
  description: string;
  primaryColor: string;
  bgColor: string;
  cardColor: string;
  borderColor: string;
  textColor: string;
  badgeColor: string;
}

export const THEME_OPTIONS: ThemeOption[] = [
  {
    id: 'default',
    name: 'Default',
    tagline: 'Purple / Indigo Modern ISP',
    category: 'dark',
    description: 'The standard Fiberworld-style professional purple/indigo theme with dark sidebar and clean card contrast.',
    primaryColor: '#8b5cf6',
    bgColor: '#0a0e1a',
    cardColor: '#101626',
    borderColor: '#1e2638',
    textColor: '#f8fafc',
    badgeColor: '#a78bfa',
  },
  {
    id: 'dark-pro',
    name: 'Dark Pro',
    tagline: 'Deep Charcoal NOC Center',
    category: 'dark',
    description: 'Deep dark charcoal/near-black canvas engineered for technical NOC teams with maximum focus and subtle borders.',
    primaryColor: '#9061f9',
    bgColor: '#06080d',
    cardColor: '#10121a',
    borderColor: '#1c1f2e',
    textColor: '#f8fafc',
    badgeColor: '#c084fc',
  },
  {
    id: 'light-pro',
    name: 'Light Pro',
    tagline: 'Crisp Enterprise Light',
    category: 'light',
    description: 'Clean, bright white and soft slate design tailored for administrative, customer support, and billing management staff.',
    primaryColor: '#7c3aed',
    bgColor: '#f8fafc',
    cardColor: '#ffffff',
    borderColor: '#cbd5e1',
    textColor: '#0f172a',
    badgeColor: '#6d28d9',
  },
  {
    id: 'colorful',
    name: 'Colorful',
    tagline: 'Multi-Color Modern Dashboard',
    category: 'vibrant',
    description: 'Vibrant indigo, cyan, emerald, and violet accents carefully balanced for a modern, multi-spectrum experience.',
    primaryColor: '#6366f1',
    bgColor: '#0b0f19',
    cardColor: '#131929',
    borderColor: '#1e293b',
    textColor: '#f8fafc',
    badgeColor: '#38bdf8',
  },
  {
    id: 'noc',
    name: 'NOC High Contrast',
    tagline: 'High Visibility Operations',
    category: 'high-contrast',
    description: 'Pure black canvas with ultra-high contrast neon indicators designed specifically for 24/7 video walls and large displays.',
    primaryColor: '#9d4edd',
    bgColor: '#000000',
    cardColor: '#121212',
    borderColor: '#383838',
    textColor: '#ffffff',
    badgeColor: '#00e676',
  },
];

interface AppThemeContextType {
  theme: AppThemeKey;
  appearanceMode: AppearanceMode;
  logoUrl: string | null;
  brandName: string;
  brandSubtitle: string;
  orgDefaultTheme: AppThemeKey;
  setTheme: (theme: AppThemeKey, saveToBackend?: boolean) => void;
  setAppearanceMode: (mode: AppearanceMode) => void;
  setLogoUrl: (url: string | null) => void;
  setBrandInfo: (name: string, subtitle: string) => void;
  setOrgDefaultTheme: (theme: AppThemeKey) => Promise<void>;
  resetToDefault: () => void;
  resetLogo: () => Promise<void>;
  saveBrandingToBackend: (input: { logo_url?: string | null; brand_name?: string; brand_subtitle?: string }) => Promise<void>;
}

const AppThemeContext = createContext<AppThemeContextType | undefined>(undefined);

export function AppThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<AppThemeKey>('default');
  const [appearanceMode, setAppearanceModeState] = useState<AppearanceMode>('dark');
  const [logoUrl, setLogoUrlState] = useState<string | null>(null);
  const [brandName, setBrandNameState] = useState<string>('SKY RADIUS');
  const [brandSubtitle, setBrandSubtitleState] = useState<string>('ISP Operations');
  const [orgDefaultTheme, setOrgDefaultThemeState] = useState<AppThemeKey>('default');

  // Apply theme to document element
  const applyThemeToDOM = useCallback((newTheme: AppThemeKey) => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;

    // Set data-theme attribute
    root.setAttribute('data-theme', newTheme);

    // Sync class for Tailwind dark mode
    if (newTheme === 'light-pro') {
      root.classList.remove('dark');
      root.classList.add('light');
    } else {
      root.classList.add('dark');
      root.classList.remove('light');
    }
  }, []);

  // Initialize from localStorage immediately on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      const savedTheme = localStorage.getItem('radius_theme') as AppThemeKey | null;
      const savedMode = localStorage.getItem('radius_appearance_mode') as AppearanceMode | null;
      const savedLogo = localStorage.getItem('radius_logo_url');
      const savedName = localStorage.getItem('radius_brand_name');
      const savedSub = localStorage.getItem('radius_brand_subtitle');

      if (savedTheme && ['default', 'dark-pro', 'light-pro', 'colorful', 'noc'].includes(savedTheme)) {
        setThemeState(savedTheme);
        applyThemeToDOM(savedTheme);
      } else {
        applyThemeToDOM('default');
      }

      if (savedMode) setAppearanceModeState(savedMode);
      if (savedLogo) setLogoUrlState(savedLogo);
      if (savedName) setBrandNameState(savedName);
      if (savedSub) setBrandSubtitleState(savedSub);
    } catch {}

    // Fetch server-persisted appearance settings
    fetch('/api/settings/appearance')
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (json?.data) {
          const d = json.data;
          if (d.logoUrl) {
            setLogoUrlState(d.logoUrl);
            localStorage.setItem('radius_logo_url', d.logoUrl);
          }
          if (d.brandName) {
            setBrandNameState(d.brandName);
            localStorage.setItem('radius_brand_name', d.brandName);
          }
          if (d.brandSubtitle) {
            setBrandSubtitleState(d.brandSubtitle);
            localStorage.setItem('radius_brand_subtitle', d.brandSubtitle);
          }
          if (d.orgTheme) {
            setOrgDefaultThemeState(d.orgTheme as AppThemeKey);
          }

          // If no local theme was chosen, use server effective theme
          const localTheme = localStorage.getItem('radius_theme');
          if (!localTheme && d.effectiveTheme) {
            setThemeState(d.effectiveTheme as AppThemeKey);
            applyThemeToDOM(d.effectiveTheme as AppThemeKey);
          }
        }
      })
      .catch(() => undefined);
  }, [applyThemeToDOM]);

  // Set Theme Handler
  const setTheme = useCallback(
    (newTheme: AppThemeKey, saveToBackend = true) => {
      setThemeState(newTheme);
      applyThemeToDOM(newTheme);

      try {
        localStorage.setItem('radius_theme', newTheme);
      } catch {}

      if (saveToBackend) {
        // Save to user preferences in background if authenticated
        fetch('/api/users/preferences', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ theme: newTheme }),
        }).catch(() => undefined);
      }
    },
    [applyThemeToDOM]
  );

  // Set Appearance Mode Handler
  const setAppearanceMode = useCallback((newMode: AppearanceMode) => {
    setAppearanceModeState(newMode);
    try {
      localStorage.setItem('radius_appearance_mode', newMode);
    } catch {}

    fetch('/api/users/preferences', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ appearance_mode: newMode }),
    }).catch(() => undefined);
  }, []);

  // Set Logo Handler
  const setLogoUrl = useCallback((url: string | null) => {
    setLogoUrlState(url);
    try {
      if (url) {
        localStorage.setItem('radius_logo_url', url);
      } else {
        localStorage.removeItem('radius_logo_url');
      }
    } catch {}
  }, []);

  // Set Brand Info Handler
  const setBrandInfo = useCallback((name: string, subtitle: string) => {
    setBrandNameState(name);
    setBrandSubtitleState(subtitle);
    try {
      localStorage.setItem('radius_brand_name', name);
      localStorage.setItem('radius_brand_subtitle', subtitle);
    } catch {}
  }, []);

  // Save branding to backend
  const saveBrandingToBackend = useCallback(
    async (input: { logo_url?: string | null; brand_name?: string; brand_subtitle?: string }) => {
      const res = await fetch('/api/settings/appearance', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error?.message || 'Failed to save branding');
      }
      if (input.logo_url !== undefined) setLogoUrl(input.logo_url);
      if (input.brand_name) setBrandNameState(input.brand_name);
      if (input.brand_subtitle) setBrandSubtitleState(input.brand_subtitle);
    },
    [setLogoUrl]
  );

  // Set Organization Default Theme
  const setOrgDefaultTheme = useCallback(
    async (newOrgTheme: AppThemeKey) => {
      const res = await fetch('/api/settings/appearance', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ default_theme: newOrgTheme }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error?.message || 'Failed to update organization default theme');
      }
      setOrgDefaultThemeState(newOrgTheme);
    },
    []
  );

  // Reset theme to default
  const resetToDefault = useCallback(() => {
    setTheme('default');
  }, [setTheme]);

  // Reset logo to default
  const resetLogo = useCallback(async () => {
    await fetch('/api/settings/logo', { method: 'DELETE' }).catch(() => undefined);
    setLogoUrl(null);
  }, [setLogoUrl]);

  return (
    <AppThemeContext.Provider
      value={{
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
      }}
    >
      {children}
    </AppThemeContext.Provider>
  );
}

export function useAppTheme() {
  const context = useContext(AppThemeContext);
  if (!context) {
    throw new Error('useAppTheme must be used within an AppThemeProvider');
  }
  return context;
}
