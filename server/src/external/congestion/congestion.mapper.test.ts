import { CongestionLevel, CongestionType } from '@prisma/client';
import { describe, expect, it } from 'vitest';

import { ExternalApiResponseError } from '../common/external-api.error';
import type { SkCongestionResponse, SkCongestionRltmItem } from './congestion.dto';
import { mapSkCongestionToCongestionData, pickRealtimeItem } from './congestion.mapper';

function makeResponse(rltm: SkCongestionRltmItem[]): SkCongestionResponse {
  return {
    status: { code: '00', message: 'success', totalCount: 1 },
    contents: { poiId: '362105', poiName: '경복궁', rltm },
  };
}

const realtimeItem = {
  datetime: '20260806125000',
  congestion: 0.0038288629,
  congestionLevel: 1,
  type: 1,
};

describe('pickRealtimeItem', () => {
  it('type=1(실시간) 항목을 고른다', () => {
    const res = makeResponse([
      { ...realtimeItem, type: 3, congestionLevel: 4 },
      realtimeItem,
    ]);
    expect(pickRealtimeItem(res).congestionLevel).toBe(1);
  });

  it('rltm이 비어 있으면 오류', () => {
    expect(() => pickRealtimeItem(makeResponse([]))).toThrow(ExternalApiResponseError);
  });
});

describe('mapSkCongestionToCongestionData', () => {
  it('congestionLevel 1~4를 내부 enum으로 매핑한다', () => {
    const cases: Array<[number, CongestionLevel]> = [
      [1, CongestionLevel.RELAXED],
      [2, CongestionLevel.NORMAL],
      [3, CongestionLevel.CROWDED],
      [4, CongestionLevel.VERY_CROWDED],
    ];
    for (const [levelValue, expected] of cases) {
      const result = mapSkCongestionToCongestionData(
        makeResponse([{ ...realtimeItem, congestionLevel: levelValue }]),
      );
      expect(result.level).toBe(expected);
      expect(result.type).toBe(CongestionType.REALTIME);
      expect(result.source).toBe('SK_PUZZLE');
      expect(result.score).toBeNull();
    }
  });

  it('datetime(KST)을 하루/시각 밀림 없이 변환한다', () => {
    const result = mapSkCongestionToCongestionData(makeResponse([realtimeItem]));
    expect(result.measuredAt?.toISOString()).toBe('2026-08-06T03:50:00.000Z'); // 12:50 KST
  });

  it('알 수 없는 congestionLevel은 오류', () => {
    expect(() =>
      mapSkCongestionToCongestionData(makeResponse([{ ...realtimeItem, congestionLevel: 9 }])),
    ).toThrow(ExternalApiResponseError);
  });
});
