/* eslint-disable react-refresh/only-export-components */
import type { Metadata } from 'next';

import Link from 'next/link';

import { AcceptInvitation } from '@/features/family-invitations';
import { apiJsonOrUndefined } from '@/shared/api/go/server';
import { getCurrentUser } from '@/shared/api/go/session';
import { AuthPageLayout } from '@/shared/ui/AuthPageLayout';

export const metadata: Metadata = {
  title: 'Приглашение в семью | Наши Сериалы',
  robots: { index: false },
};

type InvitePageProperties = {
  searchParams: Promise<{ token?: string }>;
};

type InvitationPreview = { familyName: string; inviterName: string };

const homeLinkClass =
  'block w-full border-4 border-black bg-lime-500 p-4 text-center text-xl font-black uppercase shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]';

export default async function InvitePage({
  searchParams,
}: InvitePageProperties) {
  const { token } = await searchParams;

  const preview = token
    ? await apiJsonOrUndefined<InvitationPreview>(
        `/invitations/preview?token=${encodeURIComponent(token)}`,
      ).catch(() => {})
    : undefined;

  if (!token || !preview) {
    return (
      <AuthPageLayout title='Приглашение'>
        <p className='mb-6 font-black text-red-600' role='alert'>
          Приглашение недействительно или истекло. Попросите прислать новое.
        </p>
        <Link className={homeLinkClass} href='/'>
          На главную
        </Link>
      </AuthPageLayout>
    );
  }

  const user = await getCurrentUser();

  return (
    <AuthPageLayout title='Приглашение в семью'>
      <p className='mb-6 text-lg font-bold'>
        {preview.inviterName} приглашает вас в семью «{preview.familyName}».
      </p>

      {user ? (
        <AcceptInvitation token={token} />
      ) : (
        <>
          <p className='mb-4 font-bold'>
            Войдите или зарегистрируйтесь и откройте ссылку из письма ещё раз.
          </p>
          <Link className={homeLinkClass} href='/'>
            Войти или зарегистрироваться
          </Link>
        </>
      )}
    </AuthPageLayout>
  );
}
