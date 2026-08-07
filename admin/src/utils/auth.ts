/**
 * 관리자 토큰 저장소(localStorage).
 *
 * 토큰은 서버(POST /api/admin/login)가 발급한 만료 있는 HMAC 토큰이다.
 * 비밀번호/secret은 어떤 형태로도 프론트 코드·번들에 두지 않는다.
 */

const TOKEN_KEY = 'teumta-admin-token';
const EXPIRES_KEY = 'teumta-admin-token-expires';
const AUTH_EVENT = 'teumta-auth-changed';

function notifyAuthChanged() {
  window.dispatchEvent(new Event(AUTH_EVENT));
}

/** 유효한(만료 전) 토큰. 만료됐으면 정리하고 null. */
export function getStoredToken(): string | null {
  const token = localStorage.getItem(TOKEN_KEY);
  const expiresAt = localStorage.getItem(EXPIRES_KEY);

  if (!token || !expiresAt) {
    return null;
  }

  const expiresAtMs = new Date(expiresAt).getTime();
  if (!Number.isFinite(expiresAtMs) || expiresAtMs <= Date.now()) {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(EXPIRES_KEY);
    return null;
  }

  return token;
}

export function storeToken(token: string, expiresAt: string) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(EXPIRES_KEY, expiresAt);
  notifyAuthChanged();
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(EXPIRES_KEY);
  notifyAuthChanged();
}

/** RequireAuth 등에서 useSyncExternalStore로 구독한다. */
export function subscribeAuth(callback: () => void): () => void {
  window.addEventListener(AUTH_EVENT, callback);
  window.addEventListener('storage', callback);
  return () => {
    window.removeEventListener(AUTH_EVENT, callback);
    window.removeEventListener('storage', callback);
  };
}
