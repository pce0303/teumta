import {
  ExternalApiError,
  ExternalApiNotFoundError,
  ExternalApiResponseError,
  externalConfig,
  requestJson,
} from '../common';
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
    // 커버리지 밖 POI를 400으로 알려주므로 본문을 읽어 "없음"과 실제 장애를 구분한다.
    acceptStatuses: [400, 404],
  });
  assertPuzzleOk(response);
  return response;
}

/** SK가 "이 POI는 다루지 않는다"고 알릴 때 쓰는 오류 메시지. */
const NOT_FOUND_POI_MESSAGE = 'NOT_FOUND_POI';

/**
 * 퍼즐 API는 HTTP 200이어도 status.code로 논리 오류를 알리고(정상 '00'),
 * 커버리지 밖 POI는 400 + error 봉투로 알린다.
 * 후자는 연동 장애가 아니라 "데이터 없음"이므로 404로 내려야 한다(502 아님).
 */
function assertPuzzleOk(response: SkCongestionResponse): void {
  const error = response.error;
  if (error) {
    if (error.message === NOT_FOUND_POI_MESSAGE || error.code === '404') {
      throw new ExternalApiNotFoundError(SERVICE, 'Puzzle API has no data for this POI', {
        code: 'CONGESTION_DATA_NOT_FOUND',
      });
    }
    throw new ExternalApiResponseError(
      SERVICE,
      `Puzzle API returned error ${error.code ?? 'UNKNOWN'}`,
    );
  }

  const code = response.status?.code;
  if (code === '00') {
    return;
  }
  throw new ExternalApiResponseError(
    SERVICE,
    `Puzzle API returned status ${code ?? 'UNKNOWN'}: ${response.status?.message ?? 'Unknown error'}`,
  );
}
