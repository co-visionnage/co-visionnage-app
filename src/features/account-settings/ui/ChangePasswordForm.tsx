'use client';

import type { FormEvent } from 'react';

import { useState } from 'react';

import { fetchJson } from '@/shared/lib/fetchJson';
import { getPasswordProblem } from '@/shared/lib/password';
import {
  errorClass,
  inputClass,
  primaryButtonClass,
  sectionClass,
  sectionTitleClass,
} from './styles';

type Status = 'idle' | 'sending' | 'done';

/**
 * Смена пароля из аккаунта: нужен текущий пароль. После успеха API закрывает
 * все остальные сессии, текущая остаётся.
 */
export function ChangePasswordForm() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState('');

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const problem = getPasswordProblem(newPassword);
    if (problem) {
      setError(problem);
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Пароль и подтверждение не совпадают');
      return;
    }

    setStatus('sending');
    setError('');

    const result = await fetchJson('/api/v1/auth/password/change', {
      method: 'POST',
      body: { currentPassword, newPassword, confirmPassword },
    });

    if (!result.ok) {
      setError(result.error);
      setStatus('idle');
      return;
    }

    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setStatus('done');
  }

  return (
    <section aria-labelledby='change-password-title' className={sectionClass}>
      <h2 className={sectionTitleClass} id='change-password-title'>
        Смена пароля
      </h2>

      <form
        className='flex flex-col gap-3'
        onSubmit={(event) => void handleSubmit(event)}
      >
        <input
          required
          aria-label='Текущий пароль'
          autoComplete='current-password'
          className={inputClass}
          placeholder='Текущий пароль'
          type='password'
          value={currentPassword}
          onChange={(event) => {
            setCurrentPassword(event.target.value);
            setStatus('idle');
          }}
        />
        <input
          required
          aria-label='Новый пароль'
          autoComplete='new-password'
          className={inputClass}
          placeholder='Новый пароль'
          type='password'
          value={newPassword}
          onChange={(event) => {
            setNewPassword(event.target.value);
            setError('');
          }}
        />
        <input
          required
          aria-label='Подтверждение пароля'
          autoComplete='new-password'
          className={inputClass}
          placeholder='Подтверждение пароля'
          type='password'
          value={confirmPassword}
          onChange={(event) => {
            setConfirmPassword(event.target.value);
            setError('');
          }}
        />
        {error ? (
          <p className={errorClass} role='alert'>
            {error}
          </p>
        ) : undefined}
        {status === 'done' ? (
          <p className='font-bold' role='status'>
            Пароль изменён. На остальных устройствах нужно войти заново.
          </p>
        ) : undefined}
        <button className={primaryButtonClass} disabled={status === 'sending'}>
          {status === 'sending' ? 'Сохраняем...' : 'Сменить пароль'}
        </button>
      </form>
    </section>
  );
}
