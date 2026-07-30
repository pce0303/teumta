import type { CongestionData } from '../../dtos';
import type { SkCongestionResponse } from './congestion.dto';

/**
 * SK 실시간 혼잡도 원본 응답 → 틈타 내부 CongestionData(type=REALTIME) 변환.
 *
 * 향후 역할: 외부 혼잡도 등급/지수를 내부 score(0~100) 및 level enum으로 정규화한다.
 *
 * TODO(실제 연동 시):
 *  - 외부 혼잡도 등급 문자열 → CongestionLevel(RELAXED/NORMAL/CROWDED/VERY_CROWDED) 매핑
 *  - 외부 지수 → score(0~100) 변환 규칙 정의
 *  - 측정 시각 → measuredAt(Date), source = 'SK'
 */
export function mapSkCongestionToCongestionData(_raw: SkCongestionResponse): CongestionData {
  // TODO: 실제 변환 구현. 지금은 skeleton이므로 호출 시 즉시 실패시킨다.
  throw new Error('mapSkCongestionToCongestionData is not implemented yet');
}
