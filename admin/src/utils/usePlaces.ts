import { useCallback, useEffect, useState } from 'react';

import { getErrorMessage } from '../api/client';
import { fetchPlaces } from '../api/places';
import type { Place } from '../types/place';

/** 장소 전체 목록 조회 상태(대시보드·장소 관리 공용). 실패 시 mock 없이 오류를 그대로 노출한다. */
export function usePlaces() {
  const [places, setPlaces] = useState<Place[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setPlaces(await fetchPlaces());
    } catch (caught) {
      setPlaces(null);
      setError(getErrorMessage(caught));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { places, loading, error, reload };
}
