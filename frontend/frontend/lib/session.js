import { cookies } from 'next/headers';
import { decodeToken } from './auth';
import { getBackendUrl } from './backend-url';

export async function getSession() {
  const store = await cookies();
  const token = store.get('token')?.value;
  const user = decodeToken(token);
  return user ? { token, user } : null;
}

export async function backendFetch(path, init = {}) {
  const session = await getSession();
  const headers = { ...(init.headers || {}) };
  if (session) headers.Authorization = `Bearer ${session.token}`;

  const res = await fetch(`${getBackendUrl()}${path}`, {
    ...init,
    headers,
    cache: 'no-store',
  });

  if (!res.ok) return null;
  return res.json();
}
