/**
 * Normalize backend URL from Vercel/Railway env vars.
 * Handles accidental "BACKEND_URL=https://..." values copied from .env files.
 */
export function getBackendUrl() {
  let raw =
    process.env.BACKEND_URL ||
    process.env.NEXT_PUBLIC_BACKEND_URL ||
    'http://localhost:8000';

  raw = raw.trim();
  if (raw.startsWith('BACKEND_URL=')) {
    raw = raw.slice('BACKEND_URL='.length);
  }
  if (raw.startsWith('NEXT_PUBLIC_BACKEND_URL=')) {
    raw = raw.slice('NEXT_PUBLIC_BACKEND_URL='.length);
  }

  return raw.replace(/\/+$/, '');
}
