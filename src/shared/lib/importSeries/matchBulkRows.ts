import type { SeriesData } from '@/shared/types';

export type InsertedSeriesRow = {
  id: string;
  external_source: string | null;
  external_id: string | null;
};

export type SeriesStatusRow = {
  series_id: string;
  status: SeriesData['status'];
  rating?: number;
  comment?: string;
};

function bulkImportKey(sourceOrItem: {
  externalSource?: string | null;
  externalId?: string | null;
}): string {
  return `${sourceOrItem.externalSource ?? ''}:${sourceOrItem.externalId ?? ''}`;
}

// A plain Map keyed by "source:externalId" collapses to one entry whenever
// two items share a key -- always true for manually entered items, which
// have no external id at all ('' === ''), and possible for imported ones
// too (e.g. the same title picked from two different providers' results).
// Queueing same-key items and shifting one off per matching inserted row
// keeps each row paired with its own originating item instead of silently
// reusing the last one seen for that key.
export function matchBulkImportedRowsToItems(
  insertedRows: InsertedSeriesRow[],
  items: SeriesData[],
): SeriesStatusRow[] {
  const itemsByKey = new Map<string, SeriesData[]>();
  for (const item of items) {
    const key = bulkImportKey({
      externalSource: item.externalSource,
      externalId: item.externalId,
    });
    const bucket = itemsByKey.get(key);
    if (bucket) {
      bucket.push(item);
    } else {
      itemsByKey.set(key, [item]);
    }
  }

  return insertedRows.map((row) => {
    const key = bulkImportKey({
      externalSource: row.external_source,
      externalId: row.external_id,
    });
    const source = itemsByKey.get(key)?.shift();
    const isWatched = source?.status === 'watched';

    return {
      series_id: row.id,
      status: source?.status ?? 'to-watch',
      rating: isWatched ? (source?.rating ?? undefined) : undefined,
      comment: isWatched ? (source?.comment ?? undefined) : undefined,
    };
  });
}
