'use client';

import type { ImportedSeries } from '@/shared/lib/importSeries/types';

import { Search } from 'lucide-react';
import { useEffect, useState } from 'react';

import { useAppSounds, useDebounce } from '@/shared/hooks';
import { Button, Input } from '@/shared/ui/lib';

interface ImportSeriesSearchProperties {
  onSelect: (imported: ImportedSeries) => void;
}

export const ImportSeriesSearch = ({
  onSelect,
}: ImportSeriesSearchProperties) => {
  const { playClick } = useAppSounds();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ImportedSeries[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>();
  const [notConfigured, setNotConfigured] = useState(false);
  const debouncedQuery = useDebounce(query, 400);

  useEffect(() => {
    if (!debouncedQuery.trim()) {
      return;
    }

    const controller = new AbortController();

    const runSearch = async () => {
      setIsLoading(true);
      setError(undefined);

      try {
        const response = await fetch(
          `/api/import/search?query=${encodeURIComponent(debouncedQuery)}`,
          { signal: controller.signal },
        );
        const data = (await response.json()) as {
          results?: ImportedSeries[];
          error?: string;
        };

        if (!response.ok) {
          if (response.status === 501) {
            setNotConfigured(true);
          } else {
            setError(data.error ?? 'Не удалось выполнить поиск');
          }
          setResults([]);
          return;
        }

        setResults(data.results ?? []);
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return;
        }
        setError('Не удалось выполнить поиск');
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    };

    void runSearch();

    return () => {
      controller.abort();
    };
  }, [debouncedQuery]);

  return (
    <div className='rotate-1 border-2 border-black bg-purple-300 p-3 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'>
      <div className='mb-2 flex items-center gap-2'>
        <Search className='h-4 w-4' />
        <span className='brutal-font font-black text-black'>
          Импорт из Кинопоиска / IMDb
        </span>
      </div>
      <Input
        className='brutal-font border-2 border-black bg-white font-bold text-black'
        placeholder='Название сериала...'
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />

      {isLoading ? (
        <p className='mt-2 text-xs font-bold text-black'>Ищем...</p>
      ) : undefined}
      {error ? (
        <p className='mt-2 text-xs font-bold text-red-700'>{error}</p>
      ) : undefined}
      {notConfigured ? (
        <p className='mt-2 text-xs font-bold text-black/60'>
          Импорт выключен: добавьте KINOPOISK_API_KEY или OMDB_API_KEY в .env
        </p>
      ) : undefined}

      {debouncedQuery.trim() && results.length > 0 ? (
        <div className='mt-2 grid max-h-40 gap-1 overflow-y-auto'>
          {results.map((result) => (
            <Button
              key={`${result.source}-${result.externalId}`}
              className='justify-start border-2 border-black bg-white text-left text-xs font-bold text-black hover:bg-yellow-200'
              type='button'
              onClick={() => {
                playClick();
                onSelect(result);
                setResults([]);
                setQuery('');
              }}
            >
              {result.title} ({result.year})
            </Button>
          ))}
        </div>
      ) : undefined}
    </div>
  );
};
