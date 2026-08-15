import type { CongestionLevel, CongestionType } from '@prisma/client';

/**
 * 내부 혼잡도 데이터 계약.
 *
 * 실시간(SK)과 예측(집중률)을 같은 형태로 정규화, `type`으로 구분(Prisma `Congestion.type`과 동일 enum).
 * 외부 API 원본 응답 타입과 반드시 분리.
 */
export interface CongestionData {
  /** REALTIME | PREDICTED */
  type: CongestionType;
  /** RELAXED | NORMAL | CROWDED | VERY_CROWDED */
  level: CongestionLevel;
  /** 0~100 정규화 점수 — 외부 기준값을 내부 척도로 변환. */
  score: number | null;
  /** 데이터 출처(예: "SK"). */
  source: string | null;
  /** REALTIME 측정 시각. */
  measuredAt: Date | null;
  /** PREDICTED 예측 대상 시각. */
  predictedFor: Date | null;
}

/** KTO 집중률 예측 데이터의 source 식별자. */
export const KTO_CONCENTRATION_FORECAST_SOURCE = 'KTO_CONCENTRATION_FORECAST';

/**
 * 관광지 집중률 예측(TatsCnctrRateService) 내부 계약.
 *
 * 의미(중요):
 *  - 향후 30일 **날짜별** 예측, 일 1회 갱신
 *  - 실시간 혼잡도 아님, 시간대별도 아님
 *  - 공식 등급 임계값 미제공 → level·score로 변환하지 않음
 *
 * CongestionData와 분리한 이유: 그쪽은 level이 필수인데 이 API엔 등급 기준이 없음.
 * 임의 등급을 만들지 않으려 원본 소수값 유지.
 */
export interface ConcentrationForecastData {
  /** 예측 대상 달력 날짜(KST), "YYYY-MM-DD". */
  forecastDate: string;
  /** forecastDate의 KST 자정 시각(DB predictedFor 저장용). */
  predictedFor: Date;
  /** 집중률 원본 소수값. 정밀도 보존용 문자열 — Prisma Decimal에 그대로 전달. */
  concentrationRate: string;
  /** 법정동 시도 코드. */
  areaCd: string;
  /** 법정동 시군구 코드(5자리 전체 코드). */
  signguCd: string;
  /** 관광지명(원본). */
  tAtsNm: string;
  source: typeof KTO_CONCENTRATION_FORECAST_SOURCE;
}
