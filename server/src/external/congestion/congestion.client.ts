import { ExternalApiError } from '../common';
// import { externalConfig, requestJson } from '../common';
import type { SkCongestionResponse } from './congestion.dto';

/**
 * SK 실시간 혼잡도 API 클라이언트. 통신 책임만 가진다.
 *
 * ⚠️ 이번 작업 범위에서는 실제 호출을 하지 않는다(skeleton + TODO).
 */

/** 실시간 혼잡도 조회 파라미터. TODO: 공식 스펙 확인 후 확정. */
export interface RealtimeCongestionParams {
  // TODO: 장소 식별자/좌표 등 매칭 기준 확정
  [key: string]: unknown;
}

/**
 * 특정 장소의 현재 혼잡도 조회.
 * TODO(실제 연동 시): externalConfig.congestion + requestJson 사용.
 */
export async function fetchRealtimeCongestion(
  _params: RealtimeCongestionParams,
): Promise<SkCongestionResponse> {
  throw new ExternalApiError('congestion', 'SK congestion client is not implemented yet', {
    code: 'NOT_IMPLEMENTED',
  });
}
