import { CongestionLevel, CongestionType } from '@prisma/client';
import { describe, expect, it } from 'vitest';

import type { CongestionData } from '../dtos';
import { toPredictedCongestionRows } from './congestion-ingestion.service';

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
