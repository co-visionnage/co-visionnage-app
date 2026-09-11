'use client';

import { CalendarDays } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { createClient } from '@/shared/api/postgres/client';
import { useAppSounds } from '@/shared/hooks';
import { WatchHistoryEntry } from '@/shared/types';
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/shared/ui/lib';

const MONTH_LABELS = [
  'Январь',
  'Февраль',
  'Март',
  'Апрель',
  'Май',
  'Июнь',
  'Июль',
  'Август',
  'Сентябрь',
  'Октябрь',
  'Ноябрь',
  'Декабрь',
];

function groupByMonth(entries: WatchHistoryEntry[]) {
  const groups = new Map<string, WatchHistoryEntry[]>();

  for (const entry of entries) {
    const date = new Date(entry.watchedAt);
    const key = `${date.getFullYear()}-${MONTH_LABELS[date.getMonth()]}`;
    const bucket = groups.get(key) ?? [];
    bucket.push(entry);
    groups.set(key, bucket);
  }

  return [...groups.entries()];
}

interface WatchHistoryDialogProperties {
  familyId: string;
}

export const WatchHistoryDialog = ({
  familyId,
}: WatchHistoryDialogProperties) => {
  const client = useMemo(() => createClient(), []);
  const { playClick } = useAppSounds();
  const [isOpen, setIsOpen] = useState(false);
  const [history, setHistory] = useState<WatchHistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const { history: next } = await client.getWatchHistory(familyId);
      setHistory(next);
    } finally {
      setIsLoading(false);
    }
  }, [client, familyId]);

  useEffect(() => {
    if (isOpen) {
      void load();
    }
  }, [isOpen, load]);

  const groups = groupByMonth(history);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          className='border-4 border-black bg-white px-4 py-3 font-black text-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]'
          onClick={() => playClick()}
        >
          <CalendarDays className='mr-2 h-4 w-4' />
          ИСТОРИЯ
        </Button>
      </DialogTrigger>
      <DialogContent className='max-w-lg border-4 border-black bg-yellow-300 [&>button]:top-4 [&>button]:right-4 [&>button]:rounded-none [&>button]:border-2 [&>button]:border-black [&>button]:bg-white [&>button]:opacity-100 [&>button]:hover:bg-red-500'>
        <DialogHeader>
          <DialogTitle className='brutal-font text-2xl font-black text-black uppercase'>
            История просмотров
          </DialogTitle>
        </DialogHeader>

        {isLoading ? <p className='font-black'>Загружаем...</p> : undefined}

        <div className='grid max-h-[28rem] gap-4 overflow-y-auto'>
          {groups.map(([monthKey, entries]) => (
            <div key={monthKey}>
              <p className='mb-2 border-b-2 border-black pb-1 text-sm font-black text-black uppercase'>
                {monthKey.split('-')[1]} {monthKey.split('-')[0]}
              </p>
              <div className='grid gap-2'>
                {entries.map((entry, index) => (
                  <div
                    key={`${entry.seriesId}-${entry.watchedAt}-${index}`}
                    className='flex items-center justify-between gap-3 border-2 border-black bg-white p-2 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
                  >
                    <div className='min-w-0'>
                      <p className='truncate font-black text-black'>
                        {entry.title}
                      </p>
                      <p className='text-xs font-bold text-gray-500'>
                        {entry.watchedBy}
                        {entry.rating ? ` · ⭐ ${entry.rating}/5` : ''}
                      </p>
                    </div>
                    <span className='shrink-0 text-xs font-bold text-gray-400'>
                      {new Date(entry.watchedAt).toLocaleDateString('ru-RU', {
                        day: 'numeric',
                        month: 'short',
                      })}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {!isLoading && groups.length === 0 ? (
            <p className='font-bold text-black/60'>
              Пока ничего не посмотрено вместе.
            </p>
          ) : undefined}
        </div>
      </DialogContent>
    </Dialog>
  );
};
