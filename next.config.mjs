/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    instrumentationHook: true,
    serverActions: { bodySizeLimit: '600mb' },
    serverComponentsExternalPackages: ['sharp', '@prisma/client'],
  },
};
export default nextConfig;
