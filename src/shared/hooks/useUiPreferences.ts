'use client';

import type { AppTheme, UiPreferences } from '@/shared/types';

import { useEffect, useState } from 'react';

import {
  DEFAULT_UI_PREFERENCES,
  readUiPreferences,
  UI_PREFERENCES_EVENT,
  writeUiPreferences,
} from '@/shared/lib/uiPreferences';

export function useUiPreferences() {
  // Always starts from the defaults, matching what the server renders --
  // reading localStorage here would return the stored value on the client
  // but defaults on the server, causing a hydration mismatch. The real
  // value is synced in the effect below, right after mount.
  const [preferences, setPreferences] = useState<UiPreferences>(
    DEFAULT_UI_PREFERENCES,
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- syncs from localStorage on mount, not derived from render state; needed to avoid a hydration mismatch (see comment on the initial state above)
    setPreferences(readUiPreferences());

    const syncPreferences = () => {
      setPreferences(readUiPreferences());
    };

    const syncCustomPreferences = (event: Event) => {
      const customEvent = event as CustomEvent<UiPreferences>;
      setPreferences(customEvent.detail ?? readUiPreferences());
    };

    globalThis.addEventListener('storage', syncPreferences);
    globalThis.addEventListener(UI_PREFERENCES_EVENT, syncCustomPreferences);

    return () => {
      globalThis.removeEventListener('storage', syncPreferences);
      globalThis.removeEventListener(
        UI_PREFERENCES_EVENT,
        syncCustomPreferences,
      );
    };
  }, []);

  const updatePreferences = (nextPreferences: UiPreferences) => {
    writeUiPreferences(nextPreferences);
    setPreferences(nextPreferences);
  };

  return {
    preferences,
    setSoundsEnabled(nextValue: boolean) {
      updatePreferences({
        ...preferences,
        soundsEnabled: nextValue,
      });
    },
    setConfettiEnabled(nextValue: boolean) {
      updatePreferences({
        ...preferences,
        confettiEnabled: nextValue,
      });
    },
    setTheme(nextValue: AppTheme) {
      updatePreferences({
        ...preferences,
        theme: nextValue,
      });
    },
  };
}
