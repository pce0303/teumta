import { apiRequest } from './client';
import { storeToken } from '../utils/auth';

interface LoginResult {
  token: string;
  expiresAt: string;
}

/** POST /api/admin/login — 성공 시 토큰을 저장한다. */
export async function login(password: string): Promise<void> {
  const result = await apiRequest<LoginResult>('/admin/login', {
    method: 'POST',
    body: JSON.stringify({ password }),
  });
  storeToken(result.token, result.expiresAt);
}
