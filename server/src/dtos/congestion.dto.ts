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

/** KTO 집중률 예측 데이터의 source 식별자. */
export const KTO_CONCENTRATION_FORECAST_SOURCE = 'KTO_CONCENTRATION_FORECAST';

/**
 * 한국관광공사 관광지 집중률 예측(TatsCnctrRateService) 내부 계약.
 *
 * 의미(중요):
 *  - 현재 날짜 기준 향후 30일의 "날짜별" 집중률 예측이다(일 1회 갱신).
 *  - 실시간 혼잡도가 아니며, 시간대별 예측도 아니다.
 *  - 공식 API가 혼잡 등급 임계값을 제공하지 않으므로 level/score 로 변환하지 않는다.
 *
 * CongestionData와 별도 타입인 이유: CongestionData.level(등급)은 필수인데
 * 이 API에는 등급 기준이 없어, 임의 등급을 만들지 않기 위해 원본 소수값을 그대로 유지한다.
 */
export interface ConcentrationForecastData {
  /** 예측 대상 달력 날짜(KST), "YYYY-MM-DD". */
  forecastDate: string;
  /** forecastDate의 KST 자정 시각(DB predictedFor 저장용). */
  predictedFor: Date;
  /** 집중률 원본 소수값(정밀도 보존을 위해 문자열 유지, Prisma Decimal에 그대로 전달). */
  concentrationRate: string;
  /** 법정동 시도 코드. */
  areaCd: string;
  /** 법정동 시군구 코드(5자리 전체 코드). */
  signguCd: string;
  /** 관광지명(원본). */
  tAtsNm: string;
  source: typeof KTO_CONCENTRATION_FORECAST_SOURCE;
}
