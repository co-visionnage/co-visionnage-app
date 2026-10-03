/* eslint-disable react-refresh/only-export-components */
import type { Metadata } from 'next';

import { UnsubscribeConfirm } from '@/features/unsubscribe';
import { AuthPageLayout } from '@/shared/ui/AuthPageLayout';

export const metadata: Metadata = {
  title: 'Отписка | Наши Сериалы',
  robots: { index: false },
};

type UnsubscribePageProperties = {
  searchParams: Promise<{ token?: string }>;
};

export default async function UnsubscribePage({
  searchParams,
}: UnsubscribePageProperties) {
  const { token } = await searchParams;

  return (
    <AuthPageLayout title='Отписка от писем'>
      <UnsubscribeConfirm token={token} />
    </AuthPageLayout>
  );
}
