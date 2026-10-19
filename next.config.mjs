/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    instrumentationHook: true,
    serverActions: { bodySizeLimit: '600mb' },
    serverComponentsExternalPackages: ['sharp', '@prisma/client', 'ffmpeg-static', 'ffprobe-static'],
  },
};
export default nextConfig;
