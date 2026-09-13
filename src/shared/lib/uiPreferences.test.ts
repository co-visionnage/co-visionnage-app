import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  DEFAULT_UI_PREFERENCES,
  readUiPreferences,
  UI_PREFERENCES_EVENT,
  UI_PREFERENCES_STORAGE_KEY,
  writeUiPreferences,
} from './uiPreferences';

describe('uiPreferences', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  describe('readUiPreferences', () => {
    it('returns the defaults when nothing is stored', () => {
      expect(readUiPreferences()).toEqual(DEFAULT_UI_PREFERENCES);
    });

    it('returns the stored value written by writeUiPreferences', () => {
      const custom = {
        soundsEnabled: false,
        confettiEnabled: false,
        theme: 'dark' as const,
      };

      writeUiPreferences(custom);

      expect(readUiPreferences()).toEqual(custom);
    });

    it('falls back to defaults for corrupted JSON', () => {
      window.localStorage.setItem(UI_PREFERENCES_STORAGE_KEY, '{not json');

      expect(readUiPreferences()).toEqual(DEFAULT_UI_PREFERENCES);
    });

    it('normalizes an unknown theme value to the default theme', () => {
      window.localStorage.setItem(
        UI_PREFERENCES_STORAGE_KEY,
        JSON.stringify({ theme: 'not-a-real-theme' }),
      );

      expect(readUiPreferences().theme).toBe(DEFAULT_UI_PREFERENCES.theme);
    });

    it('fills in missing fields from a partial stored value', () => {
      window.localStorage.setItem(
        UI_PREFERENCES_STORAGE_KEY,
        JSON.stringify({ soundsEnabled: false }),
      );

      expect(readUiPreferences()).toEqual({
        ...DEFAULT_UI_PREFERENCES,
        soundsEnabled: false,
      });
    });
  });

  describe('writeUiPreferences', () => {
    it('dispatches a custom event with the new preferences as detail', () => {
      const listener = vi.fn();
      window.addEventListener(UI_PREFERENCES_EVENT, listener);

      const next = {
        soundsEnabled: false,
        confettiEnabled: true,
        theme: 'minimal' as const,
      };
      writeUiPreferences(next);

      expect(listener).toHaveBeenCalledTimes(1);
      const event = listener.mock.calls[0][0] as CustomEvent;
      expect(event.detail).toEqual(next);

      window.removeEventListener(UI_PREFERENCES_EVENT, listener);
    });
  });
});
