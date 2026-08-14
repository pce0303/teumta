import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { getErrorMessage } from '../api/client';
import { fetchPlace } from '../api/places';
import { deleteRoute, fetchRoute } from '../api/routes';
import { ErrorState, LoadingState } from '../components/Feedback';
import { PlaceTypeBadge } from '../components/PlaceTypeBadge';
import type { Place } from '../types/place';
import type { RouteDetail } from '../types/route';
import { formatDistance, formatDuration } from '../utils/format';

export function RouteDetailPage() {
  const navigate = useNavigate();
  const { routeId: routeIdParam } = useParams();
  const parsed = Number(routeIdParam);
  const routeId = Number.isInteger(parsed) && parsed > 0 ? parsed : null;

  const [route, setRoute] = useState<RouteDetail | null>(null);
  const [mainPlace, setMainPlace] = useState<Place | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

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

  const handleDelete = async () => {
    if (routeId === null || route === null) {
      return;
    }
    if (!window.confirm(`"${route.name}" 코스를 삭제할까요? 되돌릴 수 없습니다.`)) {
      return;
    }

    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteRoute(routeId);
      void navigate('/routes', { replace: true });
    } catch (caught) {
      setDeleteError(getErrorMessage(caught));
    } finally {
      setDeleting(false);
    }
  };

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

  const computedTotalMinutes =
    travelMinutesSum + stayMinutesSum + (route.returnTravelMinutes ?? 0);
  const totalMismatch =
    route.estimatedTotalDurationMinutes !== null &&
    route.estimatedTotalDurationMinutes !== computedTotalMinutes;

  return (
    <div className="stack">
      <div className="form-page-top">
        <Link to={`/routes?placeId=${route.mainPlaceId}`} className="back-link">
          ← 코스 목록
        </Link>
      </div>

      {deleteError && (
        <div className="banner banner-error" role="alert">
          삭제에 실패했습니다: {deleteError}
        </div>
      )}

      <section className="panel">
        <div className="panel-header">
          <h2 className="panel-title">{route.name}</h2>
          <span className="toolbar-actions">
            <Link
              to={`/routes/${route.id}/edit`}
              className="button button-secondary button-small"
            >
              수정
            </Link>
            <button
              type="button"
              className="button button-danger button-small"
              onClick={() => void handleDelete()}
              disabled={deleting}
            >
              {deleting ? '삭제 중…' : '삭제'}
            </button>
          </span>
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
            <span className="stat-label">총 소요시간</span>
            <span className="stat-value stat-value-small">
              {formatDuration(route.estimatedTotalDurationMinutes)}
            </span>
          </div>
          <div className="stat">
            <span className="stat-label">총 이동거리</span>
            <span className="stat-value stat-value-small">
              {formatDistance(route.estimatedTotalDistanceMeters)}
            </span>
          </div>
          <div className="stat">
            <span className="stat-label">복귀 구간</span>
            <span className="stat-value stat-value-small">
              {route.returnTravelMinutes === null
                ? '미포함'
                : `${formatDuration(route.returnTravelMinutes)} · ${formatDistance(
                  route.returnDistanceMeters,
                )}`}
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
            {route.returnTravelMinutes !== null && (
              <tr>
                <td className="cell-number">
                  <span className="badge badge-neutral">복귀</span>
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
                <td className="cell-number cell-muted">
                  {formatDuration(route.returnTravelMinutes)}
                </td>
                <td className="cell-number cell-muted">
                  {formatDistance(route.returnDistanceMeters)}
                </td>
                <td className="cell-number cell-muted">—</td>
                <td className="cell-muted">
                  {Array.isArray(route.returnPath)
                    ? `${route.returnPath.length}개 좌표`
                    : '—'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <p className="table-footnote">
          구간 합계: 이동 {formatDuration(travelMinutesSum)} + 체류{' '}
          {formatDuration(stayMinutesSum)}
          {route.returnTravelMinutes !== null &&
            ` + 복귀 ${formatDuration(route.returnTravelMinutes)}`}{' '}
          = {formatDuration(computedTotalMinutes)} ·{' '}
          {formatDistance(distanceSum + (route.returnDistanceMeters ?? 0))}
        </p>
        {totalMismatch && (
          <p className="table-footnote">
            ⚠ 저장된 총 소요시간(
            {formatDuration(route.estimatedTotalDurationMinutes)})이 구간 합계와
            다릅니다. 코스를 다시 저장하면 재계산됩니다.
          </p>
        )}
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
