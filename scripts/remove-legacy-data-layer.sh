#!/usr/bin/env bash
# One-off cleanup after the migration to the Go API: removes the code that
# talked to Postgres, the mail/push providers and object storage directly.
# Everything listed is already unused -- `tsc` passes with these paths
# excluded -- the files are only kept until you run this.
#
#   bash scripts/remove-legacy-data-layer.sh
#
# Then review `git status` and commit. Delete this script afterwards.
set -euo pipefail
cd "$(dirname "$0")/.."

git rm -r --quiet --ignore-unmatch \
  src/app/api/auth \
  src/app/auth \
  src/app/api/cron \
  src/app/api/export \
  src/app/api/import \
  src/app/api/upload \
  src/shared/api/postgres \
  src/shared/api/storage/s3.ts \
  src/shared/lib/activityLog \
  src/shared/lib/cron \
  src/shared/lib/email \
  src/shared/lib/push \
  src/shared/lib/rateLimit \
  src/shared/lib/family \
  src/shared/lib/totp.ts \
  src/shared/lib/totp.test.ts \
  src/shared/lib/importSeries/checkUpdates.ts \
  src/shared/lib/importSeries/kinopoisk.ts \
  src/shared/lib/importSeries/omdb.ts \
  src/shared/lib/importSeries/trakt.ts \
  src/shared/lib/importSeries/trakt.test.ts \
  src/shared/lib/importSeries/matchBulkRows.ts \
  src/shared/lib/importSeries/matchBulkRows.test.ts \
  src/shared/lib/nextEpisode \
  src/shared/config/environment.ts \
  integration \
  database \
  scripts/migrate.mjs \
  vitest.integration.config.ts

# Dependencies only the removed code used. pg and otplib stay as dev
# dependencies: the e2e suite resets the rate-limit table and computes TOTP
# codes.
pnpm remove pg @types/pg otplib resend web-push @types/web-push qrcode @types/qrcode
pnpm add -D pg @types/pg otplib

echo
echo "Also remove the \"test:integration\" script from package.json."
