import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: false,
  turbopack: {
    rules: {
      '*.svg': {
        loaders: ['@svgr/webpack'],
        as: '*.js',
      },
    },
  },
  images: {
    domains: ['i.imgur.com'],
  },
};

export default nextConfig;
