/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    externalDir: true
  },
  // Force all pages to be server-rendered dynamically, skip static generation
  output: 'standalone',
  // Prevent Next.js from trying to bundle browser-only wallet libs during build
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
      };
    }
    // Externalize wallet connectors on server to avoid indexedDB errors
    if (isServer) {
      config.externals.push({
        '@walletconnect/ethereum-provider': 'commonjs @walletconnect/ethereum-provider',
        '@metamask/sdk': 'commonjs @metamask/sdk',
      });
    }
    return config;
  },
};

export default nextConfig;
