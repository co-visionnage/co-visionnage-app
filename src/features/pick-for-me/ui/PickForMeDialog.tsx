'use client';

import { Dices } from 'lucide-react';
import { useState } from 'react';
import confetti from 'canvas-confetti';

import { useAppSounds, useUiPreferences } from '@/shared/hooks';
import { Series } from '@/shared/types';
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/shared/ui/lib';

interface PickForMeDialogProperties {
  toWatchSeries: Series[];
}

const SPIN_STEPS = 16;
const SPIN_INTERVAL_MS = 90;

export const PickForMeDialog = ({
  toWatchSeries,
}: PickForMeDialogProperties) => {
  const { playClick, playSuccess } = useAppSounds();
  const { preferences } = useUiPreferences();
  const [isOpen, setIsOpen] = useState(false);
  const [isSpinning, setIsSpinning] = useState(false);
  const [shownSeries, setShownSeries] = useState<Series | undefined>();

  const spin = () => {
    if (toWatchSeries.length === 0 || isSpinning) return;

    playClick();
    setIsSpinning(true);
    setShownSeries(undefined);

    let step = 0;
    const tick = () => {
      step += 1;
      const candidate =
        toWatchSeries[Math.floor(Math.random() * toWatchSeries.length)];

      if (step >= SPIN_STEPS) {
        setShownSeries(candidate);
        setIsSpinning(false);
        playSuccess();

        if (preferences.confettiEnabled) {
          confetti({
            angle: 90,
            origin: { y: 0.5 },
            particleCount: 100,
            spread: 80,
            startVelocity: 35,
            colors: ['#ff4d6d', '#facc15', '#4ade80', '#38bdf8', '#ffffff'],
          });
        }
        return;
      }

      setShownSeries(candidate);
      globalThis.setTimeout(tick, SPIN_INTERVAL_MS + step * 8);
    };

    tick();
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(next) => {
        setIsOpen(next);
        if (!next) {
          setShownSeries(undefined);
          setIsSpinning(false);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button
          className='border-4 border-black bg-purple-400 px-4 py-3 font-black text-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]'
          onClick={() => playClick()}
        >
          <Dices className='mr-2 h-4 w-4' />
          ВЫБЕРИ ЗА МЕНЯ
        </Button>
      </DialogTrigger>
      <DialogContent className='max-w-md border-4 border-black bg-purple-300 [&>button]:top-4 [&>button]:right-4 [&>button]:rounded-none [&>button]:border-2 [&>button]:border-black [&>button]:bg-white [&>button]:opacity-100 [&>button]:hover:bg-red-500'>
        <DialogHeader>
          <DialogTitle className='brutal-font text-center text-2xl font-black text-black uppercase'>
            Что смотрим?
          </DialogTitle>
        </DialogHeader>

        {toWatchSeries.length === 0 ? (
          <p className='text-center font-bold text-black/70'>
            Список «Хотим посмотреть» пуст — сначала добавьте что-нибудь.
          </p>
        ) : (
          <div className='grid gap-4'>
            <div
              className={`min-h-24 border-4 border-black bg-white p-6 text-center shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] transition-transform ${
                isSpinning ? 'scale-95' : 'scale-100'
              }`}
            >
              {shownSeries ? (
                <>
                  <p className='text-2xl font-black text-black uppercase'>
                    {shownSeries.title}
                  </p>
                  {!isSpinning && (
                    <p className='mt-1 text-sm font-bold text-gray-500'>
                      {shownSeries.year}
                      {shownSeries.genres.length > 0
                        ? ` · ${shownSeries.genres.join(', ')}`
                        : ''}
                    </p>
                  )}
                </>
              ) : (
                <p className='font-bold text-black/50 uppercase'>
                  Жми и узнай!
                </p>
              )}
            </div>

            <Button
              className='w-full border-4 border-black bg-yellow-400 py-6 text-xl font-black text-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] transition-all hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none disabled:cursor-not-allowed disabled:opacity-60'
              disabled={isSpinning}
              onClick={spin}
            >
              <Dices className='mr-2 h-5 w-5' />
              {isSpinning
                ? 'Крутим...'
                : shownSeries
                  ? 'Ещё раз'
                  : 'Выбрать случайно'}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
