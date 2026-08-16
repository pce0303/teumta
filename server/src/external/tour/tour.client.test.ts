import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { TourApiListResponse } from './tour.dto';

/**
 * TourAPI 클라이언트 테스트. 실제 네트워크·실제 키를 쓰지 않는다.
 * 키는 명백한 가짜 값(TEST_KEY...)만 사용한다.
 */

const { FAKE_KEY, requestJsonMock } = vi.hoisted(() => ({
  FAKE_KEY: 'TEST_KEY+with/special=chars',
  requestJsonMock: vi.fn(),
}));

vi.mock('../common', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../common')>();
  return {
    ...actual,
    externalConfig: {
      ...actual.externalConfig,
      tour: {
        baseUrl: 'https://apis.data.go.kr/B551011/KorService2',
        apiKey: FAKE_KEY,
      },
    },
    requestJson: (...args: unknown[]) => requestJsonMock(...args),
  };
});

import { ExternalApiError } from '../common/external-api.error';
import {
  buildAreaListQuery,
  buildLocationListQuery,
  clearTourDetailCache,
  fetchTourPlaceDetail,
  fetchTourPlaceIntro,
  fetchTourPlacesByArea,
  fetchTourPlacesByKeyword,
  fetchTourPlacesByLocation,
} from './tour.client';

function okResponse(): TourApiListResponse {
  return {
    response: {
      header: { resultCode: '0000', resultMsg: 'OK' },
      body: { items: '', numOfRows: 0, pageNo: 1, totalCount: 0 },
    },
  };
}

beforeEach(() => {
  requestJsonMock.mockReset();
  requestJsonMock.mockResolvedValue(okResponse());
  clearTourDetailCache();
});

describe('buildAreaListQuery', () => {
  it('최신 법정동/분류체계 파라미터를 사용한다(v4.4)', () => {
    const query = buildAreaListQuery({
      lDongRegnCd: 11,
      lDongSignguCd: '110',
      lclsSystm1: 'VE',
      contentTypeId: 12,
      modifiedtime: '20260801',
    });
    expect(query).toMatchObject({
      lDongRegnCd: '11',
      lDongSignguCd: '110',
      lclsSystm1: 'VE',
      contentTypeId: '12',
      modifiedtime: '20260801',
    });
  });

  it('구 파라미터(areaCode/sigunguCode/cat1~3)는 만들지 않는다', () => {
    const query = buildAreaListQuery({ lDongRegnCd: 11 });
    expect(query).not.toHaveProperty('areaCode');
    expect(query).not.toHaveProperty('sigunguCode');
    expect(query).not.toHaveProperty('cat1');
  });

  it('기본 정렬은 대표이미지 있는 제목순(O)', () => {
    expect(buildAreaListQuery({}).arrange).toBe('O');
  });
});

describe('buildLocationListQuery', () => {
  const base = { mapX: 126.977, mapY: 37.5788, radius: 2000 };

  it('기본 정렬은 거리순(E)', () => {
    expect(buildLocationListQuery(base).arrange).toBe('E');
  });

  it('radius 1~20000 범위를 벗어나면 즉시 입력 오류', () => {
    for (const radius of [0, -1, 20_001, Number.NaN]) {
      expect(() => buildLocationListQuery({ ...base, radius })).toThrow(ExternalApiError);
      try {
        buildLocationListQuery({ ...base, radius });
      } catch (error) {
        expect((error as ExternalApiError).code).toBe('INVALID_PARAM');
      }
    }
  });

  it('경계값(1, 20000)은 허용', () => {
    expect(buildLocationListQuery({ ...base, radius: 1 }).radius).toBe('1');
    expect(buildLocationListQuery({ ...base, radius: 20_000 }).radius).toBe('20000');
  });
});

describe('fetchTourPlacesByLocation', () => {
  it('radius가 유효하지 않으면 외부 API를 호출하지 않는다', async () => {
    await expect(
      fetchTourPlacesByLocation({ mapX: 126.9, mapY: 37.5, radius: 30_000 }),
    ).rejects.toThrow(ExternalApiError);
    expect(requestJsonMock).not.toHaveBeenCalled();
  });

  it('공통 파라미터(MobileOS/MobileApp/_type)와 serviceKey를 정확히 한 번 인코딩한다', async () => {
    await fetchTourPlacesByLocation({ mapX: 126.9, mapY: 37.5, radius: 2000 });

    const { url } = requestJsonMock.mock.calls[0][0] as { url: string };
    const parsed = new URL(url);
    expect(parsed.pathname.endsWith('/locationBasedList2')).toBe(true);
    expect(parsed.searchParams.get('MobileOS')).toBe('ETC');
    expect(parsed.searchParams.get('MobileApp')).toBe('teumta');
    expect(parsed.searchParams.get('_type')).toBe('json');
    // 디코딩 결과가 원본 키와 같으면 정확히 한 번만 인코딩된 것이다(이중 인코딩이면 '%2B'가 '%252B'로 남는다).
    expect(parsed.searchParams.get('serviceKey')).toBe(FAKE_KEY);
    expect(url).toContain('serviceKey=TEST_KEY%2Bwith%2Fspecial%3Dchars');
    expect(url).not.toContain('%252B');
  });
});

describe('fetchTourPlacesByArea', () => {
  it('논리 오류 코드(예: 30)는 오류 계층으로 변환한다', async () => {
    requestJsonMock.mockResolvedValue({
      response: {
        header: { resultCode: '30', resultMsg: 'SERVICE_KEY_IS_NOT_REGISTERED_ERROR' },
        body: { items: '', numOfRows: 0, pageNo: 1, totalCount: 0 },
      },
    });
    await expect(fetchTourPlacesByArea({ lDongRegnCd: 11 })).rejects.toMatchObject({
      code: 'AUTH_FAILED',
    });
  });

  it('오류 message에 serviceKey가 포함되지 않는다', async () => {
    requestJsonMock.mockResolvedValue({
      response: {
        header: { resultCode: '10', resultMsg: 'INVALID REQUEST PARAMETER ERROR' },
        body: { items: '', numOfRows: 0, pageNo: 1, totalCount: 0 },
      },
    });
    try {
      await fetchTourPlacesByArea({});
      expect.unreachable('should have thrown');
    } catch (error) {
      expect((error as Error).message).not.toContain('TEST_KEY');
      expect((error as Error).message).not.toContain('serviceKey');
    }
  });
});

describe('resultCode 처리', () => {
  it('NODATA(0003)는 오류가 아니라 결과 0건으로 통과시킨다', async () => {
    // 오류로 던지면 검색이 502로 죽고 TMAP 폴백이 실행되지 않는다
    // (일반 상점 키워드처럼 관광지 검색 결과가 없을 때 실제로 발생).
    const nodata = {
      response: { header: { resultCode: '0003', resultMsg: 'NODATA_ERROR' } },
    };
    requestJsonMock.mockResolvedValue(nodata);

    await expect(fetchTourPlacesByKeyword({ keyword: '교보문고 강남점' })).resolves.toEqual(nodata);
  });

  it('JSON 게이트웨이 오류 봉투(30)는 인증 오류로 분류한다', async () => {
    requestJsonMock.mockResolvedValue({
      OpenAPI_ServiceResponse: {
        cmmMsgHeader: {
          errMsg: 'SERVICE ERROR',
          returnAuthMsg: 'SERVICE_KEY_IS_NOT_REGISTERED_ERROR',
          returnReasonCode: '30',
        },
      },
    });

    const caught = await fetchTourPlacesByKeyword({ keyword: '경복궁' }).catch(
      (error: unknown) => error,
    );
    expect((caught as ExternalApiError).code).toBe('AUTH_FAILED');
  });

  it('요청제한 초과(22)는 rate limit으로 분류한다', async () => {
    requestJsonMock.mockResolvedValue({
      OpenAPI_ServiceResponse: {
        cmmMsgHeader: {
          returnAuthMsg: 'LIMITED_NUMBER_OF_SERVICE_REQUESTS_EXCEEDS_ERROR',
          returnReasonCode: '22',
        },
      },
    });

    const caught = await fetchTourPlacesByKeyword({ keyword: '경복궁' }).catch(
      (error: unknown) => error,
    );
    expect((caught as ExternalApiError).code).toBe('RATE_LIMITED');
  });
});

describe('상세 응답 캐시(detailCommon2/detailIntro2)', () => {
  it('같은 contentId는 TTL 안에서 외부 호출 1회만 발생한다', async () => {
    await fetchTourPlaceDetail('126508');
    await fetchTourPlaceDetail('126508');
    expect(requestJsonMock).toHaveBeenCalledTimes(1);
  });

  it('다른 contentId는 각각 호출한다', async () => {
    await fetchTourPlaceDetail('126508');
    await fetchTourPlaceDetail('126081');
    expect(requestJsonMock).toHaveBeenCalledTimes(2);
  });

  it('동시 요청도 호출 1회로 합쳐진다(화면 하나가 3곳에서 병렬 조회)', async () => {
    await Promise.all([
      fetchTourPlaceDetail('126508'),
      fetchTourPlaceDetail('126508'),
      fetchTourPlaceDetail('126508'),
    ]);
    expect(requestJsonMock).toHaveBeenCalledTimes(1);
  });

  it('실패는 캐시하지 않아 다음 호출이 다시 시도한다', async () => {
    requestJsonMock.mockRejectedValueOnce(new ExternalApiError('tour', 'boom'));
    await expect(fetchTourPlaceDetail('126508')).rejects.toThrow();
    await fetchTourPlaceDetail('126508');
    expect(requestJsonMock).toHaveBeenCalledTimes(2);
  });

  it('common과 intro는 키가 달라 서로 캐시를 공유하지 않는다', async () => {
    await fetchTourPlaceDetail('126508');
    await fetchTourPlaceIntro('126508', '12');
    await fetchTourPlaceIntro('126508', '12');
    expect(requestJsonMock).toHaveBeenCalledTimes(2);
  });
});
