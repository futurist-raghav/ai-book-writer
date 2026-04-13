/** @type {import('next').NextConfig} */
const isProduction = process.env.NODE_ENV === 'production';
// In production (Cloudflare Pages), use relative paths for API calls
// The Cloudflare Worker function will proxy /api/v1/* to the backend
const configuredApiBase = isProduction 
  ? '/api/v1'
  : (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1').replace(/\/+$/, '');
const configuredApiOrigin = isProduction ? '' : configuredApiBase.replace(/\/api\/v1$/, '');

const nextConfig = {
  reactStrictMode: true,
  swcMinify: false,
  ...(isProduction ? { output: 'standalone' } : {}),
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
  experimental: {
    serverActions: {
      bodySizeLimit: '500mb',
    },
  },
  images: {
    domains: ['localhost'],
  },
  webpack: (config, { dev }) => {
    if (dev) {
      // Disable dev cache to reduce stale chunk/style issues in local docker sessions.
      config.cache = false;
    }
    return config;
  },
  async redirects() {
    return [
      {
        source: '/notes-and-voice',
        destination: '/dashboard/notes-and-voice',
        permanent: false,
      },
      {
        source: '/references',
        destination: '/dashboard/references',
        permanent: false,
      },
      {
        source: '/entities',
        destination: '/dashboard/entities',
        permanent: false,
      },
      {
        source: '/glossary',
        destination: '/dashboard/glossary',
        permanent: false,
      },
      {
        source: '/publishing',
        destination: '/dashboard/publishing',
        permanent: false,
      },
    ];
  },
  async rewrites() {
    return {
      beforeFiles: [
        {
          source: '/api/v1/:path*',
          destination: `${configuredApiBase}/:path*`,
        },
      ],
      fallback: [],
    };
  },
};
module.exports = nextConfig;
