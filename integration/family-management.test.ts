import { afterAll, describe, expect, it } from 'vitest';

import {
  addFamilyMember,
  closePools,
  seedFamily,
  seedProfile,
  withUserContext,
} from './database';

afterAll(async () => {
  await closePools();
});

// Regression coverage for the family_members_update_policy fix: the table
// had ENABLE+FORCE RLS with SELECT/INSERT/DELETE policies but no UPDATE
// policy at all, so setMemberRoleAction's UPDATE silently matched zero rows
// -- it returned {success:true} and logged an activity entry, but the role
// never actually changed. These tests exercise the exact query shape
// setMemberRoleAction uses.

async function setRole(
  actorId: string,
  familyId: string,
  targetUserId: string,
  role: 'admin' | 'member',
) {
  return withUserContext(actorId, (client) =>
    client.query(
      `
        UPDATE public.family_members
        SET role = $3
        WHERE family_id = $1
          AND user_id = $2
          AND role != 'owner'
      `,
      [familyId, targetUserId, role],
    ),
  );
}

async function getRole(
  viewerId: string,
  familyId: string,
  userId: string,
): Promise<string | undefined> {
  const result = await withUserContext(viewerId, (client) =>
    client.query<{ role: string }>(
      'SELECT role FROM public.family_members WHERE family_id = $1 AND user_id = $2',
      [familyId, userId],
    ),
  );
  return result.rows[0]?.role;
}

describe('setMemberRoleAction (family_members UPDATE policy)', () => {
  it('lets the family owner promote a member to admin', async () => {
    const owner = await seedProfile('Owner');
    const member = await seedProfile('Member');
    const family = await seedFamily(owner.id, 'Family A');
    await addFamilyMember(family.id, member.id);

    await setRole(owner.id, family.id, member.id, 'admin');

    expect(await getRole(owner.id, family.id, member.id)).toBe('admin');
  });

  it('lets the owner demote an admin back to member', async () => {
    const owner = await seedProfile('Owner');
    const member = await seedProfile('Member');
    const family = await seedFamily(owner.id, 'Family B');
    await addFamilyMember(family.id, member.id, 'admin');

    await setRole(owner.id, family.id, member.id, 'member');

    expect(await getRole(owner.id, family.id, member.id)).toBe('member');
  });

  it("does not let a plain member change another member's role", async () => {
    const owner = await seedProfile('Owner');
    const memberA = await seedProfile('Member A');
    const memberB = await seedProfile('Member B');
    const family = await seedFamily(owner.id, 'Family C');
    await addFamilyMember(family.id, memberA.id);
    await addFamilyMember(family.id, memberB.id);

    // A zero-row UPDATE under RLS is not an error -- assert the role is
    // unchanged afterward rather than expecting a throw.
    await setRole(memberA.id, family.id, memberB.id, 'admin');

    expect(await getRole(owner.id, family.id, memberB.id)).toBe('member');
  });

  it("does not let an admin change another member's role", async () => {
    const owner = await seedProfile('Owner');
    const admin = await seedProfile('Admin');
    const member = await seedProfile('Member');
    const family = await seedFamily(owner.id, 'Family D');
    await addFamilyMember(family.id, admin.id, 'admin');
    await addFamilyMember(family.id, member.id);

    await setRole(admin.id, family.id, member.id, 'admin');

    expect(await getRole(owner.id, family.id, member.id)).toBe('member');
  });

  it("does not let the owner's own role be changed through this path", async () => {
    const owner = await seedProfile('Owner');
    const family = await seedFamily(owner.id, 'Family E');

    await setRole(owner.id, family.id, owner.id, 'member');

    expect(await getRole(owner.id, family.id, owner.id)).toBe('owner');
  });

  it('does not let an outsider change a role in a family they do not belong to', async () => {
    const owner = await seedProfile('Owner');
    const member = await seedProfile('Member');
    const outsider = await seedProfile('Outsider');
    const family = await seedFamily(owner.id, 'Family F');
    await addFamilyMember(family.id, member.id);

    await setRole(outsider.id, family.id, member.id, 'admin');

    expect(await getRole(owner.id, family.id, member.id)).toBe('member');
  });
});

async function transferOwnership(
  callerId: string,
  familyId: string,
  newOwnerId: string,
) {
  return withUserContext(callerId, (client) =>
    client.query('SELECT public.transfer_family_ownership($1, $2)', [
      familyId,
      newOwnerId,
    ]),
  );
}

describe('transfer_family_ownership', () => {
  it('moves ownership to a target member and demotes the previous owner', async () => {
    const owner = await seedProfile('Owner');
    const member = await seedProfile('Member');
    const family = await seedFamily(owner.id, 'Family G');
    await addFamilyMember(family.id, member.id);

    await transferOwnership(owner.id, family.id, member.id);

    expect(await getRole(member.id, family.id, member.id)).toBe('owner');
    expect(await getRole(member.id, family.id, owner.id)).toBe('member');
  });

  it('rejects a transfer attempted by a non-owner', async () => {
    const owner = await seedProfile('Owner');
    const member = await seedProfile('Member');
    const family = await seedFamily(owner.id, 'Family H');
    await addFamilyMember(family.id, member.id);

    await expect(
      transferOwnership(member.id, family.id, member.id),
    ).rejects.toThrow(/только текущий владелец/i);
  });

  it('rejects transferring to a user who is not a family member', async () => {
    const owner = await seedProfile('Owner');
    const outsider = await seedProfile('Outsider');
    const family = await seedFamily(owner.id, 'Family I');

    await expect(
      transferOwnership(owner.id, family.id, outsider.id),
    ).rejects.toThrow(/должен быть участником/i);
  });
});

async function findByInviteCode(userId: string, inviteCode: string) {
  return withUserContext(userId, (client) =>
    client.query<{ family_id: string }>(
      'SELECT * FROM public.find_family_by_invite_code($1)',
      [inviteCode],
    ),
  );
}

describe('joinFamily (find_family_by_invite_code)', () => {
  it('finds the family for a valid invite code, case-insensitively', async () => {
    const owner = await seedProfile('Owner');
    const family = await seedFamily(owner.id, 'Family J');
    const joiner = await seedProfile('Joiner');

    const result = await findByInviteCode(
      joiner.id,
      family.inviteCode.toLowerCase(),
    );

    expect(result.rows[0]?.family_id).toBe(family.id);
  });

  it('returns no rows for an unknown invite code', async () => {
    const joiner = await seedProfile('Joiner');

    const result = await findByInviteCode(joiner.id, 'NOSUCHCODE');

    expect(result.rows).toHaveLength(0);
  });

  it('rejects joining the same family twice', async () => {
    const owner = await seedProfile('Owner');
    const family = await seedFamily(owner.id, 'Family K');
    const joiner = await seedProfile('Joiner');
    await addFamilyMember(family.id, joiner.id);

    await expect(
      withUserContext(joiner.id, (client) =>
        client.query(
          `INSERT INTO public.family_members (family_id, user_id, role)
           VALUES ($1, $2, 'member')`,
          [family.id, joiner.id],
        ),
      ),
    ).rejects.toThrow(/duplicate key/i);
  });
});
