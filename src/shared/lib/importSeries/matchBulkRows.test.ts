import type { SeriesData } from '@/shared/types';

import { describe, expect, it } from 'vitest';

import { matchBulkImportedRowsToItems } from './matchBulkRows';

function item(overrides: Partial<SeriesData>): SeriesData {
  return {
    title: 'Untitled',
    genres: [],
    year: 2020,
    status: 'to-watch',
    mediaType: 'series',
    ...overrides,
  };
}

describe('matchBulkImportedRowsToItems', () => {
  it('matches a single row to its item by external source/id', () => {
    const items = [
      item({
        title: 'Show A',
        status: 'watched',
        rating: 9,
        comment: 'great',
        externalSource: 'omdb',
        externalId: 'tt1',
      }),
    ];
    const rows = [
      { id: 'series-1', external_source: 'omdb', external_id: 'tt1' },
    ];

    expect(matchBulkImportedRowsToItems(rows, items)).toEqual([
      {
        series_id: 'series-1',
        status: 'watched',
        rating: 9,
        comment: 'great',
      },
    ]);
  });

  it('does not collapse multiple items with no external id into one status', () => {
    // Manually added items all key to "": "" -- a plain Map keyed by that
    // string would let the second item's status silently overwrite the
    // first row's before this fix.
    const items = [
      item({ title: 'Manual A', status: 'watched', rating: 5 }),
      item({ title: 'Manual B', status: 'to-watch' }),
      item({ title: 'Manual C', status: 'watched', rating: 10 }),
    ];
    const rows = [
      { id: 'series-1', external_source: null, external_id: null },
      { id: 'series-2', external_source: null, external_id: null },
      { id: 'series-3', external_source: null, external_id: null },
    ];

    expect(matchBulkImportedRowsToItems(rows, items)).toEqual([
      {
        series_id: 'series-1',
        status: 'watched',
        rating: 5,
        comment: undefined,
      },
      {
        series_id: 'series-2',
        status: 'to-watch',
        rating: undefined,
        comment: undefined,
      },
      {
        series_id: 'series-3',
        status: 'watched',
        rating: 10,
        comment: undefined,
      },
    ]);
  });

  it('falls back to "to-watch" for a row with no matching item', () => {
    const rows = [
      { id: 'series-1', external_source: 'omdb', external_id: 'unmatched' },
    ];

    expect(matchBulkImportedRowsToItems(rows, [])).toEqual([
      {
        series_id: 'series-1',
        status: 'to-watch',
        rating: undefined,
        comment: undefined,
      },
    ]);
  });

  it('does not attach rating/comment to a to-watch item even if present', () => {
    const items = [
      item({
        status: 'to-watch',
        rating: 7,
        comment: 'should be ignored',
        externalSource: 'omdb',
        externalId: 'tt1',
      }),
    ];
    const rows = [
      { id: 'series-1', external_source: 'omdb', external_id: 'tt1' },
    ];

    expect(matchBulkImportedRowsToItems(rows, items)).toEqual([
      {
        series_id: 'series-1',
        status: 'to-watch',
        rating: undefined,
        comment: undefined,
      },
    ]);
  });
});
