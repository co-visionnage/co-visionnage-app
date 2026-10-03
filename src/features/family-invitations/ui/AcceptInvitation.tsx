'use client';

import { useState } from 'react';

import { fetchJson } from '@/shared/lib/fetchJson';

type AcceptInvitationProperties = {
  token: string;
};

const buttonClass =
  'w-full border-4 border-black bg-lime-500 p-4 text-xl font-black uppercase shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] transition-all hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none disabled:opacity-60';

/** Кнопка «Присоединиться» на странице приглашения (пользователь уже вошёл). */
export function AcceptInvitation({ token }: AcceptInvitationProperties) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  async function handleAccept() {
    setPending(true);
    setError('');

    const result = await fetchJson<{ id: string }>(
      '/api/v1/invitations/accept',
      {
        method: 'POST',
        body: { token },
      },
    );

    if (!result.ok) {
      setError(result.error);
      setPending(false);
      return;
    }

    // Make the joined family the active one before opening the home page.
    await fetchJson('/api/family/switch', {
      method: 'POST',
      body: { familyId: result.data.id },
    });
    globalThis.location.href = '/';
  }

  return (
    <div className='flex flex-col gap-4'>
      {error ? (
        <p className='font-black text-red-600' role='alert'>
          {error}
        </p>
      ) : undefined}
      <button
        className={buttonClass}
        disabled={pending}
        onClick={() => void handleAccept()}
      >
        {pending ? 'Присоединяемся...' : 'Присоединиться'}
      </button>
    </div>
  );
}
