import { NextResponse } from 'next/server';

// Sessions live in the Go API (the browser sends its cookie to /api/v1/*
// through the rewrite in next.config.ts), so there is nothing to refresh
// here; the proxy stays as the single place to add request-level logic.
export default function proxy() {
  return NextResponse.next();
}

export const config = {
  matcher: [
    // eslint-disable-next-line unicorn/prefer-string-raw
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
