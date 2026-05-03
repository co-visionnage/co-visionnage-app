import type { PoolClient } from 'pg';

import { FamilyMember, FamilyRole, SeriesStatus } from '@/shared/types';
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
  }));
}

export async function getFamilySeries(familyId: string) {
  const user = await requireCurrentUser();

  return withUserContext(user.id, async (client) =>
    getFamilySeriesWithClient(client, familyId, user.id),
  );
}

export async function getHomePageData() {
  const user = await requireCurrentUser();

  return withUserContext(user.id, async (client) => {
    const membershipResult = await client.query<FamilyMembershipRow>(
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

    const membership = membershipResult.rows[0];

    if (!membership) {
      return {
        user,
        membership: undefined,
        series: [],
      };
    }

    return {
      user,
      membership: {
        role: membership.role,
        family: {
          id: membership.family_id,
          name: membership.family_name,
          invite_code: membership.invite_code,
        },
      },
      series: await getFamilySeriesWithClient(
        client,
        membership.family_id,
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
