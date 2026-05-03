'use client';

import type { FamilyActionState } from '@/shared/actions/family-postgres';

import { useActionState } from 'react';

import { createFamily } from '@/shared/actions/family-postgres';

const initialState: FamilyActionState = {};

export function CreateFamilyForm() {
  const [state, formAction, isPending] = useActionState(
    createFamily,
    initialState,
  );

  return (
    <form action={formAction} className='flex flex-col gap-4'>
      <input
        required
        className='border-4 border-black p-4 text-lg font-bold shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] outline-none focus:bg-yellow-50 disabled:opacity-50'
        disabled={isPending}
        name='familyName'
        placeholder='Название (напр. Наша Семья)'
      />

      {state.error && (
        <p className='border-2 border-red-600 bg-red-50 p-2 text-sm font-black text-red-600 uppercase'>
          Ошибка: {String(state.error)}
        </p>
      )}

      <button
        className='w-full border-4 border-black bg-lime-400 p-4 text-xl font-black uppercase shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] transition-all hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none active:translate-x-1 active:translate-y-1 disabled:bg-gray-400'
        disabled={isPending}
        type='submit'
      >
        {isPending ? 'Создаем...' : 'Создать семью'}
      </button>
    </form>
  );
}
