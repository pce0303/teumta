import { ExternalApiError, ExternalApiResponseError, externalConfig, requestJson } from '../common';
import type { SkCongestionResponse } from './congestion.dto';

/**
 * SK 지오비전 퍼즐 "실시간 장소 혼잡도" 클라이언트. 통신 책임만, 변환은 congestion.mapper.ts.
 * 인증은 TMAP과 같은 SK Open API appKey 헤더(CONGESTION_API_KEY).
 */

const SERVICE = 'congestion';
const RLTM_PATH = '/place/congestion/rltm/pois';

/** 특정 장소(POI)의 실시간 혼잡도 조회. poiId는 TMAP 장소 통합 검색의 id. */
export async function fetchRealtimeCongestion(
  poiId: string | number,
): Promise<SkCongestionResponse> {
  const { baseUrl, apiKey } = externalConfig.congestion;

  if (!baseUrl) {
    throw new ExternalApiError(SERVICE, 'CONGESTION_API_BASE_URL is not configured', {
      code: 'CONFIG_MISSING',
    });
  }
  if (!apiKey) {
    throw new ExternalApiError(SERVICE, 'CONGESTION_API_KEY is not configured', {
      code: 'CONFIG_MISSING',
    });
  }

  const trimmed = String(poiId).trim();
  if (trimmed.length === 0) {
    throw new ExternalApiError(SERVICE, 'poiId is required', { code: 'INVALID_PARAM' });
  }

  const url = `${baseUrl.replace(/\/+$/, '')}${RLTM_PATH}/${encodeURIComponent(trimmed)}`;
  const response = await requestJson<SkCongestionResponse>({
    service: SERVICE,
    url,
    headers: { appKey: apiKey },
  });
  assertPuzzleOk(response);
  return response;
}

/** 퍼즐 API는 HTTP 200이어도 status.code로 논리 오류를 알린다. 정상 코드는 '00'. */
function assertPuzzleOk(response: SkCongestionResponse): void {
  const code = response.status?.code;
  if (code === '00') {
    return;
  }
  throw new ExternalApiResponseError(
    SERVICE,
    `Puzzle API returned status ${code ?? 'UNKNOWN'}: ${response.status?.message ?? 'Unknown error'}`,
  );
}
