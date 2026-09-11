'use client';

import { Vote } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  closeWatchPollAction,
  createWatchPollAction,
  voteWatchPollAction,
} from '@/shared/actions/voting-postgres';
import { createClient } from '@/shared/api/postgres/client';
import { useAppSounds } from '@/shared/hooks';
import { Series, WatchPoll } from '@/shared/types';
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/shared/ui/lib';

interface WatchPollDialogProperties {
  familyId: string;
  toWatchSeries: Series[];
}

export const WatchPollDialog = ({
  familyId,
  toWatchSeries,
}: WatchPollDialogProperties) => {
  const client = useMemo(() => createClient(), []);
  const { playClick } = useAppSounds();
  const [isOpen, setIsOpen] = useState(false);
  const [polls, setPolls] = useState<WatchPoll[]>([]);
  const [selectedSeriesIds, setSelectedSeriesIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>();

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(undefined);

    try {
      const { polls: nextPolls } = await client.getFamilyWatchPolls(familyId);
      setPolls(nextPolls);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Не удалось загрузить голосования',
      );
    } finally {
      setIsLoading(false);
    }
  }, [client, familyId]);

  useEffect(() => {
    if (isOpen) {
      void load();
    }
  }, [isOpen, load]);

  const toggleSeries = (seriesId: string) => {
    setSelectedSeriesIds((previous) =>
      previous.includes(seriesId)
        ? previous.filter((id) => id !== seriesId)
        : [...previous, seriesId],
    );
  };

  const handleCreatePoll = async () => {
    playClick();
    const result = await createWatchPollAction(familyId, selectedSeriesIds, '');

    if (result.error) {
      setError(result.error);
    } else {
      setSelectedSeriesIds([]);
      await load();
    }
  };

  const handleVote = async (pollId: string, optionId: string) => {
    playClick();
    const result = await voteWatchPollAction(pollId, optionId);
    if (result.error) setError(result.error);
    else await load();
  };

  const handleClose = async (pollId: string) => {
    playClick();
    const result = await closeWatchPollAction(pollId);
    if (result.error) setError(result.error);
    else await load();
  };

  const openPoll = polls.find((poll) => poll.isOpen);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          className='border-4 border-black bg-white px-4 py-3 font-black text-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]'
          onClick={() => playClick()}
        >
          <Vote className='mr-2 h-4 w-4' />
          ЧТО СМОТРИМ?
        </Button>
      </DialogTrigger>
      <DialogContent className='max-w-lg border-4 border-black bg-yellow-300 [&>button]:top-4 [&>button]:right-4 [&>button]:rounded-none [&>button]:border-2 [&>button]:border-black [&>button]:bg-white [&>button]:opacity-100 [&>button]:hover:bg-red-500'>
        <DialogHeader>
          <DialogTitle className='brutal-font text-2xl font-black text-black uppercase'>
            Что смотрим сегодня?
          </DialogTitle>
        </DialogHeader>

        {isLoading ? <p className='font-black'>Загружаем...</p> : undefined}
        {error ? (
          <p className='border-2 border-red-600 bg-white p-3 font-black text-red-700'>
            {error}
          </p>
        ) : undefined}

        {openPoll ? (
          <div className='grid gap-3'>
            <div className='grid gap-2'>
              {openPoll.options
                .toSorted((a, b) => b.votes - a.votes)
                .map((option) => (
                  <button
                    key={option.id}
                    className={`flex items-center justify-between border-2 border-black p-3 text-left font-black transition-all ${
                      option.votedByMe
                        ? 'bg-lime-400 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]'
                        : 'bg-white hover:bg-gray-100'
                    }`}
                    type='button'
                    onClick={() => void handleVote(openPoll.id, option.id)}
                  >
                    <span>{option.title}</span>
                    <span className='border-2 border-black bg-black px-2 py-1 text-xs text-white'>
                      {option.votes}
                    </span>
                  </button>
                ))}
            </div>
            <Button
              className='border-2 border-black bg-red-500 font-black text-white hover:bg-red-600'
              onClick={() => void handleClose(openPoll.id)}
            >
              Завершить голосование
            </Button>
          </div>
        ) : (
          <div className='grid gap-3'>
            <p className='font-bold text-black'>
              Выбери минимум два сериала из списка «хотим посмотреть»:
            </p>
            <div className='grid max-h-48 gap-2 overflow-y-auto'>
              {toWatchSeries.map((series) => (
                <label
                  key={series.id}
                  className='flex cursor-pointer items-center gap-2 border-2 border-black bg-white p-2 font-bold text-black'
                >
                  <input
                    checked={selectedSeriesIds.includes(series.id)}
                    type='checkbox'
                    onChange={() => toggleSeries(series.id)}
                  />
                  {series.title}
                </label>
              ))}
              {toWatchSeries.length === 0 ? (
                <p className='font-bold text-black/60'>
                  В списке «хотим посмотреть» пока пусто.
                </p>
              ) : undefined}
            </div>
            <Button
              className='border-2 border-black bg-lime-400 font-black text-black hover:bg-lime-500 disabled:cursor-not-allowed disabled:opacity-60'
              disabled={selectedSeriesIds.length < 2}
              onClick={() => void handleCreatePoll()}
            >
              Начать голосование
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
