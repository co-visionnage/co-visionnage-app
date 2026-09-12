'use client';

import { RefreshCw, Share2 } from 'lucide-react';
import { useState } from 'react';

import { SeriesPoster } from '@/entities/series';
import { EpisodeProgressControl, SeriesDiscussionDialog } from '@/features';
import { checkSeriesUpdatesAction } from '@/shared/actions/season-tracking-postgres';
import { useAppSounds } from '@/shared/hooks';
import { Series } from '@/shared/types';
import { Badge, Button } from '@/shared/ui/lib';

interface SeriesDetailViewProperties {
  familyId: string;
  series: Series;
}

export const SeriesDetailView = ({ series }: SeriesDetailViewProperties) => {
  const { playClick } = useAppSounds();
  const [isCopied, setIsCopied] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [checkMessage, setCheckMessage] = useState<string | null>();

  const handleShare = async () => {
    playClick();
    await navigator.clipboard.writeText(globalThis.location.href);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleCheckUpdates = async () => {
    playClick();
    setIsChecking(true);
    setCheckMessage(undefined);

    const result = await checkSeriesUpdatesAction(series.id);

    if (result.error) {
      setCheckMessage(result.error);
    } else if (result.updated) {
      setCheckMessage(`Нашли новый сезон! Теперь ${result.newTotalSeasons}.`);
    } else {
      setCheckMessage('Новых сезонов пока нет.');
    }

    setIsChecking(false);
  };

  return (
    <div className='-rotate-1 border-4 border-black bg-white shadow-[10px_10px_0px_0px_rgba(0,0,0,1)]'>
      <div className='relative h-64 w-full border-b-4 border-black'>
        <SeriesPoster
          src={series.image_url ?? undefined}
          title={series.title}
        />
      </div>

      <div className='space-y-4 p-6'>
        <div className='flex items-start justify-between gap-3'>
          <h1 className='text-3xl font-black text-black uppercase'>
            {series.title}
          </h1>
          <Button
            className='shrink-0 border-2 border-black bg-cyan-300 px-3 py-2 font-black text-black hover:bg-cyan-400'
            onClick={() => void handleShare()}
          >
            <Share2 className='mr-2 h-4 w-4' />
            {isCopied ? 'Скопировано!' : 'Поделиться'}
          </Button>
        </div>

        <div className='flex flex-wrap items-center gap-2'>
          <Badge className='border-2 border-black bg-purple-300 font-bold text-black'>
            {series.mediaType === 'movie' ? 'ФИЛЬМ' : 'СЕРИАЛ'}
          </Badge>
          <Badge className='border-2 border-black bg-yellow-300 font-bold text-black'>
            {series.year}
          </Badge>
          {series.genres.map((genre) => (
            <Badge
              key={genre}
              className='border-2 border-black bg-black font-bold text-lime-300'
            >
              {genre.toUpperCase()}
            </Badge>
          ))}
          {series.rating ? (
            <Badge className='border-2 border-black bg-orange-300 font-bold text-black'>
              ⭐ {series.rating}/5
            </Badge>
          ) : undefined}
        </div>

        {series.comment ? (
          <div className='border-2 border-black bg-lime-100 p-3'>
            <p className='mb-1 text-[10px] font-black text-gray-500 uppercase'>
              Ваш отзыв
            </p>
            <p className='font-bold text-black'>{series.comment}</p>
          </div>
        ) : undefined}

        {series.mediaType === 'movie' ? undefined : (
          <EpisodeProgressControl series={series} />
        )}

        {series.mediaType === 'series' && series.externalId ? (
          <div className='border-2 border-black bg-purple-100 p-3'>
            <Button
              className='w-full border-2 border-black bg-white font-black text-black hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60'
              disabled={isChecking}
              onClick={() => void handleCheckUpdates()}
            >
              <RefreshCw
                className={`mr-2 h-4 w-4 ${isChecking ? 'animate-spin' : ''}`}
              />
              {isChecking ? 'Проверяем...' : 'Проверить новые сезоны'}
            </Button>
            {checkMessage ? (
              <p className='mt-2 text-center text-sm font-bold text-black'>
                {checkMessage}
              </p>
            ) : undefined}
          </div>
        ) : undefined}
        <SeriesDiscussionDialog
          seriesId={series.id}
          seriesTitle={series.title}
        />
      </div>
    </div>
  );
};
