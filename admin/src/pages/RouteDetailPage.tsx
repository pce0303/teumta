import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { getErrorMessage } from '../api/client';
import { fetchPlace } from '../api/places';
import { fetchRoute } from '../api/routes';
import { ErrorState, LoadingState } from '../components/Feedback';
import { PlaceTypeBadge } from '../components/PlaceTypeBadge';
import type { Place } from '../types/place';
import type { RouteDetail } from '../types/route';
import { formatDistance, formatDuration } from '../utils/format';

export function RouteDetailPage() {
  const { routeId: routeIdParam } = useParams();
  const parsed = Number(routeIdParam);
  const routeId = Number.isInteger(parsed) && parsed > 0 ? parsed : null;

  const [route, setRoute] = useState<RouteDetail | null>(null);
  const [mainPlace, setMainPlace] = useState<Place | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (routeId === null) {
      setLoading(false);
      setError('코스 ID가 올바르지 않습니다.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const loaded = await fetchRoute(routeId);
      setRoute(loaded);

      // 코스 상세 응답에는 mainPlace 정보가 없어 별도 조회한다.
      // 실패해도 코스 자체는 보여준다(ID만 표시).
      try {
        setMainPlace(await fetchPlace(loaded.mainPlaceId));
      } catch {
        setMainPlace(null);
      }
    } catch (caught) {
      setRoute(null);
      setError(getErrorMessage(caught));
    } finally {
      setLoading(false);
    }
  }, [routeId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return <LoadingState label="코스를 불러오는 중…" />;
  }

  if (error !== null || route === null) {
    return (
      <div className="stack">
        <div className="form-page-top">
          <Link to="/routes" className="back-link">
            ← 코스 목록
          </Link>
        </div>
        <ErrorState
          message={error ?? '코스를 불러오지 못했습니다.'}
          onRetry={routeId === null ? undefined : () => void load()}
        />
      </div>
    );
  }

  const travelMinutesSum = route.stops.reduce(
    (total, stop) => total + (stop.estimatedTravelMinutesFromPrevious ?? 0),
    0,
  );
  const stayMinutesSum = route.stops.reduce(
    (total, stop) => total + (stop.stayMinutes ?? 0),
    0,
  );
  const distanceSum = route.stops.reduce(
    (total, stop) => total + (stop.estimatedDistanceMetersFromPrevious ?? 0),
    0,
  );
  const hasIncompleteStop = route.stops.some(
    (stop) =>
      stop.estimatedTravelMinutesFromPrevious === null ||
      stop.stayMinutes === null,
  );

  return (
    <div className="stack">
      <div className="form-page-top">
        <Link to={`/routes?placeId=${route.mainPlaceId}`} className="back-link">
          ← 코스 목록
        </Link>
      </div>

      <section className="panel">
        <div className="panel-header">
          <h2 className="panel-title">{route.name}</h2>
          <span className="cell-muted">#{route.id}</span>
        </div>
        <p className="panel-caption">{route.description ?? '설명이 없습니다.'}</p>

        <div className="stat-grid">
          <div className="stat">
            <span className="stat-label">기준 관광지</span>
            <span className="stat-value stat-value-small">
              {mainPlace?.name ?? `#${route.mainPlaceId}`}
            </span>
          </div>
          <div className="stat">
            <span className="stat-label">정류지</span>
            <span className="stat-value">{route.stops.length}</span>
          </div>
          <div className="stat">
            <span className="stat-label">저장된 총 소요시간</span>
            <span className="stat-value stat-value-small">
              {formatDuration(route.estimatedTotalDurationMinutes)}
            </span>
          </div>
          <div className="stat">
            <span className="stat-label">저장된 총 이동거리</span>
            <span className="stat-value stat-value-small">
              {formatDistance(route.estimatedTotalDistanceMeters)}
            </span>
          </div>
        </div>
      </section>

      <section className="panel panel-flush">
        <table className="table">
          <thead>
            <tr>
              <th className="cell-number">순서</th>
              <th>장소</th>
              <th>유형</th>
              <th className="cell-number">이전 구간 이동</th>
              <th className="cell-number">이전 구간 거리</th>
              <th className="cell-number">체류</th>
              <th>경로 데이터</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="cell-number">
                <span className="badge badge-neutral">출발</span>
              </td>
              <td>
                {mainPlace ? (
                  <Link to={`/places/${route.mainPlaceId}`} className="table-link">
                    {mainPlace.name}
                  </Link>
                ) : (
                  <span className="cell-muted">#{route.mainPlaceId}</span>
                )}
              </td>
              <td>{mainPlace ? <PlaceTypeBadge type={mainPlace.type} /> : '—'}</td>
              <td className="cell-number cell-muted">—</td>
              <td className="cell-number cell-muted">—</td>
              <td className="cell-number cell-muted">—</td>
              <td className="cell-muted">—</td>
            </tr>
            {route.stops.map((stop) => (
              <tr key={stop.id}>
                <td className="cell-number">{stop.stopOrder}</td>
                <td>
                  <Link to={`/places/${stop.placeId}`} className="table-link">
                    {stop.place.name}
                  </Link>
                </td>
                <td>
                  <PlaceTypeBadge type={stop.place.type} />
                </td>
                <td className="cell-number cell-muted">
                  {formatDuration(stop.estimatedTravelMinutesFromPrevious)}
                </td>
                <td className="cell-number cell-muted">
                  {formatDistance(stop.estimatedDistanceMetersFromPrevious)}
                </td>
                <td className="cell-number cell-muted">
                  {formatDuration(stop.stayMinutes)}
                </td>
                <td className="cell-muted">
                  {Array.isArray(stop.pathFromPrevious)
                    ? `${stop.pathFromPrevious.length}개 좌표`
                    : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="table-footnote">
          정류지 구간 합계: 이동 {formatDuration(travelMinutesSum)} + 체류{' '}
          {formatDuration(stayMinutesSum)} ={' '}
          {formatDuration(travelMinutesSum + stayMinutesSum)} ·{' '}
          {formatDistance(distanceSum)}. 마지막 정류지에서 기준 관광지로 돌아오는
          복귀 구간은 현재 스키마에 저장 필드가 없어 합계에 포함되지 않습니다
          (api-spec §6.5에서 논의 중).
        </p>
        {hasIncompleteStop && (
          <p className="table-footnote">
            ⚠ 이동시간 또는 체류시간이 비어 있는 정류지가 있습니다. 소요시간을
            계산할 수 없어 추천 후보에서 제외될 수 있습니다.
          </p>
        )}
      </section>
    </div>
  );
}
