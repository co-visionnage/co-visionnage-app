import { describe, expect, it } from 'vitest';

import { parseImdbWatchlistCsv } from './imdbCsv';

describe('parseImdbWatchlistCsv', () => {
  it('parses a basic CSV with the standard IMDb export columns', () => {
    const csv =
      'Const,Title,Title Type,Year,Genres\n' +
      'tt0903747,Breaking Bad,tvSeries,2008,"Crime, Drama, Thriller"';

    expect(parseImdbWatchlistCsv(csv)).toEqual([
      {
        externalId: 'tt0903747',
        source: 'imdb-csv',
        title: 'Breaking Bad',
        year: 2008,
        genres: ['Crime', 'Drama', 'Thriller'],
      },
    ]);
  });

  it('looks up columns by header name, not position', () => {
    // Genres before Title, Year last -- IMDb doesn't guarantee column order.
    const csv =
      'Genres,Const,Title,Year\n' + '"Comedy",tt1234567,The Office,2005';

    expect(parseImdbWatchlistCsv(csv)).toEqual([
      {
        externalId: 'tt1234567',
        source: 'imdb-csv',
        title: 'The Office',
        year: 2005,
        genres: ['Comedy'],
      },
    ]);
  });

  it('handles a quoted field containing a comma and an escaped quote', () => {
    const csv =
      'Const,Title,Year,Genres\n' +
      'tt0000001,"A ""Great"" Show, Really",2020,Drama';

    const [entry] = parseImdbWatchlistCsv(csv);
    expect(entry.title).toBe('A "Great" Show, Really');
  });

  it('handles a quoted field containing an embedded newline', () => {
    const csv = 'Const,Title,Year\n' + 'tt0000002,"Line one\nLine two",2021';

    const [entry] = parseImdbWatchlistCsv(csv);
    expect(entry.title).toBe('Line one\nLine two');
  });

  it('skips rows missing a required field (const or title)', () => {
    const csv =
      'Const,Title,Year\n' +
      'tt0000003,,2019\n' + // missing title
      ',No Id,2019\n' + // missing const
      'tt0000004,Valid Row,2019';

    const result = parseImdbWatchlistCsv(csv);
    expect(result).toHaveLength(1);
    expect(result[0].externalId).toBe('tt0000004');
  });

  it('falls back to the current year when Year is missing or non-numeric', () => {
    const csv = 'Const,Title,Year\n' + 'tt0000005,No Year,n/a';

    const [entry] = parseImdbWatchlistCsv(csv);
    expect(entry.year).toBe(new Date().getFullYear());
  });

  it('returns an empty array for just a header row', () => {
    expect(parseImdbWatchlistCsv('Const,Title,Year')).toEqual([]);
  });

  it('returns an empty array when required columns are absent', () => {
    const csv = 'Foo,Bar\n' + 'baz,qux';
    expect(parseImdbWatchlistCsv(csv)).toEqual([]);
  });

  it('returns an empty array for an empty string', () => {
    expect(parseImdbWatchlistCsv('')).toEqual([]);
  });

  it('normalizes CRLF line endings', () => {
    const csv = 'Const,Title,Year\r\ntt0000006,CRLF Show,2022\r\n';
    const result = parseImdbWatchlistCsv(csv);
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('CRLF Show');
  });
});
