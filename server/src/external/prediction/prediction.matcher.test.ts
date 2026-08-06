import { describe, expect, it } from 'vitest';

import {
  isSameRegion,
  matchForecastToPlace,
  normalizePlaceName,
  type ForecastPlaceCandidate,
} from './prediction.matcher';

function makeCandidate(overrides: Partial<ForecastPlaceCandidate> = {}): ForecastPlaceCandidate {
  return {
    placeId: 1,
    name: '경복궁',
    lDongRegnCd: '11',
    lDongSignguCd: '110',
    ...overrides,
  };
}

describe('normalizePlaceName', () => {
  it('앞뒤 공백 제거 + 연속 공백 축소', () => {
    expect(normalizePlaceName('  경복궁   야간개장 ')).toBe('경복궁 야간개장');
  });

  it('괄호 앞뒤 공백 정리', () => {
    expect(normalizePlaceName('경복궁 ( 서울 )')).toBe('경복궁(서울)');
  });

  it('유니코드 정규화(NFD → NFC)', () => {
    expect(normalizePlaceName('경복궁'.normalize('NFD'))).toBe('경복궁');
  });

  it('단어를 제거하지 않는다(보수적 정규화)', () => {
    expect(normalizePlaceName('국립 경복궁')).toBe('국립 경복궁');
  });
});

describe('isSameRegion', () => {
  it('signguCd가 시군구 코드 그대로 일치하면 같은 지역', () => {
    expect(isSameRegion({ areaCd: '11', signguCd: '110' }, makeCandidate())).toBe(true);
  });

  it('signguCd가 5자리 전체 코드(시도+시군구)여도 같은 지역', () => {
    expect(isSameRegion({ areaCd: '11', signguCd: '11110' }, makeCandidate())).toBe(true);
  });

  it('시도 코드가 다르면 다른 지역', () => {
    expect(isSameRegion({ areaCd: '26', signguCd: '11110' }, makeCandidate())).toBe(false);
  });

  it('장소에 법정동 코드가 없으면 매칭하지 않는다', () => {
    expect(
      isSameRegion({ areaCd: '11', signguCd: '11110' }, makeCandidate({ lDongRegnCd: null })),
    ).toBe(false);
  });
});

describe('matchForecastToPlace', () => {
  const forecast = { areaCd: '11', signguCd: '11110', tAtsNm: '경복궁' };

  it('MATCHED: 지역+정규화된 이름이 정확히 한 장소와 일치', () => {
    const result = matchForecastToPlace(forecast, [
      makeCandidate({ placeId: 10 }),
      makeCandidate({ placeId: 11, name: '창덕궁' }),
    ]);
    expect(result).toEqual({ status: 'MATCHED', placeId: 10 });
  });

  it('MATCHED: 공백/유니코드 차이는 정규화로 흡수한다', () => {
    const result = matchForecastToPlace(
      { ...forecast, tAtsNm: ' 경복궁  ' },
      [makeCandidate({ placeId: 10, name: '경복궁'.normalize('NFD') })],
    );
    expect(result).toEqual({ status: 'MATCHED', placeId: 10 });
  });

  it('UNMATCHED: 이름이 같아도 지역이 다르면 매칭하지 않는다(전역 이름 매칭 금지)', () => {
    const result = matchForecastToPlace(forecast, [
      makeCandidate({ placeId: 10, lDongRegnCd: '26', lDongSignguCd: '710' }),
    ]);
    expect(result).toEqual({ status: 'UNMATCHED' });
  });

  it('UNMATCHED: 부분 문자열/유사 이름은 매칭하지 않는다', () => {
    const result = matchForecastToPlace(forecast, [
      makeCandidate({ placeId: 10, name: '경복궁 야간개장' }),
    ]);
    expect(result).toEqual({ status: 'UNMATCHED' });
  });

  it('AMBIGUOUS: 후보가 둘 이상이면 자동 연결하지 않는다', () => {
    const result = matchForecastToPlace(forecast, [
      makeCandidate({ placeId: 10 }),
      makeCandidate({ placeId: 20 }),
    ]);
    expect(result).toEqual({ status: 'AMBIGUOUS', candidatePlaceIds: [10, 20] });
  });

  it('UNMATCHED: 이름이 비어 있으면 매칭하지 않는다', () => {
    expect(matchForecastToPlace({ ...forecast, tAtsNm: '  ' }, [makeCandidate()])).toEqual({
      status: 'UNMATCHED',
    });
  });
});
