/* eslint-disable react-refresh/only-export-components */
import type { Metadata } from 'next';

import Link from 'next/link';

import {
  ActiveSessions,
  ChangePasswordForm,
  NotificationPreferences,
} from '@/features/account-settings';
import { TwoFactorSettings } from '@/features/two-factor';
import { getCurrentUser } from '@/shared/api/go/session';
import { AuthPageLayout } from '@/shared/ui/AuthPageLayout';

export const metadata: Metadata = {
  title: 'Настройки | Наши Сериалы',
  robots: { index: false },
};

export default async function SettingsPage() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <AuthPageLayout title='Настройки'>
        <p className='mb-6 text-lg font-bold'>
          Войдите, чтобы открыть настройки аккаунта.
        </p>
        <Link
          className='block w-full border-4 border-black bg-lime-500 p-4 text-center text-xl font-black uppercase shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]'
          href='/'
        >
          На главную
        </Link>
      </AuthPageLayout>
    );
  }

  return (
    <main className='brutal-font min-h-screen bg-blue-500 p-4'>
      <div className='mx-auto flex max-w-2xl flex-col gap-6'>
        <Link
          className='inline-flex w-fit items-center gap-2 border-2 border-black bg-white px-4 py-2 font-black text-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:bg-gray-100'
          href='/'
        >
          ← Ко всем сериалам
        </Link>

        <h1 className='text-4xl font-black tracking-tighter text-black uppercase'>
          Настройки · {user.displayName ?? user.email}
        </h1>

        <ChangePasswordForm />
        <TwoFactorSettings />
        <ActiveSessions />
        <NotificationPreferences />
      </div>
    </main>
  );
}
