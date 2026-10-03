/* eslint-disable react-refresh/only-export-components */
import type { Metadata } from 'next';

import { ForgotPasswordForm } from '@/features/password-reset';
import { AuthPageLayout } from '@/shared/ui/AuthPageLayout';

export const metadata: Metadata = {
  title: 'Сброс пароля | Наши Сериалы',
  robots: { index: false },
};

export default function ForgotPasswordPage() {
  return (
    <AuthPageLayout title='Забыли пароль?'>
      <ForgotPasswordForm />
    </AuthPageLayout>
  );
}
