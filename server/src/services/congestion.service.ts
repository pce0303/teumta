import { CongestionType, type CongestionLevel } from '@prisma/client';

import { KTO_CONCENTRATION_FORECAST_SOURCE } from '../dtos';
import { ExternalApiNotFoundError } from '../external/common';
import { fetchRealtimeCongestion, mapSkCongestionToCongestionData } from '../external/congestion';
import { prisma } from '../utils/prisma';
import { resolveTmapPoiId } from './poi-matching.service';

/**
 * 혼잡도 조회 서비스.
 * - 집중률 예측: DB 조회(향후 30일 날짜별 — 실시간·시간대별 아님)
 * - 실시간 혼잡도: SK 퍼즐 API 실시간 조회 + 5분 캐시(무료 쿼터 절약, DB 미저장)
 */

export interface ConcentrationForecastView {
  /** 예측 대상 달력 날짜(KST), "YYYY-MM-DD". */
  forecastDate: string;
  /** 집중률(소수). */
  concentrationRate: number;
  source: string;
  /** 이 예측 로우의 마지막 적재·갱신 시각. */
  fetchedAt: Date;
  /** 실시간 데이터 아님. */
  isRealtime: false;
}

export type ConcentrationForecastLookup =
  | { status: 'NOT_FOUND' }
  | { status: 'SUCCESS'; forecasts: ConcentrationForecastView[] };

/** 특정 장소의 집중률 예측 목록(예측일 오름차순). 장소가 없으면 NOT_FOUND. */
export async function getConcentrationForecasts(
  placeId: number,
): Promise<ConcentrationForecastLookup> {
  const place = await prisma.place.findUnique({
    where: { id: placeId },
    select: { id: true },
  });
  if (!place) {
    return { status: 'NOT_FOUND' };
  }

  const rows = await prisma.congestion.findMany({
    where: {
      placeId,
      type: CongestionType.PREDICTED,
      source: KTO_CONCENTRATION_FORECAST_SOURCE,
      concentrationRate: { not: null },
      predictedFor: { not: null },
    },
    orderBy: { predictedFor: 'asc' },
    select: {
      concentrationRate: true,
      predictedFor: true,
      source: true,
      updatedAt: true,
    },
  });

  return {
    status: 'SUCCESS',
    forecasts: rows.map((row) => ({
      forecastDate: toKstDateString(row.predictedFor as Date),
      concentrationRate: Number(row.concentrationRate),
      source: row.source ?? KTO_CONCENTRATION_FORECAST_SOURCE,
      fetchedAt: row.updatedAt,
      isRealtime: false as const,
    })),
  };
}

/** predictedFor(KST 자정) → "YYYY-MM-DD". UTC 변환으로 하루 밀리지 않게 KST 기준. */
function toKstDateString(date: Date): string {
  return new Date(date.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// 실시간 혼잡도(SK 퍼즐) + 인메모리 캐시
// ---------------------------------------------------------------------------

/** 캐시 TTL. 퍼즐이 준실시간(수 분 단위)이라 5분이면 신선도·쿼터 균형. */
export const REALTIME_CONGESTION_CACHE_TTL_MS = 5 * 60 * 1000;

export interface RealtimeCongestionView {
  poiId: string;
  poiName: string | null;
  /** RELAXED | NORMAL | CROWDED | VERY_CROWDED */
  level: CongestionLevel;
  source: string;
  /** 외부 API 기준 측정 시각(KST). */
  measuredAt: Date | null;
  /** 서버가 가져온 시각 — 캐시 히트면 과거 값. */
  fetchedAt: Date;
  isRealtime: true;
}

const realtimeCache = new Map<string, { view: RealtimeCongestionView; expiresAt: number }>();

/** 테스트용 캐시 초기화. */
export function clearRealtimeCongestionCache(): void {
  realtimeCache.clear();
}

/** POI 실시간 혼잡도(5분 캐시). 외부 오류는 그대로 전파 — 변환은 error.middleware. */
export async function getRealtimeCongestion(poiId: string): Promise<RealtimeCongestionView> {
  const key = poiId.trim();
  const cached = realtimeCache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.view;
  }

  const raw = await fetchRealtimeCongestion(key);
  const data = mapSkCongestionToCongestionData(raw);
  const view: RealtimeCongestionView = {
    poiId: key,
    poiName: raw.contents?.poiName ?? null,
    level: data.level,
    source: data.source ?? 'SK_PUZZLE',
    measuredAt: data.measuredAt,
    fetchedAt: new Date(),
    isRealtime: true,
  };
  realtimeCache.set(key, { view, expiresAt: Date.now() + REALTIME_CONGESTION_CACHE_TTL_MS });
  return view;
}

/**
 * TourAPI 목적지(contentId)의 실시간 혼잡도.
 * SK는 TMAP poiId로만 조회 가능 → 관광지↔POI 매칭 선행(poi-matching.service, 캐시).
 * 대응 POI 없으면 "실시간 혼잡도 미제공" 상황이라 404.
 */
export async function getRealtimeCongestionByContentId(
  contentId: string,
): Promise<RealtimeCongestionView> {
  const poiId = await resolveTmapPoiId(contentId);

  if (poiId === null) {
    throw new ExternalApiNotFoundError(
      'congestion',
      'No TMAP POI matched for this TourAPI content',
      { code: 'CONGESTION_DATA_NOT_FOUND' },
    );
  }

  return getRealtimeCongestion(poiId);
}
