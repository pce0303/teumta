import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { getErrorMessage } from '../api/client';
import { fetchRoutesByPlace } from '../api/routes';
import { EmptyState, ErrorState, LoadingState } from '../components/Feedback';
import type { RouteSummary } from '../types/route';
import { formatDateTime, formatDistance, formatDuration } from '../utils/format';
import { usePlaces } from '../utils/usePlaces';

export function RoutesPage() {
  const navigate = useNavigate();
  const { places, loading: placesLoading, error: placesError } = usePlaces();
  const [searchParams, setSearchParams] = useSearchParams();

  const placeIdParam = Number(searchParams.get('placeId'));
  const selectedPlaceId =
    Number.isInteger(placeIdParam) && placeIdParam > 0 ? placeIdParam : null;

  const [routes, setRoutes] = useState<RouteSummary[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** 코스의 기준 장소(mainPlace)는 관광지다. 선택지는 관광지만 노출한다. */
  const touristSpots = useMemo(
    () =>
      (places ?? [])
        .filter((place) => place.type === 'TOURIST_SPOT')
        .sort((first, second) => first.name.localeCompare(second.name, 'ko')),
    [places],
  );

  const selectedPlace = useMemo(
    () => (places ?? []).find((place) => place.id === selectedPlaceId) ?? null,
    [places, selectedPlaceId],
  );

  const load = useCallback(async () => {
    if (selectedPlaceId === null) {
      setRoutes(null);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      setRoutes(await fetchRoutesByPlace(selectedPlaceId));
    } catch (caught) {
      setRoutes(null);
      setError(getErrorMessage(caught));
    } finally {
      setLoading(false);
    }
  }, [selectedPlaceId]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSelect = (value: string) => {
    if (value === '') {
      setSearchParams({});
      return;
    }
    setSearchParams({ placeId: value });
  };

  return (
    <div className="stack">
      <section className="panel">
        <div className="panel-header">
          <h2 className="panel-title">코스 조회</h2>
          <button
            type="button"
            className="button button-secondary button-small"
            onClick={() => void load()}
            disabled={selectedPlaceId === null || loading}
          >
            새로고침
          </button>
        </div>
        <p className="panel-caption">
          코스(Route)는 기준 관광지(mainPlace)별로 등록됩니다. 관광지를 선택하면
          해당 관광지의 우회 코스 목록을 조회합니다. 코스 등록·수정 기능은 서버의
          코스 쓰기 API(api-spec §6.5) 구현 후 이 화면에 추가됩니다.
        </p>

        <label className="field">
          <span className="field-label">기준 관광지</span>
          <select
            className="input"
            value={selectedPlaceId === null ? '' : String(selectedPlaceId)}
            onChange={(event) => handleSelect(event.target.value)}
            disabled={placesLoading || placesError !== null}
          >
            <option value="">
              {placesLoading ? '장소 목록을 불러오는 중…' : '관광지 선택…'}
            </option>
            {touristSpots.map((place) => (
              <option key={place.id} value={place.id}>
                {place.name} (#{place.id})
              </option>
            ))}
          </select>
        </label>
        {placesError !== null && (
          <p className="field-error">장소 목록을 불러오지 못했습니다: {placesError}</p>
        )}
      </section>

      {selectedPlaceId === null ? (
        <EmptyState
          title="관광지를 선택하세요"
          description="선택한 관광지를 기준으로 등록된 우회 코스를 보여줍니다."
        />
      ) : loading ? (
        <LoadingState label="코스 목록을 불러오는 중…" />
      ) : error !== null || routes === null ? (
        <ErrorState
          message={error ?? '코스 목록을 불러오지 못했습니다.'}
          onRetry={() => void load()}
        />
      ) : routes.length === 0 ? (
        <EmptyState
          title="등록된 코스가 없습니다"
          description={`${
            selectedPlace?.name ?? `#${selectedPlaceId}`
          } 를 기준으로 등록된 코스가 아직 없습니다.`}
        />
      ) : (
        <section className="panel panel-flush">
          <table className="table">
            <thead>
              <tr>
                <th className="cell-number">ID</th>
                <th>코스명</th>
                <th>설명</th>
                <th className="cell-number">예상 소요</th>
                <th className="cell-number">예상 거리</th>
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
                  <td className="cell-muted cell-ellipsis">
                    {route.description ?? '—'}
                  </td>
                  <td className="cell-number cell-muted">
                    {formatDuration(route.estimatedTotalDurationMinutes)}
                  </td>
                  <td className="cell-number cell-muted">
                    {formatDistance(route.estimatedTotalDistanceMeters)}
                  </td>
                  <td className="cell-muted">{formatDateTime(route.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="table-footnote">
            {routes.length.toLocaleString()}개 코스 · 정류지 구성은 코스를 눌러
            상세에서 확인합니다.
          </p>
        </section>
      )}
    </div>
  );
}
