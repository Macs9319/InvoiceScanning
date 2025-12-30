/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
  webpack: (config, { isServer }) => {
    config.resolve.alias.canvas = false;

    // Force Prisma to use Node.js client instead of edge client
    if (isServer) {
      config.resolve.alias['@prisma/client'] = require.resolve('@prisma/client');
    }

    return config;
  },
};

module.exports = nextConfig;
