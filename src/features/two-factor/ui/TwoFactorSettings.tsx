'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import { createClient } from '@/shared/api/postgres/client';
import {
  confirmTwoFactorAction,
  disableTwoFactorAction,
  startTwoFactorSetupAction,
} from '@/shared/actions/two-factor-postgres';
import { useAppSounds } from '@/shared/hooks';
import { Button, Input } from '@/shared/ui/lib';

export const TwoFactorSettings = () => {
  const client = useMemo(() => createClient(), []);
  const { playClick } = useAppSounds();
  const [isEnabled, setIsEnabled] = useState<boolean>();
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>();
  const [secret, setSecret] = useState<string>();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>();
  const [isPending, setIsPending] = useState(false);

  const loadStatus = useCallback(async () => {
    try {
      const { enabled } = await client.auth.getTwoFactorStatus();
      setIsEnabled(enabled);
    } catch {
      // best-effort — status widget stays in loading state on failure
    }
  }, [client]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetches 2FA status from the server on mount, not derived from render state
    void loadStatus();
  }, [loadStatus]);

  const handleStartSetup = async () => {
    playClick();
    setIsPending(true);
    setError(undefined);

    const result = await startTwoFactorSetupAction();

    if (result.error) {
      setError(result.error);
    } else {
      setQrCodeDataUrl(result.qrCodeDataUrl);
      setSecret(result.secret);
    }

    setIsPending(false);
  };

  const handleConfirm = async () => {
    playClick();
    setIsPending(true);
    setError(undefined);

    const result = await confirmTwoFactorAction(code);

    if (result.error) {
      setError(result.error);
    } else {
      setIsEnabled(true);
      setQrCodeDataUrl(undefined);
      setSecret(undefined);
      setCode('');
    }

    setIsPending(false);
  };

  const handleDisable = async () => {
    playClick();
    setIsPending(true);
    setError(undefined);

    const result = await disableTwoFactorAction(code);

    if (result.error) {
      setError(result.error);
    } else {
      setIsEnabled(false);
      setCode('');
    }

    setIsPending(false);
  };

  return (
    <div className='border-4 border-black bg-white p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]'>
      <span className='mb-3 block font-black text-black'>
        Двухфакторная аутентификация
      </span>

      {isEnabled === undefined ? (
        <p className='text-sm font-bold text-gray-500'>Загружаем...</p>
      ) : undefined}

      {error ? (
        <p className='mb-2 border-2 border-red-600 bg-white p-2 text-sm font-black text-red-700'>
          {error}
        </p>
      ) : undefined}

      {isEnabled === true ? (
        <div className='grid gap-2'>
          <p className='text-sm font-bold text-black'>Включена ✅</p>
          <Input
            className='border-2 border-black bg-white font-bold'
            placeholder='Код из приложения, чтобы отключить'
            value={code}
            onChange={(event) => setCode(event.target.value)}
          />
          <Button
            className='border-2 border-black bg-red-500 font-black text-white hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-60'
            disabled={isPending || code.length === 0}
            onClick={() => void handleDisable()}
          >
            Отключить
          </Button>
        </div>
      ) : undefined}

      {isEnabled === false && !qrCodeDataUrl ? (
        <Button
          className='w-full border-2 border-black bg-lime-400 font-black text-black hover:bg-lime-500 disabled:cursor-not-allowed disabled:opacity-60'
          disabled={isPending}
          onClick={() => void handleStartSetup()}
        >
          Настроить
        </Button>
      ) : undefined}

      {qrCodeDataUrl ? (
        <div className='grid gap-2'>
          <p className='text-xs font-bold text-black'>
            Отсканируйте QR в приложении-аутентификаторе (Google
            Authenticator, Authy и т.п.) или введите код вручную:
          </p>
          <img
            alt='QR-код для двухфакторной аутентификации'
            className='mx-auto border-2 border-black'
            src={qrCodeDataUrl}
          />
          {secret ? (
            <p className='break-all text-center text-xs font-bold text-gray-500'>
              {secret}
            </p>
          ) : undefined}
          <Input
            className='border-2 border-black bg-white font-bold'
            placeholder='Код из приложения'
            value={code}
            onChange={(event) => setCode(event.target.value)}
          />
          <Button
            className='border-2 border-black bg-lime-400 font-black text-black hover:bg-lime-500 disabled:cursor-not-allowed disabled:opacity-60'
            disabled={isPending || code.length === 0}
            onClick={() => void handleConfirm()}
          >
            Подтвердить и включить
          </Button>
        </div>
      ) : undefined}
    </div>
  );
};
