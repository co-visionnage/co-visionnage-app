import type { PoolClient } from 'pg';

import {
  Achievement,
  AchievementId,
  FamilyAchievements,
  FamilyActivityEntry,
  FamilyMember,
  FamilyRole,
  FamilyStats,
  FamilyStatsGenre,
  FamilyStatsMonth,
  MediaType,
  Recommendation,
  RsvpStatus,
  SeriesComment,
  SeriesProgress,
  SeriesReaction,
  SeriesStatus,
  WatchEvent,
  WatchEventRsvp,
  WatchHistoryEntry,
  WatchPoll,
  WatchPollOption,
  YearWrapped,
} from '@/shared/types';
import { requireCurrentUser, withUserContext } from './server';

type FamilyMembershipRow = {
  role: FamilyRole;
  family_id: string;
  family_name: string;
  invite_code: string;
};

type FamilyMemberRow = {
  user_id: string;
  email: string;
  display_name: string | null;
  role: FamilyRole;
  joined_at: string;
};

type SeriesRow = {
  id: string;
  title: string;
  genres: string[] | null;
  year: number | null;
  image_url: string | null;
  created_at: string;
  status: SeriesStatus | null;
  rating: number | null;
  comment: string | null;
  total_seasons: number | null;
  total_episodes: number | null;
  episode_runtime_minutes: number | null;
  trailer_url: string | null;
  media_type: MediaType;
  external_source: string | null;
  external_id: string | null;
  next_episode_air_date: string | null;
  next_episode_label: string | null;
};

export async function getCurrentMembership() {
  const user = await requireCurrentUser();

  return withUserContext(user.id, async (client) => {
    const result = await client.query<FamilyMembershipRow>(
      `
        SELECT
          member.role,
          family.id AS family_id,
          family.name AS family_name,
          family.invite_code
        FROM public.family_members member
        JOIN public.families family ON family.id = member.family_id
        WHERE member.user_id = $1
        ORDER BY member.joined_at ASC
        LIMIT 1
      `,
      [user.id],
    );

    const membership = result.rows[0];

    return membership
      ? {
          role: membership.role,
          family: {
            id: membership.family_id,
            name: membership.family_name,
            invite_code: membership.invite_code,
          },
        }
      : undefined;
  });
}

async function getFamilySeriesWithClient(
  client: PoolClient,
  familyId: string,
  userId: string,
) {
  const result = await client.query<SeriesRow>(
    `
      SELECT
        series.id,
        series.title,
        series.genres,
        series.year,
        series.image_url,
        series.created_at,
        series.total_seasons,
        series.total_episodes,
        series.episode_runtime_minutes,
        series.trailer_url,
        series.media_type,
        series.external_source,
        series.external_id,
        series.next_episode_air_date,
        series.next_episode_label,
        status.status,
        status.rating,
        status.comment
      FROM public.family_series series
      LEFT JOIN public.family_series_status status
        ON status.series_id = series.id
       AND status.user_id = $2
      WHERE series.family_id = $1
      ORDER BY series.created_at DESC
    `,
    [familyId, userId],
  );

  return result.rows.map((row) => ({
    id: row.id,
    title: row.title,
    genres: row.genres ?? [],
    year: row.year ?? new Date().getFullYear(),
    image_url: row.image_url,
    status: row.status ?? 'to-watch',
    rating: row.rating ?? undefined,
    comment: row.comment ?? undefined,
    totalSeasons: row.total_seasons ?? undefined,
    totalEpisodes: row.total_episodes ?? undefined,
    episodeRuntimeMinutes: row.episode_runtime_minutes ?? undefined,
    trailerUrl: row.trailer_url ?? undefined,
    mediaType: row.media_type,
    externalSource: row.external_source ?? undefined,
    externalId: row.external_id ?? undefined,
    nextEpisodeAirDate: row.next_episode_air_date ?? undefined,
    nextEpisodeLabel: row.next_episode_label ?? undefined,
  }));
}

export async function getSeriesById(seriesId: string) {
  const user = await requireCurrentUser();

  return withUserContext(user.id, async (client) => {
    const result = await client.query<SeriesRow & { family_id: string }>(
      `
        SELECT
          series.id,
          series.family_id,
          series.title,
          series.genres,
          series.year,
          series.image_url,
          series.created_at,
          series.total_seasons,
          series.total_episodes,
          series.episode_runtime_minutes,
          series.trailer_url,
          series.media_type,
          series.external_source,
          series.external_id,
          series.next_episode_air_date,
          series.next_episode_label,
          status.status,
          status.rating,
          status.comment
        FROM public.family_series series
        LEFT JOIN public.family_series_status status
          ON status.series_id = series.id
         AND status.user_id = $2
        WHERE series.id = $1
        LIMIT 1
      `,
      [seriesId, user.id],
    );

    const row = result.rows[0];
    if (!row) return;

    return {
      familyId: row.family_id,
      series: {
        id: row.id,
        title: row.title,
        genres: row.genres ?? [],
        year: row.year ?? new Date().getFullYear(),
        image_url: row.image_url,
        status: row.status ?? 'to-watch',
        rating: row.rating ?? undefined,
        comment: row.comment ?? undefined,
        totalSeasons: row.total_seasons ?? undefined,
        totalEpisodes: row.total_episodes ?? undefined,
        episodeRuntimeMinutes: row.episode_runtime_minutes ?? undefined,
        trailerUrl: row.trailer_url ?? undefined,
        mediaType: row.media_type,
        externalSource: row.external_source ?? undefined,
        externalId: row.external_id ?? undefined,
        nextEpisodeAirDate: row.next_episode_air_date ?? undefined,
        nextEpisodeLabel: row.next_episode_label ?? undefined,
      },
    };
  });
}

export async function getFamilySeries(familyId: string) {
  const user = await requireCurrentUser();

  return withUserContext(user.id, async (client) =>
    getFamilySeriesWithClient(client, familyId, user.id),
  );
}

export async function getHomePageData(preferredFamilyId?: string) {
  const user = await requireCurrentUser();

  return withUserContext(user.id, async (client) => {
    const membershipsResult = await client.query<FamilyMembershipRow>(
      `
        SELECT
          member.role,
          family.id AS family_id,
          family.name AS family_name,
          family.invite_code
        FROM public.family_members member
        JOIN public.families family ON family.id = member.family_id
        WHERE member.user_id = $1
        ORDER BY member.joined_at ASC
      `,
      [user.id],
    );

    const memberships = membershipsResult.rows.map((row) => ({
      role: row.role,
      family: {
        id: row.family_id,
        name: row.family_name,
        invite_code: row.invite_code,
      },
    }));

    if (memberships.length === 0) {
      return {
        user,
        memberships,
        membership: undefined,
        series: [],
      };
    }

    const membership =
      memberships.find((entry) => entry.family.id === preferredFamilyId) ??
      memberships[0];

    return {
      user,
      memberships,
      membership,
      series: await getFamilySeriesWithClient(
        client,
        membership.family.id,
        user.id,
      ),
    };
  });
}

export async function getFamilyMembers(familyId: string) {
  const user = await requireCurrentUser();

  return withUserContext(user.id, async (client) => {
    const membershipResult = await client.query<{ role: FamilyRole }>(
      `
        SELECT role
        FROM public.family_members
        WHERE family_id = $1
          AND user_id = $2
        LIMIT 1
      `,
      [familyId, user.id],
    );

    const membership = membershipResult.rows[0];

    if (!membership) {
      throw new Error('Доступ к семье не найден');
    }

    const membersResult = await client.query<FamilyMemberRow>(
      `
        SELECT
          member.user_id,
          profile.email,
          profile.display_name,
          member.role,
          member.joined_at
        FROM public.family_members AS member
        JOIN public.profiles AS profile ON profile.id = member.user_id
        WHERE member.family_id = $1
        ORDER BY
          CASE WHEN member.role = 'owner' THEN 0 ELSE 1 END,
          member.joined_at ASC
      `,
      [familyId],
    );

    return membersResult.rows.map(
      (member): FamilyMember => ({
        userId: member.user_id,
        email: member.email,
        displayName: member.display_name ?? undefined,
        role: member.role,
        joinedAt: member.joined_at,
      }),
    );
  });
}

export async function getFamilyMemberEmailsWithClient(
  client: PoolClient,
  familyId: string,
  excludeUserId: string,
) {
  const result = await client.query<{ email: string }>(
    `
      SELECT profile.email
      FROM public.family_members member
      JOIN public.profiles profile ON profile.id = member.user_id
      WHERE member.family_id = $1
        AND member.user_id != $2
    `,
    [familyId, excludeUserId],
  );

  return result.rows.map((row) => row.email);
}

type SeriesCommentRow = {
  id: string;
  series_id: string;
  user_id: string;
  display_name: string | null;
  email: string;
  body: string;
  created_at: string;
  spoiler_season: number | null;
  spoiler_episode: number | null;
};

export async function getSeriesComments(seriesId: string) {
  const user = await requireCurrentUser();

  return withUserContext(user.id, async (client) => {
    const result = await client.query<SeriesCommentRow>(
      `
        SELECT
          comment.id,
          comment.series_id,
          comment.user_id,
          profile.display_name,
          profile.email,
          comment.body,
          comment.created_at,
          comment.spoiler_season,
          comment.spoiler_episode
        FROM public.family_series_comments AS comment
        JOIN public.profiles AS profile ON profile.id = comment.user_id
        WHERE comment.series_id = $1
        ORDER BY comment.created_at ASC
      `,
      [seriesId],
    );

    return result.rows.map(
      (row): SeriesComment => ({
        id: row.id,
        seriesId: row.series_id,
        userId: row.user_id,
        authorName: row.display_name ?? row.email,
        body: row.body,
        createdAt: row.created_at,
        isMine: row.user_id === user.id,
        spoilerSeason: row.spoiler_season ?? undefined,
        spoilerEpisode: row.spoiler_episode ?? undefined,
      }),
    );
  });
}

type SeriesReactionRow = {
  emoji: string;
  count: string;
  reacted_by_me: boolean;
};

export async function getSeriesReactions(seriesId: string) {
  const user = await requireCurrentUser();

  return withUserContext(user.id, async (client) => {
    const result = await client.query<SeriesReactionRow>(
      `
        SELECT
          emoji,
          COUNT(*) AS count,
          BOOL_OR(user_id = $2) AS reacted_by_me
        FROM public.family_series_reactions
        WHERE series_id = $1
        GROUP BY emoji
        ORDER BY MIN(created_at) ASC
      `,
      [seriesId, user.id],
    );

    return result.rows.map(
      (row): SeriesReaction => ({
        emoji: row.emoji,
        count: Number(row.count),
        reactedByMe: row.reacted_by_me,
      }),
    );
  });
}

type SeriesProgressRow = {
  series_id: string;
  user_id: string;
  display_name: string | null;
  email: string;
  current_season: number;
  current_episode: number;
  updated_at: string;
};

export async function getSeriesProgress(seriesId: string) {
  const user = await requireCurrentUser();

  return withUserContext(user.id, async (client) => {
    const result = await client.query<SeriesProgressRow>(
      `
        SELECT
          progress.series_id,
          progress.user_id,
          profile.display_name,
          profile.email,
          progress.current_season,
          progress.current_episode,
          progress.updated_at
        FROM public.family_series_progress AS progress
        JOIN public.profiles AS profile ON profile.id = progress.user_id
        WHERE progress.series_id = $1
        ORDER BY progress.updated_at DESC
      `,
      [seriesId],
    );

    return result.rows.map(
      (row): SeriesProgress => ({
        seriesId: row.series_id,
        userId: row.user_id,
        displayName: row.display_name ?? row.email,
        currentSeason: row.current_season,
        currentEpisode: row.current_episode,
        updatedAt: row.updated_at,
        isMine: row.user_id === user.id,
      }),
    );
  });
}

// Fetches progress for every series in the family in one query, instead of
// callers issuing one getSeriesProgress request (and its own transaction)
// per series -- a family with dozens of to-watch titles would otherwise
// fire that many HTTP requests and DB round-trips on a single home-page
// render. See EpisodeProgressControl / SeriesTracker for the batched caller.
export async function getFamilyProgress(familyId: string) {
  const user = await requireCurrentUser();

  return withUserContext(user.id, async (client) => {
    const result = await client.query<SeriesProgressRow>(
      `
        SELECT
          progress.series_id,
          progress.user_id,
          profile.display_name,
          profile.email,
          progress.current_season,
          progress.current_episode,
          progress.updated_at
        FROM public.family_series_progress AS progress
        JOIN public.family_series AS series ON series.id = progress.series_id
        JOIN public.profiles AS profile ON profile.id = progress.user_id
        WHERE series.family_id = $1
        ORDER BY progress.updated_at DESC
      `,
      [familyId],
    );

    return result.rows.map(
      (row): SeriesProgress => ({
        seriesId: row.series_id,
        userId: row.user_id,
        displayName: row.display_name ?? row.email,
        currentSeason: row.current_season,
        currentEpisode: row.current_episode,
        updatedAt: row.updated_at,
        isMine: row.user_id === user.id,
      }),
    );
  });
}

type MonthlyHoursRow = {
  month: string;
  hours: string;
};

type GenreCountRow = {
  genre: string;
  count: string;
};

export async function getFamilyStats(familyId: string) {
  const user = await requireCurrentUser();

  return withUserContext(user.id, async (client) => {
    const totalsResult = await client.query<{
      total_hours: string;
      total_series: string;
    }>(
      `
        SELECT
          COALESCE(
            SUM(
              COALESCE(series.total_episodes, 1) *
              COALESCE(series.episode_runtime_minutes, 45)
            ) / 60.0,
            0
          ) AS total_hours,
          COUNT(*) AS total_series
        FROM public.family_series_status status
        JOIN public.family_series series ON series.id = status.series_id
        WHERE series.family_id = $1
          AND status.status = 'watched'
      `,
      [familyId],
    );

    const byMonthResult = await client.query<MonthlyHoursRow>(
      `
        SELECT
          TO_CHAR(COALESCE(status.watched_at, status.updated_at), 'YYYY-MM') AS month,
          SUM(
            COALESCE(series.total_episodes, 1) *
            COALESCE(series.episode_runtime_minutes, 45)
          ) / 60.0 AS hours
        FROM public.family_series_status status
        JOIN public.family_series series ON series.id = status.series_id
        WHERE series.family_id = $1
          AND status.status = 'watched'
        GROUP BY month
        ORDER BY month DESC
        LIMIT 6
      `,
      [familyId],
    );

    const topGenresResult = await client.query<GenreCountRow>(
      `
        SELECT genre, COUNT(*) AS count
        FROM public.family_series series
        JOIN public.family_series_status status ON status.series_id = series.id
        CROSS JOIN LATERAL UNNEST(series.genres) AS genre
        WHERE series.family_id = $1
          AND status.status = 'watched'
        GROUP BY genre
        ORDER BY count DESC
        LIMIT 5
      `,
      [familyId],
    );

    const totals = totalsResult.rows[0];

    return {
      totalHoursWatched: Math.round(Number(totals?.total_hours ?? 0)),
      totalWatchedSeries: Number(totals?.total_series ?? 0),
      byMonth: byMonthResult.rows
        .map(
          (row): FamilyStatsMonth => ({
            month: row.month,
            hours: Math.round(Number(row.hours)),
          }),
        )
        .toReversed(),
      topGenres: topGenresResult.rows.map(
        (row): FamilyStatsGenre => ({
          genre: row.genre,
          count: Number(row.count),
        }),
      ),
    } satisfies FamilyStats;
  });
}

function computeCurrentStreakWeeks(weekStarts: Date[]): number {
  if (weekStarts.length === 0) return 0;

  const sorted = weekStarts.toSorted((a, b) => b.getTime() - a.getTime());
  const currentWeekStart = new Date();
  currentWeekStart.setUTCHours(0, 0, 0, 0);
  const day = currentWeekStart.getUTCDay();
  const diffToMonday = day === 0 ? 6 : day - 1;
  currentWeekStart.setUTCDate(currentWeekStart.getUTCDate() - diffToMonday);

  const mostRecentGapDays = Math.round(
    (currentWeekStart.getTime() - sorted[0].getTime()) / (1000 * 60 * 60 * 24),
  );
  // the streak is only "current" if the family watched something this week
  // or last week — otherwise it's broken, even if it was long once
  if (mostRecentGapDays > 7) return 0;

  let streak = 1;
  for (let index = 1; index < sorted.length; index++) {
    const gapDays = Math.round(
      (sorted[index - 1].getTime() - sorted[index].getTime()) /
        (1000 * 60 * 60 * 24),
    );
    if (gapDays === 7) {
      streak += 1;
    } else {
      break;
    }
  }

  return streak;
}

export async function getFamilyAchievements(familyId: string) {
  const user = await requireCurrentUser();

  return withUserContext(user.id, async (client) => {
    const totalsResult = await client.query<{
      total_hours: string;
      total_watched: string;
    }>(
      `
        SELECT
          COALESCE(
            SUM(
              COALESCE(series.total_episodes, 1) *
              COALESCE(series.episode_runtime_minutes, 45)
            ) / 60.0,
            0
          ) AS total_hours,
          COUNT(*) AS total_watched
        FROM public.family_series_status status
        JOIN public.family_series series ON series.id = status.series_id
        WHERE series.family_id = $1
          AND status.status = 'watched'
      `,
      [familyId],
    );

    const weeksResult = await client.query<{ week_start: string }>(
      `
        SELECT DISTINCT
          DATE_TRUNC('week', COALESCE(status.watched_at, status.updated_at))::date AS week_start
        FROM public.family_series_status status
        JOIN public.family_series series ON series.id = status.series_id
        WHERE series.family_id = $1
          AND status.status = 'watched'
      `,
      [familyId],
    );

    const totals = totalsResult.rows[0];
    const totalWatchedCount = Number(totals?.total_watched ?? 0);
    const totalHoursWatched = Math.round(Number(totals?.total_hours ?? 0));
    const currentStreakWeeks = computeCurrentStreakWeeks(
      weeksResult.rows.map((row) => new Date(row.week_start)),
    );

    const definitions: {
      id: AchievementId;
      title: string;
      description: string;
      progress: number;
      target: number;
    }[] = [
      {
        id: 'first-watch',
        title: 'Первый просмотр',
        description: 'Отметьте первый сериал или фильм как просмотренный',
        progress: totalWatchedCount,
        target: 1,
      },
      {
        id: 'watched-10',
        title: '10 просмотрено',
        description: 'Досмотрите 10 сериалов или фильмов',
        progress: totalWatchedCount,
        target: 10,
      },
      {
        id: 'watched-25',
        title: '25 просмотрено',
        description: 'Досмотрите 25 сериалов или фильмов',
        progress: totalWatchedCount,
        target: 25,
      },
      {
        id: 'watched-50',
        title: '50 просмотрено',
        description: 'Досмотрите 50 сериалов или фильмов',
        progress: totalWatchedCount,
        target: 50,
      },
      {
        id: 'hours-10',
        title: '10 часов',
        description: 'Наберите 10 часов совместного просмотра',
        progress: totalHoursWatched,
        target: 10,
      },
      {
        id: 'hours-50',
        title: '50 часов',
        description: 'Наберите 50 часов совместного просмотра',
        progress: totalHoursWatched,
        target: 50,
      },
      {
        id: 'hours-100',
        title: '100 часов',
        description: 'Наберите 100 часов совместного просмотра',
        progress: totalHoursWatched,
        target: 100,
      },
      {
        id: 'streak-4-weeks',
        title: 'Месяц подряд',
        description: 'Смотрите что-нибудь каждую неделю 4 недели подряд',
        progress: currentStreakWeeks,
        target: 4,
      },
      {
        id: 'streak-12-weeks',
        title: 'Три месяца подряд',
        description: 'Смотрите что-нибудь каждую неделю 12 недель подряд',
        progress: currentStreakWeeks,
        target: 12,
      },
    ];

    const achievements: Achievement[] = definitions.map((definition) => ({
      ...definition,
      unlocked: definition.progress >= definition.target,
    }));

    return {
      totalWatchedCount,
      totalHoursWatched,
      currentStreakWeeks,
      achievements,
    } satisfies FamilyAchievements;
  });
}

export async function getYearWrapped(familyId: string, year: number) {
  const user = await requireCurrentUser();

  return withUserContext(user.id, async (client) => {
    const totalsResult = await client.query<{
      total_hours: string;
      total_watched: string;
    }>(
      `
        SELECT
          COALESCE(
            SUM(
              COALESCE(series.total_episodes, 1) *
              COALESCE(series.episode_runtime_minutes, 45)
            ) / 60.0,
            0
          ) AS total_hours,
          COUNT(*) AS total_watched
        FROM public.family_series_status status
        JOIN public.family_series series ON series.id = status.series_id
        WHERE series.family_id = $1
          AND status.status = 'watched'
          AND EXTRACT(YEAR FROM COALESCE(status.watched_at, status.updated_at)) = $2
      `,
      [familyId, year],
    );

    const topGenreResult = await client.query<{ genre: string }>(
      `
        SELECT genre
        FROM public.family_series series
        JOIN public.family_series_status status ON status.series_id = series.id
        CROSS JOIN LATERAL UNNEST(series.genres) AS genre
        WHERE series.family_id = $1
          AND status.status = 'watched'
          AND EXTRACT(YEAR FROM COALESCE(status.watched_at, status.updated_at)) = $2
        GROUP BY genre
        ORDER BY COUNT(*) DESC
        LIMIT 1
      `,
      [familyId, year],
    );

    const bestMonthResult = await client.query<{ month: string }>(
      `
        SELECT TO_CHAR(COALESCE(status.watched_at, status.updated_at), 'YYYY-MM') AS month
        FROM public.family_series_status status
        JOIN public.family_series series ON series.id = status.series_id
        WHERE series.family_id = $1
          AND status.status = 'watched'
          AND EXTRACT(YEAR FROM COALESCE(status.watched_at, status.updated_at)) = $2
        GROUP BY month
        ORDER BY COUNT(*) DESC
        LIMIT 1
      `,
      [familyId, year],
    );

    const topRatedResult = await client.query<{ title: string }>(
      `
        SELECT series.title
        FROM public.family_series_status status
        JOIN public.family_series series ON series.id = status.series_id
        WHERE series.family_id = $1
          AND status.status = 'watched'
          AND status.rating IS NOT NULL
          AND EXTRACT(YEAR FROM COALESCE(status.watched_at, status.updated_at)) = $2
        ORDER BY status.rating DESC, status.watched_at DESC
        LIMIT 1
      `,
      [familyId, year],
    );

    const totals = totalsResult.rows[0];

    return {
      year,
      totalHoursWatched: Math.round(Number(totals?.total_hours ?? 0)),
      totalWatchedCount: Number(totals?.total_watched ?? 0),
      topGenre: topGenreResult.rows[0]?.genre,
      bestMonth: bestMonthResult.rows[0]?.month,
      topRatedTitle: topRatedResult.rows[0]?.title,
    } satisfies YearWrapped;
  });
}

type RecommendationRow = {
  id: string;
  title: string;
  genres: string[] | null;
  year: number | null;
  image_url: string | null;
  score: string;
};

export async function getRecommendations(familyId: string) {
  const user = await requireCurrentUser();

  return withUserContext(user.id, async (client) => {
    const result = await client.query<RecommendationRow>(
      `
        WITH favourite_genres AS (
          SELECT genre, COUNT(*) AS weight
          FROM public.family_series series
          JOIN public.family_series_status status ON status.series_id = series.id
          CROSS JOIN LATERAL UNNEST(series.genres) AS genre
          WHERE series.family_id = $1
            AND status.status = 'watched'
            AND status.rating >= 4
          GROUP BY genre
        )
        SELECT
          series.id,
          series.title,
          series.genres,
          series.year,
          series.image_url,
          COALESCE(SUM(favourite_genres.weight), 0) AS score
        FROM public.family_series series
        LEFT JOIN public.family_series_status my_status
          ON my_status.series_id = series.id
         AND my_status.user_id = $2
        LEFT JOIN LATERAL UNNEST(series.genres) AS series_genre ON true
        LEFT JOIN favourite_genres ON favourite_genres.genre = series_genre
        WHERE series.family_id = $1
          AND (my_status.status IS NULL OR my_status.status = 'to-watch')
        GROUP BY series.id, series.title, series.genres, series.year, series.image_url
        ORDER BY score DESC, series.created_at DESC
        LIMIT 10
      `,
      [familyId, user.id],
    );

    return result.rows.map(
      (row): Recommendation => ({
        id: row.id,
        title: row.title,
        genres: row.genres ?? [],
        year: row.year ?? new Date().getFullYear(),
        image_url: row.image_url,
        score: Number(row.score),
      }),
    );
  });
}

type WatchHistoryRow = {
  series_id: string;
  title: string;
  image_url: string | null;
  rating: number | null;
  watched_at: string | null;
  updated_at: string;
  display_name: string | null;
  email: string;
};

const HISTORY_PAGE_SIZE = 50;

export async function getWatchHistory(
  familyId: string,
  offset = 0,
): Promise<{ entries: WatchHistoryEntry[]; hasMore: boolean }> {
  const user = await requireCurrentUser();

  return withUserContext(user.id, async (client) => {
    const result = await client.query<WatchHistoryRow>(
      `
        SELECT
          series.id AS series_id,
          series.title,
          series.image_url,
          status.rating,
          status.watched_at,
          status.updated_at,
          profile.display_name,
          profile.email
        FROM public.family_series_status status
        JOIN public.family_series series ON series.id = status.series_id
        JOIN public.profiles profile ON profile.id = status.user_id
        WHERE series.family_id = $1
          AND status.status = 'watched'
        ORDER BY COALESCE(status.watched_at, status.updated_at) DESC
        LIMIT $2 OFFSET $3
      `,
      [familyId, HISTORY_PAGE_SIZE + 1, offset],
    );

    const hasMore = result.rows.length > HISTORY_PAGE_SIZE;

    return {
      entries: result.rows.slice(0, HISTORY_PAGE_SIZE).map(
        (row): WatchHistoryEntry => ({
          seriesId: row.series_id,
          title: row.title,
          image_url: row.image_url,
          rating: row.rating ?? undefined,
          watchedAt: row.watched_at ?? row.updated_at,
          watchedBy: row.display_name ?? row.email,
        }),
      ),
      hasMore,
    };
  });
}

type WatchPollRow = {
  id: string;
  title: string;
  is_open: boolean;
  created_at: string;
  created_by: string;
};

type WatchPollOptionRow = {
  id: string;
  poll_id: string;
  series_id: string;
  title: string;
  image_url: string | null;
  votes: string;
  voted_by_me: boolean;
};

export async function getFamilyWatchPolls(familyId: string) {
  const user = await requireCurrentUser();

  return withUserContext(user.id, async (client) => {
    const pollsResult = await client.query<WatchPollRow>(
      `
        SELECT id, title, is_open, created_at, created_by
        FROM public.family_watch_polls
        WHERE family_id = $1
        ORDER BY created_at DESC
        LIMIT 5
      `,
      [familyId],
    );

    const polls = pollsResult.rows;
    if (polls.length === 0) {
      return [];
    }

    const optionsResult = await client.query<WatchPollOptionRow>(
      `
        SELECT
          option.id,
          option.poll_id,
          option.series_id,
          series.title,
          series.image_url,
          COUNT(vote.id) AS votes,
          BOOL_OR(vote.user_id = $2) AS voted_by_me
        FROM public.family_watch_poll_options option
        JOIN public.family_series series ON series.id = option.series_id
        LEFT JOIN public.family_watch_poll_votes vote ON vote.option_id = option.id
        WHERE option.poll_id = ANY($1::uuid[])
        GROUP BY option.id, option.poll_id, option.series_id, series.title, series.image_url
        ORDER BY votes DESC
      `,
      [polls.map((poll) => poll.id), user.id],
    );

    return polls.map(
      (poll): WatchPoll => ({
        id: poll.id,
        title: poll.title,
        isOpen: poll.is_open,
        createdAt: poll.created_at,
        createdBy: poll.created_by,
        options: optionsResult.rows
          .filter((option) => option.poll_id === poll.id)
          .map(
            (option): WatchPollOption => ({
              id: option.id,
              seriesId: option.series_id,
              title: option.title,
              image_url: option.image_url,
              votes: Number(option.votes),
              votedByMe: option.voted_by_me,
            }),
          ),
      }),
    );
  });
}

type WatchEventRow = {
  id: string;
  title: string;
  scheduled_at: string;
  series_id: string | null;
  series_title: string | null;
  created_by: string;
};

type WatchEventRsvpRow = {
  event_id: string;
  user_id: string;
  display_name: string | null;
  email: string;
  status: string;
};

export async function getFamilyWatchEvents(familyId: string) {
  const user = await requireCurrentUser();

  return withUserContext(user.id, async (client) => {
    const eventsResult = await client.query<WatchEventRow>(
      `
        SELECT
          event.id,
          event.title,
          event.scheduled_at,
          event.series_id,
          series.title AS series_title,
          event.created_by
        FROM public.family_watch_events event
        LEFT JOIN public.family_series series ON series.id = event.series_id
        WHERE event.family_id = $1
        ORDER BY event.scheduled_at ASC
      `,
      [familyId],
    );

    const events = eventsResult.rows;
    if (events.length === 0) {
      return [];
    }

    const rsvpsResult = await client.query<WatchEventRsvpRow>(
      `
        SELECT
          rsvp.event_id,
          rsvp.user_id,
          profile.display_name,
          profile.email,
          rsvp.status
        FROM public.family_watch_event_rsvps rsvp
        JOIN public.profiles profile ON profile.id = rsvp.user_id
        WHERE rsvp.event_id = ANY($1::uuid[])
      `,
      [events.map((event) => event.id)],
    );

    return events.map((event): WatchEvent => {
      const eventRsvps = rsvpsResult.rows.filter(
        (rsvp) => rsvp.event_id === event.id,
      );
      const mine = eventRsvps.find((rsvp) => rsvp.user_id === user.id);

      return {
        id: event.id,
        title: event.title,
        scheduledAt: event.scheduled_at,
        seriesId: event.series_id ?? undefined,
        seriesTitle: event.series_title ?? undefined,
        createdBy: event.created_by,
        myRsvp: mine ? (mine.status as RsvpStatus) : undefined,
        rsvps: eventRsvps.map(
          (rsvp): WatchEventRsvp => ({
            userId: rsvp.user_id,
            displayName: rsvp.display_name ?? rsvp.email,
            status: rsvp.status as RsvpStatus,
          }),
        ),
      };
    });
  });
}

type FamilyActivityRow = {
  id: string;
  actor_label: string;
  action: FamilyActivityEntry['action'];
  target_label: string | null;
  detail: string | null;
  created_at: string;
};

const ACTIVITY_PAGE_SIZE = 50;

export async function getFamilyActivityLog(
  familyId: string,
  offset = 0,
): Promise<{ entries: FamilyActivityEntry[]; hasMore: boolean }> {
  const user = await requireCurrentUser();

  return withUserContext(user.id, async (client) => {
    const result = await client.query<FamilyActivityRow>(
      `
        SELECT id, actor_label, action, target_label, detail, created_at
        FROM public.family_activity_log
        WHERE family_id = $1
        ORDER BY created_at DESC
        LIMIT $2 OFFSET $3
      `,
      [familyId, ACTIVITY_PAGE_SIZE + 1, offset],
    );

    const hasMore = result.rows.length > ACTIVITY_PAGE_SIZE;

    return {
      entries: result.rows.slice(0, ACTIVITY_PAGE_SIZE).map(
        (row): FamilyActivityEntry => ({
          id: row.id,
          actorLabel: row.actor_label,
          action: row.action,
          targetLabel: row.target_label ?? undefined,
          detail: row.detail ?? undefined,
          createdAt: row.created_at,
        }),
      ),
      hasMore,
    };
  });
}
