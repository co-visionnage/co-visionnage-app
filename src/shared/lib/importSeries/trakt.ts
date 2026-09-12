import { ENV } from '@/shared/config/environment';
import { ImportedSeries } from './types';

type TraktShow = {
  ids: { trakt: number; imdb?: string };
  title: string;
  year?: number;
  genres?: string[];
};

type TraktMovie = {
  ids: { trakt: number; imdb?: string };
  title: string;
  year?: number;
  genres?: string[];
};

type TraktWatchlistItem = {
  type: 'show' | 'movie';
  show?: TraktShow;
  movie?: TraktMovie;
};

const usernamePattern = /^[A-Za-z0-9_-]{1,50}$/;

// https://trakt.docs.apiary.io -- a personal watchlist is public by default
// unless the user has hidden it, and reading one needs only a client id
// (no per-request user OAuth), obtained by registering a free app at
// trakt.tv/oauth/applications.
export async function importTraktWatchlist(
  username: string,
): Promise<ImportedSeries[]> {
  if (!ENV.TRAKT_CLIENT_ID) return [];
  if (!usernamePattern.test(username)) return [];

  const response = await fetch(
    `https://api.trakt.tv/users/${encodeURIComponent(username)}/watchlist`,
    {
      headers: {
        'trakt-api-version': '2',
        'trakt-api-key': ENV.TRAKT_CLIENT_ID,
      },
      cache: 'no-store',
    },
  );

  if (!response.ok) return [];

  const items = (await response.json()) as TraktWatchlistItem[];

  return items
    .map((item): ImportedSeries | undefined => {
      const entry = item.type === 'movie' ? item.movie : item.show;
      if (!entry) return undefined;

      return {
        externalId: entry.ids.imdb ?? String(entry.ids.trakt),
        source: 'trakt',
        title: entry.title,
        year: entry.year ?? new Date().getFullYear(),
        genres: entry.genres ?? [],
      };
    })
    .filter((entry): entry is ImportedSeries => entry !== undefined);
}
