import type { PublicDataResponseHeader } from '../common';

/**
 * 관광지 집중률 예측(TatsCnctrRateService/tatsCnctrRatedList) 원본 응답 타입.
 * 향후 30일 날짜별 집중률(일 1회 갱신) — 실시간·시간대별 아님. 봉투 구조는 TourAPI와 동일.
 */

export interface KtoConcentrationForecastItem {
  /** 예측 대상 날짜(YYYYMMDD). */
  baseYmd: string;
  /** 법정동 시도 코드. */
  areaCd: string;
  areaNm?: string;
  /** 법정동 시군구 코드(5자리 전체 코드). */
  signguCd: string;
  signguNm?: string;
  /** 관광지명. */
  tAtsNm: string;
  /** 집중률(소수). 문자열 또는 숫자로 온다. */
  cnctrRate: string | number;
  [key: string]: unknown;
}

export interface ConcentrationForecastListBody {
  /** 결과가 없으면 빈 문자열("")로 오는 케이스가 있다. */
  items: { item: KtoConcentrationForecastItem | KtoConcentrationForecastItem[] } | '';
  numOfRows: number | string;
  pageNo: number | string;
  totalCount: number | string;
}

export interface ConcentrationForecastListResponse {
  response: {
    header: PublicDataResponseHeader;
    body: ConcentrationForecastListBody;
  };
}
