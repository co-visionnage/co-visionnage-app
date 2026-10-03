'use client';

import type { FormEvent } from 'react';

import { useState } from 'react';
import Link from 'next/link';

import { postJson } from '@/shared/lib/postJson';

type Status = 'idle' | 'sending' | 'sent';

/**
 * Форма «Забыли пароль?»: просит email и ставит письмо со ссылкой в очередь.
 * Ответ одинаков для существующего и несуществующего аккаунта, поэтому и
 * сообщение об успехе написано так, чтобы не раскрывать, есть ли аккаунт.
 */
export function ForgotPasswordForm() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState('');

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus('sending');
    setError('');

    const result = await postJson('/api/v1/auth/password-reset/request', {
      email,
    });

    if (result.ok) {
      setStatus('sent');
      return;
    }

    setError(result.error);
    setStatus('idle');
  }

  if (status === 'sent') {
    return (
      <div className='flex flex-col gap-6'>
        <p className='text-lg font-bold' role='status'>
          Если аккаунт с адресом <span className='break-all'>{email}</span>{' '}
          существует, мы отправили на него письмо со ссылкой для сброса пароля.
          Ссылка действует 1 час.
        </p>
        <Link
          className='w-full border-4 border-black bg-white p-4 text-center text-xl font-black uppercase shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] transition-all hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none'
          href='/'
        >
          На главную
        </Link>
      </div>
    );
  }

  return (
    <form
      className='flex flex-col gap-4'
      onSubmit={(event) => void handleSubmit(event)}
    >
      <p className='text-base font-bold'>
        Укажите email, с которым вы регистрировались. Мы пришлём ссылку для
        создания нового пароля.
      </p>
      <input
        required
        aria-label='Email'
        autoComplete='email'
        className='h-14 border-4 border-black bg-white px-4 text-lg font-bold outline-none focus:bg-yellow-50'
        placeholder='Email'
        type='email'
        value={email}
        onChange={(event) => {
          setEmail(event.target.value);
          setError('');
        }}
      />
      {error ? (
        <p className='font-black text-red-600' role='alert'>
          {error}
        </p>
      ) : undefined}
      <button
        className='w-full border-4 border-black bg-lime-500 p-4 text-xl font-black uppercase shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] transition-all hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none disabled:opacity-60'
        disabled={status === 'sending'}
      >
        {status === 'sending' ? 'Отправляем...' : 'Отправить ссылку'}
      </button>
    </form>
  );
}
