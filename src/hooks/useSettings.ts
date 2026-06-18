'use client';

import { useState, useEffect, useCallback } from 'react';
import { Settings } from '@/types';

const STORAGE_KEY = 'ssc_vocab_settings';

const DEFAULT_SETTINGS: Settings = {
  geminiApiKey: '',
  webAppUrl: '',
};

export function useSettings() {
  const [settings, setSettingsState] = useState<Settings>(DEFAULT_SETTINGS);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setSettingsState({ ...DEFAULT_SETTINGS, ...parsed });
      }
    } catch {
      // ignore parse errors
    }
    setIsLoaded(true);
  }, []);

  const saveSettings = useCallback((newSettings: Partial<Settings>) => {
    setSettingsState((prev) => {
      const updated = { ...prev, ...newSettings };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch {
        // ignore storage errors
      }
      return updated;
    });
  }, []);

  const isConfigured = Boolean(settings.geminiApiKey && settings.webAppUrl);

  return { settings, saveSettings, isLoaded, isConfigured };
}
