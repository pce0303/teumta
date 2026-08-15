import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { getErrorMessage } from '../api/client';
import { createRoute, fetchRoute, updateRoute } from '../api/routes';
import { ErrorState, LoadingState } from '../components/Feedback';
import type { Place } from '../types/place';
import type { CreateRouteInput } from '../types/route';
import { usePlaces } from '../utils/usePlaces';

interface StopRow {
  /** 순서 변경 시 입력 상태가 섞이지 않도록 행마다 고정 키. */
  key: number;
  placeId: string;
  stayMinutes: string;
}

interface RouteFormPageProps {
  mode: 'create' | 'edit';
}

function isPositiveInt(value: string): boolean {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0;
}

export function RouteFormPage({ mode }: RouteFormPageProps) {
  const navigate = useNavigate();
  const { routeId: routeIdParam } = useParams();
  const parsedRouteId = Number(routeIdParam);
  const routeId =
    Number.isInteger(parsedRouteId) && parsedRouteId > 0 ? parsedRouteId : null;

  const { places, loading: placesLoading } = usePlaces();

  const [name, setName] = useState('');
  const [mainPlaceId, setMainPlaceId] = useState('');
  const [description, setDescription] = useState('');
  const [includeReturn, setIncludeReturn] = useState(true);
  const [stops, setStops] = useState<StopRow[]>([
    { key: 0, placeId: '', stayMinutes: '' },
  ]);

  const nextKey = useRef(1);
  const [loading, setLoading] = useState(mode === 'edit');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const loadRoute = useCallback(async () => {
    if (mode !== 'edit' || routeId === null) {
      return;
    }
    setLoading(true);
    setLoadError(null);
    try {
      const route = await fetchRoute(routeId);
      setName(route.name);
      setMainPlaceId(String(route.mainPlaceId));
      setDescription(route.description ?? '');
      setIncludeReturn(route.returnTravelMinutes !== null);
      setStops(
        route.stops.map((stop, index) => ({
          key: index,
          placeId: String(stop.placeId),
          stayMinutes: stop.stayMinutes === null ? '' : String(stop.stayMinutes),
        })),
      );
      nextKey.current = route.stops.length;
    } catch (caught) {
      setLoadError(getErrorMessage(caught));
    } finally {
      setLoading(false);
    }
  }, [mode, routeId]);

  useEffect(() => {
    void loadRoute();
  }, [loadRoute]);

  const placeById = useMemo(
    () => new Map((places ?? []).map((place) => [place.id, place])),
    [places],
  );

  const sortedPlaces = useMemo(
    () =>
      [...(places ?? [])].sort((first, second) =>
        first.name.localeCompare(second.name, 'ko'),
      ),
    [places],
  );

  const touristSpots = useMemo(
    () => sortedPlaces.filter((place) => place.type === 'TOURIST_SPOT'),
    [sortedPlaces],
  );

  const updateStop = (key: number, patch: Partial<StopRow>) => {
    setStops((previous) =>
      previous.map((stop) => (stop.key === key ? { ...stop, ...patch } : stop)),
    );
  };

  /** 장소 선택 시 비어 있는 체류시간만 추천값으로 채움(입력값 보존). */
  const handleStopPlaceChange = (row: StopRow, value: string) => {
    const place: Place | undefined = placeById.get(Number(value));
    const shouldPrefill =
      row.stayMinutes.trim() === '' &&
      place?.recommendedDuration !== null &&
      place?.recommendedDuration !== undefined;

    updateStop(row.key, {
      placeId: value,
      ...(shouldPrefill ? { stayMinutes: String(place!.recommendedDuration) } : {}),
    });
  };

  const moveStop = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= stops.length) {
      return;
    }
    setStops((previous) => {
      const next = [...previous];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const addStop = () => {
    setStops((previous) => [
      ...previous,
      { key: nextKey.current++, placeId: '', stayMinutes: '' },
    ]);
  };

  const removeStop = (key: number) => {
    setStops((previous) => previous.filter((stop) => stop.key !== key));
  };

  function validate(): CreateRouteInput | null {
    if (name.trim() === '') {
      setFormError('코스명을 입력하세요.');
      return null;
    }
    if (!isPositiveInt(mainPlaceId)) {
      setFormError('기준 관광지를 선택하세요.');
      return null;
    }
    if (stops.length === 0) {
      setFormError('정류지를 1개 이상 추가하세요.');
      return null;
    }

    const parsedStops: CreateRouteInput['stops'] = [];
    for (const [index, stop] of stops.entries()) {
      if (!isPositiveInt(stop.placeId)) {
        setFormError(`${index + 1}번 정류지의 장소를 선택하세요.`);
        return null;
      }
      if (!isPositiveInt(stop.stayMinutes)) {
        setFormError(`${index + 1}번 정류지의 체류시간은 1분 이상이어야 합니다.`);
        return null;
      }
      if (Number(stop.placeId) === Number(mainPlaceId)) {
        setFormError('기준 관광지는 정류지로 넣을 수 없습니다.');
        return null;
      }
      parsedStops.push({
        placeId: Number(stop.placeId),
        stayMinutes: Number(stop.stayMinutes),
      });
    }

    setFormError(null);
    return {
      name: name.trim(),
      mainPlaceId: Number(mainPlaceId),
      description: description.trim() === '' ? null : description.trim(),
      includeReturn,
      stops: parsedStops,
    };
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    const input = validate();
    if (input === null) {
      return;
    }

    setSaving(true);
    setSaveError(null);
    try {
      const saved =
        mode === 'create' || routeId === null
          ? await createRoute(input)
          : await updateRoute(routeId, input);
      void navigate(`/routes/${saved.id}`, { replace: true });
    } catch (caught) {
      setSaveError(getErrorMessage(caught));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <LoadingState label="코스를 불러오는 중…" />;
  }

  if (loadError !== null) {
    return <ErrorState message={loadError} onRetry={() => void loadRoute()} />;
  }

  const backTo = mode === 'edit' && routeId !== null ? `/routes/${routeId}` : '/routes';

  return (
    <div className="stack form-page">
      <div className="form-page-top">
        <Link to={backTo} className="back-link">
          ← {mode === 'edit' ? '코스 상세' : '코스 목록'}
        </Link>
      </div>

      {saveError && (
        <div className="banner banner-error" role="alert">
          저장에 실패했습니다: {saveError}
        </div>
      )}
      {formError && (
        <div className="banner banner-error" role="alert">
          {formError}
        </div>
      )}

      <form className="panel form" onSubmit={(event) => void handleSubmit(event)}>
        <fieldset className="form-section" disabled={saving}>
          <legend className="form-section-title">기본 정보</legend>
          <div className="form-grid">
            <label className="field">
              <span className="field-label">
                코스명 <em className="field-required">*</em>
              </span>
              <input
                className="input"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="예: 경복궁 60분 우회 코스"
              />
            </label>

            <label className="field">
              <span className="field-label">
                기준 관광지 <em className="field-required">*</em>
              </span>
              <select
                className="input"
                value={mainPlaceId}
                onChange={(event) => setMainPlaceId(event.target.value)}
                disabled={placesLoading}
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
              <span className="field-hint">
                혼잡할 때 사용자가 우회를 시작하는 관광지입니다.
              </span>
            </label>

            <label className="field field-wide">
              <span className="field-label">설명</span>
              <textarea
                className="textarea"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                rows={2}
                placeholder="예: 서촌 골목 상권을 도는 짧은 코스"
              />
            </label>

            <label className="field field-wide">
              <span className="field-label">복귀 구간</span>
              <span>
                <input
                  type="checkbox"
                  checked={includeReturn}
                  onChange={(event) => setIncludeReturn(event.target.checked)}
                />{' '}
                마지막 정류지에서 기준 관광지로 돌아오는 구간을 포함합니다.
              </span>
              <span className="field-hint">
                포함하면 복귀 이동시간이 총 소요시간에 더해집니다. 원 관광지로 돌아오는
                흐름이 기본이라 켜 두는 것을 권장합니다.
              </span>
            </label>
          </div>
        </fieldset>

        <fieldset className="form-section" disabled={saving}>
          <legend className="form-section-title">정류지 구성</legend>
          <p className="panel-caption">
            방문 순서대로 장소와 체류시간을 입력합니다. 이동시간·거리·지도 경로는 저장할 때
            서버가 TMAP으로 계산합니다(정류지 수 + 복귀 1회만큼 외부 호출).
          </p>

          <table className="table table-plain">
            <thead>
              <tr>
                <th className="cell-number">순서</th>
                <th>장소</th>
                <th className="cell-number">체류(분)</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {stops.map((stop, index) => (
                <tr key={stop.key}>
                  <td className="cell-number cell-muted">{index + 1}</td>
                  <td>
                    <select
                      className="input"
                      value={stop.placeId}
                      onChange={(event) => handleStopPlaceChange(stop, event.target.value)}
                      disabled={placesLoading}
                    >
                      <option value="">장소 선택…</option>
                      {sortedPlaces
                        .filter((place) => String(place.id) !== mainPlaceId)
                        .map((place) => (
                          <option key={place.id} value={place.id}>
                            {place.name} (#{place.id})
                          </option>
                        ))}
                    </select>
                  </td>
                  <td className="cell-number">
                    <input
                      className="input"
                      inputMode="numeric"
                      value={stop.stayMinutes}
                      onChange={(event) =>
                        updateStop(stop.key, { stayMinutes: event.target.value })
                      }
                      placeholder="20"
                    />
                  </td>
                  <td>
                    <button
                      type="button"
                      className="button button-secondary button-small"
                      onClick={() => moveStop(index, -1)}
                      disabled={index === 0}
                      aria-label="위로"
                    >
                      ↑
                    </button>{' '}
                    <button
                      type="button"
                      className="button button-secondary button-small"
                      onClick={() => moveStop(index, 1)}
                      disabled={index === stops.length - 1}
                      aria-label="아래로"
                    >
                      ↓
                    </button>{' '}
                    <button
                      type="button"
                      className="button button-danger button-small"
                      onClick={() => removeStop(stop.key)}
                    >
                      삭제
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <button
            type="button"
            className="button button-secondary"
            onClick={addStop}
          >
            정류지 추가
          </button>
        </fieldset>

        <div className="form-actions">
          <div className="form-actions-left">
            <Link to={backTo} className="button button-secondary">
              취소
            </Link>
          </div>
          <button type="submit" className="button button-primary" disabled={saving}>
            {saving ? '경로 계산 중…' : mode === 'create' ? '코스 등록' : '저장'}
          </button>
        </div>
      </form>
    </div>
  );
}
