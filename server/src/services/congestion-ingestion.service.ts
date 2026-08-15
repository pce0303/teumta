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
import {
  FORECAST_FETCH_NUM_OF_ROWS,
  buildForecastAliasKey,
  groupForecastsByKey,
  loadForecastAliasMap,
} from './concentration-matching.service';

/**
 * 집중률 예측 → Congestion 테이블 적재.
 *
 * 설계 근거(협업 규칙 §4 데이터 인계):
 *  - PREDICTED: 시계열 축적·조회 대상 → DB 저장
 *  - REALTIME: 저장 없이 서비스 함수로 pass-through → 여기서 다루지 않음
 *
 * 외부 API 스펙과 무관 — 내부 CongestionData + Prisma 스키마에만 의존.
 * 변환은 prediction.mapper 담당.
 */

export interface CongestionSaveResult {
  /** 재적재 시 교체로 삭제된 기존 예측 로우 수. */
  replaced: number;
  inserted: number;
}

/**
 * 특정 장소의 예측 혼잡도 저장.
 * 중복 방지를 위해 기존 PREDICTED 로우 삭제 후 삽입(replace 전략).
 * (placeId, predictedFor) 유니크 제약이 없어 upsert 대신 교체.
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
 * CongestionData[] → 삽입 로우[]. 순수 변환.
 * PREDICTED만 통과 — 실시간이 섞여도 필터링.
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

// KTO 집중률 예측 적재 — 향후 30일 날짜별(시간대별 아님). 공식 등급 기준 없어 level 미저장

export interface ConcentrationForecastSaveResult {
  /** 같은 source·반환 날짜 범위에서 삭제된 기존 로우 수. */
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
  /** 매칭 성공해 저장된 관광지 수(alias 포함). */
  matchedPlaces: number;
  /** 그중 관리자 alias(ForecastPlaceAlias)로 연결된 수. */
  aliasMatchedPlaces: number;
  inserted: number;
  deleted: number;
  /** 후보 없음 — 자동 저장 없이 집계만. */
  unmatched: { tAtsNm: string }[];
  /** 후보 2건 이상 — 자동 저장 없이 집계만. */
  ambiguous: { tAtsNm: string; candidatePlaceIds: number[] }[];
  /** 형식 불량으로 매핑에서 제외된 항목. */
  skipped: { tAtsNm: string; baseYmd: string; reason: string }[];
}

/**
 * fetch → map → 매칭 → 저장. MATCHED만 저장, UNMATCHED·AMBIGUOUS는 집계만.
 * 관리자 alias(ForecastPlaceAlias)가 자동 이름 매칭보다 우선.
 */
export async function ingestConcentrationForecasts(
  params: ConcentrationForecastParams,
): Promise<ConcentrationForecastIngestResult> {
  // 행 수 = 관광지 수 × 30일. 기본값(100)은 지역당 3곳 수준이라 전 지역이 담기게 확대
  const response = await fetchConcentrationForecast({
    numOfRows: FORECAST_FETCH_NUM_OF_ROWS,
    ...params,
  });
  const { forecasts, skipped } = mapConcentrationForecast(response);

  const result: ConcentrationForecastIngestResult = {
    matchedPlaces: 0,
    aliasMatchedPlaces: 0,
    inserted: 0,
    deleted: 0,
    unmatched: [],
    ambiguous: [],
    skipped,
  };

  if (forecasts.length === 0) {
    return result;
  }

  // 시도 단위 후보만 로드 — 시군구 판정은 matcher 담당
  const [candidateRows, aliasMap] = await Promise.all([
    prisma.place.findMany({
      where: { lDongRegnCd: String(params.areaCd).trim() },
      select: { id: true, name: true, lDongRegnCd: true, lDongSignguCd: true },
    }),
    loadForecastAliasMap(params.areaCd),
  ]);
  const candidates: ForecastPlaceCandidate[] = candidateRows.map((row) => ({
    placeId: row.id,
    name: row.name,
    lDongRegnCd: row.lDongRegnCd,
    lDongSignguCd: row.lDongSignguCd,
  }));

  // 같은 관광지명(tAtsNm) 묶음 단위로 매칭 후 저장
  for (const group of groupForecastsByKey(forecasts).values()) {
    const { areaCd, signguCd, tAtsNm } = group[0];

    const aliasPlaceId = aliasMap.get(
      buildForecastAliasKey(areaCd, signguCd, tAtsNm),
    );

    if (aliasPlaceId !== undefined) {
      const saved = await saveConcentrationForecasts(aliasPlaceId, group);
      result.matchedPlaces += 1;
      result.aliasMatchedPlaces += 1;
      result.inserted += saved.inserted;
      result.deleted += saved.deleted;
      continue;
    }

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
