import { ENV } from '@/shared/config/environment';
import { ImportedSeries } from './types';

type KinopoiskDoc = {
  id: number;
  name?: string;
  alternativeName?: string;
  year?: number;
  genres?: { name: string }[];
  poster?: { url?: string; previewUrl?: string };
  seasonsInfo?: { number: number; episodesCount?: number }[];
};

type KinopoiskSearchResponse = {
  docs?: KinopoiskDoc[];
};

// https://kinopoiskapiunofficial.tech / api.kinopoisk.dev — unofficial API,
// key obtained via their Telegram bot (free tier with a request quota).
export async function searchKinopoisk(
  query: string,
): Promise<ImportedSeries[]> {
  if (!ENV.KINOPOISK_API_KEY) return [];

  const url = new URL('https://api.kinopoisk.dev/v1.4/movie/search');
  url.searchParams.set('query', query);
  url.searchParams.set('limit', '10');
  url.searchParams.set('type', 'tv-series');

  const response = await fetch(url, {
    headers: { 'X-API-KEY': ENV.KINOPOISK_API_KEY },
    cache: 'no-store',
  });

  if (!response.ok) return [];

  const data = (await response.json()) as KinopoiskSearchResponse;

  return (data.docs ?? []).map(mapKinopoiskDoc);
}

export async function getKinopoiskById(
  id: string,
): Promise<ImportedSeries | undefined> {
  if (!ENV.KINOPOISK_API_KEY) return undefined;

  const response = await fetch(`https://api.kinopoisk.dev/v1.4/movie/${id}`, {
    headers: { 'X-API-KEY': ENV.KINOPOISK_API_KEY },
    cache: 'no-store',
  });

  if (!response.ok) return undefined;

  const doc = (await response.json()) as KinopoiskDoc;
  return mapKinopoiskDoc(doc);
}

function mapKinopoiskDoc(doc: KinopoiskDoc): ImportedSeries {
  const totalEpisodes = doc.seasonsInfo?.reduce(
    (sum, season) => sum + (season.episodesCount ?? 0),
    0,
  );

  return {
    externalId: String(doc.id),
    source: 'kinopoisk',
    title: doc.name ?? doc.alternativeName ?? 'Без названия',
    year: doc.year ?? new Date().getFullYear(),
    genres: (doc.genres ?? []).map((genre) => genre.name),
    image_url: doc.poster?.url ?? doc.poster?.previewUrl,
    totalSeasons: doc.seasonsInfo?.length || undefined,
    totalEpisodes: totalEpisodes || undefined,
  };
}
