'use client';

import { useState } from 'react';

import { deleteAccountAction } from '@/shared/actions/account-postgres';
import { useAppSounds } from '@/shared/hooks';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
  Button,
  Input,
} from '@/shared/ui/lib';

export const DeleteAccountButton = () => {
  const { playClick, playDelete } = useAppSounds();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>();
  const [isPending, setIsPending] = useState(false);

  const handleDelete = async () => {
    playDelete();
    setIsPending(true);
    setError(undefined);

    const result = await deleteAccountAction(password);

    if (result.error) {
      setError(result.error);
      setIsPending(false);
    } else {
      globalThis.location.href = '/';
    }
  };

  return (
    <div className='border-4 border-black bg-white p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]'>
      <span className='mb-3 block font-black text-black'>
        Удаление аккаунта
      </span>

      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button
            className='w-full border-2 border-black bg-red-500 font-black text-white hover:bg-red-600'
            onClick={() => playClick()}
          >
            Удалить аккаунт
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent className='border-4 border-black bg-white p-6 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]'>
          <AlertDialogHeader>
            <AlertDialogTitle className='text-2xl font-black uppercase'>
              Удалить аккаунт навсегда?
            </AlertDialogTitle>
            <AlertDialogDescription className='font-bold text-black'>
              Все ваши сериалы, оценки, комментарии и прогресс будут удалены
              безвозвратно. Если вы владелец семьи с другими участниками,
              сначала передайте владение — иначе удаление будет заблокировано.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className='mt-4 grid gap-2'>
            <Input
              className='border-2 border-black bg-white font-bold'
              placeholder='Ваш пароль'
              type='password'
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            {error ? (
              <p className='border-2 border-red-600 bg-white p-2 text-sm font-black text-red-700'>
                {error}
              </p>
            ) : undefined}
          </div>

          <AlertDialogFooter className='mt-4 gap-4'>
            <AlertDialogCancel className='border-2 border-black bg-yellow-400 font-black text-black hover:bg-yellow-500'>
              Отмена
            </AlertDialogCancel>
            <AlertDialogAction
              className='border-2 border-black bg-red-500 font-black text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60'
              disabled={isPending || password.length === 0}
              onClick={(event) => {
                event.preventDefault();
                void handleDelete();
              }}
            >
              {isPending ? 'Удаляем...' : 'Да, удалить навсегда'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
