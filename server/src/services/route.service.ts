import { PlaceType, Prisma, TripStatus } from '@prisma/client';

import type { Coordinate } from '../dtos';
import { prisma } from '../utils/prisma';
import { transformPlace } from './place.service';
import { calculateWalkingRoute } from './route-calculation.service';

export async function getRoutesByPlaceId(placeId: number) {
  return prisma.route.findMany({
    where: {
      mainPlaceId: placeId,
    },
    orderBy: {
      id: 'asc',
    },
  });
}

/**
 * 관리자 코스 관리 화면용 전체 목록(api-spec §6.5.0).
 * 3.5는 mainPlaceId를 미리 알아야 조회할 수 있어 "어느 관광지에 코스가 있는지"를 알 수 없다.
 * 목록 표시에 필요한 mainPlaceName/stopCount를 함께 반환한다.
 */
export async function getAllRoutes(mainPlaceId?: number) {
  const routes = await prisma.route.findMany({
    where: mainPlaceId === undefined ? {} : { mainPlaceId },
    include: {
      mainPlace: { select: { name: true } },
      _count: { select: { stops: true } },
    },
    orderBy: [{ mainPlaceId: 'asc' }, { id: 'asc' }],
  });

  return routes.map(({ mainPlace, _count, ...route }) => ({
    ...route,
    mainPlaceName: mainPlace.name,
    stopCount: _count.stops,
  }));
}

export async function getRouteById(routeId: number) {
  const route = await prisma.route.findUnique({
    where: {
      id: routeId,
    },
    include: {
      stops: {
        orderBy: {
          stopOrder: 'asc',
        },
        include: {
          place: {
            include: {
              placeTags: {
                include: {
                  tag: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!route) {
    return null;
  }

  return {
    ...route,
    stops: route.stops.map((stop) => ({
      ...stop,
      place: transformPlace(stop.place),
    })),
  };
}

// ── 코스 쓰기(관리자 전용, api-spec §6.5) ─────────────────────────────────────
//
// 이동시간·거리·경로는 클라이언트 입력을 받지 않고 서버가 TMAP으로 계산한다
// (route-calculation.service 경유 — 컨트롤러/관리자 웹은 TMAP을 직접 호출하지 않는다).
// TMAP 호출이 실패하면 ExternalApiError가 그대로 전파돼 502가 되고, 계산이 끝난 뒤에만
// DB에 쓰기 때문에 "경로 미검증 코스"가 저장되는 일은 없다(route-data-rules §13).

export interface RouteStopInput {
  placeId: number;
  stayMinutes: number;
}

export interface CreateRouteInput {
  name: string;
  mainPlaceId: number;
  description?: string | null;
  /** 마지막 정류지에서 mainPlace로 돌아오는 구간을 계산·저장할지. 기본 true. */
  includeReturn?: boolean;
  stops: RouteStopInput[];
}

export type UpdateRouteInput = Partial<CreateRouteInput>;

interface RoutePlan {
  stops: {
    placeId: number;
    stopOrder: number;
    stayMinutes: number;
    estimatedTravelMinutesFromPrevious: number;
    estimatedDistanceMetersFromPrevious: number;
    pathFromPrevious: Coordinate[];
  }[];
  returnTravelMinutes: number | null;
  returnDistanceMeters: number | null;
  returnPath: Coordinate[] | null;
  estimatedTotalDurationMinutes: number;
  estimatedTotalDistanceMeters: number;
}

type PlanResult =
  | { status: 'OK'; plan: RoutePlan }
  | { status: 'INVALID'; message: string };

/**
 * Place 고정 좌표 → 계산용 좌표.
 * 0은 유효한 좌표로 보지 않는다 — TourAPI 적재 경로(tour.mapper)와 같은 관례이며,
 * `Number(null)`이 0이 되는 탓에 빈 값이 (0, 0)으로 새는 것도 여기서 함께 막는다.
 */
function toCoordinate(place: {
  latitude: Prisma.Decimal;
  longitude: Prisma.Decimal;
}): Coordinate | null {
  const latitude = Number(place.latitude);
  const longitude = Number(place.longitude);
  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude === 0 ||
    longitude === 0
  ) {
    return null;
  }
  return { latitude, longitude };
}

/**
 * 정류지 구성을 검증하고 TMAP으로 구간을 계산한다.
 * 장소 존재/타입/좌표 문제는 INVALID(400)로 돌려주고, TMAP 오류는 그대로 throw한다(502).
 */
async function planRoute(
  mainPlaceId: number,
  stops: RouteStopInput[],
  includeReturn: boolean,
): Promise<PlanResult> {
  if (stops.some((stop) => stop.placeId === mainPlaceId)) {
    return {
      status: 'INVALID',
      message: '기준 관광지는 정류지로 포함할 수 없습니다.',
    };
  }

  const placeIds = [...new Set([mainPlaceId, ...stops.map((stop) => stop.placeId)])];
  const places = await prisma.place.findMany({
    where: { id: { in: placeIds } },
    select: { id: true, name: true, type: true, latitude: true, longitude: true },
  });
  const placeById = new Map(places.map((place) => [place.id, place]));

  const mainPlace = placeById.get(mainPlaceId);
  if (!mainPlace) {
    return { status: 'INVALID', message: `기준 관광지를 찾을 수 없습니다: ${mainPlaceId}` };
  }
  if (mainPlace.type !== PlaceType.TOURIST_SPOT) {
    return {
      status: 'INVALID',
      message: '기준 관광지는 TOURIST_SPOT이어야 합니다.',
    };
  }

  const missingIds = stops
    .map((stop) => stop.placeId)
    .filter((placeId) => !placeById.has(placeId));
  if (missingIds.length > 0) {
    return {
      status: 'INVALID',
      message: `존재하지 않는 정류지 장소입니다: ${[...new Set(missingIds)].join(', ')}`,
    };
  }

  const waypoints: Coordinate[] = [];
  for (const placeId of [mainPlaceId, ...stops.map((stop) => stop.placeId)]) {
    const place = placeById.get(placeId)!;
    const coordinate = toCoordinate(place);
    if (coordinate === null) {
      return {
        status: 'INVALID',
        message: `좌표가 없어 경로를 계산할 수 없습니다: ${place.name}(#${place.id})`,
      };
    }
    waypoints.push(coordinate);
  }

  if (includeReturn) {
    waypoints.push(waypoints[0]);
  }

  const calculation = await calculateWalkingRoute(waypoints);
  const stayMinutesSum = stops.reduce((sum, stop) => sum + stop.stayMinutes, 0);
  // segments[i] = i번째 구간. 정류지 수만큼이 진입 구간이고, 복귀 포함 시 마지막 1개가 복귀 구간이다.
  const returnSegment = includeReturn ? calculation.segments[stops.length] : null;

  return {
    status: 'OK',
    plan: {
      stops: stops.map((stop, index) => ({
        placeId: stop.placeId,
        stopOrder: index + 1,
        stayMinutes: stop.stayMinutes,
        estimatedTravelMinutesFromPrevious: calculation.segments[index].travelMinutes,
        estimatedDistanceMetersFromPrevious: calculation.segments[index].distanceMeters,
        pathFromPrevious: calculation.segments[index].path,
      })),
      returnTravelMinutes: returnSegment?.travelMinutes ?? null,
      returnDistanceMeters: returnSegment?.distanceMeters ?? null,
      returnPath: returnSegment?.path ?? null,
      // 총 소요시간 = 모든 구간 이동시간(복귀 포함) + 정류지 체류시간 합.
      estimatedTotalDurationMinutes: calculation.totalDurationMinutes + stayMinutesSum,
      estimatedTotalDistanceMeters: calculation.totalDistanceMeters,
    },
  };
}

function toJson(path: Coordinate[] | null): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  return path === null ? Prisma.JsonNull : (path as unknown as Prisma.InputJsonValue);
}

export type CreateRouteResult =
  | { status: 'CREATED'; route: Awaited<ReturnType<typeof getRouteById>> }
  | { status: 'INVALID'; message: string };

export async function createRoute(input: CreateRouteInput): Promise<CreateRouteResult> {
  const includeReturn = input.includeReturn ?? true;
  const planned = await planRoute(input.mainPlaceId, input.stops, includeReturn);

  if (planned.status === 'INVALID') {
    return planned;
  }

  const created = await prisma.route.create({
    data: {
      name: input.name,
      mainPlaceId: input.mainPlaceId,
      description: input.description ?? null,
      estimatedTotalDurationMinutes: planned.plan.estimatedTotalDurationMinutes,
      estimatedTotalDistanceMeters: planned.plan.estimatedTotalDistanceMeters,
      returnTravelMinutes: planned.plan.returnTravelMinutes,
      returnDistanceMeters: planned.plan.returnDistanceMeters,
      returnPath: toJson(planned.plan.returnPath),
      stops: {
        create: planned.plan.stops.map((stop) => ({
          placeId: stop.placeId,
          stopOrder: stop.stopOrder,
          stayMinutes: stop.stayMinutes,
          estimatedTravelMinutesFromPrevious: stop.estimatedTravelMinutesFromPrevious,
          estimatedDistanceMetersFromPrevious: stop.estimatedDistanceMetersFromPrevious,
          pathFromPrevious: toJson(stop.pathFromPrevious),
        })),
      },
    },
    select: { id: true },
  });

  return { status: 'CREATED', route: await getRouteById(created.id) };
}

export type UpdateRouteResult =
  | { status: 'UPDATED'; route: Awaited<ReturnType<typeof getRouteById>> }
  | { status: 'NOT_FOUND' }
  | { status: 'TRIP_IN_PROGRESS' }
  | { status: 'INVALID'; message: string };

/**
 * 부분 수정. `stops`/`includeReturn`이 오면 정류지 구성을 전체 교체하고 TMAP을 다시 계산한다.
 * 이름·설명만 바꾸는 경우에는 외부 호출 없이 끝난다(쿼터 절약).
 */
export async function updateRoute(
  id: number,
  input: UpdateRouteInput,
): Promise<UpdateRouteResult> {
  const existing = await prisma.route.findUnique({
    where: { id },
    include: { stops: { orderBy: { stopOrder: 'asc' } } },
  });

  if (!existing) {
    return { status: 'NOT_FOUND' };
  }

  const needsRecalculation =
    input.stops !== undefined ||
    input.includeReturn !== undefined ||
    input.mainPlaceId !== undefined;

  if (!needsRecalculation) {
    await prisma.route.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
      },
    });
    return { status: 'UPDATED', route: await getRouteById(id) };
  }

  // 진행 중인 방문이 있는 코스의 구성을 바꾸면 사용자가 걷고 있는 코스와 기록이 어긋난다.
  const inProgressTrip = await prisma.trip.findFirst({
    where: { routeId: id, status: TripStatus.IN_PROGRESS },
    select: { id: true },
  });
  if (inProgressTrip) {
    return { status: 'TRIP_IN_PROGRESS' };
  }

  const mainPlaceId = input.mainPlaceId ?? existing.mainPlaceId;
  const stops =
    input.stops ??
    existing.stops.map((stop) => ({
      placeId: stop.placeId,
      stayMinutes: stop.stayMinutes ?? 0,
    }));
  const includeReturn = input.includeReturn ?? existing.returnTravelMinutes !== null;

  if (stops.length === 0) {
    return { status: 'INVALID', message: 'stops는 1개 이상이어야 합니다.' };
  }

  const planned = await planRoute(mainPlaceId, stops, includeReturn);
  if (planned.status === 'INVALID') {
    return planned;
  }

  await prisma.route.update({
    where: { id },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      mainPlaceId,
      estimatedTotalDurationMinutes: planned.plan.estimatedTotalDurationMinutes,
      estimatedTotalDistanceMeters: planned.plan.estimatedTotalDistanceMeters,
      returnTravelMinutes: planned.plan.returnTravelMinutes,
      returnDistanceMeters: planned.plan.returnDistanceMeters,
      returnPath: toJson(planned.plan.returnPath),
      stops: {
        deleteMany: {},
        create: planned.plan.stops.map((stop) => ({
          placeId: stop.placeId,
          stopOrder: stop.stopOrder,
          stayMinutes: stop.stayMinutes,
          estimatedTravelMinutesFromPrevious: stop.estimatedTravelMinutesFromPrevious,
          estimatedDistanceMetersFromPrevious: stop.estimatedDistanceMetersFromPrevious,
          pathFromPrevious: toJson(stop.pathFromPrevious),
        })),
      },
    },
  });

  return { status: 'UPDATED', route: await getRouteById(id) };
}

export type DeleteRouteResult = 'DELETED' | 'NOT_FOUND' | 'IN_USE';

/**
 * 코스 삭제. RouteStop은 cascade로 함께 정리된다.
 * Trip이 참조 중이면 DB 제약(RESTRICT)에 걸려 IN_USE — 방문 기록 보호(장소 삭제와 동일 정책).
 */
export async function deleteRoute(id: number): Promise<DeleteRouteResult> {
  try {
    await prisma.route.delete({ where: { id } });
    return 'DELETED';
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2025') {
        return 'NOT_FOUND';
      }
      if (error.code === 'P2003') {
        return 'IN_USE';
      }
    }
    throw error;
  }
}
