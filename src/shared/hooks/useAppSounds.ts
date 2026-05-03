'use client';

import useSound from 'use-sound';

import { useUiPreferences } from './useUiPreferences';

const config = { volume: 0.2 };

export const useAppSounds = () => {
  const { preferences } = useUiPreferences();
  const [playClick] = useSound('/sounds/click.mp3', {
    ...config,
    volume: 0.1,
  });
  const [playSuccess] = useSound('/sounds/success.mp3', {
    ...config,
  });
  const [playDelete] = useSound('/sounds/click.mp3', {
    ...config,
    playbackRate: 0.3,
  });

  const playIfEnabled = (callback: () => void) => {
    if (preferences.soundsEnabled) {
      callback();
    }
  };

  return {
    playClick: () => playIfEnabled(playClick),
    playSuccess: () => playIfEnabled(playSuccess),
    playDelete: () => playIfEnabled(playDelete),
  };
};
