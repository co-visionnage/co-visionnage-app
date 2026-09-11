'use client';

import { useEffect } from 'react';

import { useUiPreferences } from '@/shared/hooks';

export function ThemeApplier() {
  const { preferences } = useUiPreferences();

  useEffect(() => {
    document.documentElement.dataset.theme = preferences.theme;
  }, [preferences.theme]);

  return <></>;
}
