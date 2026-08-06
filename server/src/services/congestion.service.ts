import { CongestionType } from '@prisma/client';

import { KTO_CONCENTRATION_FORECAST_SOURCE } from '../dtos';
import { prisma } from '../utils/prisma';

/**
 * 집중률 예측 조회(읽기 전용, DB만). 향후 30일 날짜별 예측 — 실시간·시간대별 아님.
 */

export interface ConcentrationForecastView {
  /** 예측 대상 달력 날짜(KST), "YYYY-MM-DD". */
  forecastDate: string;
  /** 집중률(소수). */
  concentrationRate: number;
  source: string;
  /** 이 예측 로우를 마지막으로 적재/갱신한 시각. */
  fetchedAt: Date;
  /** 실시간 데이터가 아님을 명시. */
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

/** predictedFor(KST 자정 시각) → "YYYY-MM-DD" (KST 기준, UTC 변환으로 하루 밀리지 않게). */
function toKstDateString(date: Date): string {
  return new Date(date.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}
