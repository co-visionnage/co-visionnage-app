'use client';

import { CalendarDays, RefreshCw } from 'lucide-react';
import { useState } from 'react';

import { checkNextEpisodeAction } from '@/shared/actions/season-tracking-postgres';
import { useAppSounds } from '@/shared/hooks';
import { Series } from '@/shared/types';
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/shared/ui/lib';

interface EpisodeCalendarDialogProperties {
  series: Series[];
  onRefresh: () => void | Promise<void>;
}

function isImdbLinked(item: Series) {
  return (
    !!item.externalId &&
    (item.externalSource === 'omdb' || item.externalSource === 'imdb-csv')
  );
}

export const EpisodeCalendarDialog = ({
  series,
  onRefresh,
}: EpisodeCalendarDialogProperties) => {
  const { playClick } = useAppSounds();
  const [isOpen, setIsOpen] = useState(false);
  const [checkingId, setCheckingId] = useState<string | undefined>();
  const [error, setError] = useState<string | null>();

  const upcoming = series
    .filter((item) => item.nextEpisodeAirDate)
    .toSorted(
      (a, b) =>
        new Date(a.nextEpisodeAirDate!).getTime() -
        new Date(b.nextEpisodeAirDate!).getTime(),
    );

  const checkable = series.filter(
    (item) => isImdbLinked(item) && !item.nextEpisodeAirDate,
  );

  const handleCheck = async (seriesId: string) => {
    playClick();
    setCheckingId(seriesId);
    setError(undefined);

    const result = await checkNextEpisodeAction(seriesId);
    if (result.error) {
      setError(result.error);
    } else {
      await onRefresh();
    }

    setCheckingId(undefined);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          className='border-4 border-black bg-lime-300 px-4 py-3 font-black text-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]'
          onClick={() => playClick()}
        >
          <CalendarDays className='mr-2 h-4 w-4' />
          КАЛЕНДАРЬ ЭПИЗОДОВ
        </Button>
      </DialogTrigger>
      <DialogContent className='max-w-lg border-4 border-black bg-lime-200 [&>button]:top-4 [&>button]:right-4 [&>button]:rounded-none [&>button]:border-2 [&>button]:border-black [&>button]:bg-white [&>button]:opacity-100 [&>button]:hover:bg-red-500'>
        <DialogHeader>
          <DialogTitle className='brutal-font text-2xl font-black text-black uppercase'>
            Даты выхода эпизодов
          </DialogTitle>
        </DialogHeader>

        {error ? (
          <p className='border-2 border-red-600 bg-white p-2 text-xs font-black text-red-700'>
            {error}
          </p>
        ) : undefined}

        <div className='grid max-h-56 gap-2 overflow-y-auto'>
          {upcoming.map((item) => (
            <div
              key={item.id}
              className='flex items-center justify-between gap-3 border-2 border-black bg-white p-2 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
            >
              <p className='min-w-0 truncate font-bold text-black'>
                {item.title}{' '}
                <span className='text-purple-600'>{item.nextEpisodeLabel}</span>
              </p>
              <span className='shrink-0 text-xs font-bold text-gray-500'>
                {new Date(item.nextEpisodeAirDate!).toLocaleDateString(
                  'ru-RU',
                  { day: 'numeric', month: 'short' },
                )}
              </span>
            </div>
          ))}
          {upcoming.length === 0 ? (
            <p className='font-bold text-black/60'>
              Пока нет известных дат выхода.
            </p>
          ) : undefined}
        </div>

        {checkable.length > 0 ? (
          <div className='grid gap-2 border-t-4 border-dashed border-black pt-3'>
            <p className='text-xs font-bold text-black/70'>
              Можно проверить дату для (импортированы с IMDb-идентификатором):
            </p>
            {checkable.map((item) => (
              <Button
                key={item.id}
                className='justify-start border-2 border-black bg-white text-left text-xs font-bold text-black hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60'
                disabled={checkingId === item.id}
                onClick={() => void handleCheck(item.id)}
              >
                <RefreshCw
                  className={`mr-2 h-3.5 w-3.5 ${checkingId === item.id ? 'animate-spin' : ''}`}
                />
                {item.title}
              </Button>
            ))}
          </div>
        ) : undefined}
      </DialogContent>
    </Dialog>
  );
};
