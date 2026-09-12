import { ImportedSeries } from './types';

// A minimal RFC 4180 parser: handles quoted fields, escaped quotes ("")
// and commas/newlines inside quotes, which is as far as IMDb's own export
// format goes.
function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let index = 0; index < line.length; index++) {
    const char = line[index];

    if (inQuotes) {
      if (char === '"') {
        if (line[index + 1] === '"') {
          current += '"';
          index += 1;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      fields.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  fields.push(current);
  return fields;
}

function parseCsvRows(text: string): string[][] {
  const normalized = text.replace(/\r\n/g, '\n');
  const rows: string[][] = [];
  let current = '';
  let inQuotes = false;

  for (const char of normalized) {
    if (char === '"') inQuotes = !inQuotes;
    if (char === '\n' && !inQuotes) {
      if (current.length > 0) rows.push(parseCsvLine(current));
      current = '';
    } else {
      current += char;
    }
  }
  if (current.length > 0) rows.push(parseCsvLine(current));

  return rows;
}

/**
 * Parses the CSV export IMDb offers for "Your Watchlist" (and "Your
 * Ratings") from a user's account page — there's no free IMDb API, so this
 * is the only zero-config way to bulk-import from it. Expects the standard
 * IMDb export columns (Const, Title, Title Type, Year, Genres, ...); column
 * order isn't guaranteed to be stable, so this looks columns up by header
 * name rather than by position.
 */
export function parseImdbWatchlistCsv(csvText: string): ImportedSeries[] {
  const rows = parseCsvRows(csvText);
  if (rows.length < 2) return [];

  const header = rows[0].map((column) => column.trim().toLowerCase());
  const indexOf = (name: string) => header.indexOf(name);

  const constIndex = indexOf('const');
  const titleIndex = indexOf('title');
  const yearIndex = indexOf('year');
  const genresIndex = indexOf('genres');

  if (constIndex === -1 || titleIndex === -1) return [];

  return rows
    .slice(1)
    .map((row): ImportedSeries | undefined => {
      const externalId = row[constIndex]?.trim();
      const title = row[titleIndex]?.trim();
      if (!externalId || !title) return undefined;

      const year = Number.parseInt(row[yearIndex] ?? '', 10);
      const genres = (row[genresIndex] ?? '')
        .split(',')
        .map((genre) => genre.trim())
        .filter((genre) => genre.length > 0);

      return {
        externalId,
        source: 'imdb-csv',
        title,
        year: Number.isFinite(year) ? year : new Date().getFullYear(),
        genres,
      };
    })
    .filter((entry): entry is ImportedSeries => entry !== undefined);
}
