'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const THEME_STORAGE_KEY = 'rack-editor:theme';
const AppThemeContext = createContext(null);

function normalizeTheme(value) {
  return value === 'dark' ? 'dark' : 'light';
}

function getStoredTheme() {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  const raw = window.localStorage.getItem(THEME_STORAGE_KEY);
  if (!raw) return null;
  return normalizeTheme(raw);
}

export function AppThemeProvider({ children }) {
  const [theme, setThemeState] = useState('light');

  const setTheme = useCallback((nextTheme) => {
    setThemeState(normalizeTheme(nextTheme));
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((current) => (current === 'dark' ? 'light' : 'dark'));
  }, []);

  useEffect(() => {
    const storedTheme = getStoredTheme();
    if (storedTheme) {
      setThemeState(storedTheme);
      return;
    }

    const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches;
    setThemeState(prefersDark ? 'dark' : 'light');
  }, []);

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', theme);
      document.documentElement.style.colorScheme = theme;
    }

    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    }
  }, [theme]);

  const value = useMemo(
    () => ({
      theme,
      isDark: theme === 'dark',
      setTheme,
      toggleTheme,
    }),
    [theme, setTheme, toggleTheme],
  );

  return <AppThemeContext.Provider value={value}>{children}</AppThemeContext.Provider>;
}

export function useAppTheme() {
  const context = useContext(AppThemeContext);
  if (!context) {
    throw new Error('useAppTheme must be used inside AppThemeProvider.');
  }
  return context;
}
