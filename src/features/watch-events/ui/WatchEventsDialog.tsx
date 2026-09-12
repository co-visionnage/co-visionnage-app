'use client';

import { CalendarPlus, Check, HelpCircle, Trash2, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  createWatchEventAction,
  deleteWatchEventAction,
  setWatchEventRsvpAction,
} from '@/shared/actions/watch-events-postgres';
import { createClient } from '@/shared/api/postgres/client';
import { useAppSounds } from '@/shared/hooks';
import { RsvpStatus, Series, WatchEvent } from '@/shared/types';
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/ui/lib';

interface WatchEventsDialogProperties {
  familyId: string;
  currentUserId: string;
  toWatchSeries: Series[];
}

const RSVP_LABELS: Record<RsvpStatus, string> = {
  going: 'Иду',
  maybe: 'Может быть',
  no: 'Не иду',
};

function formatWhen(scheduledAt: string) {
  return new Date(scheduledAt).toLocaleString('ru-RU', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export const WatchEventsDialog = ({
  familyId,
  currentUserId,
  toWatchSeries,
}: WatchEventsDialogProperties) => {
  const client = useMemo(() => createClient(), []);
  const { playClick } = useAppSounds();
  const [isOpen, setIsOpen] = useState(false);
  const [events, setEvents] = useState<WatchEvent[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>();

  const [title, setTitle] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [seriesId, setSeriesId] = useState<string>('none');

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(undefined);

    try {
      const { events: next } = await client.getFamilyWatchEvents(familyId);
      setEvents(next);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Не удалось загрузить встречи',
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

  const handleCreate = async () => {
    playClick();
    const result = await createWatchEventAction(
      familyId,
      title,
      scheduledAt,
      seriesId === 'none' ? undefined : seriesId,
    );

    if (result.error) {
      setError(result.error);
    } else {
      setTitle('');
      setScheduledAt('');
      setSeriesId('none');
      await load();
    }
  };

  const handleDelete = async (eventId: string) => {
    playClick();
    const result = await deleteWatchEventAction(eventId);
    if (result.error) setError(result.error);
    else await load();
  };

  const handleRsvp = async (eventId: string, status: RsvpStatus) => {
    playClick();
    const result = await setWatchEventRsvpAction(eventId, status);
    if (result.error) setError(result.error);
    else await load();
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          className='border-4 border-black bg-cyan-300 px-4 py-3 font-black text-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]'
          onClick={() => playClick()}
        >
          <CalendarPlus className='mr-2 h-4 w-4' />
          СОВМЕСТНЫЙ ПРОСМОТР
        </Button>
      </DialogTrigger>
      <DialogContent className='max-w-lg border-4 border-black bg-yellow-300 [&>button]:top-4 [&>button]:right-4 [&>button]:rounded-none [&>button]:border-2 [&>button]:border-black [&>button]:bg-white [&>button]:opacity-100 [&>button]:hover:bg-red-500'>
        <DialogHeader>
          <DialogTitle className='brutal-font text-2xl font-black text-black uppercase'>
            Совместный просмотр
          </DialogTitle>
        </DialogHeader>

        {isLoading ? <p className='font-black'>Загружаем...</p> : undefined}
        {error ? (
          <p className='border-2 border-red-600 bg-white p-3 font-black text-red-700'>
            {error}
          </p>
        ) : undefined}

        <div className='grid max-h-72 gap-3 overflow-y-auto'>
          {events.map((event) => (
            <div
              key={event.id}
              className='border-2 border-black bg-white p-3 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
            >
              <div className='flex items-start justify-between gap-2'>
                <div>
                  <p className='font-black text-black'>
                    {event.title}
                    {event.seriesTitle ? ` · ${event.seriesTitle}` : ''}
                  </p>
                  <p className='text-xs font-bold text-gray-500'>
                    {formatWhen(event.scheduledAt)}
                  </p>
                </div>
                {event.createdBy === currentUserId ? (
                  <button
                    className='shrink-0 text-red-600 hover:text-red-800'
                    type='button'
                    onClick={() => void handleDelete(event.id)}
                  >
                    <Trash2 className='h-3.5 w-3.5' />
                  </button>
                ) : undefined}
              </div>

              <div className='mt-2 flex flex-wrap gap-1'>
                {(['going', 'maybe', 'no'] as const).map((status) => (
                  <button
                    key={status}
                    className={`flex items-center gap-1 border-2 border-black px-2 py-1 text-xs font-black transition-all ${
                      event.myRsvp === status
                        ? 'bg-lime-400 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
                        : 'bg-white hover:bg-gray-100'
                    }`}
                    type='button'
                    onClick={() => void handleRsvp(event.id, status)}
                  >
                    {status === 'going' ? (
                      <Check className='h-3 w-3' />
                    ) : status === 'no' ? (
                      <X className='h-3 w-3' />
                    ) : (
                      <HelpCircle className='h-3 w-3' />
                    )}
                    {RSVP_LABELS[status]} (
                    {
                      event.rsvps.filter((rsvp) => rsvp.status === status)
                        .length
                    }
                    )
                  </button>
                ))}
              </div>
            </div>
          ))}
          {!isLoading && events.length === 0 ? (
            <p className='font-bold text-black/60'>
              Пока ничего не запланировано.
            </p>
          ) : undefined}
        </div>

        <div className='grid gap-2 border-t-4 border-dashed border-black pt-4'>
          <Input
            className='border-2 border-black bg-white font-bold'
            placeholder='Название встречи'
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
          <Input
            className='border-2 border-black bg-white font-bold'
            type='datetime-local'
            value={scheduledAt}
            onChange={(event) => setScheduledAt(event.target.value)}
          />
          <Select value={seriesId} onValueChange={setSeriesId}>
            <SelectTrigger className='border-2 border-black bg-white font-bold'>
              <SelectValue />
            </SelectTrigger>
            <SelectContent className='border-2 border-black bg-pink-300 font-bold'>
              <SelectItem value='none'>Без привязки к сериалу</SelectItem>
              {toWatchSeries.map((series) => (
                <SelectItem key={series.id} value={series.id}>
                  {series.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            className='border-2 border-black bg-lime-400 font-black text-black hover:bg-lime-500 disabled:cursor-not-allowed disabled:opacity-60'
            disabled={!title.trim() || !scheduledAt}
            onClick={() => void handleCreate()}
          >
            Запланировать
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
