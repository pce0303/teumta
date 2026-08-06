import { CongestionLevel, CongestionType } from '@prisma/client';
import { describe, expect, it } from 'vitest';

import type { CongestionData, ConcentrationForecastData } from '../dtos';
import { KTO_CONCENTRATION_FORECAST_SOURCE } from '../dtos';
import {
  toConcentrationForecastRows,
  toPredictedCongestionRows,
} from './congestion-ingestion.service';

const predicted: CongestionData = {
  type: CongestionType.PREDICTED,
  level: CongestionLevel.NORMAL,
  score: 40,
  source: 'PRED',
  measuredAt: null,
  predictedFor: new Date('2026-07-30T15:00:00Z'),
};

const realtime: CongestionData = {
  type: CongestionType.REALTIME,
  level: CongestionLevel.CROWDED,
  score: 80,
  source: 'SK',
  measuredAt: new Date('2026-07-30T12:00:00Z'),
  predictedFor: null,
};

describe('toPredictedCongestionRows', () => {
  it('REALTIME은 걸러내고 PREDICTED만 변환한다', () => {
    const rows = toPredictedCongestionRows(7, [predicted, realtime]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      placeId: 7,
      type: CongestionType.PREDICTED,
      level: CongestionLevel.NORMAL,
      score: 40,
      source: 'PRED',
    });
  });

  it('placeId를 모든 로우에 주입한다', () => {
    const rows = toPredictedCongestionRows(42, [predicted, { ...predicted, score: 55 }]);
    expect(rows.every((row) => row.placeId === 42)).toBe(true);
  });

  it('예측이 없으면 빈 배열', () => {
    expect(toPredictedCongestionRows(1, [realtime])).toEqual([]);
  });
});

const forecast: ConcentrationForecastData = {
  forecastDate: '2026-08-06',
  predictedFor: new Date('2026-08-05T15:00:00.000Z'), // 2026-08-06 KST 자정
  concentrationRate: '23.45',
  areaCd: '11',
  signguCd: '11110',
  tAtsNm: '경복궁',
  source: KTO_CONCENTRATION_FORECAST_SOURCE,
};

describe('toConcentrationForecastRows', () => {
  it('level/score 없이 원본 소수값(concentrationRate)과 source를 저장한다', () => {
    const rows = toConcentrationForecastRows(7, [forecast]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      placeId: 7,
      type: CongestionType.PREDICTED,
      level: null,
      score: null,
      concentrationRate: '23.45',
      source: KTO_CONCENTRATION_FORECAST_SOURCE,
      measuredAt: null,
    });
    expect(rows[0].predictedFor).toEqual(new Date('2026-08-05T15:00:00.000Z'));
  });

  it('빈 입력은 빈 배열', () => {
    expect(toConcentrationForecastRows(1, [])).toEqual([]);
  });
});
