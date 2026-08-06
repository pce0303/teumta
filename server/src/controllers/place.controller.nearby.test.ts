import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';

/**
 * 주변 로컬 장소 컨트롤러 테스트(입력 검증/상태 코드/응답 봉투).
 * 서비스 계층은 mock — 외부 API/DB에 닿지 않는다.
 */

const { getNearbyLocalPlacesRealtimeMock, getNearbyLocalPlacesByContentIdMock, searchTourPlacesMock } =
  vi.hoisted(() => ({
    getNearbyLocalPlacesRealtimeMock: vi.fn(),
    getNearbyLocalPlacesByContentIdMock: vi.fn(),
    searchTourPlacesMock: vi.fn(),
  }));

vi.mock('../services/nearby-local-place.service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/nearby-local-place.service')>();
  return {
    ...actual,
    getNearbyLocalPlacesRealtime: getNearbyLocalPlacesRealtimeMock,
    getNearbyLocalPlacesByContentId: getNearbyLocalPlacesByContentIdMock,
  };
});

vi.mock('../services/place-search.service', () => ({
  searchTourPlaces: searchTourPlacesMock,
}));

// place.service는 컨트롤러 모듈이 import하지만 이 테스트에서는 DB에 닿지 않도록 mock 한다.
vi.mock('../services/place.service', () => ({
  createPlace: vi.fn(),
  findMissingTagIds: vi.fn(),
  getPlaceById: vi.fn(),
  getPlaces: vi.fn(),
  updatePlace: vi.fn(),
}));

import { ExternalApiError } from '../external/common/external-api.error';
import {
  getNearbyLocalPlacesByContentIdController,
  getNearbyLocalPlacesController,
  searchPlacesController,
} from './place.controller';

interface FakeResponse {
  statusCode: number;
  body: unknown;
  status: (code: number) => FakeResponse;
  json: (payload: unknown) => FakeResponse;
}

function makeRes(): FakeResponse {
  const res: FakeResponse = {
    statusCode: 0,
    body: null,
    status(code: number) {
      res.statusCode = code;
      return res;
    },
    json(payload: unknown) {
      res.body = payload;
      return res;
    },
  };
  return res;
}

function makeReq(id: string, radius?: string): Request {
  return {
    params: { id },
    query: radius === undefined ? {} : { radius },
  } as unknown as Request;
}

async function run(req: Request) {
  const res = makeRes();
  const next = vi.fn();
  await getNearbyLocalPlacesController(req, res as unknown as Response, next);
  return { res, next };
}

beforeEach(() => {
  getNearbyLocalPlacesRealtimeMock.mockReset();
  getNearbyLocalPlacesRealtimeMock.mockResolvedValue({ status: 'SUCCESS', places: [] });
  getNearbyLocalPlacesByContentIdMock.mockReset();
  getNearbyLocalPlacesByContentIdMock.mockResolvedValue({ status: 'SUCCESS', places: [] });
  searchTourPlacesMock.mockReset();
  searchTourPlacesMock.mockResolvedValue([]);
});

function makeQueryReq(query: Record<string, string>): Request {
  return { params: {}, query } as unknown as Request;
}

async function runController(
  controller: typeof searchPlacesController,
  req: Request,
) {
  const res = makeRes();
  const next = vi.fn();
  await controller(req, res as unknown as Response, next);
  return { res, next };
}

describe('getNearbyLocalPlacesController — 입력 검증', () => {
  it('잘못된 장소 ID(문자열/0/음수)는 400', async () => {
    for (const id of ['abc', '0', '-1', '1.5']) {
      const { res } = await run(makeReq(id));
      expect(res.statusCode).toBe(400);
      expect(res.body).toMatchObject({ success: false, data: null });
    }
    expect(getNearbyLocalPlacesRealtimeMock).not.toHaveBeenCalled();
  });

  it('radius 0/음수/소수/문자열은 400', async () => {
    for (const radius of ['0', '-100', '2.5', 'abc']) {
      const { res } = await run(makeReq('1', radius));
      expect(res.statusCode).toBe(400);
    }
    expect(getNearbyLocalPlacesRealtimeMock).not.toHaveBeenCalled();
  });

  it('radius 20000 초과는 400', async () => {
    const { res } = await run(makeReq('1', '20001'));
    expect(res.statusCode).toBe(400);
    expect(getNearbyLocalPlacesRealtimeMock).not.toHaveBeenCalled();
  });

  it('radius 미지정 시 기본 2000을 적용한다', async () => {
    await run(makeReq('1'));
    expect(getNearbyLocalPlacesRealtimeMock).toHaveBeenCalledWith(1, 2000);
  });

  it('radius 경계값 20000은 허용한다', async () => {
    const { res } = await run(makeReq('1', '20000'));
    expect(res.statusCode).toBe(200);
    expect(getNearbyLocalPlacesRealtimeMock).toHaveBeenCalledWith(1, 20_000);
  });
});

describe('getNearbyLocalPlacesController — 서비스 결과 매핑', () => {
  it('존재하지 않는 Place는 404', async () => {
    getNearbyLocalPlacesRealtimeMock.mockResolvedValue({ status: 'NOT_FOUND' });
    const { res } = await run(makeReq('1'));
    expect(res.statusCode).toBe(404);
  });

  it('LOCAL_PLACE 기준 요청은 400', async () => {
    getNearbyLocalPlacesRealtimeMock.mockResolvedValue({ status: 'NOT_TOURIST_SPOT' });
    const { res } = await run(makeReq('1'));
    expect(res.statusCode).toBe(400);
  });

  it('tourApiContentId가 없으면 400 + 명확한 메시지', async () => {
    getNearbyLocalPlacesRealtimeMock.mockResolvedValue({ status: 'NO_TOUR_CONTENT_ID' });
    const { res } = await run(makeReq('1'));
    expect(res.statusCode).toBe(400);
    expect((res.body as { error: { message: string } }).error.message).toContain(
      'tourApiContentId',
    );
  });

  it('성공 시 기존 응답 봉투를 유지한다', async () => {
    const place = {
      name: '통인시장',
      address: '서울 종로구',
      latitude: 37.58,
      longitude: 126.97,
      imageUrl: null,
      distanceMeters: 850,
      travelTimeMinutes: 13,
    };
    getNearbyLocalPlacesRealtimeMock.mockResolvedValue({ status: 'SUCCESS', places: [place] });
    const { res } = await run(makeReq('1'));
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ success: true, data: [place], error: null });
  });

  it('외부 API 오류는 next(error)로 위임한다(→ error.middleware가 502/503/504 변환)', async () => {
    const error = new ExternalApiError('tour', 'TourAPI unavailable');
    getNearbyLocalPlacesRealtimeMock.mockRejectedValue(error);
    const { res, next } = await run(makeReq('1'));
    expect(next).toHaveBeenCalledWith(error);
    expect(res.statusCode).toBe(0); // 컨트롤러가 직접 응답하지 않음
  });
});

describe('searchPlacesController — 목적지 검색', () => {
  it('keyword 없거나 공백이면 400', async () => {
    for (const query of [{}, { keyword: '  ' }]) {
      const { res } = await runController(searchPlacesController, makeQueryReq(query as never));
      expect(res.statusCode).toBe(400);
    }
    expect(searchTourPlacesMock).not.toHaveBeenCalled();
  });

  it('정상 검색 시 결과를 봉투에 담아 반환한다', async () => {
    const item = {
      tourApiContentId: '126508',
      contentTypeId: '12',
      name: '경복궁',
      address: '서울 종로구',
      latitude: 37.5788,
      longitude: 126.977,
      imageUrl: null,
    };
    searchTourPlacesMock.mockResolvedValue([item]);
    const { res } = await runController(searchPlacesController, makeQueryReq({ keyword: '경복궁' }));
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ success: true, data: [item], error: null });
    expect(searchTourPlacesMock).toHaveBeenCalledWith({ keyword: '경복궁', pageNo: 1 });
  });
});

describe('getNearbyLocalPlacesByContentIdController — 목적지 기반 추천', () => {
  it('contentId 없으면 400', async () => {
    const { res } = await runController(getNearbyLocalPlacesByContentIdController, makeQueryReq({}));
    expect(res.statusCode).toBe(400);
    expect(getNearbyLocalPlacesByContentIdMock).not.toHaveBeenCalled();
  });

  it('radius 범위 초과는 400', async () => {
    const { res } = await runController(
      getNearbyLocalPlacesByContentIdController,
      makeQueryReq({ contentId: '126508', radius: '20001' }),
    );
    expect(res.statusCode).toBe(400);
  });

  it('목적지를 찾지 못하면 404', async () => {
    getNearbyLocalPlacesByContentIdMock.mockResolvedValue({ status: 'NOT_FOUND' });
    const { res } = await runController(
      getNearbyLocalPlacesByContentIdController,
      makeQueryReq({ contentId: '999999' }),
    );
    expect(res.statusCode).toBe(404);
  });

  it('정상 조회 시 기본 radius 2000 적용', async () => {
    const { res } = await runController(
      getNearbyLocalPlacesByContentIdController,
      makeQueryReq({ contentId: '126508' }),
    );
    expect(res.statusCode).toBe(200);
    expect(getNearbyLocalPlacesByContentIdMock).toHaveBeenCalledWith('126508', 2000);
  });
});
