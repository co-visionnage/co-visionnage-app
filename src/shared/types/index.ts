export type AuthMode = 'login' | 'register';
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
}

export type SeriesData = {
  title: string;
  genres: string[];
  year: number;
  status: SeriesStatus;
  image_url?: string | null;
  rating?: number;
  comment?: string;
};

export type SeriesStatus = 'watched' | 'to-watch';

export type FamilyRole = 'owner' | 'member';

export type FamilyMember = {
  userId: string;
  email: string;
  displayName?: string;
  role: FamilyRole;
  joinedAt: string;
};

export type UiPreferences = {
  soundsEnabled: boolean;
  confettiEnabled: boolean;
};
