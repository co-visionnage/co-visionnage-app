// Shapes returned by the Go API (camelCase JSON) and their mappers to the
// app's domain types. Every mapper is a pure function so it is unit-tested
// without a server.
import type { ImportedSeries } from '@/shared/lib/importSeries/types';
import type {
  FamilyActivityEntry,
  FamilyMember,
  FamilyMembership,
  FamilyRole,
  MediaType,
  Recommendation,
  RsvpStatus,
  Series,
  SeriesComment,
  SeriesProgress,
  SeriesReaction,
  SeriesStatus,
  WatchEvent,
  WatchHistoryEntry,
  WatchPoll,
} from '@/shared/types';

export type SeriesDto = {
  id: string;
  familyId: string;
  title: string;
  genres: string[] | null;
  year?: number;
  imageUrl?: string;
  totalSeasons?: number;
  totalEpisodes?: number;
  episodeRuntimeMinutes?: number;
  mediaType: MediaType;
  trailerUrl?: string;
  externalSource?: string;
  externalId?: string;
  nextEpisodeAirDate?: string;
  nextEpisodeLabel?: string;
  status: SeriesStatus;
  rating?: number;
  comment?: string;
  watchedAt?: string;
};

export type FamilyDto = {
  id: string;
  name: string;
  inviteCode: string;
  ownerId: string;
  role: FamilyRole;
  joinedAt: string;
};

export type MemberDto = {
  userId: string;
  email: string;
  displayName?: string;
  role: FamilyRole;
  joinedAt: string;
};

export type CommentDto = {
  id: string;
  seriesId: string;
  userId: string;
  authorName: string;
  body: string;
  createdAt: string;
  spoilerSeason?: number;
  spoilerEpisode?: number;
};

export type ReactionDto = { seriesId: string; userId: string; emoji: string };

export type ProgressDto = {
  seriesId: string;
  userId: string;
  displayName: string;
  currentSeason: number;
  currentEpisode: number;
  updatedAt: string;
};

export type PollDto = {
  id: string;
  createdBy: string;
  title: string;
  isOpen: boolean;
  createdAt: string;
  options: Array<{
    id: string;
    seriesId: string;
    votes: number;
    title: string;
    imageUrl?: string;
    votedByMe: boolean;
  }>;
};

export type EventDto = {
  id: string;
  seriesId?: string;
  seriesTitle?: string;
  createdBy: string;
  title: string;
  scheduledAt: string;
  rsvps: Array<{ userId: string; displayName: string; status: string }>;
};

export type HistoryEntryDto = {
  seriesId: string;
  title: string;
  imageUrl?: string;
  rating?: number;
  watchedAt: string;
  watchedBy: string;
};

export type ActivityEntryDto = {
  id: string;
  actorLabel: string;
  action: string;
  targetLabel?: string;
  detail?: string;
  createdAt: string;
};

export type RecommendationDto = {
  id: string;
  title: string;
  genres: string[] | null;
  year: number;
  imageUrl?: string;
  score: number;
};

export type ImportedSeriesDto = {
  externalId: string;
  source: ImportedSeries['source'];
  title: string;
  year: number;
  genres: string[] | null;
  imageUrl?: string;
  totalSeasons?: number;
  totalEpisodes?: number;
};

export function toImportedSeries(dto: ImportedSeriesDto): ImportedSeries {
  return {
    externalId: dto.externalId,
    source: dto.source,
    title: dto.title,
    year: dto.year,
    genres: dto.genres ?? [],
    image_url: dto.imageUrl,
    totalSeasons: dto.totalSeasons,
    totalEpisodes: dto.totalEpisodes,
  };
}

export function toSeries(dto: SeriesDto): Series {
  return {
    id: dto.id,
    title: dto.title,
    genres: dto.genres ?? [],
    year: dto.year ?? new Date().getFullYear(),
    image_url: dto.imageUrl,
    status: dto.status,
    rating: dto.rating,
    comment: dto.comment,
    dateWatched: dto.watchedAt,
    totalSeasons: dto.totalSeasons,
    totalEpisodes: dto.totalEpisodes,
    episodeRuntimeMinutes: dto.episodeRuntimeMinutes,
    trailerUrl: dto.trailerUrl,
    mediaType: dto.mediaType,
    externalSource: dto.externalSource,
    externalId: dto.externalId,
    nextEpisodeAirDate: dto.nextEpisodeAirDate,
    nextEpisodeLabel: dto.nextEpisodeLabel,
  };
}

export function toMembership(dto: FamilyDto): FamilyMembership {
  return {
    role: dto.role,
    family: { id: dto.id, name: dto.name, invite_code: dto.inviteCode },
  };
}

// Oldest membership first: the first family is the default active one.
export function toMemberships(dtos: FamilyDto[]): FamilyMembership[] {
  return dtos
    .toSorted((a, b) => Date.parse(a.joinedAt) - Date.parse(b.joinedAt))
    .map((dto) => toMembership(dto));
}

export function toMember(dto: MemberDto): FamilyMember {
  return {
    userId: dto.userId,
    email: dto.email,
    displayName: dto.displayName || undefined,
    role: dto.role,
    joinedAt: dto.joinedAt,
  };
}

export function toComment(
  dto: CommentDto,
  currentUserId: string,
): SeriesComment {
  return {
    id: dto.id,
    seriesId: dto.seriesId,
    userId: dto.userId,
    authorName: dto.authorName,
    body: dto.body,
    createdAt: dto.createdAt,
    isMine: dto.userId === currentUserId,
    spoilerSeason: dto.spoilerSeason,
    spoilerEpisode: dto.spoilerEpisode,
  };
}

export function toReactions(
  dtos: ReactionDto[],
  currentUserId: string,
): SeriesReaction[] {
  const byEmoji = new Map<string, SeriesReaction>();

  for (const dto of dtos) {
    const entry = byEmoji.get(dto.emoji) ?? {
      emoji: dto.emoji,
      count: 0,
      reactedByMe: false,
    };
    entry.count += 1;
    entry.reactedByMe ||= dto.userId === currentUserId;
    byEmoji.set(dto.emoji, entry);
  }

  return [...byEmoji.values()].toSorted(
    (a, b) => b.count - a.count || a.emoji.localeCompare(b.emoji),
  );
}

export function toProgress(
  dto: ProgressDto,
  currentUserId: string,
): SeriesProgress {
  return {
    seriesId: dto.seriesId,
    userId: dto.userId,
    displayName: dto.displayName,
    currentSeason: dto.currentSeason,
    currentEpisode: dto.currentEpisode,
    updatedAt: dto.updatedAt,
    isMine: dto.userId === currentUserId,
  };
}

const POLLS_SHOWN = 5;

export function toPolls(dtos: PollDto[]): WatchPoll[] {
  return dtos.slice(0, POLLS_SHOWN).map((poll) => ({
    id: poll.id,
    title: poll.title,
    isOpen: poll.isOpen,
    createdAt: poll.createdAt,
    createdBy: poll.createdBy,
    options: poll.options.map((option) => ({
      id: option.id,
      seriesId: option.seriesId,
      title: option.title,
      image_url: option.imageUrl,
      votes: option.votes,
      votedByMe: option.votedByMe,
    })),
  }));
}

export function toEvents(
  dtos: EventDto[],
  currentUserId: string,
): WatchEvent[] {
  return dtos.map((event) => ({
    id: event.id,
    title: event.title,
    scheduledAt: event.scheduledAt,
    seriesId: event.seriesId,
    seriesTitle: event.seriesTitle,
    createdBy: event.createdBy,
    myRsvp: event.rsvps.find((rsvp) => rsvp.userId === currentUserId)
      ?.status as RsvpStatus | undefined,
    rsvps: event.rsvps.map((rsvp) => ({
      userId: rsvp.userId,
      displayName: rsvp.displayName,
      status: rsvp.status as RsvpStatus,
    })),
  }));
}

export function toHistoryEntry(dto: HistoryEntryDto): WatchHistoryEntry {
  return {
    seriesId: dto.seriesId,
    title: dto.title,
    image_url: dto.imageUrl,
    rating: dto.rating,
    watchedAt: dto.watchedAt,
    watchedBy: dto.watchedBy,
  };
}

// The Go API writes dotted action names ("series.added"); rows written by
// the former Next.js implementation use underscores. The UI knows only the
// underscore form.
export function toActivityEntry(dto: ActivityEntryDto): FamilyActivityEntry {
  return {
    id: dto.id,
    actorLabel: dto.actorLabel,
    action: dto.action.replaceAll('.', '_') as FamilyActivityEntry['action'],
    targetLabel: dto.targetLabel,
    detail: dto.detail,
    createdAt: dto.createdAt,
  };
}

export function toRecommendation(dto: RecommendationDto): Recommendation {
  return {
    id: dto.id,
    title: dto.title,
    genres: dto.genres ?? [],
    year: dto.year,
    image_url: dto.imageUrl,
    score: dto.score,
  };
}
