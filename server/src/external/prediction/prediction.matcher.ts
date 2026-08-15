/**
 * 집중률 예측 항목 ↔ Place 매칭(순수 함수).
 * contentid가 없어 지역(법정동) + 정규화 이름 정확 일치만 허용
 * — 단어 제거·유사도 자동 연결 금지(오매칭 방지).
 */

export interface ForecastPlaceCandidate {
  placeId: number;
  name: string;
  lDongRegnCd: string | null;
  lDongSignguCd: string | null;
}

export interface ForecastMatchKey {
  areaCd: string;
  signguCd: string;
  tAtsNm: string;
}

export type ForecastMatchResult =
  | { status: 'MATCHED'; placeId: number }
  | { status: 'UNMATCHED' }
  | { status: 'AMBIGUOUS'; candidatePlaceIds: number[] };

/**
 * 관광지명 정규화. 허용 범위:
 *  - 유니코드 NFC
 *  - 앞뒤 공백 제거, 연속 공백 축소
 *  - 괄호 앞뒤 공백 정리
 * 단어 제거 같은 공격적 변형 금지.
 */
export function normalizePlaceName(name: string): string {
  return name
    .normalize('NFC')
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\s*\(\s*/g, '(')
    .replace(/\s*\)\s*/g, ')');
}

/** 지역(법정동) 일치 여부. 시군구는 원본 일치 또는 시도+시군구 연결값 일치만 허용. */
export function isSameRegion(
  forecast: Pick<ForecastMatchKey, 'areaCd' | 'signguCd'>,
  candidate: Pick<ForecastPlaceCandidate, 'lDongRegnCd' | 'lDongSignguCd'>,
): boolean {
  const areaCd = forecast.areaCd.trim();
  const signguCd = forecast.signguCd.trim();
  const regn = (candidate.lDongRegnCd ?? '').trim();
  const signgu = (candidate.lDongSignguCd ?? '').trim();

  if (regn.length === 0 || signgu.length === 0 || regn !== areaCd) {
    return false;
  }
  return signgu === signguCd || `${regn}${signgu}` === signguCd;
}

/** 예측 키(지역+관광지명) 하나를 후보 장소 목록과 매칭. */
export function matchForecastToPlace(
  forecast: ForecastMatchKey,
  candidates: ForecastPlaceCandidate[],
): ForecastMatchResult {
  const normalizedTarget = normalizePlaceName(forecast.tAtsNm);
  if (normalizedTarget.length === 0) {
    return { status: 'UNMATCHED' };
  }

  const matched = candidates.filter(
    (candidate) =>
      isSameRegion(forecast, candidate) &&
      normalizePlaceName(candidate.name) === normalizedTarget,
  );

  if (matched.length === 1) {
    return { status: 'MATCHED', placeId: matched[0].placeId };
  }
  if (matched.length === 0) {
    return { status: 'UNMATCHED' };
  }
  return {
    status: 'AMBIGUOUS',
    candidatePlaceIds: matched.map((candidate) => candidate.placeId),
  };
}
