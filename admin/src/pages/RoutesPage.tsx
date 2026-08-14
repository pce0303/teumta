import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

import { getErrorMessage } from '../api/client';
import { fetchAllRoutes } from '../api/routes';
import { EmptyState, ErrorState, LoadingState } from '../components/Feedback';
import type { RouteListItem } from '../types/route';
import { formatDateTime, formatDistance, formatDuration } from '../utils/format';
import { usePlaces } from '../utils/usePlaces';

export function RoutesPage() {
  const navigate = useNavigate();
  const { places, loading: placesLoading } = usePlaces();
  const [searchParams, setSearchParams] = useSearchParams();

  const placeIdParam = Number(searchParams.get('placeId'));
  const filterPlaceId =
    Number.isInteger(placeIdParam) && placeIdParam > 0 ? placeIdParam : null;

  const [routes, setRoutes] = useState<RouteListItem[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /** 코스의 기준 장소(mainPlace)는 관광지다. 필터 선택지도 관광지만 노출한다. */
  const touristSpots = useMemo(
    () =>
      (places ?? [])
        .filter((place) => place.type === 'TOURIST_SPOT')
        .sort((first, second) => first.name.localeCompare(second.name, 'ko')),
    [places],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRoutes(await fetchAllRoutes(filterPlaceId ?? undefined));
    } catch (caught) {
      setRoutes(null);
      setError(getErrorMessage(caught));
    } finally {
      setLoading(false);
    }
  }, [filterPlaceId]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleFilterChange = (value: string) => {
    setSearchParams(value === '' ? {} : { placeId: value });
  };

  return (
    <div className="stack">
      <div className="toolbar">
        <label className="field">
          <span className="field-label">기준 관광지 필터</span>
          <select
            className="input"
            value={filterPlaceId === null ? '' : String(filterPlaceId)}
            onChange={(event) => handleFilterChange(event.target.value)}
            disabled={placesLoading}
          >
            <option value="">전체</option>
            {touristSpots.map((place) => (
              <option key={place.id} value={place.id}>
                {place.name} (#{place.id})
              </option>
            ))}
          </select>
        </label>

        <div className="toolbar-actions">
          <button
            type="button"
            className="button button-secondary"
            onClick={() => void load()}
            disabled={loading}
          >
            새로고침
          </button>
          <Link to="/routes/new" className="button button-primary">
            새 코스 등록
          </Link>
        </div>
      </div>

      {loading ? (
        <LoadingState label="코스 목록을 불러오는 중…" />
      ) : error !== null || routes === null ? (
        <ErrorState
          message={error ?? '코스 목록을 불러오지 못했습니다.'}
          onRetry={() => void load()}
        />
      ) : routes.length === 0 ? (
        <EmptyState
          title={
            filterPlaceId === null
              ? '등록된 코스가 없습니다'
              : '이 관광지의 코스가 없습니다'
          }
          description="새 코스 등록으로 우회 코스를 만들면 사용자 앱의 코스 화면과 성과 분석에 쓰입니다."
        />
      ) : (
        <section className="panel panel-flush">
          <table className="table">
            <thead>
              <tr>
                <th className="cell-number">ID</th>
                <th>코스명</th>
                <th>기준 관광지</th>
                <th className="cell-number">정류지</th>
                <th className="cell-number">예상 소요</th>
                <th className="cell-number">예상 거리</th>
                <th>복귀</th>
                <th>수정일</th>
              </tr>
            </thead>
            <tbody>
              {routes.map((route) => (
                <tr
                  key={route.id}
                  className="row-clickable"
                  onClick={() => void navigate(`/routes/${route.id}`)}
                >
                  <td className="cell-number cell-muted">{route.id}</td>
                  <td>
                    <span className="table-link">{route.name}</span>
                  </td>
                  <td className="cell-muted cell-ellipsis">{route.mainPlaceName}</td>
                  <td className="cell-number cell-muted">{route.stopCount}</td>
                  <td className="cell-number cell-muted">
                    {formatDuration(route.estimatedTotalDurationMinutes)}
                  </td>
                  <td className="cell-number cell-muted">
                    {formatDistance(route.estimatedTotalDistanceMeters)}
                  </td>
                  <td className="cell-muted">
                    {route.returnTravelMinutes === null
                      ? '미포함'
                      : formatDuration(route.returnTravelMinutes)}
                  </td>
                  <td className="cell-muted">{formatDateTime(route.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="table-footnote">
            {routes.length.toLocaleString()}개 코스
          </p>
        </section>
      )}
    </div>
  );
}
