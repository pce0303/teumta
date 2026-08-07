import { Link } from 'react-router-dom';

import { EmptyState, ErrorState, LoadingState } from '../components/Feedback';
import { PlaceTypeBadge } from '../components/PlaceTypeBadge';
import type { Place } from '../types/place';
import { formatDateTime } from '../utils/format';
import { usePlaces } from '../utils/usePlaces';

const RECENT_COUNT = 5;

/** TripEvent 실연동 전까지는 수치를 만들지 않고 항목명만 보여준다(Never Fake Analytics). */
const PENDING_METRICS = [
  '오늘 이용자',
  '우회 선택률',
  '로컬 장소 도착률',
  '원 관광지 복귀율',
  '평균 우회시간',
];

function recentPlaces(places: Place[]): Place[] {
  return [...places]
    .sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    )
    .slice(0, RECENT_COUNT);
}

export function DashboardPage() {
  const { places, loading, error, reload } = usePlaces();

  if (loading) {
    return <LoadingState label="장소 데이터를 불러오는 중…" />;
  }

  if (error !== null || places === null) {
    return (
      <ErrorState
        message={error ?? '장소 데이터를 불러오지 못했습니다.'}
        onRetry={() => void reload()}
      />
    );
  }

  const touristCount = places.filter(
    (place) => place.type === 'TOURIST_SPOT',
  ).length;
  const localCount = places.length - touristCount;

  const missingDescription = places.filter(
    (place) => !place.description,
  ).length;
  const missingDuration = places.filter(
    (place) => place.recommendedDuration === null,
  ).length;
  const missingHours = places.filter(
    (place) => !place.openingTime && !place.closingTime,
  ).length;
  const missingTags = places.filter((place) => place.tags.length === 0).length;

  return (
    <div className="stack">
      <section aria-label="장소 현황">
        <div className="stat-grid">
          <div className="stat">
            <span className="stat-label">전체 등록 장소</span>
            <span className="stat-value">{places.length.toLocaleString()}</span>
          </div>
          <div className="stat">
            <span className="stat-label">관광지</span>
            <span className="stat-value">{touristCount.toLocaleString()}</span>
          </div>
          <div className="stat">
            <span className="stat-label">로컬 장소</span>
            <span className="stat-value">{localCount.toLocaleString()}</span>
          </div>
          <div className="stat">
            <span className="stat-label">마지막 데이터 변경</span>
            <span className="stat-value stat-value-small">
              {places.length > 0
                ? formatDateTime(
                  places
                    .map((place) => place.updatedAt)
                    .sort()
                    .at(-1)!,
                )
                : '—'}
            </span>
          </div>
        </div>
      </section>

      <div className="dashboard-columns">
        <section className="panel">
          <div className="panel-header">
            <h2 className="panel-title">큐레이션 미입력 현황</h2>
            <Link to="/places" className="panel-link">
              장소 관리로 이동
            </Link>
          </div>
          <p className="panel-caption">
            우회 코스 추천 품질에 필요한 운영 정보가 비어 있는 장소 수입니다.
          </p>
          <table className="table table-plain">
            <tbody>
              <tr>
                <td>설명 미입력</td>
                <td className="cell-number">{missingDescription}곳</td>
              </tr>
              <tr>
                <td>추천 체류시간 미입력</td>
                <td className="cell-number">{missingDuration}곳</td>
              </tr>
              <tr>
                <td>운영시간 미입력</td>
                <td className="cell-number">{missingHours}곳</td>
              </tr>
              <tr>
                <td>태그 미지정</td>
                <td className="cell-number">{missingTags}곳</td>
              </tr>
            </tbody>
          </table>
        </section>

        <section className="panel">
          <div className="panel-header">
            <h2 className="panel-title">최근 수정된 장소</h2>
          </div>
          {places.length === 0 ? (
            <EmptyState title="등록된 장소가 없습니다" />
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>이름</th>
                  <th>유형</th>
                  <th>수정일</th>
                </tr>
              </thead>
              <tbody>
                {recentPlaces(places).map((place) => (
                  <tr key={place.id}>
                    <td>
                      <Link to={`/places/${place.id}`} className="table-link">
                        {place.name}
                      </Link>
                    </td>
                    <td>
                      <PlaceTypeBadge type={place.type} />
                    </td>
                    <td className="cell-muted">
                      {formatDateTime(place.updatedAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>

      <section className="panel">
        <div className="panel-header">
          <h2 className="panel-title">이용 분석</h2>
          <span className="badge badge-neutral">준비 중</span>
        </div>
        <p className="panel-caption">
          아래 지표는 Trip/TripEvent가 사용자 앱과 실연동된 뒤 실제 데이터로만
          제공합니다. 임의 수치는 표시하지 않습니다.
        </p>
        <ul className="pending-metrics">
          {PENDING_METRICS.map((metric) => (
            <li key={metric} className="pending-metric">
              <span>{metric}</span>
              <span className="cell-muted">TripEvent 연동 후 제공 예정</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
