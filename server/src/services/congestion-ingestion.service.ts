import { CongestionType, Prisma } from '@prisma/client';

import type { CongestionData, ConcentrationForecastData } from '../dtos';
import { KTO_CONCENTRATION_FORECAST_SOURCE } from '../dtos';
import {
  fetchConcentrationForecast,
  mapConcentrationForecast,
  matchForecastToPlace,
  type ConcentrationForecastParams,
  type ForecastMatchResult,
  type ForecastPlaceCandidate,
} from '../external/prediction';
import { prisma } from '../utils/prisma';

/**
 * 예측 혼잡도(집중률 예측) 데이터를 내부 Congestion 테이블에 적재하는 서비스.
 *
 * 설계 근거(협업 규칙 §4 데이터 인계):
 *  - 예측(PREDICTED) 데이터는 시계열로 축적/조회하므로 DB에 저장한다.
 *  - 실시간(REALTIME) 데이터는 저장하지 않고 서비스 함수로 pass-through 하므로 여기서 다루지 않는다.
 *
 * 이 서비스는 외부 API 스펙과 무관하다(내부 CongestionData + Prisma 스키마에만 의존).
 * 예측 API 연동이 완료되면 prediction.mapper 가 CongestionData[]를 만들어 이 서비스에 넘긴다.
 */

export interface CongestionSaveResult {
  /** 기존 예측 로우 삭제 수(재적재 시 교체). */
  replaced: number;
  inserted: number;
}

/**
 * 특정 장소의 예측 혼잡도를 저장한다.
 * 재적재 시 중복을 막기 위해 해당 장소의 기존 PREDICTED 로우를 지우고 새로 넣는다(replace 전략).
 * Congestion에는 (placeId, predictedFor) 유니크 제약이 없어 upsert 대신 교체 방식을 쓴다.
 */
export async function savePredictedCongestion(
  placeId: number,
  predictions: CongestionData[],
): Promise<CongestionSaveResult> {
  const rows = toPredictedCongestionRows(placeId, predictions);

  return prisma.$transaction(async (tx) => {
    const deleted = await tx.congestion.deleteMany({
      where: { placeId, type: CongestionType.PREDICTED },
    });

    if (rows.length === 0) {
      return { replaced: deleted.count, inserted: 0 };
    }

    const created = await tx.congestion.createMany({ data: rows });
    return { replaced: deleted.count, inserted: created.count };
  });
}

/**
 * CongestionData[] → Congestion 삽입 로우[] (순수 변환, 오프라인 검증용).
 * PREDICTED 타입만 대상으로 한다(실시간이 섞여 들어와도 걸러낸다).
 */
export function toPredictedCongestionRows(
  placeId: number,
  predictions: CongestionData[],
): Prisma.CongestionCreateManyInput[] {
  return predictions
    .filter((prediction) => prediction.type === CongestionType.PREDICTED)
    .map((prediction) => ({
      placeId,
      type: CongestionType.PREDICTED,
      level: prediction.level,
      score: prediction.score,
      source: prediction.source,
      measuredAt: prediction.measuredAt,
      predictedFor: prediction.predictedFor,
    }));
}

// KTO 집중률 예측 적재 — 향후 30일 날짜별(실시간·시간대별 아님), 공식 등급 기준 없어 level 미저장.

export interface ConcentrationForecastSaveResult {
  /** 같은 source의 반환 날짜 범위 내 기존 로우 삭제 수. */
  deleted: number;
  inserted: number;
}

/** Congestion 삽입 로우 변환(순수). level/score는 null, 원본 소수값 보존. */
export function toConcentrationForecastRows(
  placeId: number,
  forecasts: ConcentrationForecastData[],
): Prisma.CongestionCreateManyInput[] {
  return forecasts.map((forecast) => ({
    placeId,
    type: CongestionType.PREDICTED,
    level: null,
    score: null,
    concentrationRate: forecast.concentrationRate,
    source: forecast.source,
    measuredAt: null,
    predictedFor: forecast.predictedFor,
  }));
}

/** 집중률 예측 저장. 같은 source + 반환 날짜 범위만 교체(다른 source 미삭제). */
export async function saveConcentrationForecasts(
  placeId: number,
  forecasts: ConcentrationForecastData[],
): Promise<ConcentrationForecastSaveResult> {
  const rows = toConcentrationForecastRows(placeId, forecasts);
  if (rows.length === 0) {
    return { deleted: 0, inserted: 0 };
  }

  const dates = forecasts.map((forecast) => forecast.predictedFor.getTime());
  const rangeStart = new Date(Math.min(...dates));
  const rangeEnd = new Date(Math.max(...dates));

  return prisma.$transaction(async (tx) => {
    const deleted = await tx.congestion.deleteMany({
      where: {
        placeId,
        type: CongestionType.PREDICTED,
        source: KTO_CONCENTRATION_FORECAST_SOURCE,
        predictedFor: { gte: rangeStart, lte: rangeEnd },
      },
    });
    const created = await tx.congestion.createMany({ data: rows });
    return { deleted: deleted.count, inserted: created.count };
  });
}

export interface ConcentrationForecastIngestResult {
  /** 안전하게 매칭되어 저장된 관광지 수. */
  matchedPlaces: number;
  inserted: number;
  deleted: number;
  /** 후보 없음 — 자동 저장하지 않고 집계만 반환. */
  unmatched: { tAtsNm: string }[];
  /** 후보 둘 이상 — 자동 저장하지 않고 집계만 반환. */
  ambiguous: { tAtsNm: string; candidatePlaceIds: number[] }[];
  /** 형식 불량으로 매핑 단계에서 건너뛴 항목. */
  skipped: { tAtsNm: string; baseYmd: string; reason: string }[];
}

/** fetch → map → 매칭 → 저장. MATCHED만 저장, UNMATCHED/AMBIGUOUS는 집계만. */
export async function ingestConcentrationForecasts(
  params: ConcentrationForecastParams,
): Promise<ConcentrationForecastIngestResult> {
  const response = await fetchConcentrationForecast(params);
  const { forecasts, skipped } = mapConcentrationForecast(response);

  const result: ConcentrationForecastIngestResult = {
    matchedPlaces: 0,
    inserted: 0,
    deleted: 0,
    unmatched: [],
    ambiguous: [],
    skipped,
  };

  if (forecasts.length === 0) {
    return result;
  }

  // 지역(법정동 시도) 후보만 로드한다. 시군구 판정은 matcher가 담당한다.
  const candidateRows = await prisma.place.findMany({
    where: { lDongRegnCd: String(params.areaCd).trim() },
    select: { id: true, name: true, lDongRegnCd: true, lDongSignguCd: true },
  });
  const candidates: ForecastPlaceCandidate[] = candidateRows.map((row) => ({
    placeId: row.id,
    name: row.name,
    lDongRegnCd: row.lDongRegnCd,
    lDongSignguCd: row.lDongSignguCd,
  }));

  // 같은 관광지명(tAtsNm) 묶음 단위로 매칭 후 저장한다.
  const groups = new Map<string, ConcentrationForecastData[]>();
  for (const forecast of forecasts) {
    const key = `${forecast.areaCd}|${forecast.signguCd}|${forecast.tAtsNm}`;
    const group = groups.get(key);
    if (group) {
      group.push(forecast);
    } else {
      groups.set(key, [forecast]);
    }
  }

  for (const group of groups.values()) {
    const { areaCd, signguCd, tAtsNm } = group[0];
    const match: ForecastMatchResult = matchForecastToPlace(
      { areaCd, signguCd, tAtsNm },
      candidates,
    );

    if (match.status === 'MATCHED') {
      const saved = await saveConcentrationForecasts(match.placeId, group);
      result.matchedPlaces += 1;
      result.inserted += saved.inserted;
      result.deleted += saved.deleted;
    } else if (match.status === 'UNMATCHED') {
      result.unmatched.push({ tAtsNm });
    } else {
      result.ambiguous.push({ tAtsNm, candidatePlaceIds: match.candidatePlaceIds });
    }
  }

  return result;
}
