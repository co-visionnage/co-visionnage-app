'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { postJson } from '@/shared/lib/postJson';

type VerifyEmailStatusProperties = {
  token?: string;
};

type Status = 'loading' | 'success' | 'error';

const MISSING_TOKEN_MESSAGE =
  'В ссылке нет кода подтверждения. Откройте ссылку из письма целиком.';

/**
 * Подтверждает email по токену из ссылки в письме. Запрос уходит сразу при
 * открытии страницы -- отдельная кнопка «подтвердить» была бы лишним шагом.
 * Токен гасится только POST-запросом из браузера, а не самим открытием
 * ссылки, поэтому почтовые сканеры, просто проходящие по ссылкам, его не
 * тратят.
 */
export function VerifyEmailStatus({ token }: VerifyEmailStatusProperties) {
  const router = useRouter();
  // В dev-режиме React монтирует эффект дважды: без флага токен ушёл бы
  // дважды, и вторая попытка показала бы «ссылка недействительна».
  const startedReference = useRef(false);
  const [status, setStatus] = useState<Status>(token ? 'loading' : 'error');
  const [error, setError] = useState(token ? '' : MISSING_TOKEN_MESSAGE);

  useEffect(() => {
    if (!token || startedReference.current) {
      return;
    }
    startedReference.current = true;

    void postJson('/api/v1/auth/verify-email', { token }).then((result) => {
      if (result.ok) {
        setStatus('success');
        // Обновляем серверные компоненты, чтобы баннер «email не
        // подтверждён» исчез без ручной перезагрузки.
        router.refresh();
        return;
      }

      setError(result.error);
      setStatus('error');
    });
  }, [token, router]);

  if (status === 'loading') {
    return (
      <p className='text-lg font-bold uppercase' role='status'>
        Подтверждаем email...
      </p>
    );
  }

  if (status === 'success') {
    return (
      <div className='flex flex-col gap-6'>
        <p className='text-lg font-bold' role='status'>
          Email подтверждён. Спасибо!
        </p>
        <Link
          className='w-full border-4 border-black bg-lime-500 p-4 text-center text-xl font-black uppercase shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] transition-all hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none'
          href='/'
        >
          На главную
        </Link>
      </div>
    );
  }

  return (
    <div className='flex flex-col gap-6'>
      <p className='font-black text-red-600' role='alert'>
        {error}
      </p>
      <p className='text-base font-bold'>
        Войдите в аккаунт: вверху страницы будет кнопка, чтобы отправить письмо
        с подтверждением ещё раз.
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
