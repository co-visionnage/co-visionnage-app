'use client';

import type { UiPreferences } from '@/shared/types';

import { useEffect, useState } from 'react';

import {
  readUiPreferences,
  UI_PREFERENCES_EVENT,
  writeUiPreferences,
} from '@/shared/lib/uiPreferences';

export function useUiPreferences() {
  const [preferences, setPreferences] = useState<UiPreferences>(() =>
    readUiPreferences(),
  );

  useEffect(() => {
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
  };
}
