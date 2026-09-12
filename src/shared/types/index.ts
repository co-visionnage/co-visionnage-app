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
  trailerUrl?: string;
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
  trailerUrl?: string;
  mediaType: MediaType;
  externalSource?: string;
  externalId?: string;
};

export type SeriesStatus = 'watched' | 'to-watch';

export type FamilyRole = 'owner' | 'admin' | 'member';

export type FamilyMembership = {
  role: FamilyRole;
  family: {
    id: string;
    name: string;
    invite_code: string;
  };
};

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

export type AchievementId =
  | 'first-watch'
  | 'watched-10'
  | 'watched-25'
  | 'watched-50'
  | 'hours-10'
  | 'hours-50'
  | 'hours-100'
  | 'streak-4-weeks'
  | 'streak-12-weeks';

export type Achievement = {
  id: AchievementId;
  title: string;
  description: string;
  unlocked: boolean;
  progress: number;
  target: number;
};

export type FamilyAchievements = {
  totalWatchedCount: number;
  totalHoursWatched: number;
  currentStreakWeeks: number;
  achievements: Achievement[];
};

export type YearWrapped = {
  year: number;
  totalHoursWatched: number;
  totalWatchedCount: number;
  topGenre?: string;
  bestMonth?: string;
  topRatedTitle?: string;
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

export type FamilyActivityAction =
  | 'series_added'
  | 'series_removed'
  | 'member_joined'
  | 'role_changed'
  | 'ownership_transferred';

export type FamilyActivityEntry = {
  id: string;
  actorLabel: string;
  action: FamilyActivityAction;
  targetLabel?: string;
  detail?: string;
  createdAt: string;
};

export type AppTheme = 'brutal' | 'minimal' | 'dark';

export type UiPreferences = {
  soundsEnabled: boolean;
  confettiEnabled: boolean;
  theme: AppTheme;
};
