import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';

import logoUrl from '../assets/teumta-logo.png';
import { getApiTargetLabel } from '../api/client';
import { clearToken } from '../utils/auth';

interface NavItem {
  to: string;
  label: string;
  ready: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { to: '/dashboard', label: '대시보드', ready: true },
  { to: '/places', label: '장소 관리', ready: true },
  { to: '/matching', label: '데이터 매칭', ready: true },
  { to: '/routes', label: '코스 관리', ready: true },
  { to: '/analytics', label: '성과 분석', ready: false },
];

function currentPageTitle(pathname: string): string {
  if (pathname === '/places/new') {
    return '새 장소 등록';
  }
  if (pathname === '/routes/new') {
    return '새 코스 등록';
  }
  const item = NAV_ITEMS.find(
    (navItem) =>
      pathname === navItem.to || pathname.startsWith(`${navItem.to}/`),
  );
  return item?.label ?? '틈타 관리자';
}

export function AdminLayout() {
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = () => {
    clearToken();
    void navigate('/login', { replace: true });
  };

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <img src={logoUrl} alt="" className="sidebar-logo" />
          <span className="sidebar-brand-name">틈타</span>
          <span className="sidebar-brand-sub">관리자</span>
        </div>

        <nav className="sidebar-nav">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `sidebar-link${isActive ? ' is-active' : ''}`
              }
            >
              <span>{item.label}</span>
              {!item.ready && <span className="sidebar-badge">준비 중</span>}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-footer-row">
            <span className="sidebar-footer-label">API</span>
            <span className="sidebar-footer-value">{getApiTargetLabel()}</span>
          </div>
          <button
            type="button"
            className="sidebar-logout"
            onClick={handleLogout}
          >
            로그아웃
          </button>
        </div>
      </aside>

      <div className="main">
        <header className="header">
          <h1 className="header-title">{currentPageTitle(location.pathname)}</h1>
        </header>
        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
