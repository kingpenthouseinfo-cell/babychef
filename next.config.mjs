/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: { bodySizeLimit: '600mb' },
    serverComponentsExternalPackages: ['sharp', '@prisma/client'],
  },
};
export default nextConfig;
