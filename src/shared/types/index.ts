export type AuthMode = 'login' | 'register';
export type MediaType = 'series' | 'movie';

export interface Series {
  id: string;
  title: string;
  genres: string[];
  year: number;
  rating?: number;
  comment?: string;
  dateWatched?: string;
  status: SeriesStatus;
  image_url?: string | null;
  totalSeasons?: number;
  totalEpisodes?: number;
  episodeRuntimeMinutes?: number;
  mediaType: MediaType;
  externalSource?: string;
  externalId?: string;
}

export type SeriesData = {
  title: string;
  genres: string[];
  year: number;
  status: SeriesStatus;
  image_url?: string | null;
  rating?: number;
  comment?: string;
  totalSeasons?: number;
  totalEpisodes?: number;
  episodeRuntimeMinutes?: number;
  mediaType: MediaType;
  externalSource?: string;
  externalId?: string;
};

export type SeriesStatus = 'watched' | 'to-watch';

export type FamilyRole = 'owner' | 'admin' | 'member';

export type FamilyMember = {
  userId: string;
  email: string;
  displayName?: string;
  role: FamilyRole;
  joinedAt: string;
};

export type SeriesComment = {
  id: string;
  seriesId: string;
  userId: string;
  authorName: string;
  body: string;
  createdAt: string;
  isMine: boolean;
};

export type SeriesReaction = {
  emoji: string;
  count: number;
  reactedByMe: boolean;
};

export type SeriesProgress = {
  seriesId: string;
  currentSeason: number;
  currentEpisode: number;
  updatedAt: string;
  userId: string;
  displayName: string;
  isMine: boolean;
};

export type FamilyStatsMonth = {
  month: string;
  hours: number;
};

export type FamilyStatsGenre = {
  genre: string;
  count: number;
};

export type FamilyStats = {
  totalHoursWatched: number;
  totalWatchedSeries: number;
  byMonth: FamilyStatsMonth[];
  topGenres: FamilyStatsGenre[];
};

export type Recommendation = {
  id: string;
  title: string;
  genres: string[];
  year: number;
  image_url?: string | null;
  score: number;
};

export type WatchPollOption = {
  id: string;
  seriesId: string;
  title: string;
  image_url?: string | null;
  votes: number;
  votedByMe: boolean;
};

export type WatchHistoryEntry = {
  seriesId: string;
  title: string;
  image_url?: string | null;
  rating?: number;
  watchedAt: string;
  watchedBy: string;
};

export type WatchPoll = {
  id: string;
  title: string;
  isOpen: boolean;
  createdAt: string;
  createdBy: string;
  options: WatchPollOption[];
};

export type AppTheme = 'brutal' | 'minimal' | 'dark';

export type UiPreferences = {
  soundsEnabled: boolean;
  confettiEnabled: boolean;
  theme: AppTheme;
};
