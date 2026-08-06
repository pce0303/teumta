import { describe, expect, it } from 'vitest';

import { KTO_CONCENTRATION_FORECAST_SOURCE } from '../../dtos';
import type {
  ConcentrationForecastListResponse,
  KtoConcentrationForecastItem,
} from './prediction.dto';
import { extractForecastItems, mapConcentrationForecast, mapConcentrationForecastItem } from './prediction.mapper';

function makeItem(overrides: Partial<KtoConcentrationForecastItem> = {}): KtoConcentrationForecastItem {
  return {
    baseYmd: '20260806',
    areaCd: '11',
    areaNm: '서울특별시',
    signguCd: '11110',
    signguNm: '종로구',
    tAtsNm: '경복궁',
    cnctrRate: '23.45',
    ...overrides,
  };
}

function wrap(
  items: KtoConcentrationForecastItem | KtoConcentrationForecastItem[] | '',
): ConcentrationForecastListResponse {
  const count = items === '' ? 0 : Array.isArray(items) ? items.length : 1;
  return {
    response: {
      header: { resultCode: '0000', resultMsg: 'OK' },
      body: {
        items: items === '' ? '' : { item: items },
        numOfRows: count,
        pageNo: 1,
        totalCount: count,
      },
    },
  };
}

describe('extractForecastItems', () => {
  it('배열 item을 그대로 반환', () => {
    expect(extractForecastItems(wrap([makeItem(), makeItem()]))).toHaveLength(2);
  });

  it('단일 객체 item을 배열로 감싼다', () => {
    expect(extractForecastItems(wrap(makeItem()))).toHaveLength(1);
  });

  it('빈 결과(items="")는 빈 배열', () => {
    expect(extractForecastItems(wrap(''))).toEqual([]);
  });
});

describe('mapConcentrationForecastItem', () => {
  it('baseYmd(KST 달력 날짜)를 하루 밀림 없이 변환한다', () => {
    const result = mapConcentrationForecastItem(makeItem({ baseYmd: '20260806' }));
    expect(result.forecastDate).toBe('2026-08-06');
    // KST 자정 = UTC 전날 15:00
    expect(result.predictedFor.toISOString()).toBe('2026-08-05T15:00:00.000Z');
  });

  it('cnctrRate 소수 문자열의 원본 정밀도를 보존한다', () => {
    expect(mapConcentrationForecastItem(makeItem({ cnctrRate: '23.45' })).concentrationRate).toBe('23.45');
    expect(mapConcentrationForecastItem(makeItem({ cnctrRate: '7.05' })).concentrationRate).toBe('7.05');
  });

  it('cnctrRate가 숫자로 와도 처리한다', () => {
    expect(mapConcentrationForecastItem(makeItem({ cnctrRate: 15.2 })).concentrationRate).toBe('15.2');
  });

  it('source를 KTO_CONCENTRATION_FORECAST로 고정한다', () => {
    expect(mapConcentrationForecastItem(makeItem()).source).toBe(KTO_CONCENTRATION_FORECAST_SOURCE);
  });
});

describe('mapConcentrationForecast', () => {
  it('정상 30일 목록을 모두 변환한다', () => {
    const items = Array.from({ length: 30 }, (_, index) =>
      makeItem({
        baseYmd: `202608${String(index + 1).padStart(2, '0')}`,
        cnctrRate: `${index}.5`,
      }),
    );
    const result = mapConcentrationForecast(wrap(items));
    expect(result.forecasts).toHaveLength(30);
    expect(result.skipped).toEqual([]);
    expect(result.forecasts[0].forecastDate).toBe('2026-08-01');
    expect(result.forecasts[29].forecastDate).toBe('2026-08-30');
  });

  it('잘못된 baseYmd는 skip으로 집계하고 나머지는 변환한다', () => {
    const result = mapConcentrationForecast(
      wrap([
        makeItem(),
        makeItem({ baseYmd: '2026-08-06' }),
        makeItem({ baseYmd: '20260231' }),
      ]),
    );
    expect(result.forecasts).toHaveLength(1);
    expect(result.skipped).toHaveLength(2);
  });

  it('잘못된 cnctrRate는 skip으로 집계한다', () => {
    const result = mapConcentrationForecast(wrap([makeItem({ cnctrRate: 'abc' })]));
    expect(result.forecasts).toEqual([]);
    expect(result.skipped).toHaveLength(1);
    expect(result.skipped[0].reason).toContain('cnctrRate');
  });

  it('빈 결과는 빈 배열', () => {
    const result = mapConcentrationForecast(wrap(''));
    expect(result.forecasts).toEqual([]);
    expect(result.skipped).toEqual([]);
  });
});
