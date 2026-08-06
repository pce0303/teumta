import { CongestionLevel } from '@prisma/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/** 실시간 혼잡도 캐시 테스트. 외부 API는 mock. */

const { fetchRealtimeCongestionMock } = vi.hoisted(() => ({
  fetchRealtimeCongestionMock: vi.fn(),
}));

vi.mock('../external/congestion', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../external/congestion')>();
  return { ...actual, fetchRealtimeCongestion: fetchRealtimeCongestionMock };
});

vi.mock('../utils/prisma', () => ({ prisma: {} }));

import {
  clearRealtimeCongestionCache,
  getRealtimeCongestion,
  REALTIME_CONGESTION_CACHE_TTL_MS,
} from './congestion.service';

const rawResponse = {
  status: { code: '00', message: 'success', totalCount: 1 },
  contents: {
    poiId: '362105',
    poiName: '경복궁',
    rltm: [{ datetime: '20260806125000', congestion: 0.003, congestionLevel: 2, type: 1 }],
  },
};

beforeEach(() => {
  vi.useFakeTimers();
  clearRealtimeCongestionCache();
  fetchRealtimeCongestionMock.mockReset();
  fetchRealtimeCongestionMock.mockResolvedValue(rawResponse);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('getRealtimeCongestion', () => {
  it('원본 응답을 실시간 혼잡도 뷰로 변환한다', async () => {
    const view = await getRealtimeCongestion('362105');
    expect(view).toMatchObject({
      poiId: '362105',
      poiName: '경복궁',
      level: CongestionLevel.NORMAL,
      source: 'SK_PUZZLE',
      isRealtime: true,
    });
  });

  it('TTL 내 재호출은 캐시를 사용한다(외부 호출 1회)', async () => {
    await getRealtimeCongestion('362105');
    await getRealtimeCongestion('362105');
    expect(fetchRealtimeCongestionMock).toHaveBeenCalledTimes(1);
  });

  it('TTL이 지나면 다시 외부를 호출한다', async () => {
    await getRealtimeCongestion('362105');
    vi.advanceTimersByTime(REALTIME_CONGESTION_CACHE_TTL_MS + 1000);
    await getRealtimeCongestion('362105');
    expect(fetchRealtimeCongestionMock).toHaveBeenCalledTimes(2);
  });

  it('poiId별로 캐시가 분리된다', async () => {
    await getRealtimeCongestion('362105');
    await getRealtimeCongestion('10817049');
    expect(fetchRealtimeCongestionMock).toHaveBeenCalledTimes(2);
  });

  it('외부 오류는 캐시 없이 그대로 전파된다', async () => {
    fetchRealtimeCongestionMock.mockRejectedValue(new Error('boom'));
    await expect(getRealtimeCongestion('362105')).rejects.toThrow('boom');
    fetchRealtimeCongestionMock.mockResolvedValue(rawResponse);
    await getRealtimeCongestion('362105');
    expect(fetchRealtimeCongestionMock).toHaveBeenCalledTimes(2);
  });
});
