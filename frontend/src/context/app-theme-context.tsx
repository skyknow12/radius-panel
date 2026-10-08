'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';

export type AppThemeKey = 'light-pro' | 'default' | 'colorful' | 'noc' | 'dark-pro';
export type AppearanceMode = 'light' | 'dark' | 'system';

export interface ThemeOption {
  id: AppThemeKey;
  name: string;
  tagline: string;
  category: 'light' | 'dark';
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
    id: 'light-pro',
    name: 'Light Pro (Default)',
    tagline: 'Crisp White & Royal Purple',
    category: 'light',
    description: 'Bright white canvas, pure white cards, soft slate borders, and royal purple accents for high-clarity ISP management and billing.',
    primaryColor: '#7c3aed',
    bgColor: '#f8fafc',
    cardColor: '#ffffff',
    borderColor: '#cbd5e1',
    textColor: '#0f172a',
    badgeColor: '#6d28d9',
  },
  {
    id: 'default',
    name: 'Ocean Blue',
    tagline: 'Crisp White & Electric Sky Blue',
    category: 'light',
    description: 'Fresh sky-white canvas with soft blue borders and vibrant electric ocean blue accents for modern telecom operations.',
    primaryColor: '#2563eb',
    bgColor: '#f0f7ff',
    cardColor: '#ffffff',
    borderColor: '#bfdbfe',
    textColor: '#1e293b',
    badgeColor: '#0284c7',
  },
  {
    id: 'colorful',
    name: 'Emerald Mint',
    tagline: 'Crisp White & Cyber Mint Green',
    category: 'light',
    description: 'Bright pearl white canvas with soft mint borders and vibrant emerald green accents for network operations and eco dashboards.',
    primaryColor: '#059669',
    bgColor: '#f0fdf4',
    cardColor: '#ffffff',
    borderColor: '#bbf7d0',
    textColor: '#132a22',
    badgeColor: '#10b981',
  },
  {
    id: 'noc',
    name: 'Sunset Amber',
    tagline: 'Crisp White & Radiant Sunset Coral',
    category: 'light',
    description: 'Warm pearl white canvas with soft peach borders and radiant sunset amber accents for energetic modern billing workflows.',
    primaryColor: '#ea580c',
    bgColor: '#fffbeb',
    cardColor: '#ffffff',
    borderColor: '#fde68a',
    textColor: '#291e14',
    badgeColor: '#f97316',
  },
  {
    id: 'dark-pro',
    name: 'Dark Pro (NOC Midnight)',
    tagline: 'Midnight Charcoal & Technical Night',
    category: 'dark',
    description: 'The single definitive dark theme: deep pitch charcoal canvas, dark slate cards, and radiant electric blue indicators for 24/7 NOC centers.',
    primaryColor: '#3b82f6',
    bgColor: '#080b11',
    cardColor: '#10141d',
    borderColor: '#202738',
    textColor: '#f8fafc',
    badgeColor: '#60a5fa',
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

// Helper for auth headers
function getAuthHeaders(): HeadersInit {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('radius_token');
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }
  return headers;
}

export function AppThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<AppThemeKey>('light-pro');
  const [appearanceMode, setAppearanceModeState] = useState<AppearanceMode>('light');
  const [logoUrl, setLogoUrlState] = useState<string | null>(null);
  const [brandName, setBrandNameState] = useState<string>('SKY RADIUS');
  const [brandSubtitle, setBrandSubtitleState] = useState<string>('ISP Operations');
  const [orgDefaultTheme, setOrgDefaultThemeState] = useState<AppThemeKey>('light-pro');

  // Apply theme to document element
  const applyThemeToDOM = useCallback((newTheme: AppThemeKey) => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;

    // Set data-theme attribute
    root.setAttribute('data-theme', newTheme);

    // Only 'dark-pro' gets the dark class; all other 4 themes are crisp white/light!
    if (newTheme === 'dark-pro') {
      root.classList.add('dark');
      root.classList.remove('light');
    } else {
      root.classList.remove('dark');
      root.classList.add('light');
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

      if (savedTheme && ['light-pro', 'default', 'dark-pro', 'colorful', 'noc'].includes(savedTheme)) {
        setThemeState(savedTheme);
        applyThemeToDOM(savedTheme);
      } else {
        applyThemeToDOM('light-pro');
      }

      if (savedMode) setAppearanceModeState(savedMode);
      if (savedLogo) setLogoUrlState(savedLogo);
      if (savedName) setBrandNameState(savedName);
      if (savedSub) setBrandSubtitleState(savedSub);
    } catch {}

    // Fetch server-persisted appearance settings
    fetch('/api/settings/appearance', {
      headers: getAuthHeaders(),
      credentials: 'same-origin',
    })
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
          headers: getAuthHeaders(),
          credentials: 'same-origin',
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

    if (newMode === 'dark') {
      setTheme('dark-pro');
    } else if (newMode === 'light') {
      setThemeState((current) => {
        if (current === 'dark-pro') {
          applyThemeToDOM('light-pro');
          return 'light-pro';
        }
        return current;
      });
    }

    fetch('/api/users/preferences', {
      method: 'PATCH',
      headers: getAuthHeaders(),
      credentials: 'same-origin',
      body: JSON.stringify({ appearance_mode: newMode }),
    }).catch(() => undefined);
  }, [applyThemeToDOM, setTheme]);

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
        headers: getAuthHeaders(),
        credentials: 'same-origin',
        body: JSON.stringify(input),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error?.message || err.message || 'Failed to save branding');
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
        headers: getAuthHeaders(),
        credentials: 'same-origin',
        body: JSON.stringify({ default_theme: newOrgTheme }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error?.message || err.message || 'Failed to update organization default theme');
      }
      setOrgDefaultThemeState(newOrgTheme);
    },
    []
  );

  // Reset theme to default
  const resetToDefault = useCallback(() => {
    const target = orgDefaultTheme || 'light-pro';
    setTheme(target);
  }, [orgDefaultTheme, setTheme]);

  // Reset logo to default
  const resetLogo = useCallback(async () => {
    await fetch('/api/settings/logo', {
      method: 'DELETE',
      headers: getAuthHeaders(),
      credentials: 'same-origin',
    }).catch(() => undefined);
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
