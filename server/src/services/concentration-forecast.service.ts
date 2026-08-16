import { KTO_CONCENTRATION_FORECAST_SOURCE, type ConcentrationForecastData } from '../dtos';
import {
  fetchConcentrationForecast,
  mapConcentrationForecast,
} from '../external/prediction';
import { extractDetailItem, fetchTourPlaceDetail } from '../external/tour';
import { toPlaceMatchKey } from '../utils/place-name';
import { TtlCache } from '../utils/ttl-cache';

/**
 * 집중률 예측 실시간 조회 — DB 미사용, 전국.
 *
 * 3.4b는 적재된 내부 Place(종로구 528곳)만 조회 가능 → 그 밖의 목적지는 집중률 표시 불가.
 * KTO는 전국 시군구를 커버하므로 목적지의 법정동 코드·이름을 실시간 해석해 바로 조회.
 * 공모전 FAQ의 "로컬 DB 저장 대신 실시간 호출 권고"와도 일치.
 *
 * 호출량: 시군구 단위 캐시 → 같은 지역의 여러 목적지가 KTO 호출 1건 공유.
 */

/** 지역 단위 캐시 TTL. KTO 예측은 하루 1회 갱신이라 6시간이면 충분. */
export const FORECAST_REGION_CACHE_TTL_MS = 6 * 60 * 60 * 1000;

/** 지역 전체 일괄 수신(행 수 = 관광지 수 × 30일이라 넉넉히). */
const FORECAST_NUM_OF_ROWS = 5000;

export interface ConcentrationForecastEntry {
  /** 예측 대상 달력 날짜(KST), "YYYY-MM-DD". */
  forecastDate: string;
  concentrationRate: number;
  source: string;
  /** 실시간 혼잡도 아님 — 일 단위 예측. */
  isRealtime: false;
}

export interface ConcentrationForecastByContentIdResult {
  /** 조회에 사용한 목적지 이름(TourAPI 기준). */
  destinationName: string;
  /** 실제 매칭된 KTO 관광지명. 표기가 달라 참고용으로 동봉. */
  matchedName: string;
  areaCd: string;
  signguCd: string;
  forecasts: ConcentrationForecastEntry[];
}

/** 상한 — 전국 시군구 수(~250)보다 넉넉하게. */
const REGION_CACHE_MAX_ENTRIES = 300;

const regionCache = new TtlCache<ConcentrationForecastData[]>(
  FORECAST_REGION_CACHE_TTL_MS,
  REGION_CACHE_MAX_ENTRIES,
);

/** 테스트용 캐시 초기화. */
export function clearForecastRegionCache(): void {
  regionCache.clear();
}

/** KTO가 요구하는 시군구 전체 코드 길이(시도 2 + 시군구 3). */
const FULL_SIGNGU_CODE_LENGTH = 5;

/**
 * 법정동 시군구 코드 → KTO가 요구하는 5자리 전체 코드.
 *
 * TourAPI는 시군구를 3자리로 제공(서울 종로구 11/110, 부산 해운대구 26/350).
 * 그대로 넘기면 0건이라 시도 코드를 앞에 붙인다.
 *
 * ⚠️ 접두사 검사(`startsWith`) 금지 — "110".startsWith("11")이 참이라 종로구를
 * 전체 코드로 오인해 조회 0건(실제 발생). 길이로 판단.
 */
export function toFullSignguCode(areaCd: string, signguCd: string): string {
  const area = areaCd.trim();
  const signgu = signguCd.trim();
  if (signgu.length === 0 || area.length === 0 || signgu.length >= FULL_SIGNGU_CODE_LENGTH) {
    return signgu;
  }
  return `${area}${signgu}`;
}

/**
 * 지역 단위 예측 목록(캐시). 같은 시군구 목적지끼리 호출 1건 공유하고,
 * 같은 지역 동시 미스도 호출 1건으로 합쳐진다(getOrCreate).
 */
async function getRegionForecasts(
  areaCd: string,
  signguCd: string,
): Promise<ConcentrationForecastData[]> {
  return regionCache.getOrCreate(`${areaCd}:${signguCd}`, async () => {
    const response = await fetchConcentrationForecast({
      areaCd,
      signguCd,
      numOfRows: FORECAST_NUM_OF_ROWS,
    });
    return mapConcentrationForecast(response).forecasts;
  });
}

/**
 * 지역 목록에서 목적지 이름에 해당하는 항목만 선별.
 * KTO·TourAPI 표기 차이(띄어쓰기·괄호) 때문에 정규화 후 정확 일치 → 부분 일치 순.
 */
export function selectForecastsByName(
  forecasts: ConcentrationForecastData[],
  destinationName: string,
): ConcentrationForecastData[] {
  const target = toPlaceMatchKey(destinationName);
  if (target.length === 0) {
    return [];
  }

  // 이름 정규화(NFC + 정규식 2회)는 행마다 비싸다. 시군구 하나가 수천 행이라
  // 정확/부분/최단 선별마다 다시 하면 요청당 수만 번 — 행당 1회만 계산해 재사용.
  const keyed = forecasts.map((forecast) => ({ forecast, key: toPlaceMatchKey(forecast.tAtsNm) }));

  const exact = keyed.filter((entry) => entry.key === target);
  if (exact.length > 0) {
    return exact.map((entry) => entry.forecast);
  }

  // 부분 일치는 후보 다수 가능 → 가장 짧은 이름(부속 아닌 본 시설)으로 압축
  const partial = keyed.filter(
    (entry) => entry.key.includes(target) || target.includes(entry.key),
  );
  if (partial.length === 0) {
    return [];
  }

  let bestName = partial[0].key;
  for (const entry of partial) {
    if (entry.key.length < bestName.length) {
      bestName = entry.key;
    }
  }

  return partial.filter((entry) => entry.key === bestName).map((entry) => entry.forecast);
}



export type ConcentrationForecastLookupResult =
  | { status: 'SUCCESS'; data: ConcentrationForecastByContentIdResult }
  /** 목적지 상세 해석 실패(이름·지역 코드 누락). */
  | { status: 'DESTINATION_NOT_RESOLVED' }
  /** 지역 예측에 해당 관광지 없음 — KTO 미커버 장소. */
  | { status: 'NO_FORECAST' };

/** TourAPI 목적지(contentId)의 30일 날짜별 집중률 예측. DB 미사용. */
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
          // 내부 DTO는 정밀도 보존용 문자열, 응답 규약은 number(§1.3)
          concentrationRate: Number(forecast.concentrationRate),
          source: forecast.source ?? KTO_CONCENTRATION_FORECAST_SOURCE,
          isRealtime: false as const,
        })),
    },
  };
}
