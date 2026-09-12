'use client';

import type { ImportedSeries } from '@/shared/lib/importSeries/types';

import { ListChecks } from 'lucide-react';
import { useState } from 'react';

import { useAppSounds } from '@/shared/hooks';
import { parseImdbWatchlistCsv } from '@/shared/lib/importSeries/imdbCsv';
import { SeriesData } from '@/shared/types';
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Input,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/shared/ui/lib';

interface BulkImportDialogProperties {
  onAdd: (series: SeriesData) => void | Promise<void>;
}

function toSeriesData(item: ImportedSeries): SeriesData {
  return {
    title: item.title,
    genres: item.genres,
    year: item.year,
    status: 'to-watch',
    image_url: item.image_url,
    totalSeasons: item.totalSeasons,
    totalEpisodes: item.totalEpisodes,
    mediaType: 'series',
    externalSource: item.source,
    externalId: item.externalId,
  };
}

export const BulkImportDialog = ({ onAdd }: BulkImportDialogProperties) => {
  const { playClick, playSuccess } = useAppSounds();
  const [isOpen, setIsOpen] = useState(false);
  const [items, setItems] = useState<ImportedSeries[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [traktUsername, setTraktUsername] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState<string | null>();
  const [notConfigured, setNotConfigured] = useState(false);

  const itemKey = (item: ImportedSeries) => `${item.source}-${item.externalId}`;

  const setResults = (results: ImportedSeries[]) => {
    setItems(results);
    setSelectedIds(new Set(results.map((item) => itemKey(item))));
  };

  const handleTraktImport = async () => {
    const username = traktUsername.trim();
    if (!username) return;

    playClick();
    setIsLoading(true);
    setError(undefined);
    setNotConfigured(false);

    try {
      const response = await fetch(
        `/api/import/trakt?username=${encodeURIComponent(username)}`,
      );
      const data = (await response.json()) as {
        results?: ImportedSeries[];
        error?: string;
      };

      if (!response.ok) {
        if (response.status === 501) {
          setNotConfigured(true);
        } else {
          setError(data.error ?? 'Не удалось загрузить список Trakt');
        }
        setResults([]);
        return;
      }

      setResults(data.results ?? []);
    } catch {
      setError('Не удалось загрузить список Trakt');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCsvFile = async (file: File | undefined) => {
    if (!file) return;

    playClick();
    setError(undefined);

    try {
      const text = await file.text();
      const parsed = parseImdbWatchlistCsv(text);

      if (parsed.length === 0) {
        setError('Не удалось распознать файл — это точно экспорт IMDb?');
        setResults([]);
        return;
      }

      setResults(parsed);
    } catch {
      setError('Не удалось прочитать файл');
    }
  };

  const toggleItem = (key: string) => {
    setSelectedIds((previous) => {
      const next = new Set(previous);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleImportSelected = async () => {
    playClick();
    setIsImporting(true);

    try {
      const selected = items.filter((item) => selectedIds.has(itemKey(item)));
      for (const item of selected) {
        await onAdd(toSeriesData(item));
      }
      playSuccess();
      setItems([]);
      setSelectedIds(new Set());
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          className='border-4 border-black bg-orange-300 px-4 py-3 font-black text-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]'
          onClick={() => playClick()}
        >
          <ListChecks className='mr-2 h-4 w-4' />
          ИМПОРТ СПИСКА
        </Button>
      </DialogTrigger>
      <DialogContent className='max-w-lg border-4 border-black bg-orange-200 [&>button]:top-4 [&>button]:right-4 [&>button]:rounded-none [&>button]:border-2 [&>button]:border-black [&>button]:bg-white [&>button]:opacity-100 [&>button]:hover:bg-red-500'>
        <DialogHeader>
          <DialogTitle className='brutal-font text-2xl font-black text-black uppercase'>
            Импорт списка
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue='trakt'>
          <TabsList className='mb-2 grid grid-cols-2 border-2 border-black bg-white'>
            <TabsTrigger value='trakt'>TRAKT</TabsTrigger>
            <TabsTrigger value='imdb'>IMDB CSV</TabsTrigger>
          </TabsList>

          <TabsContent value='trakt'>
            <div className='flex gap-2'>
              <Input
                className='border-2 border-black bg-white font-bold'
                placeholder='Имя пользователя Trakt'
                value={traktUsername}
                onChange={(event) => setTraktUsername(event.target.value)}
              />
              <Button
                className='shrink-0 border-2 border-black bg-lime-400 font-black text-black hover:bg-lime-500'
                disabled={isLoading || !traktUsername.trim()}
                onClick={() => void handleTraktImport()}
              >
                {isLoading ? '...' : 'Загрузить'}
              </Button>
            </div>
            {notConfigured ? (
              <p className='mt-2 text-xs font-bold text-black/60'>
                Импорт выключен: добавьте TRAKT_CLIENT_ID в .env
              </p>
            ) : undefined}
          </TabsContent>

          <TabsContent value='imdb'>
            <p className='mb-2 text-xs font-bold text-black/70'>
              Экспортируйте свой список на странице IMDb «Your Watchlist» →
              Export и загрузите CSV-файл сюда.
            </p>
            <input
              accept='.csv,text/csv'
              className='brutal-font w-full border-2 border-black bg-white p-2 text-sm font-bold file:mr-2 file:border-0 file:bg-black file:px-2 file:py-1 file:font-black file:text-white'
              type='file'
              onChange={(event) => void handleCsvFile(event.target.files?.[0])}
            />
          </TabsContent>
        </Tabs>

        {error ? (
          <p className='mt-2 border-2 border-red-600 bg-white p-2 text-xs font-black text-red-700'>
            {error}
          </p>
        ) : undefined}

        {items.length > 0 ? (
          <div className='mt-3 grid gap-2'>
            <div className='grid max-h-56 gap-1 overflow-y-auto'>
              {items.map((item) => {
                const key = itemKey(item);
                return (
                  <label
                    key={key}
                    className='flex cursor-pointer items-center gap-2 border-2 border-black bg-white p-2 text-sm font-bold text-black'
                  >
                    <input
                      checked={selectedIds.has(key)}
                      type='checkbox'
                      onChange={() => toggleItem(key)}
                    />
                    {item.title} ({item.year})
                  </label>
                );
              })}
            </div>
            <Button
              className='border-2 border-black bg-lime-400 font-black text-black hover:bg-lime-500 disabled:cursor-not-allowed disabled:opacity-60'
              disabled={isImporting || selectedIds.size === 0}
              onClick={() => void handleImportSelected()}
            >
              {isImporting
                ? 'Добавляем...'
                : `Добавить выбранное (${selectedIds.size})`}
            </Button>
          </div>
        ) : undefined}
      </DialogContent>
    </Dialog>
  );
};
