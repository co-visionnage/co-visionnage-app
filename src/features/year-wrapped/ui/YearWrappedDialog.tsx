'use client';

import { Download, Sparkles } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { createClient } from '@/shared/api/postgres/client';
import { useAppSounds } from '@/shared/hooks';
import { YearWrapped } from '@/shared/types';
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/shared/ui/lib';

const CANVAS_WIDTH = 1080;
const CANVAS_HEIGHT = 1350;

function drawWrappedCard(
  canvas: HTMLCanvasElement,
  wrapped: YearWrapped,
  familyName: string,
) {
  const context = canvas.getContext('2d');
  if (!context) return;

  const gradient = context.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
  gradient.addColorStop(0, '#3b82f6');
  gradient.addColorStop(1, '#a855f7');
  context.fillStyle = gradient;
  context.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  context.fillStyle = '#facc15';
  context.font = '900 64px sans-serif';
  context.textAlign = 'center';
  context.fillText(`ИТОГИ ${wrapped.year}`, CANVAS_WIDTH / 2, 180);

  context.fillStyle = '#ffffff';
  context.font = '700 40px sans-serif';
  context.fillText(familyName, CANVAS_WIDTH / 2, 250);

  const stats: [string, string][] = [
    [String(wrapped.totalHoursWatched), 'часов посмотрели'],
    [String(wrapped.totalWatchedCount), 'сериалов и фильмов'],
  ];

  let y = 450;
  for (const [value, label] of stats) {
    context.fillStyle = '#ffffff';
    context.font = '900 140px sans-serif';
    context.fillText(value, CANVAS_WIDTH / 2, y);

    context.font = '700 36px sans-serif';
    context.fillStyle = '#e0e7ff';
    context.fillText(label.toUpperCase(), CANVAS_WIDTH / 2, y + 60);

    y += 260;
  }

  if (wrapped.topGenre) {
    context.fillStyle = '#facc15';
    context.font = '700 36px sans-serif';
    context.fillText(
      `Любимый жанр: ${wrapped.topGenre.toUpperCase()}`,
      CANVAS_WIDTH / 2,
      y + 30,
    );
    y += 90;
  }

  if (wrapped.topRatedTitle) {
    context.fillStyle = '#facc15';
    context.font = '700 32px sans-serif';
    context.fillText(
      `Топ по оценке: ${wrapped.topRatedTitle}`,
      CANVAS_WIDTH / 2,
      y + 30,
    );
  }

  context.fillStyle = '#ffffff';
  context.font = '700 32px sans-serif';
  context.fillText('notre-cinema', CANVAS_WIDTH / 2, CANVAS_HEIGHT - 60);
}

interface YearWrappedDialogProperties {
  familyId: string;
  familyName: string;
}

export const YearWrappedDialog = ({
  familyId,
  familyName,
}: YearWrappedDialogProperties) => {
  const client = useMemo(() => createClient(), []);
  const { playClick } = useAppSounds();
  const [isOpen, setIsOpen] = useState(false);
  const [wrapped, setWrapped] = useState<YearWrapped>();
  const [isLoading, setIsLoading] = useState(false);
  const canvasReference = useRef<HTMLCanvasElement>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const { wrapped: data } = await client.getYearWrapped(
        familyId,
        new Date().getFullYear(),
      );
      setWrapped(data);
    } finally {
      setIsLoading(false);
    }
  }, [client, familyId]);

  useEffect(() => {
    if (isOpen) {
      void load();
    }
  }, [isOpen, load]);

  useEffect(() => {
    if (wrapped && canvasReference.current) {
      drawWrappedCard(canvasReference.current, wrapped, familyName);
    }
  }, [wrapped, familyName]);

  const handleDownload = () => {
    playClick();
    const canvas = canvasReference.current;
    if (!canvas) return;

    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `notre-cinema-${wrapped?.year ?? new Date().getFullYear()}.png`;
      link.click();
      URL.revokeObjectURL(url);
    }, 'image/png');
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          className='border-4 border-black bg-white px-4 py-3 font-black text-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]'
          onClick={() => playClick()}
        >
          <Sparkles className='mr-2 h-4 w-4' />
          ИТОГИ ГОДА
        </Button>
      </DialogTrigger>
      <DialogContent className='max-w-md border-4 border-black bg-yellow-300 [&>button]:top-4 [&>button]:right-4 [&>button]:rounded-none [&>button]:border-2 [&>button]:border-black [&>button]:bg-white [&>button]:opacity-100 [&>button]:hover:bg-red-500'>
        <DialogHeader>
          <DialogTitle className='brutal-font text-2xl font-black text-black uppercase'>
            Итоги года
          </DialogTitle>
        </DialogHeader>

        {isLoading ? <p className='font-black'>Считаем...</p> : undefined}

        <canvas
          ref={canvasReference}
          className='w-full border-2 border-black'
          height={CANVAS_HEIGHT}
          width={CANVAS_WIDTH}
        />

        <Button
          className='w-full border-2 border-black bg-lime-400 font-black text-black hover:bg-lime-500 disabled:cursor-not-allowed disabled:opacity-60'
          disabled={!wrapped}
          onClick={handleDownload}
        >
          <Download className='mr-2 h-4 w-4' />
          Скачать картинку
        </Button>
      </DialogContent>
    </Dialog>
  );
};
