/** @type {import('next').NextConfig} */
const backendUrl = (process.env.NEXT_PUBLIC_BACKEND_URL || process.env.BACKEND_URL || '')
  .trim()
  .replace(/\/+$/, '');

const nextConfig = {
  // Expose backend URL to the browser so scan uploads bypass the Vercel proxy.
  env: {
    NEXT_PUBLIC_BACKEND_URL: backendUrl,
  },
};

export default nextConfig;
