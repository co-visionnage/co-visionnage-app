import { ENV } from '@/shared/config/environment';
import { ImportedSeries } from './types';

type OmdbSearchItem = {
  Title: string;
  Year: string;
  imdbID: string;
  Type: string;
  Poster: string;
};

type OmdbSearchResponse = {
  Search?: OmdbSearchItem[];
  Response: string;
};

type OmdbDetailResponse = {
  Title: string;
  Year: string;
  Genre: string;
  Poster: string;
  totalSeasons?: string;
  Response: string;
};

// https://www.omdbapi.com — free tier requires a personal API key (signup
// at omdbapi.com/apikey.aspx), used here for English-language/IMDb data.
export async function searchOmdb(query: string): Promise<ImportedSeries[]> {
  if (!ENV.OMDB_API_KEY) return [];

  const url = new URL('https://www.omdbapi.com/');
  url.searchParams.set('apikey', ENV.OMDB_API_KEY);
  url.searchParams.set('s', query);
  url.searchParams.set('type', 'series');

  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) return [];

  const data = (await response.json()) as OmdbSearchResponse;
  if (data.Response !== 'True' || !data.Search) return [];

  const detailed = await Promise.all(
    data.Search.slice(0, 10).map((item) => getOmdbById(item.imdbID)),
  );

  return detailed.filter((item): item is ImportedSeries => item !== undefined);
}

export async function getOmdbById(
  imdbId: string,
): Promise<ImportedSeries | undefined> {
  if (!ENV.OMDB_API_KEY) return undefined;
  const url = new URL('https://www.omdbapi.com/');
  url.searchParams.set('apikey', ENV.OMDB_API_KEY!);
  url.searchParams.set('i', imdbId);

  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) return undefined;

  const data = (await response.json()) as OmdbDetailResponse;
  if (data.Response !== 'True') return undefined;

  return {
    externalId: imdbId,
    source: 'omdb',
    title: data.Title,
    year: Number.parseInt(data.Year, 10) || new Date().getFullYear(),
    genres: data.Genre
      ? data.Genre.split(',').map((genre) => genre.trim())
      : [],
    image_url: data.Poster && data.Poster !== 'N/A' ? data.Poster : undefined,
    totalSeasons: data.totalSeasons
      ? Number.parseInt(data.totalSeasons, 10) || undefined
      : undefined,
  };
}
