import { beforeEach, describe, expect, it, vi } from 'vitest';

/** 집중률 예측 실시간 조회 테스트. 외부 API는 전부 mock. */

const { fetchTourPlaceDetailMock, fetchConcentrationForecastMock } = vi.hoisted(() => ({
  fetchTourPlaceDetailMock: vi.fn(),
  fetchConcentrationForecastMock: vi.fn(),
}));

vi.mock('../external/tour', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../external/tour')>();
  return { ...actual, fetchTourPlaceDetail: fetchTourPlaceDetailMock };
});

vi.mock('../external/prediction', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../external/prediction')>();
  return { ...actual, fetchConcentrationForecast: fetchConcentrationForecastMock };
});

import {
  clearForecastRegionCache,
  getConcentrationForecastByContentId,
  selectForecastsByName,
  toFullSignguCode,
} from './concentration-forecast.service';

function tourDetail(item: Record<string, unknown> | null) {
  return {
    response: {
      header: { resultCode: '0000', resultMsg: 'OK' },
      body: { items: item === null ? '' : { item }, numOfRows: 1, pageNo: 1, totalCount: 1 },
    },
  };
}

function forecastResponse(items: Record<string, unknown>[]) {
  return {
    response: {
      header: { resultCode: '0000', resultMsg: 'OK' },
      body: {
        items: items.length === 0 ? '' : { item: items },
        numOfRows: items.length,
        pageNo: 1,
        totalCount: items.length,
      },
    },
  };
}

function forecastItem(tAtsNm: string, baseYmd: string, cnctrRate: string) {
  return { baseYmd, areaCd: '26', signguCd: '26350', tAtsNm, cnctrRate };
}

beforeEach(() => {
  clearForecastRegionCache();
  vi.clearAllMocks();

  fetchTourPlaceDetailMock.mockResolvedValue(
    tourDetail({
      contentid: '126081',
      title: '해운대해수욕장',
      // TourAPI는 시군구를 3자리로 준다.
      lDongRegnCd: '26',
      lDongSignguCd: '350',
    }),
  );
  fetchConcentrationForecastMock.mockResolvedValue(
    forecastResponse([
      forecastItem('해운대해수욕장', '20260815', '77.86'),
      forecastItem('해운대해수욕장', '20260814', '65.20'),
      forecastItem('SEA LIFE 부산아쿠아리움', '20260814', '31.00'),
    ]),
  );
});

describe('toFullSignguCode', () => {
  it('3자리 시군구 코드 앞에 시도 코드를 붙인다', () => {
    // KTO는 5자리 전체 코드만 받는다. 3자리로 조회하면 결과가 0건이다.
    expect(toFullSignguCode('26', '350')).toBe('26350');
  });

  it('시군구 코드가 시도 코드로 시작해도 3자리면 붙인다', () => {
    // 서울 종로구는 "110"이라 접두사 검사로 판단하면 이미 전체 코드로 오해한다("110".startsWith("11")).
    expect(toFullSignguCode('11', '110')).toBe('11110');
  });

  it('이미 전체 코드면 그대로 둔다', () => {
    expect(toFullSignguCode('11', '11110')).toBe('11110');
  });
});

describe('selectForecastsByName', () => {
  const rows = [
    { tAtsNm: '해운대 해수욕장', forecastDate: '2026-08-14' },
    { tAtsNm: '해운대해수욕장 주차장', forecastDate: '2026-08-14' },
  ] as never[];

  it('띄어쓰기가 달라도 정규화해서 정확 일치를 찾는다', () => {
    const selected = selectForecastsByName(rows, '해운대해수욕장');
    expect(selected).toHaveLength(1);
    expect((selected[0] as { tAtsNm: string }).tAtsNm).toBe('해운대 해수욕장');
  });

  it('정확 일치가 없으면 부분 일치 중 가장 짧은 이름으로 좁힌다', () => {
    const selected = selectForecastsByName(
      [{ tAtsNm: '경복궁 주차장' }, { tAtsNm: '경복궁' }] as never[],
      '경복궁(사적)',
    );
    expect((selected[0] as { tAtsNm: string }).tAtsNm).toBe('경복궁');
  });

  it('관련 없는 이름은 매칭하지 않는다', () => {
    expect(selectForecastsByName(rows, '남산타워')).toEqual([]);
  });
});

describe('getConcentrationForecastByContentId', () => {
  it('전국 어디든 contentId만으로 조회한다(DB 미사용)', async () => {
    const result = await getConcentrationForecastByContentId('126081');

    expect(fetchConcentrationForecastMock).toHaveBeenCalledWith(
      expect.objectContaining({ areaCd: '26', signguCd: '26350' }),
    );
    if (result.status !== 'SUCCESS') {
      throw new Error('expected success');
    }
    expect(result.data.destinationName).toBe('해운대해수욕장');
    // 날짜 오름차순, 해당 관광지 항목만.
    expect(result.data.forecasts.map((entry) => entry.forecastDate)).toEqual([
      '2026-08-14',
      '2026-08-15',
    ]);
    expect(result.data.forecasts[0].concentrationRate).toBe(65.2);
    expect(result.data.forecasts[0].isRealtime).toBe(false);
  });

  it('같은 지역의 다른 목적지는 캐시를 재사용해 KTO를 다시 부르지 않는다', async () => {
    await getConcentrationForecastByContentId('126081');
    fetchTourPlaceDetailMock.mockResolvedValue(
      tourDetail({
        contentid: '999',
        title: 'SEA LIFE 부산아쿠아리움',
        lDongRegnCd: '26',
        lDongSignguCd: '350',
      }),
    );

    const second = await getConcentrationForecastByContentId('999');

    expect(second.status).toBe('SUCCESS');
    expect(fetchConcentrationForecastMock).toHaveBeenCalledTimes(1);
  });

  it('지역 코드가 없으면 DESTINATION_NOT_RESOLVED', async () => {
    fetchTourPlaceDetailMock.mockResolvedValue(
      tourDetail({ contentid: '1', title: '어떤 곳' }),
    );

    const result = await getConcentrationForecastByContentId('1');

    expect(result.status).toBe('DESTINATION_NOT_RESOLVED');
    expect(fetchConcentrationForecastMock).not.toHaveBeenCalled();
  });

  it('지역 예측에 해당 관광지가 없으면 NO_FORECAST', async () => {
    fetchTourPlaceDetailMock.mockResolvedValue(
      tourDetail({
        contentid: '2',
        title: '집중률 없는 장소',
        lDongRegnCd: '26',
        lDongSignguCd: '350',
      }),
    );

    expect((await getConcentrationForecastByContentId('2')).status).toBe('NO_FORECAST');
  });
});
