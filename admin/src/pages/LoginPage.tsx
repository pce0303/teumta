import { useState, useSyncExternalStore } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';

import logoUrl from '../assets/teumta-logo.png';
import { login } from '../api/auth';
import { getErrorMessage } from '../api/client';
import { getStoredToken, subscribeAuth } from '../utils/auth';

export function LoginPage() {
  const token = useSyncExternalStore(subscribeAuth, getStoredToken);
  const navigate = useNavigate();
  const location = useLocation();
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const from =
    (location.state as { from?: string } | null)?.from ?? '/dashboard';

  if (token !== null) {
    return <Navigate to={from} replace />;
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (password.length === 0) {
      setError('비밀번호를 입력하세요.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await login(password);
      navigate(from, { replace: true });
    } catch (caught) {
      setError(getErrorMessage(caught));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="login-screen">
      <form
        className="login-card"
        onSubmit={(event) => void handleSubmit(event)}
      >
        <img src={logoUrl} alt="틈타 로고" className="login-logo" />
        <h1 className="login-title">틈타 관리자</h1>
        <p className="login-caption">
          운영 도구입니다. 관리자 비밀번호로 로그인하세요.
        </p>

        <label className="field">
          <span className="field-label">비밀번호</span>
          <input
            type="password"
            className="input"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoFocus
            autoComplete="current-password"
            disabled={submitting}
          />
        </label>

        {error && (
          <div className="banner banner-error" role="alert">
            {error}
          </div>
        )}

        <button
          type="submit"
          className="button button-primary login-submit"
          disabled={submitting}
        >
          {submitting ? '확인 중…' : '로그인'}
        </button>
      </form>
    </div>
  );
}
