'use client';

import { useCallback, useEffect, useState } from 'react';

import { fetchJson } from '@/shared/lib/fetchJson';
import {
  dangerButtonClass,
  errorClass,
  sectionClass,
  sectionTitleClass,
} from './styles';
import { describeUserAgent } from './userAgent';

type Session = {
  id: string;
  current: boolean;
  ip?: string;
  userAgent?: string;
  createdAt: string;
  lastSeenAt: string;
};

const dateFormat = new Intl.DateTimeFormat('ru-RU', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

/** Список активных сессий с возможностью закрыть любую или все остальные. */
export function ActiveSessions() {
  const [sessions, setSessions] = useState<Session[]>();
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  const load = useCallback(async () => {
    const result = await fetchJson<{ sessions: Session[] }>(
      '/api/v1/auth/sessions',
    );

    if (result.ok) {
      setSessions(result.data.sessions);
    } else {
      setError(result.error);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- loads the session list from the server on mount
    void load();
  }, [load]);

  async function revoke(session: Session) {
    setPending(true);
    setError('');

    const result = await fetchJson(`/api/v1/auth/sessions/${session.id}`, {
      method: 'DELETE',
    });

    if (!result.ok) {
      setError(result.error);
    } else if (session.current) {
      // Closed the session this browser is signed in with: that is a logout.
      globalThis.location.assign('/');
      return;
    } else {
      await load();
    }

    setPending(false);
  }

  async function revokeOthers() {
    setPending(true);
    setError('');

    const result = await fetchJson('/api/v1/auth/sessions', {
      method: 'DELETE',
    });

    if (result.ok) {
      await load();
    } else {
      setError(result.error);
    }

    setPending(false);
  }

  const hasOthers = sessions?.some((session) => !session.current) ?? false;

  return (
    <section aria-labelledby='sessions-title' className={sectionClass}>
      <h2 className={sectionTitleClass} id='sessions-title'>
        Активные сессии
      </h2>

      {error ? (
        <p className={errorClass} role='alert'>
          {error}
        </p>
      ) : undefined}

      {sessions === undefined && !error ? (
        <p className='font-bold text-gray-500'>Загружаем...</p>
      ) : undefined}

      <ul className='flex flex-col gap-3'>
        {sessions?.map((session) => (
          <li
            key={session.id}
            className='flex items-center justify-between gap-3 border-4 border-black p-3'
            data-testid='session-row'
          >
            <div className='min-w-0'>
              <p className='font-black'>
                {describeUserAgent(session.userAgent)}
                {session.current ? (
                  <span className='ml-2 border-2 border-black bg-yellow-400 px-2 text-xs uppercase'>
                    Это устройство
                  </span>
                ) : undefined}
              </p>
              <p className='text-sm font-bold text-gray-600'>
                {session.ip ? `${session.ip} · ` : ''}
                был(а) {dateFormat.format(new Date(session.lastSeenAt))}
              </p>
            </div>
            <button
              className={dangerButtonClass}
              disabled={pending}
              onClick={() => void revoke(session)}
            >
              {session.current ? 'Выйти' : 'Закрыть'}
            </button>
          </li>
        ))}
      </ul>

      {hasOthers ? (
        <button
          className={`${dangerButtonClass} mt-4 w-full`}
          disabled={pending}
          onClick={() => void revokeOthers()}
        >
          Выйти на всех остальных устройствах
        </button>
      ) : undefined}
    </section>
  );
}
