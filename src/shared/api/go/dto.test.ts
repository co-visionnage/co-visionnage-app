import { describe, expect, it } from 'vitest';

import {
  toActivityEntry,
  toEvents,
  toMemberships,
  toPolls,
  toReactions,
  toSeries,
} from './dto';

describe('toSeries', () => {
  it('maps the API shape to the UI shape and fills defaults', () => {
    const series = toSeries({
      id: 's1',
      familyId: 'f1',
      title: 'Dune',
      // eslint-disable-next-line unicorn/no-null -- the API sends null for an empty list
      genres: null,
      mediaType: 'movie',
      status: 'watched',
      rating: 4,
      watchedAt: '2026-01-02T00:00:00Z',
      imageUrl: 'https://img/1.png',
    });

    expect(series).toMatchObject({
      id: 's1',
      genres: [],
      image_url: 'https://img/1.png',
      mediaType: 'movie',
      status: 'watched',
      rating: 4,
      dateWatched: '2026-01-02T00:00:00Z',
    });
    expect(series.year).toBe(new Date().getFullYear());
  });
});

describe('toMemberships', () => {
  it('puts the oldest membership first (the default active family)', () => {
    const memberships = toMemberships([
      {
        id: 'new',
        name: 'New',
        inviteCode: 'N',
        ownerId: 'u',
        role: 'member',
        joinedAt: '2026-03-01T00:00:00Z',
      },
      {
        id: 'old',
        name: 'Old',
        inviteCode: 'O',
        ownerId: 'u',
        role: 'owner',
        joinedAt: '2025-01-01T00:00:00Z',
      },
    ]);

    expect(memberships.map((m) => m.family.id)).toEqual(['old', 'new']);
    expect(memberships[0]).toEqual({
      role: 'owner',
      family: { id: 'old', name: 'Old', invite_code: 'O' },
    });
  });
});

describe('toReactions', () => {
  it('aggregates per emoji and marks the current user', () => {
    const reactions = toReactions(
      [
        { seriesId: 's', userId: 'a', emoji: '🔥' },
        { seriesId: 's', userId: 'me', emoji: '🔥' },
        { seriesId: 's', userId: 'a', emoji: '😂' },
      ],
      'me',
    );

    expect(reactions).toEqual([
      { emoji: '🔥', count: 2, reactedByMe: true },
      { emoji: '😂', count: 1, reactedByMe: false },
    ]);
  });
});

describe('toActivityEntry', () => {
  it('normalizes dotted action names to the underscore form', () => {
    expect(
      toActivityEntry({
        id: '1',
        actorLabel: 'a',
        action: 'series.added',
        createdAt: 'x',
      }).action,
    ).toBe('series_added');
    expect(
      toActivityEntry({
        id: '2',
        actorLabel: 'a',
        action: 'role_changed',
        createdAt: 'x',
      }).action,
    ).toBe('role_changed');
  });
});

describe('toPolls', () => {
  it('shows at most five polls', () => {
    const polls = Array.from({ length: 7 }, (_, index) => ({
      id: String(index),
      createdBy: 'u',
      title: 't',
      isOpen: true,
      createdAt: 'x',
      options: [],
    }));

    expect(toPolls(polls)).toHaveLength(5);
  });
});

describe('toEvents', () => {
  it('derives my RSVP from the list', () => {
    const [event] = toEvents(
      [
        {
          id: 'e',
          createdBy: 'u',
          title: 'Movie night',
          scheduledAt: 'x',
          rsvps: [
            { userId: 'other', displayName: 'Other', status: 'no' },
            { userId: 'me', displayName: 'Me', status: 'going' },
          ],
        },
      ],
      'me',
    );

    expect(event.myRsvp).toBe('going');
    expect(event.rsvps).toHaveLength(2);
  });
});
