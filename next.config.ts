import type { NextConfig } from 'next';

// STORAGE_PUBLIC_URL points at the deployment's own MinIO/S3-compatible
// bucket (host varies per environment), so its remote pattern is derived
// from the env var at build/start time instead of being hardcoded.
function storagePublicUrlPattern() {
  if (!process.env.STORAGE_PUBLIC_URL) return;

  try {
    const url = new URL(process.env.STORAGE_PUBLIC_URL);
    return {
      protocol: url.protocol.replace(':', '') as 'http' | 'https',
      hostname: url.hostname,
      port: url.port || undefined,
    };
  } catch {
    return;
  }
}

const storagePattern = storagePublicUrlPattern();

const nextConfig: NextConfig = {
  output: 'standalone',
  images: {
    remotePatterns: [
      // OMDb poster images
      { protocol: 'https', hostname: 'm.media-amazon.com' },
      // Kinopoisk (api.kinopoisk.dev) poster images
      { protocol: 'https', hostname: 'image.openmoviedb.com' },
      ...(storagePattern ? [storagePattern] : []),
    ],
  },
};

export default nextConfig;
