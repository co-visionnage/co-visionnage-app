'use client';

import { BarChart3 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { createClient } from '@/shared/api/postgres/client';
import { useAppSounds } from '@/shared/hooks';
import { FamilyStats } from '@/shared/types';
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/shared/ui/lib';

const MONTH_LABELS: Record<string, string> = {
  '01': 'Янв',
  '02': 'Фев',
  '03': 'Мар',
  '04': 'Апр',
  '05': 'Май',
  '06': 'Июн',
  '07': 'Июл',
  '08': 'Авг',
  '09': 'Сен',
  '10': 'Окт',
  '11': 'Ноя',
  '12': 'Дек',
};

function formatMonth(month: string): string {
  const [, monthNumber] = month.split('-');
  return MONTH_LABELS[monthNumber] ?? month;
}

interface FamilyStatsDialogProperties {
  familyId: string;
}

export const FamilyStatsDialog = ({
  familyId,
}: FamilyStatsDialogProperties) => {
  const client = useMemo(() => createClient(), []);
  const { playClick } = useAppSounds();
  const [isOpen, setIsOpen] = useState(false);
  const [stats, setStats] = useState<FamilyStats>();
  const [isLoading, setIsLoading] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const { stats: nextStats } = await client.getFamilyStats(familyId);
      setStats(nextStats);
    } finally {
      setIsLoading(false);
    }
  }, [client, familyId]);

  useEffect(() => {
    if (isOpen) {
      void load();
    }
  }, [isOpen, load]);

  const maxMonthlyHours = Math.max(
    1,
    ...(stats?.byMonth.map((m) => m.hours) ?? [1]),
  );

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          className='border-4 border-black bg-white px-4 py-3 font-black text-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]'
          onClick={() => playClick()}
        >
          <BarChart3 className='mr-2 h-4 w-4' />
          СТАТИСТИКА
        </Button>
      </DialogTrigger>
      <DialogContent className='max-w-lg border-4 border-black bg-yellow-300 [&>button]:top-4 [&>button]:right-4 [&>button]:rounded-none [&>button]:border-2 [&>button]:border-black [&>button]:bg-white [&>button]:opacity-100 [&>button]:hover:bg-red-500'>
        <DialogHeader>
          <DialogTitle className='brutal-font text-2xl font-black text-black uppercase'>
            Статистика семьи
          </DialogTitle>
        </DialogHeader>

        {isLoading || !stats ? (
          <p className='font-black'>Считаем...</p>
        ) : (
          <div className='grid gap-4'>
            <div className='grid grid-cols-2 gap-3'>
              <div className='border-4 border-black bg-white p-4 text-center shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]'>
                <p className='text-3xl font-black text-black'>
                  {stats.totalHoursWatched}
                </p>
                <p className='text-xs font-black text-gray-500 uppercase'>
                  часов просмотрено
                </p>
              </div>
              <div className='border-4 border-black bg-white p-4 text-center shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]'>
                <p className='text-3xl font-black text-black'>
                  {stats.totalWatchedSeries}
                </p>
                <p className='text-xs font-black text-gray-500 uppercase'>
                  сериалов посмотрено
                </p>
              </div>
            </div>

            {stats.byMonth.length > 0 ? (
              <div className='border-4 border-black bg-white p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]'>
                <p className='mb-2 text-xs font-black text-gray-500 uppercase'>
                  Часы по месяцам
                </p>
                <div className='flex items-end gap-3'>
                  {stats.byMonth.map((entry) => (
                    <div
                      key={entry.month}
                      className='flex flex-1 flex-col items-center gap-1'
                    >
                      <div
                        className='w-full border-2 border-black bg-lime-400'
                        style={{
                          height: `${Math.max(6, (entry.hours / maxMonthlyHours) * 80)}px`,
                        }}
                      />
                      <span className='text-[10px] font-black text-black'>
                        {formatMonth(entry.month)}
                      </span>
                      <span className='text-[10px] font-bold text-gray-500'>
                        {entry.hours}ч
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : undefined}

            {stats.topGenres.length > 0 ? (
              <div className='border-4 border-black bg-white p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]'>
                <p className='mb-2 text-xs font-black text-gray-500 uppercase'>
                  Любимые жанры
                </p>
                <div className='flex flex-wrap gap-2'>
                  {stats.topGenres.map((genre) => (
                    <span
                      key={genre.genre}
                      className='border-2 border-black bg-pink-300 px-2 py-1 text-xs font-black text-black uppercase'
                    >
                      {genre.genre} · {genre.count}
                    </span>
                  ))}
                </div>
              </div>
            ) : undefined}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
