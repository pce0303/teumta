import { ExternalApiError } from '../common';
// import { externalConfig, requestJson } from '../common';
import type { PredictionResponse } from './prediction.dto';

/**
 * 관광지 집중률 예측 데이터 API 클라이언트. 통신 책임만 가진다.
 *
 * ⚠️ 이번 작업 범위에서는 실제 호출을 하지 않는다(skeleton + TODO).
 */

/** 예측 조회 파라미터. TODO: 공식 스펙 확인 후 확정. */
export interface PredictionParams {
  // TODO: 장소 식별자, 조회 대상 날짜/시간대 범위 등
  [key: string]: unknown;
}

/**
 * 특정 관광지의 미래(시간대별) 예상 혼잡도 조회.
 * TODO(실제 연동 시): externalConfig.prediction + requestJson 사용.
 */
export async function fetchPredictedCongestion(
  _params: PredictionParams,
): Promise<PredictionResponse> {
  throw new ExternalApiError('prediction', 'Prediction client is not implemented yet', {
    code: 'NOT_IMPLEMENTED',
  });
}
