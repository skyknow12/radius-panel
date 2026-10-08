'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';

export type AppThemeKey = 'light-pro' | 'default' | 'dark-pro' | 'colorful' | 'noc';
export type AppearanceMode = 'light' | 'dark' | 'system';

export interface ThemeOption {
  id: AppThemeKey;
  name: string;
  tagline: string;
  category: 'light' | 'dark' | 'vibrant' | 'high-contrast';
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
    name: 'Light Pro',
    tagline: 'Clean Crisp Enterprise Light (Default)',
    category: 'light',
    description: 'Bright crisp canvas, pure white cards, soft slate borders, and royal purple accents for high-clarity ISP operations and billing.',
    primaryColor: '#7c3aed',
    bgColor: '#f8fafc',
    cardColor: '#ffffff',
    borderColor: '#cbd5e1',
    textColor: '#0f172a',
    badgeColor: '#6d28d9',
  },
  {
    id: 'default',
    name: 'Classic Dark',
    tagline: 'Purple / Indigo Modern ISP',
    category: 'dark',
    description: 'The standard Fiberworld-style professional purple/indigo theme with dark navy canvas, slate cards, and clean contrast.',
    primaryColor: '#8b5cf6',
    bgColor: '#0b0f19',
    cardColor: '#141b2d',
    borderColor: '#24304f',
    textColor: '#f8fafc',
    badgeColor: '#a78bfa',
  },
  {
    id: 'dark-pro',
    name: 'Dark Pro',
    tagline: 'Midnight Charcoal & Radiant Blue',
    category: 'dark',
    description: 'Deep pitch charcoal/near-black canvas engineered for technical NOC teams with radiant electric blue indicators.',
    primaryColor: '#3b82f6',
    bgColor: '#080b11',
    cardColor: '#10141d',
    borderColor: '#202738',
    textColor: '#f8fafc',
    badgeColor: '#60a5fa',
  },
  {
    id: 'colorful',
    name: 'Colorful',
    tagline: 'Deep Ocean Teal & Cyber Emerald',
    category: 'vibrant',
    description: 'Deep ocean teal canvas with rich aquatic cards, cyan borders, and emerald green accents for a distinctive modern experience.',
    primaryColor: '#14b8a6',
    bgColor: '#0a171c',
    cardColor: '#12252c',
    borderColor: '#234c5b',
    textColor: '#f8fafc',
    badgeColor: '#2dd4bf',
  },
  {
    id: 'noc',
    name: 'NOC High Contrast',
    tagline: 'OLED Black & Ultra Neon Indicators',
    category: 'high-contrast',
    description: 'Pure 100% OLED pitch black canvas with jet black cards, crisp white text, and ultra-high visibility neon green indicators.',
    primaryColor: '#00e676',
    bgColor: '#000000',
    cardColor: '#0f0f0f',
    borderColor: '#474747',
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

    // Sync class for Tailwind dark/light mode
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

    fetch('/api/users/preferences', {
      method: 'PATCH',
      headers: getAuthHeaders(),
      credentials: 'same-origin',
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
