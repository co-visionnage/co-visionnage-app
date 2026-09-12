import { ENV } from '@/shared/config/environment';

type TmdbFindResponse = {
  tv_results?: { id: number }[];
};

type TmdbTvDetails = {
  next_episode_to_air?: {
    air_date: string;
    season_number: number;
    episode_number: number;
  } | null;
};

export type NextEpisodeInfo = {
  airDate: string;
  label: string;
};

// https://developer.themoviedb.org/reference/find-by-id — a free API key
// covers both lookups; next_episode_to_air is null once a show has no
// confirmed upcoming episode (ended, hiatus, or TMDB just doesn't know yet).
export async function findNextEpisode(
  imdbId: string,
): Promise<NextEpisodeInfo | undefined> {
  if (!ENV.TMDB_API_KEY) return undefined;

  const findResponse = await fetch(
    `https://api.themoviedb.org/3/find/${encodeURIComponent(imdbId)}?external_source=imdb_id`,
    {
      headers: { Authorization: `Bearer ${ENV.TMDB_API_KEY}` },
      cache: 'no-store',
    },
  );

  if (!findResponse.ok) return undefined;

  const findData = (await findResponse.json()) as TmdbFindResponse;
  const tvId = findData.tv_results?.[0]?.id;
  if (!tvId) return undefined;

  const detailsResponse = await fetch(
    `https://api.themoviedb.org/3/tv/${tvId}`,
    {
      headers: { Authorization: `Bearer ${ENV.TMDB_API_KEY}` },
      cache: 'no-store',
    },
  );

  if (!detailsResponse.ok) return undefined;

  const details = (await detailsResponse.json()) as TmdbTvDetails;
  const next = details.next_episode_to_air;
  if (!next) return undefined;

  return {
    airDate: next.air_date,
    label: `S${next.season_number}E${next.episode_number}`,
  };
}
