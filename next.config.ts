import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Allow image domains for OCR previews
  images: {
    remotePatterns: [],
  },
  // Ensure proper handling of large payloads for Gemini base64 images
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
};

export default nextConfig;
