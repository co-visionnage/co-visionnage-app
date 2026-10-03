/* eslint-disable react-refresh/only-export-components */
import type { Metadata } from 'next';

import { ResetPasswordForm } from '@/features/password-reset';
import { AuthPageLayout } from '@/shared/ui/AuthPageLayout';

export const metadata: Metadata = {
  title: 'Новый пароль | Наши Сериалы',
  robots: { index: false },
};

type ResetPasswordPageProperties = {
  searchParams: Promise<{ token?: string }>;
};

export default async function ResetPasswordPage({
  searchParams,
}: ResetPasswordPageProperties) {
  const { token } = await searchParams;

  return (
    <AuthPageLayout title='Новый пароль'>
      <ResetPasswordForm token={token} />
    </AuthPageLayout>
  );
}
