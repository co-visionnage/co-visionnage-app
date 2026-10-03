'use client';

import type { FormEvent } from 'react';

import { useCallback, useEffect, useState } from 'react';

import { fetchJson } from '@/shared/lib/fetchJson';

type FamilyInvitationsProperties = {
  familyId: string;
};

type Invitation = {
  id: string;
  email: string;
  createdAt: string;
  expiresAt?: string;
};

const smallButtonClass =
  'border-2 border-black bg-white px-2 py-1 text-xs font-black uppercase hover:bg-gray-100 disabled:opacity-60';

/**
 * Приглашение в семью по email (для владельца и админов): форма, список
 * ожидающих приглашений, повторная отправка и отзыв. Саму ссылку получает
 * только адресат -- в письме.
 */
export function FamilyInvitations({ familyId }: FamilyInvitationsProperties) {
  const base = `/api/v1/families/${encodeURIComponent(familyId)}/invitations`;

  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [pending, setPending] = useState(false);

  const load = useCallback(async () => {
    const result = await fetchJson<Invitation[]>(base);

    if (result.ok) {
      setInvitations(result.data);
    } else {
      setError(result.error);
    }
  }, [base]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- loads pending invitations from the server on mount
    void load();
  }, [load]);

  async function handleInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError('');
    setNotice('');

    const result = await fetchJson(base, { method: 'POST', body: { email } });

    if (result.ok) {
      setNotice(`Приглашение отправлено на ${email.trim()}`);
      setEmail('');
      await load();
    } else {
      setError(result.error);
    }

    setPending(false);
  }

  async function handleAction(
    invitation: Invitation,
    action: 'resend' | 'revoke',
  ) {
    setPending(true);
    setError('');
    setNotice('');

    const result =
      action === 'resend'
        ? await fetchJson(`${base}/${invitation.id}/resend`, { method: 'POST' })
        : await fetchJson(`${base}/${invitation.id}`, { method: 'DELETE' });

    if (result.ok) {
      setNotice(
        action === 'resend'
          ? `Письмо отправлено ещё раз на ${invitation.email}`
          : `Приглашение для ${invitation.email} отозвано`,
      );
      await load();
    } else {
      setError(result.error);
    }

    setPending(false);
  }

  return (
    <div
      className='grid gap-2 border-4 border-black bg-white p-3'
      data-testid='family-invitations'
    >
      <span className='font-black text-black uppercase'>
        Пригласить по email
      </span>

      <form
        className='flex gap-2'
        onSubmit={(event) => void handleInvite(event)}
      >
        <input
          required
          aria-label='Email для приглашения'
          autoComplete='off'
          className='h-10 min-w-0 flex-1 border-2 border-black px-2 font-bold outline-none focus:bg-yellow-50'
          placeholder='email@example.com'
          type='email'
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
        <button
          className='border-2 border-black bg-lime-400 px-3 font-black uppercase hover:bg-lime-500 disabled:opacity-60'
          disabled={pending}
        >
          Пригласить
        </button>
      </form>

      {error ? (
        <p className='font-black text-red-600' role='alert'>
          {error}
        </p>
      ) : undefined}
      {notice ? (
        <p className='text-sm font-bold' role='status'>
          {notice}
        </p>
      ) : undefined}

      {invitations.length > 0 ? (
        <ul className='grid gap-1'>
          {invitations.map((invitation) => (
            <li
              key={invitation.id}
              className='flex items-center justify-between gap-2 border-2 border-black p-2'
            >
              <span className='min-w-0 truncate text-sm font-bold'>
                {invitation.email}
              </span>
              <span className='flex shrink-0 gap-1'>
                <button
                  className={smallButtonClass}
                  disabled={pending}
                  onClick={() => void handleAction(invitation, 'resend')}
                >
                  Ещё раз
                </button>
                <button
                  className={smallButtonClass}
                  disabled={pending}
                  onClick={() => void handleAction(invitation, 'revoke')}
                >
                  Отозвать
                </button>
              </span>
            </li>
          ))}
        </ul>
      ) : undefined}
    </div>
  );
}
