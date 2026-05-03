'use client';

import type { FamilyActionState } from '@/shared/actions/family-postgres';

import { useActionState } from 'react';

import { joinFamily } from '@/shared/actions/family-postgres';

const initialState: FamilyActionState = {};

export function JoinFamilyForm() {
  const [state, formAction, isPending] = useActionState(
    joinFamily,
    initialState,
  );

  return (
    <form
      action={formAction}
      className='mt-8 flex flex-col gap-4 border-t-4 border-dashed border-black pt-8'
    >
      <p className='text-lg font-bold uppercase'>Или войти по коду:</p>
      <input
        required
        className='border-4 border-black p-4 text-lg font-bold shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] outline-none focus:bg-yellow-50'
        name='inviteCode'
        placeholder='BRTL-XXXXXX'
      />
      {state.error && <p className='font-black text-red-600'>{state.error}</p>}
      <button
        className='w-full border-4 border-black bg-cyan-400 p-4 text-xl font-black uppercase shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] transition-all hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none'
        disabled={isPending}
      >
        {isPending ? 'Входим...' : 'Присоединиться'}
      </button>
    </form>
  );
}
