/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    optimizePackageImports: ['zustand', 'lucide-react']
  },
  webpack: (config, { dev }) => {
    if (dev) {
      config.watchOptions = { ignored: /node_modules/, poll: 2000 };
    }
    return config;
  },
};

export default nextConfig;


