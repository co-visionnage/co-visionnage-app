'use client';

import type { AppTheme, UiPreferences } from '@/shared/types';

export const UI_PREFERENCES_STORAGE_KEY = 'co-visionnage-ui-preferences';
export const UI_PREFERENCES_EVENT = 'co-visionnage-ui-preferences-changed';

export const APP_THEMES: AppTheme[] = ['brutal', 'minimal', 'dark'];

export const DEFAULT_UI_PREFERENCES: UiPreferences = {
  soundsEnabled: true,
  confettiEnabled: true,
  theme: 'brutal',
};

function normalizeTheme(value: unknown): AppTheme {
  return APP_THEMES.includes(value as AppTheme)
    ? (value as AppTheme)
    : DEFAULT_UI_PREFERENCES.theme;
}

export function readUiPreferences(): UiPreferences {
  if (typeof window === 'undefined') {
    return DEFAULT_UI_PREFERENCES;
  }

  try {
    const rawValue = window.localStorage.getItem(UI_PREFERENCES_STORAGE_KEY);
    if (!rawValue) {
      return DEFAULT_UI_PREFERENCES;
    }

    const parsed = JSON.parse(rawValue) as Partial<UiPreferences>;

    return {
      soundsEnabled:
        parsed.soundsEnabled ?? DEFAULT_UI_PREFERENCES.soundsEnabled,
      confettiEnabled:
        parsed.confettiEnabled ?? DEFAULT_UI_PREFERENCES.confettiEnabled,
      theme: normalizeTheme(parsed.theme),
    };
  } catch {
    return DEFAULT_UI_PREFERENCES;
  }
}

export function writeUiPreferences(nextPreferences: UiPreferences) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(
    UI_PREFERENCES_STORAGE_KEY,
    JSON.stringify(nextPreferences),
  );
  window.dispatchEvent(
    new CustomEvent<UiPreferences>(UI_PREFERENCES_EVENT, {
      detail: nextPreferences,
    }),
  );
}
