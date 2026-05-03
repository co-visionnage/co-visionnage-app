'use client';

import { Check, CheckCheck, Clock, Copy } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import confetti from 'canvas-confetti';

import { FamilyMembersDialog } from '@/app/_components/FamilyMembersDialog';
import { AddSeriesDialog } from '@/features/add-series';
import {
  addSeriesAction as addSeries,
  deleteAction as deleteSeries,
  editAction as editSeries,
  markWatchedAction as markWatched,
  moveToWatchListAction as moveToWatchList,
} from '@/shared/actions/series-postgres';
import { createClient } from '@/shared/api/postgres/client';
import { useAppSounds, useDebounce, useUiPreferences } from '@/shared/hooks';
import { FamilyRole, Series, SeriesData } from '@/shared/types';
import {
  EmptyState,
  SeriesCardSkeleton,
  SeriesFilters,
  SeriesHeader,
} from '@/shared/ui';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/lib';
import { ToWatchCard, WatchedCard } from '@/widgets';

interface SeriesTrackerProperties {
  currentUserId: string;
  currentUserRole: FamilyRole;
  userDisplayName?: string;
  userEmail?: string;
  family: {
    id: string;
    name: string;
    invite_code: string;
  };
  initialSeries: Series[];
}

const SeriesTracker = ({
  currentUserId,
  currentUserRole,
  userDisplayName,
  userEmail,
  family,
  initialSeries,
}: SeriesTrackerProperties) => {
  const client = useMemo(() => createClient(), []);
  const { playClick, playSuccess } = useAppSounds();
  const { preferences } = useUiPreferences();
  const [isLoading, setIsLoading] = useState(true);
  const [series, setSeries] = useState<Series[]>(initialSeries);
  const [isInviteCopied, setIsInviteCopied] = useState(false);

  const loadSeries = useCallback(async () => {
    setIsLoading(true);

    try {
      const response = await client.getFamilySeries(family.id);
      setSeries(response.series as Series[]);
    } catch (error) {
      console.error('SeriesTracker: error loading family series', error);
      setSeries([]);
    } finally {
      setIsLoading(false);
    }
  }, [client, family.id]);

  useEffect(() => {
    void loadSeries();
  }, [loadSeries]);

  const [searchTerm, setSearchTerm] = useState('');
  const [genreFilter, setGenreFilter] = useState('all');
  const [yearFilter, setYearFilter] = useState('all');
  const [ratingFilter, setRatingFilter] = useState('all');
  const debouncedSearch = useDebounce(searchTerm, 300);

  const allGenres = useMemo(() => {
    const genres = series.flatMap((item) => item.genres || []);
    return [...new Set(genres)].filter(Boolean);
  }, [series]);

  const allYears = useMemo(
    () =>
      [...new Set(series.map((item) => item.year))]
        .filter(Boolean)
        .toSorted((left, right) => right - left),
    [series],
  );

  const filteredSeries = useMemo(() => {
    return series.filter((show) => {
      const matchesSearch = show.title
        .toLowerCase()
        .includes(debouncedSearch.toLowerCase());
      const matchesGenre =
        genreFilter === 'all' ||
        (show.genres && show.genres.includes(genreFilter));
      const matchesYear =
        yearFilter === 'all' ||
        (show.year && show.year.toString() === yearFilter);

      let matchesRating = true;
      if (ratingFilter !== 'all' && show.rating) {
        switch (ratingFilter) {
          case '5': {
            matchesRating = show.rating === 5;
            break;
          }
          case '4+': {
            matchesRating = show.rating >= 4;
            break;
          }
          case '3+': {
            matchesRating = show.rating >= 3;
            break;
          }
        }
      } else if (ratingFilter !== 'all' && !show.rating) {
        matchesRating = false;
      }

      return matchesSearch && matchesGenre && matchesYear && matchesRating;
    });
  }, [series, debouncedSearch, genreFilter, yearFilter, ratingFilter]);

  const toWatchList = useMemo(
    () => filteredSeries.filter((item) => item.status === 'to-watch'),
    [filteredSeries],
  );
  const watchedList = useMemo(
    () => filteredSeries.filter((item) => item.status === 'watched'),
    [filteredSeries],
  );

  const runAndRefresh = useCallback(
    async <T,>(action: () => Promise<T>) => {
      const result = await action();
      if (
        result &&
        typeof result === 'object' &&
        'error' in result &&
        (result as { error?: unknown }).error
      ) {
        return result;
      }

      await loadSeries();
      return result;
    },
    [loadSeries],
  );

  const handleAddSeries = useCallback(
    async (data: SeriesData) => {
      const result = await runAndRefresh(() => addSeries(family.id, data));
      if (!result?.error) {
        playSuccess();
      }
    },
    [family.id, playSuccess, runAndRefresh],
  );

  const handleDelete = useCallback(
    async (id: string) => {
      await runAndRefresh(() => deleteSeries(id));
    },
    [runAndRefresh],
  );

  const handleMarkWatched = useCallback(
    async (id: string, rating: number, comment: string) => {
      const result = await runAndRefresh(() =>
        markWatched(id, rating, comment),
      );

      if (!result?.error) {
        playSuccess();

        if (preferences.confettiEnabled) {
          confetti({
            angle: 90,
            origin: { y: 0.65 },
            particleCount: 140,
            spread: 90,
            startVelocity: 42,
            colors: ['#ff4d6d', '#facc15', '#4ade80', '#38bdf8', '#ffffff'],
          });
        }
      }
    },
    [playSuccess, preferences.confettiEnabled, runAndRefresh],
  );

  const handleMoveToWatch = useCallback(
    async (id: string) => {
      await runAndRefresh(() => moveToWatchList(id));
    },
    [runAndRefresh],
  );

  const handleEdit = useCallback(
    async (id: string, updates: Partial<SeriesData>) => {
      await runAndRefresh(() => editSeries(id, updates));
    },
    [runAndRefresh],
  );

  const handleCopyInviteCode = useCallback(async () => {
    playClick();

    try {
      await navigator.clipboard.writeText(family.invite_code);
      setIsInviteCopied(true);
      globalThis.setTimeout(() => setIsInviteCopied(false), 1600);
    } catch (error) {
      console.error('SeriesTracker: failed to copy invite code', error);
    }
  }, [family.invite_code, playClick]);

  return (
    <div className='brutal-font relative min-h-screen w-full overflow-x-hidden bg-blue-500 font-sans'>
      <div
        className='pointer-events-none fixed inset-0 z-0 opacity-60'
        style={{
          backgroundImage: "url('/images/clouds.png')",
          backgroundRepeat: 'no-repeat',
          backgroundSize: 'cover',
          imageRendering: 'pixelated',
        }}
      />

      <div className='relative z-10 mx-auto max-w-7xl p-4'>
        <SeriesHeader userDisplayName={userDisplayName} userEmail={userEmail} />

        <div className='mb-8 flex flex-wrap items-center gap-4'>
          <div className='-rotate-1 border-4 border-black bg-yellow-300 p-3 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]'>
            <span className='text-xl font-black uppercase'>
              Семья: {family.name}
            </span>
          </div>
          <button
            className='flex rotate-1 items-center gap-3 border-4 border-black bg-white p-3 text-left shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all hover:-translate-y-0.5 hover:bg-lime-200'
            type='button'
            onClick={() => void handleCopyInviteCode()}
          >
            <span>
              <span className='font-bold text-gray-500 uppercase'>Код: </span>
              <span className='font-black text-black'>
                {family.invite_code}
              </span>
            </span>
            <span className='flex items-center gap-1 border-2 border-black bg-yellow-300 px-2 py-1 text-xs font-black uppercase'>
              {isInviteCopied ? <CheckCheck size={14} /> : <Copy size={14} />}
              {isInviteCopied ? 'Скопировано' : 'Копировать'}
            </span>
          </button>
          <FamilyMembersDialog
            currentUserId={currentUserId}
            currentUserRole={currentUserRole}
            familyId={family.id}
          />
        </div>

        <SeriesFilters
          allGenres={allGenres}
          allYears={allYears}
          genreFilter={genreFilter}
          ratingFilter={ratingFilter}
          searchTerm={searchTerm}
          yearFilter={yearFilter}
          onGenreChange={setGenreFilter}
          onRatingChange={setRatingFilter}
          onSearchChange={setSearchTerm}
          onYearChange={setYearFilter}
        />

        <div className='mb-8 flex justify-center'>
          <AddSeriesDialog onAdd={handleAddSeries} />
        </div>

        <Tabs
          className='w-full'
          defaultValue='to-watch'
          onValueChange={() => playClick()}
        >
          <TabsList className='mb-8 grid h-auto w-full grid-cols-2 border-4 border-black bg-yellow-400 p-2 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]'>
            <TabsTrigger
              className='p-4 font-black data-[state=active]:border-black data-[state=active]:bg-orange-500'
              value='to-watch'
            >
              <Clock className='mr-2' /> ХОТИМ (
              {isLoading ? '...' : toWatchList.length})
            </TabsTrigger>
            <TabsTrigger
              className='p-4 font-black data-[state=active]:border-black data-[state=active]:bg-lime-500'
              value='watched'
            >
              <Check className='mr-2' /> СМОТРЕЛИ (
              {isLoading ? '...' : watchedList.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value='to-watch'>
            {isLoading ? (
              <div className='grid gap-6 md:grid-cols-2 lg:grid-cols-4'>
                {Array.from({ length: 4 }).map((_, index) => (
                  <SeriesCardSkeleton key={index} />
                ))}
              </div>
            ) : toWatchList.length > 0 ? (
              <div className='grid gap-6 md:grid-cols-2 lg:grid-cols-4'>
                {toWatchList.map((show, index) => (
                  <ToWatchCard
                    key={show.id}
                    index={index}
                    series={show}
                    onDelete={handleDelete}
                    onEdit={handleEdit}
                    onMarkWatched={handleMarkWatched}
                  />
                ))}
              </div>
            ) : (
              <EmptyState />
            )}
          </TabsContent>

          <TabsContent value='watched'>
            {isLoading ? (
              <div className='grid gap-6 md:grid-cols-2 lg:grid-cols-4'>
                {Array.from({ length: 4 }).map((_, index) => (
                  <SeriesCardSkeleton key={index} />
                ))}
              </div>
            ) : watchedList.length > 0 ? (
              <div className='grid gap-6 md:grid-cols-2 lg:grid-cols-4'>
                {watchedList.map((show, index) => (
                  <WatchedCard
                    key={show.id}
                    index={index}
                    series={show}
                    onDelete={handleDelete}
                    onEdit={handleEdit}
                    onMoveToWatchList={handleMoveToWatch}
                  />
                ))}
              </div>
            ) : (
              <EmptyState />
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default SeriesTracker;
