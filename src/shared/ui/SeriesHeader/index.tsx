'use client';

import { Github, LogOut, Mail, Settings2, UserPlus } from 'lucide-react';
import { useMemo, useState } from 'react';
import Link from 'next/link';

import { createClient } from '@/shared/api/postgres/client';
import { useAppSounds, useUiPreferences } from '@/shared/hooks';
import { AuthMode } from '@/shared/types';
import {
  Button,
  Checkbox,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/shared/ui/lib';

interface HeaderProperties {
  userDisplayName?: string;
  userEmail?: string;
}

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const hasLetterPattern = /[A-Za-zА-Яа-яЁё]/;
const hasDigitPattern = /\d/;
const hasSpecialPattern = /[^A-Za-zА-Яа-яЁё0-9]/;

export const SeriesHeader = ({
  userDisplayName,
  userEmail,
}: HeaderProperties) => {
  const { playClick } = useAppSounds();
  const { preferences, setConfettiEnabled, setSoundsEnabled } =
    useUiPreferences();
  const client = useMemo(() => createClient(), []);

  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [legalAccepted, setLegalAccepted] = useState(false);
  const [error, setError] = useState<string | null>();
  const [isPending, setIsPending] = useState(false);

  const normalizedEmail = email.trim().toLowerCase();
  const normalizedDisplayName = displayName.trim();
  const isEmailValid = emailPattern.test(normalizedEmail);
  const isDisplayNameValid = normalizedDisplayName.length >= 2;
  const isPasswordStrong =
    password.length >= 8 &&
    hasLetterPattern.test(password) &&
    hasDigitPattern.test(password) &&
    hasSpecialPattern.test(password);
  const isConfirmValid = mode === 'login' || password === confirmPassword;

  const canSubmit =
    isEmailValid &&
    isPasswordStrong &&
    legalAccepted &&
    !isPending &&
    (mode === 'login' || (isDisplayNameValid && isConfirmValid));

  const resetCommonError = () => {
    if (error) {
      setError(undefined);
    }
  };

  const handleEmailAuth = async () => {
    playClick();

    if (!canSubmit) {
      setError(
        legalAccepted
          ? 'Проверьте поля формы перед отправкой.'
          : 'Нужно принять пользовательское соглашение и правовые документы',
      );
      return;
    }

    setError(undefined);
    setIsPending(true);

    try {
      await client.auth.login({
        mode,
        provider: 'email',
        email: normalizedEmail,
        displayName: normalizedDisplayName,
        password,
        confirmPassword,
        legalAccepted,
      });
      globalThis.location.reload();
    } catch (authError) {
      setError(
        authError instanceof Error
          ? authError.message
          : 'Не удалось выполнить вход',
      );
    } finally {
      setIsPending(false);
    }
  };

  const handleGitHubLogin = () => {
    playClick();

    if (!legalAccepted) {
      setError(
        'Нужно принять пользовательское соглашение и правовые документы',
      );
      return;
    }

    setError(undefined);
    setIsPending(true);
    client.auth.startGitHubLogin(true);
  };

  const handleLogout = async () => {
    playClick();
    await client.auth.logout();
    globalThis.location.reload();
  };

  const inlineEmailError =
    email.length > 0 && !isEmailValid ? 'Введите корректный email.' : undefined;
  const inlineDisplayNameError =
    mode === 'register' && displayName.length > 0 && !isDisplayNameValid
      ? 'Имя должно быть не короче 2 символов.'
      : undefined;
  const inlinePasswordError =
    password.length > 0 && !isPasswordStrong
      ? 'Пароль должен быть не короче 8 символов и содержать буквы, цифры и спецсимвол.'
      : undefined;
  const inlineConfirmError =
    mode === 'register' && confirmPassword.length > 0 && !isConfirmValid
      ? 'Пароль и подтверждение не совпадают.'
      : undefined;

  return (
    <header className='brutal-font mb-12 flex flex-col items-center justify-between gap-6 md:flex-row md:items-start'>
      <div className='-rotate-2 transform border-4 border-black bg-lime-400 p-6 shadow-[10px_10px_0px_0px_rgba(0,0,0,1)] transition-transform hover:rotate-0'>
        <h1 className='text-4xl font-black tracking-tighter text-black uppercase md:text-6xl'>
          НАШИ СЕРИАЛЫ
        </h1>
        <div className='mt-2 inline-block rotate-3 border-2 border-black bg-pink-500 px-4 py-1 font-bold shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]'>
          ОТСЛЕЖИВАЕМ ВСЁ ВМЕСТЕ!
        </div>
      </div>

      <div className='z-10'>
        {userDisplayName ? (
          <div className='flex rotate-1 items-center gap-3 border-4 border-black bg-white p-4 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]'>
            <div className='flex flex-col'>
              <span className='text-[10px] font-black text-gray-400 uppercase'>
                Пользователь
              </span>
              <p className='font-black text-black'>{userDisplayName}</p>
              {userEmail ? (
                <p className='text-xs font-bold text-gray-500 lowercase'>
                  {userEmail}
                </p>
              ) : undefined}
            </div>

            <Dialog>
              <DialogTrigger asChild>
                <Button
                  className='border-2 border-black bg-cyan-300 p-2 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none'
                  onClick={() => playClick()}
                >
                  <Settings2 size={18} />
                </Button>
              </DialogTrigger>
              <DialogContent className='max-w-md border-4 border-black bg-yellow-300 [&>button]:top-4 [&>button]:right-4 [&>button]:rounded-none [&>button]:border-2 [&>button]:border-black [&>button]:bg-white [&>button]:opacity-100 [&>button]:hover:bg-red-500'>
                <DialogHeader>
                  <DialogTitle className='text-2xl font-black text-black uppercase'>
                    Настройки
                  </DialogTitle>
                </DialogHeader>

                <div className='grid gap-4'>
                  <label className='flex items-center justify-between gap-4 border-4 border-black bg-white p-4 font-black text-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]'>
                    <span>Звуки интерфейса</span>
                    <Checkbox
                      checked={preferences.soundsEnabled}
                      onChange={(event) =>
                        setSoundsEnabled(event.target.checked)
                      }
                    />
                  </label>

                  <label className='flex items-center justify-between gap-4 border-4 border-black bg-white p-4 font-black text-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]'>
                    <span>Конфетти</span>
                    <Checkbox
                      checked={preferences.confettiEnabled}
                      onChange={(event) =>
                        setConfettiEnabled(event.target.checked)
                      }
                    />
                  </label>
                </div>
              </DialogContent>
            </Dialog>

            <Button
              className='border-2 border-black bg-red-500 p-2 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none'
              onClick={() => void handleLogout()}
            >
              <LogOut color='white' size={20} />
            </Button>
          </div>
        ) : (
          <Dialog>
            <DialogTrigger asChild>
              <Button
                className='rotate-2 border-4 border-black bg-yellow-400 px-8 py-6 text-2xl font-black text-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] transition-all hover:translate-x-1 hover:translate-y-1 hover:rotate-0 hover:shadow-none active:bg-lime-400'
                onClick={() => playClick()}
              >
                ВХОД
              </Button>
            </DialogTrigger>
            <DialogContent className='max-w-md rounded-none border-[6px] border-black bg-pink-400 p-6 shadow-[15px_15px_0px_0px_rgba(0,0,0,1)] sm:p-8 [&>button]:rounded-none [&>button]:border-4 [&>button]:border-black [&>button]:bg-white'>
              <DialogHeader>
                <div className='mb-4 -rotate-2 border-4 border-black bg-purple-600 p-4 shadow-[5px_5px_0px_0px_rgba(0,0,0,1)]'>
                  <DialogTitle className='text-center text-3xl font-black tracking-tight text-yellow-300 uppercase'>
                    {mode === 'login' ? 'Вход' : 'Регистрация'}
                  </DialogTitle>
                </div>
              </DialogHeader>

              <div className='mb-2 grid grid-cols-2 gap-3'>
                <Button
                  className='border-4 border-black bg-white font-black text-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]'
                  type='button'
                  onClick={() => {
                    playClick();
                    setMode('login');
                    setError(undefined);
                  }}
                >
                  <Mail className='mr-2' size={18} />
                  Войти
                </Button>
                <Button
                  className='border-4 border-black bg-cyan-300 font-black text-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]'
                  type='button'
                  onClick={() => {
                    playClick();
                    setMode('register');
                    setError(undefined);
                  }}
                >
                  <UserPlus className='mr-2' size={18} />
                  Регистрация
                </Button>
              </div>

              <div className='grid gap-3'>
                <div className='grid gap-2'>
                  <input
                    required
                    className='h-14 border-4 border-black bg-white px-4 text-lg font-bold outline-none focus:bg-yellow-50'
                    placeholder='email@example.com'
                    value={email}
                    onChange={(event) => {
                      setEmail(event.target.value);
                      resetCommonError();
                    }}
                  />
                  {inlineEmailError ? (
                    <p className='text-sm font-black text-red-700'>
                      {inlineEmailError}
                    </p>
                  ) : undefined}
                </div>

                {mode === 'register' ? (
                  <div className='grid gap-2'>
                    <input
                      className='h-14 border-4 border-black bg-white px-4 text-lg font-bold outline-none focus:bg-yellow-50'
                      placeholder='Как вас подписать'
                      value={displayName}
                      onChange={(event) => {
                        setDisplayName(event.target.value);
                        resetCommonError();
                      }}
                    />
                    {inlineDisplayNameError ? (
                      <p className='text-sm font-black text-red-700'>
                        {inlineDisplayNameError}
                      </p>
                    ) : undefined}
                  </div>
                ) : undefined}

                <div className='grid gap-2'>
                  <input
                    required
                    className='h-14 border-4 border-black bg-white px-4 text-lg font-bold outline-none focus:bg-yellow-50'
                    placeholder='Пароль'
                    type='password'
                    value={password}
                    onChange={(event) => {
                      setPassword(event.target.value);
                      resetCommonError();
                    }}
                  />
                  {inlinePasswordError ? (
                    <p className='text-sm font-black text-red-700'>
                      {inlinePasswordError}
                    </p>
                  ) : undefined}
                </div>

                {mode === 'register' ? (
                  <div className='grid gap-2'>
                    <input
                      required
                      className='h-14 border-4 border-black bg-white px-4 text-lg font-bold outline-none focus:bg-yellow-50'
                      placeholder='Подтверждение пароля'
                      type='password'
                      value={confirmPassword}
                      onChange={(event) => {
                        setConfirmPassword(event.target.value);
                        resetCommonError();
                      }}
                    />
                    {inlineConfirmError ? (
                      <p className='text-sm font-black text-red-700'>
                        {inlineConfirmError}
                      </p>
                    ) : undefined}
                  </div>
                ) : undefined}

                <label className='group flex cursor-pointer items-start gap-3 border-4 border-black bg-[#fff8ce] p-4 text-sm font-bold text-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] transition-transform hover:-translate-y-0.5'>
                  <span className='relative mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden border-4 border-black bg-white transition-all duration-150 group-hover:scale-105 group-hover:bg-yellow-200'>
                    <input
                      checked={legalAccepted}
                      className='peer sr-only'
                      type='checkbox'
                      onChange={(event) => {
                        playClick();
                        setLegalAccepted(event.target.checked);
                        resetCommonError();
                      }}
                    />
                    <span className='absolute inset-0 bg-[linear-gradient(135deg,#bef264_0%,#facc15_100%)] opacity-0 transition-opacity peer-checked:opacity-100' />
                    <span className='relative text-lg leading-none font-black text-black opacity-0 transition-all peer-checked:scale-100 peer-checked:opacity-100'>
                      ✓
                    </span>
                  </span>
                  <span className='leading-6'>
                    Я принимаю{' '}
                    <Link
                      className='underline decoration-4 underline-offset-[6px]'
                      href='/legal/agreement'
                      target='_blank'
                    >
                      пользовательское соглашение
                    </Link>
                    ,{' '}
                    <Link
                      className='underline decoration-4 underline-offset-[6px]'
                      href='/legal/terms'
                      target='_blank'
                    >
                      условия использования
                    </Link>{' '}
                    и{' '}
                    <Link
                      className='underline decoration-4 underline-offset-[6px]'
                      href='/legal/privacy'
                      target='_blank'
                    >
                      политику конфиденциальности
                    </Link>
                    .
                  </span>
                </label>

                {error ? (
                  <p className='border-4 border-black bg-white p-3 text-sm font-black text-red-600'>
                    {error}
                  </p>
                ) : undefined}

                <Button
                  className='flex h-16 gap-4 border-4 border-black bg-white text-xl font-black text-black shadow-[5px_5px_0px_0px_rgba(0,0,0,1)] transition-all hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-500 disabled:shadow-none'
                  disabled={!canSubmit}
                  onClick={() => void handleEmailAuth()}
                >
                  <Mail size={28} />
                  {isPending
                    ? 'Обрабатываем...'
                    : mode === 'login'
                      ? 'Войти'
                      : 'Зарегистрироваться'}
                </Button>

                <Button
                  className='flex h-16 gap-4 border-4 border-black bg-gray-900 text-xl font-black text-white shadow-[5px_5px_0px_0px_rgba(0,0,0,1)] transition-all hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none disabled:cursor-not-allowed disabled:opacity-60'
                  disabled={isPending}
                  onClick={handleGitHubLogin}
                >
                  <Github size={28} />
                  {isPending ? 'Перенаправляем...' : 'Войти по GitHub'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </header>
  );
};
