import { Prisma } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/** 코스 쓰기(관리자) 테스트. TMAP 계산과 prisma는 전부 mock. */

const { prismaMock, calculateWalkingRouteMock } = vi.hoisted(() => ({
  prismaMock: {
    route: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    place: { findMany: vi.fn() },
    trip: { findFirst: vi.fn() },
  },
  calculateWalkingRouteMock: vi.fn(),
}));

vi.mock('../utils/prisma', () => ({ prisma: prismaMock }));
vi.mock('./route-calculation.service', () => ({
  calculateWalkingRoute: calculateWalkingRouteMock,
}));

import { createRoute, deleteRoute, updateRoute } from './route.service';

const MAIN_PLACE = {
  id: 1,
  name: '경복궁',
  type: 'TOURIST_SPOT',
  latitude: 37.5796,
  longitude: 126.977,
};
const STOP_A = {
  id: 20,
  name: '통인시장',
  type: 'LOCAL_PLACE',
  latitude: 37.58,
  longitude: 126.97,
};
const STOP_B = {
  id: 21,
  name: '서촌 카페',
  type: 'LOCAL_PLACE',
  latitude: 37.581,
  longitude: 126.971,
};

function segment(travelMinutes: number, distanceMeters: number) {
  return {
    travelMinutes,
    distanceMeters,
    path: [{ latitude: 37.5, longitude: 126.9 }],
  };
}

/** 저장 후 getRouteById가 호출되므로 최소 형태의 상세 응답을 돌려준다. */
function stubRouteDetail() {
  prismaMock.route.findUnique.mockResolvedValue({
    id: 100,
    name: '경복궁 60분 우회 코스',
    mainPlaceId: 1,
    stops: [],
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.place.findMany.mockResolvedValue([MAIN_PLACE, STOP_A, STOP_B]);
  prismaMock.route.create.mockResolvedValue({ id: 100 });
  prismaMock.route.update.mockResolvedValue({ id: 100 });
  prismaMock.trip.findFirst.mockResolvedValue(null);
  calculateWalkingRouteMock.mockResolvedValue({
    totalDurationMinutes: 21,
    totalDistanceMeters: 1500,
    segments: [segment(8, 600), segment(5, 400), segment(8, 500)],
  });
  stubRouteDetail();
});

describe('createRoute', () => {
  it('TMAP 계산 결과를 정류지 구간과 복귀 구간에 나눠 저장한다', async () => {
    const result = await createRoute({
      name: '경복궁 60분 우회 코스',
      mainPlaceId: 1,
      stops: [
        { placeId: 20, stayMinutes: 20 },
        { placeId: 21, stayMinutes: 15 },
      ],
    });

    expect(result.status).toBe('CREATED');

    // mainPlace → stopA → stopB → mainPlace (복귀 기본 포함)
    expect(calculateWalkingRouteMock).toHaveBeenCalledWith([
      { latitude: 37.5796, longitude: 126.977 },
      { latitude: 37.58, longitude: 126.97 },
      { latitude: 37.581, longitude: 126.971 },
      { latitude: 37.5796, longitude: 126.977 },
    ]);

    const { data } = prismaMock.route.create.mock.calls[0][0];
    // 총 소요시간 = 이동 21분 + 체류(20+15)분
    expect(data.estimatedTotalDurationMinutes).toBe(56);
    expect(data.estimatedTotalDistanceMeters).toBe(1500);
    // 마지막 구간은 복귀 구간이라 정류지가 아닌 Route 필드로 간다.
    expect(data.returnTravelMinutes).toBe(8);
    expect(data.returnDistanceMeters).toBe(500);
    expect(data.stops.create).toEqual([
      expect.objectContaining({
        placeId: 20,
        stopOrder: 1,
        stayMinutes: 20,
        estimatedTravelMinutesFromPrevious: 8,
        estimatedDistanceMetersFromPrevious: 600,
      }),
      expect.objectContaining({
        placeId: 21,
        stopOrder: 2,
        stayMinutes: 15,
        estimatedTravelMinutesFromPrevious: 5,
        estimatedDistanceMetersFromPrevious: 400,
      }),
    ]);
  });

  it('includeReturn=false면 복귀 구간을 계산하지도 저장하지도 않는다', async () => {
    calculateWalkingRouteMock.mockResolvedValue({
      totalDurationMinutes: 8,
      totalDistanceMeters: 600,
      segments: [segment(8, 600)],
    });

    await createRoute({
      name: '편도 코스',
      mainPlaceId: 1,
      includeReturn: false,
      stops: [{ placeId: 20, stayMinutes: 30 }],
    });

    expect(calculateWalkingRouteMock.mock.calls[0][0]).toHaveLength(2);
    const { data } = prismaMock.route.create.mock.calls[0][0];
    expect(data.returnTravelMinutes).toBeNull();
    expect(data.returnDistanceMeters).toBeNull();
    expect(data.estimatedTotalDurationMinutes).toBe(38);
  });

  it('기준 관광지가 TOURIST_SPOT이 아니면 INVALID', async () => {
    prismaMock.place.findMany.mockResolvedValue([
      { ...MAIN_PLACE, type: 'LOCAL_PLACE' },
      STOP_A,
    ]);

    const result = await createRoute({
      name: 'x',
      mainPlaceId: 1,
      stops: [{ placeId: 20, stayMinutes: 10 }],
    });

    expect(result.status).toBe('INVALID');
    expect(calculateWalkingRouteMock).not.toHaveBeenCalled();
    expect(prismaMock.route.create).not.toHaveBeenCalled();
  });

  it('존재하지 않는 정류지 장소가 있으면 INVALID', async () => {
    prismaMock.place.findMany.mockResolvedValue([MAIN_PLACE]);

    const result = await createRoute({
      name: 'x',
      mainPlaceId: 1,
      stops: [{ placeId: 999, stayMinutes: 10 }],
    });

    expect(result).toEqual({
      status: 'INVALID',
      message: '존재하지 않는 정류지 장소입니다: 999',
    });
    expect(prismaMock.route.create).not.toHaveBeenCalled();
  });

  it('기준 관광지를 정류지로 넣으면 INVALID(외부 호출 전에 걸러낸다)', async () => {
    const result = await createRoute({
      name: 'x',
      mainPlaceId: 1,
      stops: [{ placeId: 1, stayMinutes: 10 }],
    });

    expect(result.status).toBe('INVALID');
    expect(prismaMock.place.findMany).not.toHaveBeenCalled();
  });

  it('좌표가 없는 장소가 포함되면 INVALID', async () => {
    prismaMock.place.findMany.mockResolvedValue([
      MAIN_PLACE,
      { ...STOP_A, latitude: null, longitude: null },
    ]);

    const result = await createRoute({
      name: 'x',
      mainPlaceId: 1,
      stops: [{ placeId: 20, stayMinutes: 10 }],
    });

    expect(result.status).toBe('INVALID');
    expect(calculateWalkingRouteMock).not.toHaveBeenCalled();
  });
});

describe('updateRoute', () => {
  const existingRoute = {
    id: 100,
    name: '기존 코스',
    mainPlaceId: 1,
    returnTravelMinutes: 8,
    stops: [{ placeId: 20, stopOrder: 1, stayMinutes: 20 }],
  };

  it('이름만 바꾸면 TMAP을 호출하지 않는다(쿼터 절약)', async () => {
    prismaMock.route.findUnique.mockResolvedValueOnce(existingRoute);

    const result = await updateRoute(100, { name: '새 이름' });

    expect(result.status).toBe('UPDATED');
    expect(calculateWalkingRouteMock).not.toHaveBeenCalled();
    expect(prismaMock.route.update.mock.calls[0][0].data).toEqual({ name: '새 이름' });
  });

  it('진행 중인 방문이 있으면 정류지 구성을 바꾸지 않는다', async () => {
    prismaMock.route.findUnique.mockResolvedValueOnce(existingRoute);
    prismaMock.trip.findFirst.mockResolvedValue({ id: 5 });

    const result = await updateRoute(100, {
      stops: [{ placeId: 21, stayMinutes: 30 }],
    });

    expect(result).toEqual({ status: 'TRIP_IN_PROGRESS' });
    expect(calculateWalkingRouteMock).not.toHaveBeenCalled();
    expect(prismaMock.route.update).not.toHaveBeenCalled();
  });

  it('stops를 보내면 전체 교체하고 재계산한다', async () => {
    prismaMock.route.findUnique.mockResolvedValueOnce(existingRoute);
    calculateWalkingRouteMock.mockResolvedValue({
      totalDurationMinutes: 13,
      totalDistanceMeters: 900,
      segments: [segment(6, 500), segment(7, 400)],
    });

    const result = await updateRoute(100, {
      stops: [{ placeId: 21, stayMinutes: 30 }],
    });

    expect(result.status).toBe('UPDATED');
    const { data } = prismaMock.route.update.mock.calls[0][0];
    expect(data.stops.deleteMany).toEqual({});
    expect(data.stops.create).toHaveLength(1);
    expect(data.estimatedTotalDurationMinutes).toBe(43);
  });

  it('존재하지 않는 코스는 NOT_FOUND', async () => {
    prismaMock.route.findUnique.mockResolvedValueOnce(null);
    expect(await updateRoute(999, { name: 'x' })).toEqual({ status: 'NOT_FOUND' });
  });
});

describe('deleteRoute', () => {
  it('Trip이 참조 중이면(P2003) IN_USE', async () => {
    prismaMock.route.delete.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('FK constraint', {
        code: 'P2003',
        clientVersion: 'test',
      }),
    );

    expect(await deleteRoute(100)).toBe('IN_USE');
  });

  it('없는 코스는(P2025) NOT_FOUND', async () => {
    prismaMock.route.delete.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('not found', {
        code: 'P2025',
        clientVersion: 'test',
      }),
    );

    expect(await deleteRoute(999)).toBe('NOT_FOUND');
  });

  it('정상 삭제는 DELETED', async () => {
    prismaMock.route.delete.mockResolvedValue({ id: 100 });
    expect(await deleteRoute(100)).toBe('DELETED');
  });
});
