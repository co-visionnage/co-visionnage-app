'use client';

import { useState } from 'react';

import { postJson } from '@/shared/lib/postJson';

type EmailVerificationBannerProperties = {
  email: string;
};

type Status = 'idle' | 'sending' | 'sent' | 'error';

/**
 * Полоса над страницей для вошедшего пользователя с неподтверждённым email:
 * объясняет, что делать, и даёт отправить письмо ещё раз.
 */
export function EmailVerificationBanner({
  email,
}: EmailVerificationBannerProperties) {
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState('');

  async function resend() {
    setStatus('sending');
    setError('');

    const result = await postJson('/api/v1/auth/verify-email/resend');

    if (result.ok) {
      setStatus('sent');
      return;
    }

    setError(result.error);
    setStatus('error');
  }

  return (
    <div
      aria-label='Подтверждение email'
      className='brutal-font flex flex-col items-start gap-3 border-b-4 border-black bg-yellow-400 px-4 py-3 text-sm font-black text-black sm:flex-row sm:items-center sm:justify-between'
      role='region'
    >
      <p>
        Email <span className='break-all underline'>{email}</span> не
        подтверждён. Мы отправили вам письмо со ссылкой — проверьте почту.
      </p>

      <div className='flex flex-col items-start gap-1 sm:items-end'>
        {status === 'sent' ? (
          <p role='status'>Письмо отправлено. Проверьте почту.</p>
        ) : (
          <button
            className='border-4 border-black bg-white px-3 py-2 uppercase shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none disabled:opacity-60'
            disabled={status === 'sending'}
            type='button'
            onClick={() => void resend()}
          >
            {status === 'sending' ? 'Отправляем...' : 'Отправить ещё раз'}
          </button>
        )}
        {status === 'error' ? (
          <p className='text-red-700' role='alert'>
            {error}
          </p>
        ) : undefined}
      </div>
    </div>
  );
}
