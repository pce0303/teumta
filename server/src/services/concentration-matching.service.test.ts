import { describe, expect, it } from 'vitest';

import type { ConcentrationForecastData } from '../dtos';
import { KTO_CONCENTRATION_FORECAST_SOURCE } from '../dtos';
import {
  buildForecastAliasKey,
  groupForecastsByKey,
} from './concentration-matching.service';

function forecast(
  overrides: Partial<ConcentrationForecastData>,
): ConcentrationForecastData {
  return {
    forecastDate: '2026-08-07',
    predictedFor: new Date('2026-08-06T15:00:00.000Z'),
    concentrationRate: '12.34',
    areaCd: '11',
    signguCd: '11110',
    tAtsNm: '경복궁',
    source: KTO_CONCENTRATION_FORECAST_SOURCE,
    ...overrides,
  };
}

describe('buildForecastAliasKey', () => {
  it('이름을 자동 매칭과 같은 규칙으로 정규화한다', () => {
    expect(buildForecastAliasKey('11', '11110', '경복궁')).toBe(
      buildForecastAliasKey(' 11 ', ' 11110 ', '  경복궁  '),
    );
    expect(buildForecastAliasKey('11', '11110', '광화문 (광장)')).toBe(
      buildForecastAliasKey('11', '11110', '광화문(광장)'),
    );
  });

  it('지역이 다르면 다른 키가 된다', () => {
    expect(buildForecastAliasKey('11', '11110', '경복궁')).not.toBe(
      buildForecastAliasKey('11', '11140', '경복궁'),
    );
  });
});

describe('groupForecastsByKey', () => {
  it('같은 지역+관광지명 행을 하나의 그룹으로 묶는다', () => {
    const groups = groupForecastsByKey([
      forecast({ forecastDate: '2026-08-07' }),
      forecast({ forecastDate: '2026-08-08' }),
      forecast({ tAtsNm: '창덕궁' }),
    ]);

    expect(groups.size).toBe(2);
    expect(groups.get('11|11110|경복궁')).toHaveLength(2);
    expect(groups.get('11|11110|창덕궁')).toHaveLength(1);
  });

  it('빈 입력은 빈 맵을 반환한다', () => {
    expect(groupForecastsByKey([]).size).toBe(0);
  });
});
