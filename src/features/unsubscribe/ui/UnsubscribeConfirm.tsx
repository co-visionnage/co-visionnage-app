'use client';

import { useState } from 'react';
import Link from 'next/link';

import { CATEGORY_LABELS } from '@/features/account-settings/ui/categoryLabels';
import { fetchJson } from '@/shared/lib/fetchJson';

type UnsubscribeConfirmProperties = {
  token?: string;
};

type State =
  | { status: 'idle' }
  | { status: 'sending' }
  | { status: 'done'; category?: string }
  | { status: 'error'; message: string };

const buttonClass =
  'w-full border-4 border-black bg-lime-500 p-4 text-center text-xl font-black uppercase shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] transition-all hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none disabled:opacity-60';

/**
 * Страница отписки по ссылке из письма. Отписка срабатывает только по
 * нажатию кнопки (POST): иначе почтовые сканеры, открывающие ссылки сами,
 * отписывали бы людей без их ведома.
 */
export function UnsubscribeConfirm({ token }: UnsubscribeConfirmProperties) {
  const [state, setState] = useState<State>({ status: 'idle' });

  if (!token) {
    return (
      <p className='font-black text-red-600' role='alert'>
        В ссылке нет кода отписки. Откройте ссылку из письма целиком или
        настройте уведомления в аккаунте.
      </p>
    );
  }

  async function handleClick() {
    setState({ status: 'sending' });

    const result = await fetchJson<{ category?: string }>(
      '/api/v1/unsubscribe',
      { method: 'POST', body: { token } },
    );

    setState(
      result.ok
        ? { status: 'done', category: result.data.category }
        : { status: 'error', message: result.error },
    );
  }

  if (state.status === 'done') {
    const label = state.category ? CATEGORY_LABELS[state.category] : undefined;

    return (
      <div className='flex flex-col gap-6'>
        <p className='text-lg font-bold' role='status'>
          Готово: больше не будем присылать письма
          {label ? ` о событии «${label}»` : ' этого типа'}. Остальные письма
          настраиваются в аккаунте.
        </p>
        <Link className={buttonClass} href='/settings'>
          Настройки уведомлений
        </Link>
      </div>
    );
  }

  return (
    <div className='flex flex-col gap-6'>
      <p className='text-base font-bold'>
        Отписаться от писем этого типа? Push-уведомления и письма о безопасности
        аккаунта это не затронет.
      </p>
      {state.status === 'error' ? (
        <p className='font-black text-red-600' role='alert'>
          {state.message}
        </p>
      ) : undefined}
      <button
        className={buttonClass}
        disabled={state.status === 'sending'}
        onClick={() => void handleClick()}
      >
        {state.status === 'sending' ? 'Отписываем...' : 'Отписаться'}
      </button>
    </div>
  );
}
