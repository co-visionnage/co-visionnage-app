'use client';

import { Minus, Plus } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { setSeriesProgressAction } from '@/shared/actions/progress-postgres';
import { createClient } from '@/shared/api/postgres/client';
import { useAppSounds } from '@/shared/hooks';
import { Series, SeriesProgress } from '@/shared/types';

interface EpisodeProgressControlProperties {
  series: Series;
}

export const EpisodeProgressControl = ({
  series,
}: EpisodeProgressControlProperties) => {
  const client = useMemo(() => createClient(), []);
  const { playClick } = useAppSounds();
  const [mine, setMine] = useState<SeriesProgress | undefined>();
  const [others, setOthers] = useState<SeriesProgress[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const { progress } = await client.getSeriesProgress(series.id);
      setMine(progress.find((entry) => entry.isMine));
      setOthers(progress.filter((entry) => !entry.isMine));
    } catch {
      // best-effort widget — silently keep previous state on failure
    }
  }, [client, series.id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetches progress from the server on mount, not derived from render state
    void load();
  }, [load]);

  const season = mine?.currentSeason ?? 1;
  const episode = mine?.currentEpisode ?? 0;

  const save = async (nextSeason: number, nextEpisode: number) => {
    playClick();
    setIsSaving(true);
    await setSeriesProgressAction(series.id, nextSeason, nextEpisode);
    await load();
    setIsSaving(false);
  };

  const changeEpisode = (delta: number) => {
    const nextEpisode = episode + delta;

    if (nextEpisode < 0) return;
    if (series.totalEpisodes && nextEpisode > series.totalEpisodes) return;

    void save(season, nextEpisode);
  };

  return (
    <div className='border-2 border-black bg-white p-2'>
      <div className='flex items-center justify-between gap-2'>
        <span className='text-[10px] font-black text-gray-500 uppercase'>
          Прогресс{series.totalSeasons ? ` · сезон ${season}` : ''}
        </span>
        <div className='flex items-center gap-1'>
          <button
            className='flex h-6 w-6 items-center justify-center border-2 border-black bg-gray-100 disabled:opacity-40'
            disabled={isSaving || episode === 0}
            type='button'
            onClick={() => changeEpisode(-1)}
          >
            <Minus className='h-3 w-3' />
          </button>
          <span className='min-w-8 text-center text-sm font-black'>
            {episode}
            {series.totalEpisodes ? `/${series.totalEpisodes}` : ''}
          </span>
          <button
            className='flex h-6 w-6 items-center justify-center border-2 border-black bg-gray-100 disabled:opacity-40'
            disabled={isSaving}
            type='button'
            onClick={() => changeEpisode(1)}
          >
            <Plus className='h-3 w-3' />
          </button>
        </div>
      </div>

      {others.length > 0 ? (
        <p className='mt-1 text-[10px] font-bold text-gray-500'>
          {others
            .map(
              (entry) =>
                `${entry.displayName}: с${entry.currentSeason} э${entry.currentEpisode}`,
            )
            .join(', ')}
        </p>
      ) : undefined}
    </div>
  );
};
