/**
 * @type {import('next').NextConfig}
 * Env vars (from .env): NEXTAUTH_URL, NEXTAUTH_SECRET, BACKEND_INTERNAL_API_KEY,
 * API_BASE, APP_DATABASE_URL, AUTH_DATABASE_URL, AUTH_SECRET, AUTH_URL,
 * GOOGLE_*, LINKEDIN_*, NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY.
 */
const nextConfig = {
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
  },
};

module.exports = nextConfig;
