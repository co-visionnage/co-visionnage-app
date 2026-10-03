import type {
  ActivityEntryDto,
  CommentDto,
  EventDto,
  FamilyDto,
  HistoryEntryDto,
  MemberDto,
  PollDto,
  ProgressDto,
  ReactionDto,
  RecommendationDto,
  SeriesDto,
} from './dto';
import type {
  FamilyAchievements,
  FamilyActivityEntry,
  FamilyMember,
  FamilyStats,
  Recommendation,
  SeriesComment,
  SeriesProgress,
  SeriesReaction,
  WatchEvent,
  WatchHistoryEntry,
  WatchPoll,
  YearWrapped,
} from '@/shared/types';

import {
  toActivityEntry,
  toComment,
  toEvents,
  toHistoryEntry,
  toMember,
  toMemberships,
  toPolls,
  toProgress,
  toReactions,
  toRecommendation,
  toSeries,
} from './dto';
import { apiJson, apiJsonOrUndefined } from './server';
import { requireCurrentUser } from './session';

const familyPath = (familyId: string) =>
  `/families/${encodeURIComponent(familyId)}`;
const seriesPath = (seriesId: string) =>
  `/series/${encodeURIComponent(seriesId)}`;

async function listFamilies() {
  return toMemberships(await apiJson<FamilyDto[]>('/families'));
}

export async function getCurrentMembership() {
  await requireCurrentUser();
  const memberships = await listFamilies();
  return memberships[0];
}

export async function getFamilySeries(familyId: string) {
  const list = await apiJson<SeriesDto[]>(`${familyPath(familyId)}/series`);
  return list.map((dto) => toSeries(dto));
}

export async function getSeriesById(seriesId: string) {
  const dto = await apiJsonOrUndefined<SeriesDto>(seriesPath(seriesId));
  if (!dto) return;

  return { familyId: dto.familyId, series: toSeries(dto) };
}

export async function getHomePageData(preferredFamilyId?: string) {
  const user = await requireCurrentUser();
  const memberships = await listFamilies();

  if (memberships.length === 0) {
    return { user, memberships, membership: undefined, series: [] };
  }

  const membership =
    memberships.find((entry) => entry.family.id === preferredFamilyId) ??
    memberships[0];

  return {
    user,
    memberships,
    membership,
    series: await getFamilySeries(membership.family.id),
  };
}

export async function getFamilyMembers(
  familyId: string,
): Promise<FamilyMember[]> {
  const members = await apiJson<MemberDto[]>(`${familyPath(familyId)}/members`);
  return members.map((member) => toMember(member));
}

export async function getSeriesComments(
  seriesId: string,
): Promise<SeriesComment[]> {
  const user = await requireCurrentUser();
  const list = await apiJson<CommentDto[]>(`${seriesPath(seriesId)}/comments`);
  return list.map((dto) => toComment(dto, user.id));
}

export async function getSeriesReactions(
  seriesId: string,
): Promise<SeriesReaction[]> {
  const user = await requireCurrentUser();
  const list = await apiJson<ReactionDto[]>(
    `${seriesPath(seriesId)}/reactions`,
  );
  return toReactions(list, user.id);
}

export async function getSeriesProgress(
  seriesId: string,
): Promise<SeriesProgress[]> {
  const user = await requireCurrentUser();
  const list = await apiJson<ProgressDto[]>(
    `${seriesPath(seriesId)}/progress/all`,
  );
  return list.map((dto) => toProgress(dto, user.id));
}

// One request for every series in the family: the home page would otherwise
// fire a progress request per to-watch title.
export async function getFamilyProgress(
  familyId: string,
): Promise<SeriesProgress[]> {
  const user = await requireCurrentUser();
  const list = await apiJson<ProgressDto[]>(`${familyPath(familyId)}/progress`);
  return list.map((dto) => toProgress(dto, user.id));
}

export async function getFamilyStats(familyId: string): Promise<FamilyStats> {
  return apiJson<FamilyStats>(`${familyPath(familyId)}/stats`);
}

export async function getFamilyAchievements(
  familyId: string,
): Promise<FamilyAchievements> {
  return apiJson<FamilyAchievements>(`${familyPath(familyId)}/achievements`);
}

export async function getYearWrapped(
  familyId: string,
  year: number,
): Promise<YearWrapped> {
  return apiJson<YearWrapped>(`${familyPath(familyId)}/wrapped?year=${year}`);
}

export async function getRecommendations(
  familyId: string,
): Promise<Recommendation[]> {
  const list = await apiJson<RecommendationDto[]>(
    `${familyPath(familyId)}/recommendations`,
  );
  return list.map((dto) => toRecommendation(dto));
}

export async function getWatchHistory(
  familyId: string,
  offset = 0,
): Promise<{ entries: WatchHistoryEntry[]; hasMore: boolean }> {
  const page = await apiJson<{ entries: HistoryEntryDto[]; hasMore: boolean }>(
    `${familyPath(familyId)}/history?offset=${offset}`,
  );
  return {
    entries: page.entries.map((dto) => toHistoryEntry(dto)),
    hasMore: page.hasMore,
  };
}

export async function getFamilyWatchPolls(
  familyId: string,
): Promise<WatchPoll[]> {
  return toPolls(await apiJson<PollDto[]>(`${familyPath(familyId)}/polls`));
}

export async function getFamilyWatchEvents(
  familyId: string,
): Promise<WatchEvent[]> {
  const user = await requireCurrentUser();
  const list = await apiJson<EventDto[]>(`${familyPath(familyId)}/events`);
  return toEvents(list, user.id);
}

export async function getFamilyActivityLog(
  familyId: string,
  offset = 0,
): Promise<{ entries: FamilyActivityEntry[]; hasMore: boolean }> {
  const page = await apiJson<{
    entries: ActivityEntryDto[];
    hasMore: boolean;
  }>(`${familyPath(familyId)}/activity?offset=${offset}`);
  return {
    entries: page.entries.map((dto) => toActivityEntry(dto)),
    hasMore: page.hasMore,
  };
}
