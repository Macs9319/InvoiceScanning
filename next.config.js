/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
  webpack: (config, { isServer }) => {
    // Exclude canvas and PDF converter from client-side bundle
    config.resolve.alias.canvas = false;

    // Externalize native modules and PDF converter for server-side only
    if (isServer) {
      // Force Prisma to use Node.js client instead of edge client
      config.resolve.alias['@prisma/client'] = require.resolve('@prisma/client');

      // Externalize pdf-to-png-converter and its native dependencies
      config.externals = config.externals || [];
      config.externals.push(
        'pdf-to-png-converter',
        'canvas',
        '@napi-rs/canvas',
        'pdfjs-dist'
      );
    } else {
      // Client-side: prevent bundling of server-only PDF converter
      config.resolve.alias['pdf-to-png-converter'] = false;
    }

    return config;
  },
};

module.exports = nextConfig;
