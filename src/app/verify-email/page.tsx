/* eslint-disable react-refresh/only-export-components */
import type { Metadata } from 'next';

import { VerifyEmailStatus } from '@/features/email-verification';
import { AuthPageLayout } from '@/shared/ui/AuthPageLayout';

export const metadata: Metadata = {
  title: 'Подтверждение email | Наши Сериалы',
  robots: { index: false },
};

type VerifyEmailPageProperties = {
  searchParams: Promise<{ token?: string }>;
};

export default async function VerifyEmailPage({
  searchParams,
}: VerifyEmailPageProperties) {
  const { token } = await searchParams;

  return (
    <AuthPageLayout title='Подтверждение email'>
      <VerifyEmailStatus token={token} />
    </AuthPageLayout>
  );
}
