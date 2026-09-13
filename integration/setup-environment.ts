import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

// Same minimal .env loader as scripts/migrate.mjs (kept in sync manually --
// it's a handful of lines, not worth sharing a module for across a Next.js
// app script and a Vitest setup file with different module resolution).
const environmentPath = path.join(process.cwd(), '.env');

if (existsSync(environmentPath)) {
  for (const line of readFileSync(environmentPath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const equalsIndex = trimmed.indexOf('=');
    if (equalsIndex === -1) continue;

    const key = trimmed.slice(0, equalsIndex).trim();
    let value = trimmed.slice(equalsIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    process.env[key] ??= value;
  }
}
