import type { CongestionLevel, CongestionType } from '@prisma/client';

/**
 * 틈타 내부 혼잡도 데이터 계약.
 *
 * 실시간(SK)과 예측(집중률 예측)을 동일한 형태로 정규화하여 내부에서 사용한다.
 * `type`으로 실시간/예측을 구분한다(Prisma `Congestion.type`과 동일 enum).
 *
 * 외부 API 원본 응답 타입과 반드시 분리한다.
 */
export interface CongestionData {
  /** REALTIME | PREDICTED */
  type: CongestionType;
  /** RELAXED | NORMAL | CROWDED | VERY_CROWDED */
  level: CongestionLevel;
  /** 0~100 정규화 점수. 외부 기준값을 내부 척도로 변환한 결과. */
  score: number | null;
  /** 데이터 출처(예: "SK"). */
  source: string | null;
  /** REALTIME인 경우 측정 시각. */
  measuredAt: Date | null;
  /** PREDICTED인 경우 예측 대상 시각. */
  predictedFor: Date | null;
}
