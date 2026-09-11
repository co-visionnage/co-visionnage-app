export type ImportedSeries = {
  externalId: string;
  source: 'kinopoisk' | 'omdb';
  title: string;
  year: number;
  genres: string[];
  image_url?: string;
  totalSeasons?: number;
  totalEpisodes?: number;
};
