import { jwtDecode } from 'jwt-decode';

export function decodeToken(token) {
  if (!token) return null;
  try {
    const payload = jwtDecode(token);
    if (payload.exp && Date.now() >= payload.exp * 1000) return null;
    return { email: payload.sub, role: payload.role, fullName: payload.full_name };
  } catch {
    return null;
  }
}
