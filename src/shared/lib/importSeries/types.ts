export type ImportedSeries = {
  externalId: string;
  source: 'kinopoisk' | 'omdb' | 'trakt' | 'imdb-csv';
  title: string;
  year: number;
  genres: string[];
  image_url?: string;
  totalSeasons?: number;
  totalEpisodes?: number;
};
