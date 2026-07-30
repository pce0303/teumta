import { ExternalApiError, externalConfig, requestJson } from '../common';
import type { Coordinate } from '../../dtos';
import type { TmapRouteResponse } from './tmap.dto';

/**
 * TMAP 보행자 경로안내 클라이언트(SK Open API).
 * 통신(URL/인증/timeout) 책임만 가진다. 변환은 tmap.mapper.ts.
 *
 * ⚠️ 실제 호출 코드지만, 유효한 TMAP_API_KEY / TMAP_API_BASE_URL 이 설정되기 전에는 동작하지 않는다.
 *
 * 키 관련 주의:
 *  - TMAP 은 header `appKey` 로 인증한다(.env 의 TMAP_API_KEY = SK Open API appKey).
 *  - startName/endName 은 URL 인코딩이 필요하다(공백 등 포함 시 오류).
 */

const SERVICE = 'tmap';
const PEDESTRIAN_PATH = '/tmap/routes/pedestrian?version=1';

export interface TmapPedestrianRouteParams {
  start: Coordinate;
  end: Coordinate;
  startName?: string;
  endName?: string;
}

/** 출발지 → 도착지 보행자 경로/이동시간 조회. */
export async function fetchPedestrianRoute(
  params: TmapPedestrianRouteParams,
): Promise<TmapRouteResponse> {
  const { baseUrl, apiKey } = externalConfig.tmap;

  if (!baseUrl) {
    throw new ExternalApiError(SERVICE, 'TMAP_API_BASE_URL is not configured', {
      code: 'CONFIG_MISSING',
    });
  }
  if (!apiKey) {
    throw new ExternalApiError(SERVICE, 'TMAP_API_KEY is not configured', {
      code: 'CONFIG_MISSING',
    });
  }

  const url = `${baseUrl.replace(/\/+$/, '')}${PEDESTRIAN_PATH}`;

  return requestJson<TmapRouteResponse>({
    service: SERVICE,
    url,
    method: 'POST',
    headers: { appKey: apiKey },
    body: {
      startX: params.start.longitude,
      startY: params.start.latitude,
      endX: params.end.longitude,
      endY: params.end.latitude,
      startName: encodeURIComponent(params.startName ?? '출발'),
      endName: encodeURIComponent(params.endName ?? '도착'),
      reqCoordType: 'WGS84GEO',
      resCoordType: 'WGS84GEO',
      searchOption: '0',
    },
  });
}
