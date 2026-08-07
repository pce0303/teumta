import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { EmptyState, ErrorState, LoadingState } from '../components/Feedback';
import { PlaceTypeBadge } from '../components/PlaceTypeBadge';
import type { Place, PlaceType } from '../types/place';
import {
  formatDateTime,
  formatDuration,
  formatOperatingHours,
} from '../utils/format';
import { usePlaces } from '../utils/usePlaces';

type TypeFilter = 'ALL' | PlaceType;

const TYPE_FILTERS: { value: TypeFilter; label: string }[] = [
  { value: 'ALL', label: '전체' },
  { value: 'TOURIST_SPOT', label: '관광지' },
  { value: 'LOCAL_PLACE', label: '로컬 장소' },
];

/** 이름·주소 클라이언트 검색. 목록 규모(수백 건)에서는 서버 검색이 필요 없다. */
function filterPlaces(
  places: Place[],
  typeFilter: TypeFilter,
  keyword: string,
): Place[] {
  const normalized = keyword.trim().toLowerCase();

  return places.filter((place) => {
    if (typeFilter !== 'ALL' && place.type !== typeFilter) {
      return false;
    }
    if (normalized === '') {
      return true;
    }
    return (
      place.name.toLowerCase().includes(normalized) ||
      (place.address ?? '').toLowerCase().includes(normalized)
    );
  });
}

export function PlacesPage() {
  const navigate = useNavigate();
  const { places, loading, error, reload } = usePlaces();
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('ALL');
  const [keyword, setKeyword] = useState('');

  const filtered = useMemo(
    () => (places ? filterPlaces(places, typeFilter, keyword) : []),
    [places, typeFilter, keyword],
  );

  const countByFilter = useMemo(() => {
    const counts: Record<TypeFilter, number> = {
      ALL: places?.length ?? 0,
      TOURIST_SPOT: 0,
      LOCAL_PLACE: 0,
    };
    for (const place of places ?? []) {
      counts[place.type] += 1;
    }
    return counts;
  }, [places]);

  return (
    <div className="stack">
      <div className="toolbar">
        <div className="segmented" role="group" aria-label="장소 유형 필터">
          {TYPE_FILTERS.map((filter) => (
            <button
              key={filter.value}
              type="button"
              className={`segmented-item${
                typeFilter === filter.value ? ' is-active' : ''
              }`}
              onClick={() => setTypeFilter(filter.value)}
            >
              {filter.label}
              <span className="segmented-count">
                {countByFilter[filter.value]}
              </span>
            </button>
          ))}
        </div>

        <input
          type="search"
          className="input toolbar-search"
          placeholder="이름·주소 검색"
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
        />

        <div className="toolbar-actions">
          <button
            type="button"
            className="button button-secondary"
            onClick={() => void reload()}
            disabled={loading}
          >
            새로고침
          </button>
          <Link to="/places/new" className="button button-primary">
            새 장소 등록
          </Link>
        </div>
      </div>

      {loading ? (
        <LoadingState label="장소 목록을 불러오는 중…" />
      ) : error !== null || places === null ? (
        <ErrorState
          message={error ?? '장소 목록을 불러오지 못했습니다.'}
          onRetry={() => void reload()}
        />
      ) : places.length === 0 ? (
        <EmptyState
          title="등록된 장소가 없습니다"
          description="새 장소 등록으로 첫 장소를 추가하세요."
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          title="조건에 맞는 장소가 없습니다"
          description="필터나 검색어를 변경해 보세요."
        />
      ) : (
        <section className="panel panel-flush">
          <table className="table">
            <thead>
              <tr>
                <th className="cell-number">ID</th>
                <th>이름</th>
                <th>유형</th>
                <th>주소</th>
                <th>태그</th>
                <th>추천 체류</th>
                <th>운영시간</th>
                <th>수정일</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((place) => (
                <tr
                  key={place.id}
                  className="row-clickable"
                  onClick={() => void navigate(`/places/${place.id}`)}
                >
                  <td className="cell-number cell-muted">{place.id}</td>
                  <td>
                    <span className="table-link">{place.name}</span>
                  </td>
                  <td>
                    <PlaceTypeBadge type={place.type} />
                  </td>
                  <td className="cell-muted cell-ellipsis">
                    {place.address ?? '—'}
                  </td>
                  <td>
                    {place.tags.length === 0 ? (
                      <span className="cell-muted">—</span>
                    ) : (
                      <span className="tag-list">
                        {place.tags.map((tag) => (
                          <span key={tag.id} className="tag">
                            {tag.name}
                          </span>
                        ))}
                      </span>
                    )}
                  </td>
                  <td className="cell-muted">
                    {formatDuration(place.recommendedDuration)}
                  </td>
                  <td className="cell-muted">
                    {formatOperatingHours(place.openingTime, place.closingTime)}
                  </td>
                  <td className="cell-muted">
                    {formatDateTime(place.updatedAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="table-footnote">
            {filtered.length.toLocaleString()}개 표시 / 전체{' '}
            {places.length.toLocaleString()}개
          </p>
        </section>
      )}
    </div>
  );
}
