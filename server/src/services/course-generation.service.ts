import type { NearbyLocalPlaceCandidate } from '../dtos';
import { extractRouteTotals, fetchPedestrianRoute } from '../external/tmap';
import { distanceMeters } from '../utils/geo';
import {
  DEFAULT_RADIUS_METERS,
  TMAP_CONCURRENCY,
  mapWithConcurrency,
  measureNearbyLocalPlaces,
  resolveDestinationByContentId,
  resolveDestinationByPoiId,
  type DestinationBase,
  type MeasuredNearbyPlace,
} from './nearby-local-place.service';

/**
 * 우회 코스 실시간 생성 — DB 미사용, 전국.
 *
 * 저장형 Route는 내부 Place만 참조 가능 → 적재 지역(종로구)에서만 코스가 나옴.
 * 여기서는 주변 장소 조회(3.3b)가 이미 구한 실측 보행거리를 재활용해 즉석 조합.
 *
 * 구조: 목적지 → 정류지1 … 정류지N → 목적지(복귀).
 * 목적지↔정류지는 실측, 정류지 사이는 추정으로 후보를 좁힌 뒤 반환할 코스만 TMAP 검증(호출량 절약).
 */

/** 앱이 제시하는 선택지. 그 밖의 값도 허용, 범위만 제한. */
export const COURSE_TIME_OPTIONS = [30, 60, 90] as const;
export const MIN_AVAILABLE_MINUTES = 10;
export const MAX_AVAILABLE_MINUTES = 240;

/**
 * 분류별 기본 체류시간(분). 14=문화시설, 38=쇼핑, 39=음식점.
 *
 * ⚠️ 공식 통계 없는 팀 합의값 — 방문 로그 쌓이면 실측으로 보정
 * (docs/congestion-rules.md "장소별 권장 체류시간 기준" 미결정 항목).
 */
export const STAY_MINUTES_BY_CONTENT_TYPE: Record<string, number> = {
  '14': 40,
  '38': 30,
  '39': 40,
};
export const DEFAULT_STAY_MINUTES = 30;

/** 최소 체류시간(분). 이 밑으로 줄이면 방문 자체가 무의미(docs/route-data-rules.md §6). */
export const MIN_STAY_MINUTES = 15;

/** 코스당 최대 정류지 수. */
const MAX_STOPS = 3;
/** 후보 상한(가까운 순) — 조합 폭발 방지. */
const MAX_CANDIDATE_POOL = 6;
/** 반환 코스 수. */
const MAX_COURSES = 3;

/** 보행 속도(m/분), 4km/h 기준 — 정류지 사이 구간 어림용. */
const WALKING_METERS_PER_MINUTE = 67;
/** 직선거리 → 실제 보행거리 보정 계수(골목·횡단보도). */
const DETOUR_FACTOR = 1.3;

export interface CourseStop {
  name: string;
  address: string | null;
  latitude: number;
  longitude: number;
  imageUrl: string | null;
  /** 이전 지점(첫 정류지는 목적지)에서 여기까지 보행시간(분). */
  travelMinutesFromPrevious: number;
  /** 이전 지점에서 여기까지 보행거리(m). */
  distanceMetersFromPrevious: number;
  stayMinutes: number;
}

export interface GeneratedCourse {
  /** 이동 + 체류 + 복귀 합산(분). */
  totalMinutes: number;
  /** 마지막 정류지 → 목적지 복귀 시간(분). */
  returnTravelMinutes: number;
  returnDistanceMeters: number;
  stops: CourseStop[];
  /** 정류지 사이 구간이 TMAP 실측인지 여부. 정류지 1곳이면 전 구간 실측이라 항상 true. */
  verified: boolean;
}

export interface CourseGenerationResult {
  destination: { name: string; latitude: number; longitude: number };
  availableMinutes: number;
  courses: GeneratedCourse[];
}

export type CourseGenerationLookup =
  | { status: 'SUCCESS'; result: CourseGenerationResult }
  /** 목적지 식별자 → 좌표 해석 실패. */
  | { status: 'DESTINATION_NOT_FOUND' };

/** 후보의 기본 체류시간. */
export function stayMinutesFor(candidate: NearbyLocalPlaceCandidate): number {
  const contentTypeId = candidate.contentTypeId ?? '';
  return STAY_MINUTES_BY_CONTENT_TYPE[contentTypeId] ?? DEFAULT_STAY_MINUTES;
}

/** 정류지 사이 보행시간 추정(분) — 실측 전 조합 압축용. */
export function estimateWalkMinutes(
  from: { latitude: number; longitude: number },
  to: { latitude: number; longitude: number },
): number {
  const straight = distanceMeters(from, to);
  return Math.max(1, Math.ceil((straight * DETOUR_FACTOR) / WALKING_METERS_PER_MINUTE));
}

/** k개 조합(순서 무관). 방문 순서는 목적지에서 가까운 순. */
function combinations<T>(items: T[], size: number): T[][] {
  if (size === 0) {
    return [[]];
  }
  const result: T[][] = [];
  items.forEach((item, index) => {
    for (const rest of combinations(items.slice(index + 1), size - 1)) {
      result.push([item, ...rest]);
    }
  });
  return result;
}

interface CoursePlan {
  stops: MeasuredNearbyPlace[];
  /** 정류지 사이 구간(추정 또는 실측). legs[i] = stops[i] → stops[i+1]. */
  legs: { travelMinutes: number; distanceMeters: number }[];
  /** 정류지별 체류시간. 가용 시간에 따라 기본값에서 축소 가능. */
  stayMinutes: number[];
  totalMinutes: number;
  verified: boolean;
}

/** 목적지 → 정류지들 → 목적지 이동시간 합(체류 제외). */
function travelMinutesOf(
  stops: MeasuredNearbyPlace[],
  legs: { travelMinutes: number }[],
): number {
  const outbound = stops[0].travelMinutes;
  // 복귀 구간: 왕복 대칭으로 보고 실측 편도값 재사용
  const inbound = stops[stops.length - 1].travelMinutes;
  const between = legs.reduce((sum, leg) => sum + leg.travelMinutes, 0);
  return outbound + between + inbound;
}

/**
 * 남는 시간에 맞춘 체류시간 결정.
 *
 * 기본값 고정 시 30분 코스가 아예 안 나옴 — 문화시설 40분이라 이동시간만 더해도 초과.
 * 제한시간에 따라 체류시간을 달리 두는 건 route-data-rules §6이 정한 방식.
 * 기본값에서 비율 축소하되 최소 체류시간은 사수, 그래도 안 되면 조합 불가(null).
 */
export function fitStayMinutes(
  stops: MeasuredNearbyPlace[],
  travelMinutes: number,
  availableMinutes: number,
): number[] | null {
  const defaults = stops.map((stop) => stayMinutesFor(stop.candidate));
  const stayBudget = availableMinutes - travelMinutes;

  if (stayBudget < MIN_STAY_MINUTES * stops.length) {
    return null;
  }

  const defaultTotal = defaults.reduce((sum, minutes) => sum + minutes, 0);
  if (defaultTotal <= stayBudget) {
    return defaults;
  }

  const scale = stayBudget / defaultTotal;
  const scaled = defaults.map((minutes) =>
    Math.max(MIN_STAY_MINUTES, Math.floor(minutes * scale)),
  );

  // 최소 체류시간 보정으로 다시 초과 가능
  return scaled.reduce((sum, minutes) => sum + minutes, 0) <= stayBudget ? scaled : null;
}

/** 추정값 기준 코스 후보 생성(가용 시간 초과분 제외). */
export function planCourses(
  measured: MeasuredNearbyPlace[],
  availableMinutes: number,
): CoursePlan[] {
  const pool = measured.slice(0, MAX_CANDIDATE_POOL);
  const plans: CoursePlan[] = [];

  for (let size = 1; size <= Math.min(MAX_STOPS, pool.length); size += 1) {
    for (const combo of combinations(pool, size)) {
      // 방문 순서: 목적지에서 가까운 순 — 불필요한 왕복 감소
      const stops = [...combo].sort((a, b) => a.distanceMeters - b.distanceMeters);
      const legs = stops.slice(1).map((stop, index) => ({
        travelMinutes: estimateWalkMinutes(stops[index].candidate, stop.candidate),
        distanceMeters: Math.round(
          distanceMeters(stops[index].candidate, stop.candidate) * DETOUR_FACTOR,
        ),
      }));

      const travelMinutes = travelMinutesOf(stops, legs);
      const stayMinutes = fitStayMinutes(stops, travelMinutes, availableMinutes);
      if (stayMinutes === null) {
        continue;
      }

      plans.push({
        stops,
        legs,
        stayMinutes,
        totalMinutes: travelMinutes + stayMinutes.reduce((sum, minutes) => sum + minutes, 0),
        verified: stops.length === 1,
      });
    }
  }

  return rankCourses(plans, availableMinutes);
}

/** 남는 시간이 적은 순 → 동률이면 정류지가 많은 순(로컬을 더 들를수록 분산 효과 큼). */
export function rankCourses(plans: CoursePlan[], availableMinutes: number): CoursePlan[] {
  return [...plans].sort((first, second) => {
    const firstSlack = availableMinutes - first.totalMinutes;
    const secondSlack = availableMinutes - second.totalMinutes;
    if (firstSlack !== secondSlack) {
      return firstSlack - secondSlack;
    }
    return second.stops.length - first.stops.length;
  });
}

/** 정류지 사이 구간 TMAP 실측 후 총 시간 재계산. 실패 시 추정값 유지. */
async function verifyPlan(plan: CoursePlan): Promise<CoursePlan> {
  if (plan.legs.length === 0) {
    return plan;
  }

  const measuredLegs = await mapWithConcurrency(
    plan.legs.map((_, index) => index),
    TMAP_CONCURRENCY,
    async (index) => {
      const from = plan.stops[index].candidate;
      const to = plan.stops[index + 1].candidate;
      const route = await fetchPedestrianRoute({
        start: { latitude: from.latitude, longitude: from.longitude },
        end: { latitude: to.latitude, longitude: to.longitude },
        startName: from.name,
        endName: to.name,
      });
      const totals = extractRouteTotals(route);
      return {
        travelMinutes: Math.ceil(totals.totalSeconds / 60),
        distanceMeters: totals.distanceMeters,
      };
    },
  );

  const legs = plan.legs.map((leg, index) => measuredLegs[index] ?? leg);
  const verified = measuredLegs.every((leg) => leg !== null);
  const travelMinutes = travelMinutesOf(plan.stops, legs);

  return {
    ...plan,
    legs,
    verified,
    totalMinutes: travelMinutes + plan.stayMinutes.reduce((sum, minutes) => sum + minutes, 0),
  };
}

function toGeneratedCourse(plan: CoursePlan): GeneratedCourse {
  const stops: CourseStop[] = plan.stops.map((stop, index) => ({
    name: stop.candidate.name,
    address: stop.candidate.address,
    latitude: stop.candidate.latitude,
    longitude: stop.candidate.longitude,
    imageUrl: stop.candidate.imageUrl,
    travelMinutesFromPrevious: index === 0 ? stop.travelMinutes : plan.legs[index - 1].travelMinutes,
    distanceMetersFromPrevious:
      index === 0 ? stop.distanceMeters : plan.legs[index - 1].distanceMeters,
    stayMinutes: plan.stayMinutes[index],
  }));

  const last = plan.stops[plan.stops.length - 1];

  return {
    totalMinutes: plan.totalMinutes,
    returnTravelMinutes: last.travelMinutes,
    returnDistanceMeters: last.distanceMeters,
    stops,
    verified: plan.verified,
  };
}

export interface GenerateCoursesParams {
  contentId?: string;
  poiId?: string;
  availableMinutes: number;
  radiusMeters?: number;
}

/** 목적지 주변에서 가용 시간에 맞는 우회 코스 생성. 저장 없음 — 요청 시점 결과. */
export async function generateCourses(
  params: GenerateCoursesParams,
): Promise<CourseGenerationLookup> {
  const base = await resolveDestination(params);
  if (!base) {
    return { status: 'DESTINATION_NOT_FOUND' };
  }

  const measured = await measureNearbyLocalPlaces(
    base,
    params.radiusMeters ?? DEFAULT_RADIUS_METERS,
  );

  const planned = planCourses(measured, params.availableMinutes);
  const verified = await Promise.all(planned.slice(0, MAX_COURSES).map(verifyPlan));

  // 실측 후 초과한 코스 제외 — 약속한 시간 안에 복귀 불가
  const courses = rankCourses(
    verified.filter((plan) => plan.totalMinutes <= params.availableMinutes),
    params.availableMinutes,
  ).map(toGeneratedCourse);

  return {
    status: 'SUCCESS',
    result: {
      destination: { name: base.name, latitude: base.latitude, longitude: base.longitude },
      availableMinutes: params.availableMinutes,
      courses,
    },
  };
}

async function resolveDestination(
  params: GenerateCoursesParams,
): Promise<DestinationBase | null> {
  if (params.contentId) {
    return resolveDestinationByContentId(params.contentId);
  }
  if (params.poiId) {
    return resolveDestinationByPoiId(params.poiId);
  }
  return null;
}
