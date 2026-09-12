import { getKinopoiskById } from './kinopoisk';
import { getOmdbById } from './omdb';
import { ImportedSeries } from './types';

export async function fetchCurrentSeasonInfo(
  source: string,
  externalId: string,
): Promise<Pick<ImportedSeries, 'totalSeasons' | 'totalEpisodes'> | undefined> {
  if (source === 'kinopoisk') return getKinopoiskById(externalId);
  if (source === 'omdb') return getOmdbById(externalId);
  return undefined;
}
