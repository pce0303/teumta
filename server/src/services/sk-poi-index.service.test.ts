import { beforeEach, describe, expect, it, vi } from 'vitest';

/** SK 제공 장소 인덱스 테스트. 외부 API는 전부 mock. */

const { fetchCongestionPoiPageMock } = vi.hoisted(() => ({
  fetchCongestionPoiPageMock: vi.fn(),
}));

vi.mock('../external/congestion', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../external/congestion')>();
  return { ...actual, fetchCongestionPoiPage: fetchCongestionPoiPageMock };
});

import { clearSkPoiIndexCache, getSkPoiIndex } from './sk-poi-index.service';

function page(items: { poiId: string; poiName?: string }[]) {
  return {
    status: { code: '00', message: 'success', totalCount: 33745 },
    contents: items,
  };
}

beforeEach(() => {
  clearSkPoiIndexCache();
  fetchCongestionPoiPageMock.mockReset();
});

describe('getSkPoiIndex', () => {
  it('마지막 페이지(limit 미만)까지 모아 poiId·이름 인덱스를 만든다', async () => {
    fetchCongestionPoiPageMock.mockResolvedValueOnce(
      page([
        { poiId: '387701', poiName: '에버랜드' },
        { poiId: '205065', poiName: '수원 화성' },
      ]),
    );

    const index = await getSkPoiIndex();

    expect(index).not.toBeNull();
    expect(index?.size).toBe(2);
    expect(index?.hasPoi('387701')).toBe(true);
    expect(index?.hasPoi('999999')).toBe(false);
    // 이름은 정규화(공백 제거) 후 정확 일치로 찾는다
    expect(index?.findPoiIdsByName('수원화성')).toEqual(['205065']);
    expect(index?.findPoiIdsByName('수원 화성')).toEqual(['205065']);
    expect(fetchCongestionPoiPageMock).toHaveBeenCalledTimes(1);
  });

  it('두 번째 호출은 캐시로 답한다(24시간 보관)', async () => {
    fetchCongestionPoiPageMock.mockResolvedValue(page([{ poiId: '1' }]));

    await getSkPoiIndex();
    await getSkPoiIndex();

    expect(fetchCongestionPoiPageMock).toHaveBeenCalledTimes(1);
  });

  it('동시 호출은 로드 1회를 공유한다', async () => {
    fetchCongestionPoiPageMock.mockResolvedValue(page([{ poiId: '1' }]));

    const [first, second] = await Promise.all([getSkPoiIndex(), getSkPoiIndex()]);

    expect(first).not.toBeNull();
    expect(second).not.toBeNull();
    expect(fetchCongestionPoiPageMock).toHaveBeenCalledTimes(1);
  });

  it('중간 페이지 실패(offset 상한 등)는 확보한 만큼으로 진행한다', async () => {
    const fullPage = page(
      Array.from({ length: 1000 }, (_, index) => ({ poiId: String(index + 1) })),
    );
    fetchCongestionPoiPageMock
      .mockResolvedValueOnce(fullPage)
      .mockRejectedValueOnce(new Error('400 offset limit'));

    const index = await getSkPoiIndex();

    expect(index?.size).toBe(1000);
  });

  it('첫 페이지부터 실패하면 null을 주고, 실패 상태 동안 재로드하지 않는다', async () => {
    fetchCongestionPoiPageMock.mockRejectedValue(new Error('down'));

    await expect(getSkPoiIndex()).resolves.toBeNull();
    await expect(getSkPoiIndex()).resolves.toBeNull();

    // 실패 게이트(10분) 덕에 두 번째 호출은 외부를 다시 부르지 않는다
    expect(fetchCongestionPoiPageMock).toHaveBeenCalledTimes(1);
  });

  it('포함 방향 검색: 목록명이 target 안에 있을 때만, 긴 이름 우선', async () => {
    fetchCongestionPoiPageMock.mockResolvedValueOnce(
      page([
        { poiId: '205065', poiName: '수원화성' },
        { poiId: '11', poiName: '수원' },
        { poiId: '1157887', poiName: '청계천박물관' },
      ]),
    );

    const index = await getSkPoiIndex();

    // "수원화성 관광특구" 안에 "수원화성"(4자)·"수원"(2자, 최소 길이 미달) — 수원화성만
    expect(index?.findPoiIdsContainedInName('수원화성 관광특구')).toEqual(['205065']);
    // 반대 방향("청계천" ⊂ "청계천박물관")은 잡지 않는다
    expect(index?.findPoiIdsContainedInName('청계천')).toEqual([]);
  });
});
