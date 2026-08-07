import { useSyncExternalStore } from 'react';
import { Navigate, useLocation } from 'react-router-dom';

import { getStoredToken, subscribeAuth } from '../utils/auth';

/** 토큰이 없거나 만료되면 로그인 화면으로 보낸다(원래 가려던 경로 유지). */
export function RequireAuth({ children }: { children: React.ReactNode }) {
  const token = useSyncExternalStore(subscribeAuth, getStoredToken);
  const location = useLocation();

  if (token === null) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: `${location.pathname}${location.search}` }}
      />
    );
  }

  return children;
}
