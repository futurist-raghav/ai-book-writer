/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: false, // Disabled for ARM64 Docker compatibility
  output: 'standalone',
  experimental: {
    serverActions: {
      bodySizeLimit: '500mb',
    },
  },
  images: {
    domains: ['localhost'],
  },
  webpack: (config, { dev, isServer }) => {
    if (dev) {
      // Avoid stale webpack pack cache artifacts in Docker dev volumes.
      config.cache = false;

      // Stabilize SSR route compilation in dev by avoiding fragile server vendor-chunk splits.
      if (isServer && config.optimization?.splitChunks) {
        config.optimization.splitChunks = false;
      }
    }
    return config;
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: process.env.NEXT_PUBLIC_API_URL
          ? `${process.env.NEXT_PUBLIC_API_URL}/:path*`
          : 'http://localhost:8000/api/:path*',
      },
    ];
  },
};

module.exports = nextConfig;
