import type { CongestionData } from '../../dtos';
import type { PredictionResponse } from './prediction.dto';

/**
 * 집중률 예측 원본 응답 → 틈타 내부 CongestionData(type=PREDICTED) 배열 변환.
 *
 * 향후 역할: 시간대별 예상 혼잡도를 실시간 혼잡도와 "동일한 내부 형태"로 정규화한다.
 * 실시간 혼잡도(congestion.mapper)와 같은 CongestionData를 반환해 하위 로직이 통일되게 한다.
 *
 * TODO(실제 연동 시):
 *  - 시간대별 항목 각각을 CongestionData로 변환(type=PREDICTED)
 *  - 예측 대상 시각 → predictedFor(Date)
 *  - 예측 등급/지수 → level / score 변환(실시간과 동일 규칙 재사용)
 */
export function mapPredictionToCongestionData(_raw: PredictionResponse): CongestionData[] {
  // TODO: 실제 변환 구현. 지금은 skeleton이므로 호출 시 즉시 실패시킨다.
  throw new Error('mapPredictionToCongestionData is not implemented yet');
}
