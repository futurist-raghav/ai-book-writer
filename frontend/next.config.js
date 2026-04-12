/** @type {import('next').NextConfig} */
const isProduction = process.env.NODE_ENV === 'production';
const configuredApiBase = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1').replace(/\/+$/, '');
const configuredApiOrigin = configuredApiBase.replace(/\/api\/v1$/, '');

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
  async rewrites() {
    return [
      {
        source: '/api/v1/:path*',
        destination: `${configuredApiBase}/:path*`,
      },
      {
        source: '/api/:path*',
        destination: `${configuredApiOrigin}/api/:path*`,
      },
    ];
  },
};
module.exports = nextConfig;
