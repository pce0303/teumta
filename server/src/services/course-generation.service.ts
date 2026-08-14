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
 * 우회 코스 실시간 생성(DB 미사용, 전국).
 *
 * 저장형 Route는 내부 Place만 참조할 수 있어 적재된 지역(현재 종로구)에서만 코스가 나온다.
 * 이 서비스는 주변 로컬 장소 조회(3.3b)가 이미 구한 실측 보행거리를 재활용해
 * **사용자의 가용 시간 안에 다녀올 수 있는 조합**을 즉석에서 만든다 — 적재 없이 전국이 된다.
 *
 * 계산 구조: 목적지 → 정류지1 → … → 정류지N → 목적지(복귀).
 * 목적지↔정류지 구간은 TMAP 실측값이고, 정류지 사이 구간만 추정으로 후보를 좁힌 뒤
 * 최종 반환할 코스에 한해 TMAP으로 검증한다(호출량 절약).
 */

/** 앱이 제시하는 가용 시간 선택지. 그 밖의 값도 허용하되 범위는 제한한다. */
export const COURSE_TIME_OPTIONS = [30, 60, 90] as const;
export const MIN_AVAILABLE_MINUTES = 10;
export const MAX_AVAILABLE_MINUTES = 240;

/**
 * 분류별 기본 체류시간(분).
 *
 * ⚠️ 공식 통계가 없어 팀 합의값이다. 방문 로그가 쌓이면 실측으로 보정한다
 * (docs/congestion-rules.md "장소별 권장 체류시간 기준" 미결정 항목).
 * 14=문화시설, 38=쇼핑, 39=음식점.
 */
export const STAY_MINUTES_BY_CONTENT_TYPE: Record<string, number> = {
  '14': 40,
  '38': 30,
  '39': 40,
};
export const DEFAULT_STAY_MINUTES = 30;

/**
 * 최소 체류시간(분). 시간이 빠듯하면 기본값보다 줄이되 이 밑으로는 내리지 않는다 —
 * 너무 짧으면 방문 자체가 의미 없어진다(docs/route-data-rules.md §6).
 */
export const MIN_STAY_MINUTES = 15;

/** 한 코스에 넣을 최대 정류지 수. */
const MAX_STOPS = 3;
/** 조합 폭발을 막기 위한 후보 상한(가까운 순). */
const MAX_CANDIDATE_POOL = 6;
/** 반환할 코스 수. */
const MAX_COURSES = 3;

/** 보행 속도(m/분). 4km/h 기준 — 정류지 사이 구간을 어림잡는 용도. */
const WALKING_METERS_PER_MINUTE = 67;
/** 직선거리 → 실제 보행거리 보정 계수(골목·횡단보도). */
const DETOUR_FACTOR = 1.3;

export interface CourseStop {
  name: string;
  address: string | null;
  latitude: number;
  longitude: number;
  imageUrl: string | null;
  /** 이전 지점(첫 정류지는 목적지)에서 여기까지 걷는 시간(분). */
  travelMinutesFromPrevious: number;
  /** 이전 지점에서 여기까지 보행거리(m). */
  distanceMetersFromPrevious: number;
  stayMinutes: number;
}

export interface GeneratedCourse {
  /** 이동 + 체류 + 복귀를 모두 더한 예상 소요시간(분). */
  totalMinutes: number;
  /** 마지막 정류지에서 목적지로 돌아오는 시간(분). */
  returnTravelMinutes: number;
  returnDistanceMeters: number;
  stops: CourseStop[];
  /**
   * 정류지 사이 구간이 TMAP 실측인지 추정인지.
   * 정류지가 1곳이면 모든 구간이 실측이라 항상 true.
   */
  verified: boolean;
}

export interface CourseGenerationResult {
  destination: { name: string; latitude: number; longitude: number };
  availableMinutes: number;
  courses: GeneratedCourse[];
}

export type CourseGenerationLookup =
  | { status: 'SUCCESS'; result: CourseGenerationResult }
  /** 목적지 식별자를 좌표로 해석하지 못함. */
  | { status: 'DESTINATION_NOT_FOUND' };

/** 후보의 기본 체류시간. */
export function stayMinutesFor(candidate: NearbyLocalPlaceCandidate): number {
  const contentTypeId = candidate.contentTypeId ?? '';
  return STAY_MINUTES_BY_CONTENT_TYPE[contentTypeId] ?? DEFAULT_STAY_MINUTES;
}

/** 두 정류지 사이 보행시간 추정(분). 실측 전 조합을 좁히는 용도. */
export function estimateWalkMinutes(
  from: { latitude: number; longitude: number },
  to: { latitude: number; longitude: number },
): number {
  const straight = distanceMeters(from, to);
  return Math.max(1, Math.ceil((straight * DETOUR_FACTOR) / WALKING_METERS_PER_MINUTE));
}

/** k개짜리 조합(순서 무관)을 만든다. 방문 순서는 목적지에서 가까운 순으로 정한다. */
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
  /** 정류지 사이 구간(추정 또는 실측) 이동시간·거리. legs[i] = stops[i] → stops[i+1]. */
  legs: { travelMinutes: number; distanceMeters: number }[];
  /** 정류지별 체류시간. 가용 시간에 맞춰 기본값에서 줄어들 수 있다. */
  stayMinutes: number[];
  totalMinutes: number;
  verified: boolean;
}

/** 목적지 → 첫 정류지 → … → 마지막 정류지 → 목적지의 이동시간 합(체류 제외). */
function travelMinutesOf(
  stops: MeasuredNearbyPlace[],
  legs: { travelMinutes: number }[],
): number {
  const outbound = stops[0].travelMinutes;
  // 복귀 구간은 목적지↔마지막 정류지 왕복이 대칭이라고 보고 실측 편도값을 재사용한다.
  const inbound = stops[stops.length - 1].travelMinutes;
  const between = legs.reduce((sum, leg) => sum + leg.travelMinutes, 0);
  return outbound + between + inbound;
}

/**
 * 남는 시간에 맞춰 체류시간을 정한다.
 *
 * 기본값을 그대로 쓰면 짧은 코스(30분)가 아예 만들어지지 않는다 — 문화시설 기본 40분이라
 * 걷는 시간만 더해도 초과한다. 같은 장소라도 코스 제한시간에 따라 체류시간을 달리 두는 것은
 * route-data-rules §6이 정한 방식이라, 기본값에서 비율로 줄이되 최소 체류시간은 지킨다.
 * 최소 체류시간으로도 안 되면 그 조합은 만들 수 없다(null).
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

  // 최소 체류시간 보정 때문에 다시 초과할 수 있다.
  return scaled.reduce((sum, minutes) => sum + minutes, 0) <= stayBudget ? scaled : null;
}

/** 추정값으로 가능한 코스 후보를 만든다(가용 시간 초과분 제외). */
export function planCourses(
  measured: MeasuredNearbyPlace[],
  availableMinutes: number,
): CoursePlan[] {
  const pool = measured.slice(0, MAX_CANDIDATE_POOL);
  const plans: CoursePlan[] = [];

  for (let size = 1; size <= Math.min(MAX_STOPS, pool.length); size += 1) {
    for (const combo of combinations(pool, size)) {
      // 방문 순서: 목적지에서 가까운 정류지부터(불필요한 왕복을 줄인다).
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

/**
 * 가용 시간을 알차게 쓰는 코스를 우선한다(남는 시간이 적을수록 좋음).
 * 같은 조건이면 정류지가 많은 쪽 — 로컬 장소를 더 들르는 편이 분산 효과가 크다.
 */
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

/** 정류지 사이 구간을 TMAP으로 실측해 총 시간을 다시 계산한다. 실패하면 추정값을 유지한다. */
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

/**
 * 목적지 주변에서 가용 시간에 맞는 우회 코스를 만든다.
 * 저장하지 않는다 — 요청 시점의 실시간 결과다.
 */
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

  // 실측 후 시간이 늘어 가용 시간을 넘긴 코스는 제외한다(약속한 시간 안에 못 돌아온다).
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
