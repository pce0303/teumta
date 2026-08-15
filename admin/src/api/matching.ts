import { apiRequest } from './client';
import type {
  ForecastAlias,
  MatchingIngestResult,
  MatchingPreviewResult,
} from '../types/matching';

/**
 * GET /api/admin/concentration-matching/preview — KTO 외부 API 1회 호출.
 * 호출량 관리 대상 → 버튼 클릭 시에만, 자동 폴링 금지.
 */
export function fetchMatchingPreview(
  areaCd: string,
  signguCd: string,
): Promise<MatchingPreviewResult> {
  const query = new URLSearchParams({ areaCd, signguCd });
  return apiRequest<MatchingPreviewResult>(
    `/admin/concentration-matching/preview?${query.toString()}`,
  );
}

/** POST /api/admin/concentration-matching/ingest — 해당 지역 적재 즉시 실행. */
export function runMatchingIngest(
  areaCd: string,
  signguCd: string,
): Promise<MatchingIngestResult> {
  return apiRequest<MatchingIngestResult>('/admin/concentration-matching/ingest', {
    method: 'POST',
    body: JSON.stringify({ areaCd, signguCd }),
  });
}

/** GET /api/admin/concentration-matching/aliases */
export function fetchAliases(): Promise<ForecastAlias[]> {
  return apiRequest<ForecastAlias[]>('/admin/concentration-matching/aliases');
}

/** POST /api/admin/concentration-matching/aliases — 같은 키면 대상 장소 교체(upsert). */
export function saveAlias(input: {
  areaCd: string;
  signguCd: string;
  tAtsNm: string;
  placeId: number;
}): Promise<ForecastAlias> {
  return apiRequest<ForecastAlias>('/admin/concentration-matching/aliases', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

/** DELETE /api/admin/concentration-matching/aliases/:id */
export function deleteAlias(id: number): Promise<{ deleted: boolean }> {
  return apiRequest<{ deleted: boolean }>(
    `/admin/concentration-matching/aliases/${id}`,
    { method: 'DELETE' },
  );
}
