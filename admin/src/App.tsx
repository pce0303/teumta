import { Navigate, Route, Routes } from 'react-router-dom';

import { RequireAuth } from './components/RequireAuth';
import { AdminLayout } from './layouts/AdminLayout';
import { ComingSoonPage } from './pages/ComingSoonPage';
import { DashboardPage } from './pages/DashboardPage';
import { LoginPage } from './pages/LoginPage';
import { MatchingPage } from './pages/MatchingPage';
import { PlaceFormPage } from './pages/PlaceFormPage';
import { PlacesPage } from './pages/PlacesPage';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        element={
          <RequireAuth>
            <AdminLayout />
          </RequireAuth>
        }
      >
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/places" element={<PlacesPage />} />
        <Route path="/places/new" element={<PlaceFormPage mode="create" />} />
        <Route path="/places/:id" element={<PlaceFormPage mode="edit" />} />
        <Route path="/matching" element={<MatchingPage />} />
        <Route
          path="/routes"
          element={
            <ComingSoonPage
              title="코스 관리"
              description="관광지별 우회 코스(Route/RouteStop)를 구성하고 관리하는 도구입니다."
              blockedBy="Route API를 다른 팀원이 구현 중입니다. API 완성 후 연동합니다."
            />
          }
        />
        <Route
          path="/analytics"
          element={
            <ComingSoonPage
              title="성과 분석"
              description="우회 선택률·로컬 도착률·복귀율·평균 우회시간 등 혼잡 분산 효과를 확인하는 화면입니다."
              blockedBy="Trip/TripEvent가 아직 사용자 앱과 실연동되지 않았습니다. 연동 후 실제 데이터로만 제공합니다."
            />
          }
        />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Route>
    </Routes>
  );
}
