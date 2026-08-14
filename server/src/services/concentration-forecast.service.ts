import { KTO_CONCENTRATION_FORECAST_SOURCE, type ConcentrationForecastData } from '../dtos';
import {
  fetchConcentrationForecast,
  mapConcentrationForecast,
  normalizePlaceName,
} from '../external/prediction';
import { extractDetailItem, fetchTourPlaceDetail } from '../external/tour';

/**
 * 집중률 예측 실시간 조회(DB 미사용, 전국).
 *
 * 기존 3.4b는 적재된 내부 Place(현재 종로구 528곳)만 조회할 수 있어 그 밖의 목적지에서는
 * 집중률을 보여줄 수 없었다. KTO 집중률은 전국 시군구를 커버하므로, 목적지의 법정동 코드와
 * 이름을 실시간으로 해석해 바로 조회한다 — 적재 없이 전국이 된다
 * (공모전 FAQ의 "로컬 DB 저장 대신 실시간 호출 권고"와도 맞다).
 *
 * 호출량: 지역(시군구) 단위로 캐시하므로 같은 지역의 여러 목적지가 KTO 호출 1건을 공유한다.
 */

/** 지역 단위 조회 결과 캐시 TTL. KTO 예측은 하루 1회 갱신이라 6시간이면 충분하다. */
export const FORECAST_REGION_CACHE_TTL_MS = 6 * 60 * 60 * 1000;

/** 지역 전체를 한 번에 받는다(행 수 = 관광지 수 × 30일이라 넉넉히 잡아야 한다). */
const FORECAST_NUM_OF_ROWS = 5000;

export interface ConcentrationForecastEntry {
  /** 예측 대상 달력 날짜(KST), "YYYY-MM-DD". */
  forecastDate: string;
  concentrationRate: number;
  source: string;
  /** 실시간 혼잡도가 아님을 명시(일 단위 예측). */
  isRealtime: false;
}

export interface ConcentrationForecastByContentIdResult {
  /** 조회에 사용한 목적지 이름(TourAPI 기준). */
  destinationName: string;
  /** 실제로 매칭된 KTO 관광지명. 이름 표기가 달라 참고용으로 함께 준다. */
  matchedName: string;
  areaCd: string;
  signguCd: string;
  forecasts: ConcentrationForecastEntry[];
}

interface RegionCacheEntry {
  forecasts: ConcentrationForecastData[];
  expiresAt: number;
}

const regionCache = new Map<string, RegionCacheEntry>();

/** 테스트용 캐시 초기화. */
export function clearForecastRegionCache(): void {
  regionCache.clear();
}

/** KTO가 요구하는 시군구 전체 코드 길이(시도 2 + 시군구 3). */
const FULL_SIGNGU_CODE_LENGTH = 5;

/**
 * 법정동 시군구 코드를 KTO가 요구하는 5자리 전체 코드로 맞춘다.
 *
 * TourAPI는 시군구를 3자리로 준다(서울 종로구 → areaCd 11 / signguCd 110,
 * 부산 해운대구 → 26 / 350). KTO에 그대로 넘기면 결과가 0건이라 시도 코드를 앞에 붙인다.
 *
 * ⚠️ 접두사 검사(`startsWith`)로 판단하면 안 된다 — 종로구는 "110".startsWith("11")이 참이라
 * 이미 전체 코드로 오해하고 그대로 넘겨 조회가 0건이 된다(실제로 겪음). 길이로 판단한다.
 */
export function toFullSignguCode(areaCd: string, signguCd: string): string {
  const area = areaCd.trim();
  const signgu = signguCd.trim();
  if (signgu.length === 0 || area.length === 0 || signgu.length >= FULL_SIGNGU_CODE_LENGTH) {
    return signgu;
  }
  return `${area}${signgu}`;
}

/** 지역 단위 예측 목록(캐시). 같은 시군구의 여러 목적지가 호출 1건을 공유한다. */
async function getRegionForecasts(
  areaCd: string,
  signguCd: string,
): Promise<ConcentrationForecastData[]> {
  const key = `${areaCd}:${signguCd}`;
  const cached = regionCache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.forecasts;
  }

  const response = await fetchConcentrationForecast({
    areaCd,
    signguCd,
    numOfRows: FORECAST_NUM_OF_ROWS,
  });
  const { forecasts } = mapConcentrationForecast(response);

  regionCache.set(key, { forecasts, expiresAt: Date.now() + FORECAST_REGION_CACHE_TTL_MS });
  return forecasts;
}

/**
 * 지역 목록에서 목적지 이름에 해당하는 항목만 고른다.
 * KTO와 TourAPI의 표기가 조금씩 달라(띄어쓰기·괄호) 정규화 후 정확 일치 → 부분 일치 순으로 본다.
 */
export function selectForecastsByName(
  forecasts: ConcentrationForecastData[],
  destinationName: string,
): ConcentrationForecastData[] {
  const target = matchKey(destinationName);
  if (target.length === 0) {
    return [];
  }

  const exact = forecasts.filter((forecast) => matchKey(forecast.tAtsNm) === target);
  if (exact.length > 0) {
    return exact;
  }

  // 부분 일치는 후보가 여럿일 수 있어 가장 짧은 이름(부속 시설이 아닌 본 시설)으로 좁힌다.
  const partial = forecasts.filter((forecast) => {
    const name = matchKey(forecast.tAtsNm);
    return name.includes(target) || target.includes(name);
  });
  if (partial.length === 0) {
    return [];
  }

  const bestName = partial
    .map((forecast) => matchKey(forecast.tAtsNm))
    .sort((first, second) => first.length - second.length)[0];

  return partial.filter((forecast) => matchKey(forecast.tAtsNm) === bestName);
}

/**
 * 이름 비교용 키. KTO와 TourAPI가 같은 장소를 다르게 띄어써서("해운대 해수욕장" vs "해운대해수욕장")
 * 공백을 모두 지우고 비교한다. 적재 매칭용 normalizePlaceName은 계약이 걸려 있어 건드리지 않는다.
 */
function matchKey(name: string): string {
  return normalizePlaceName(name).replace(/\s+/g, '');
}

export type ConcentrationForecastLookupResult =
  | { status: 'SUCCESS'; data: ConcentrationForecastByContentIdResult }
  /** 목적지 상세를 해석하지 못함(이름·지역 코드 누락). */
  | { status: 'DESTINATION_NOT_RESOLVED' }
  /** 지역 예측에 해당 관광지가 없음 — KTO가 다루지 않는 장소. */
  | { status: 'NO_FORECAST' };

/** TourAPI 목적지(contentId)의 30일 날짜별 집중률 예측. DB를 사용하지 않는다. */
export async function getConcentrationForecastByContentId(
  contentId: string,
): Promise<ConcentrationForecastLookupResult> {
  const detail = await fetchTourPlaceDetail(contentId);
  const item = extractDetailItem(detail);

  const name = String(item?.title ?? '').trim();
  const areaCd = String(item?.lDongRegnCd ?? '').trim();
  const rawSigngu = String(item?.lDongSignguCd ?? '').trim();

  if (name.length === 0 || areaCd.length === 0 || rawSigngu.length === 0) {
    return { status: 'DESTINATION_NOT_RESOLVED' };
  }

  const signguCd = toFullSignguCode(areaCd, rawSigngu);
  const regionForecasts = await getRegionForecasts(areaCd, signguCd);
  const matched = selectForecastsByName(regionForecasts, name);

  if (matched.length === 0) {
    return { status: 'NO_FORECAST' };
  }

  return {
    status: 'SUCCESS',
    data: {
      destinationName: name,
      matchedName: matched[0].tAtsNm,
      areaCd,
      signguCd,
      forecasts: matched
        .slice()
        .sort((first, second) => first.forecastDate.localeCompare(second.forecastDate))
        .map((forecast) => ({
          forecastDate: forecast.forecastDate,
          // 내부 DTO는 정밀도 보존을 위해 문자열로 들고 있다. 응답 규약은 number(§1.3).
          concentrationRate: Number(forecast.concentrationRate),
          source: forecast.source ?? KTO_CONCENTRATION_FORECAST_SOURCE,
          isRealtime: false as const,
        })),
    },
  };
}
