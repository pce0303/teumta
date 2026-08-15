import type { ConcentrationForecastData } from '../dtos';
import {
  fetchConcentrationForecast,
  mapConcentrationForecast,
  matchForecastToPlace,
  normalizePlaceName,
  type ForecastPlaceCandidate,
} from '../external/prediction';
import { prisma } from '../utils/prisma';

/**
 * KTO 집중률 ↔ Place 매칭 운영 도구(관리자 웹).
 *
 * - preview: 외부 API 1회 호출로 매칭 상태(MATCHED/ALIAS_MATCHED/UNMATCHED/AMBIGUOUS) 집계만, 저장 없음
 * - alias: 자동 매칭이 못 잇는 항목을 관리자가 Place에 수동 연결.
 *   적재(congestion-ingestion)에서 자동 매칭보다 우선 적용
 */

/**
 * 집중률 조회 요청 최대 행 수(preview·적재 공용).
 * 행 수 = 관광지 수 × 30일이라 기본값(100)은 지역당 3곳 수준
 * (종로구 실측 67곳+ × 30일 > 2,000행). 행 수를 키워도 외부 호출은 1회로 동일.
 */
export const FORECAST_FETCH_NUM_OF_ROWS = 5000;

/** alias 조회 키. 이름 정규화 규칙은 자동 매칭과 동일. */
export function buildForecastAliasKey(
  areaCd: string,
  signguCd: string,
  tAtsNm: string,
): string {
  return `${areaCd.trim()}|${signguCd.trim()}|${normalizePlaceName(tAtsNm)}`;
}

/** 시도 단위 alias 전체 → 키 → placeId 맵(적재·preview 공용). */
export async function loadForecastAliasMap(
  areaCd: string | number,
): Promise<Map<string, number>> {
  const aliases = await prisma.forecastPlaceAlias.findMany({
    where: {
      areaCd: String(areaCd).trim(),
    },
    select: {
      areaCd: true,
      signguCd: true,
      tAtsNm: true,
      placeId: true,
    },
  });

  return new Map(
    aliases.map((alias) => [
      buildForecastAliasKey(alias.areaCd, alias.signguCd, alias.tAtsNm),
      alias.placeId,
    ]),
  );
}

/** 같은 관광지명(지역+tAtsNm) 묶음으로 그룹화(적재 로직과 동일 기준). */
export function groupForecastsByKey(
  forecasts: ConcentrationForecastData[],
): Map<string, ConcentrationForecastData[]> {
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
  return groups;
}

export type MatchingPreviewStatus =
  | 'MATCHED'
  | 'ALIAS_MATCHED'
  | 'UNMATCHED'
  | 'AMBIGUOUS';

export interface MatchingPreviewItem {
  /** KTO 관광지명(원본 표기). */
  tAtsNm: string;
  areaCd: string;
  signguCd: string;
  status: MatchingPreviewStatus;
  /** 예측 날짜 행 수(보통 30일). */
  forecastCount: number;
  /** 집중률 평균(참고용). */
  averageRate: number | null;
  matchedPlace: { id: number; name: string } | null;
  /** AMBIGUOUS일 때의 자동 매칭 후보. */
  candidates: { id: number; name: string }[];
}

export interface MatchingPreviewResult {
  areaCd: string;
  signguCd: string;
  totalItems: number;
  counts: {
    matched: number;
    aliasMatched: number;
    unmatched: number;
    ambiguous: number;
  };
  items: MatchingPreviewItem[];
  /** 형식 불량으로 매핑에서 제외된 항목. */
  skipped: { tAtsNm: string; baseYmd: string; reason: string }[];
  /** totalCount가 요청 행 수를 넘어 일부만 조회됐으면 true. */
  truncated: boolean;
}

const STATUS_ORDER: Record<MatchingPreviewStatus, number> = {
  UNMATCHED: 0,
  AMBIGUOUS: 1,
  ALIAS_MATCHED: 2,
  MATCHED: 3,
};

function averageRate(group: ConcentrationForecastData[]): number | null {
  const rates = group
    .map((forecast) => Number(forecast.concentrationRate))
    .filter((rate) => Number.isFinite(rate));
  if (rates.length === 0) {
    return null;
  }
  const sum = rates.reduce((total, rate) => total + rate, 0);
  return Math.round((sum / rates.length) * 100) / 100;
}

/** 외부 API 1회 호출로 지역 매칭 상태 집계. DB 저장 없음. */
export async function previewConcentrationMatching(
  areaCd: string,
  signguCd: string,
): Promise<MatchingPreviewResult> {
  const response = await fetchConcentrationForecast({
    areaCd,
    signguCd,
    numOfRows: FORECAST_FETCH_NUM_OF_ROWS,
  });
  const { forecasts, skipped } = mapConcentrationForecast(response);

  const totalCount = Number(response.response?.body?.totalCount ?? 0);
  const truncated =
    Number.isFinite(totalCount) && totalCount > FORECAST_FETCH_NUM_OF_ROWS;

  const [aliasMap, candidateRows] = await Promise.all([
    loadForecastAliasMap(areaCd),
    prisma.place.findMany({
      where: {
        lDongRegnCd: String(areaCd).trim(),
      },
      select: {
        id: true,
        name: true,
        lDongRegnCd: true,
        lDongSignguCd: true,
      },
    }),
  ]);

  const candidates: ForecastPlaceCandidate[] = candidateRows.map((row) => ({
    placeId: row.id,
    name: row.name,
    lDongRegnCd: row.lDongRegnCd,
    lDongSignguCd: row.lDongSignguCd,
  }));

  const aliasPlaceIds = [...new Set(aliasMap.values())];
  const aliasPlaces =
    aliasPlaceIds.length > 0
      ? await prisma.place.findMany({
        where: {
          id: {
            in: aliasPlaceIds,
          },
        },
        select: {
          id: true,
          name: true,
        },
      })
      : [];

  const placeNameById = new Map<number, string>([
    ...candidateRows.map((row) => [row.id, row.name] as const),
    ...aliasPlaces.map((row) => [row.id, row.name] as const),
  ]);

  const counts = { matched: 0, aliasMatched: 0, unmatched: 0, ambiguous: 0 };
  const items: MatchingPreviewItem[] = [];

  for (const group of groupForecastsByKey(forecasts).values()) {
    const { areaCd: itemAreaCd, signguCd: itemSignguCd, tAtsNm } = group[0];
    const base = {
      tAtsNm,
      areaCd: itemAreaCd,
      signguCd: itemSignguCd,
      forecastCount: group.length,
      averageRate: averageRate(group),
    };

    const aliasPlaceId = aliasMap.get(
      buildForecastAliasKey(itemAreaCd, itemSignguCd, tAtsNm),
    );

    if (aliasPlaceId !== undefined) {
      counts.aliasMatched += 1;
      items.push({
        ...base,
        status: 'ALIAS_MATCHED',
        matchedPlace: {
          id: aliasPlaceId,
          name: placeNameById.get(aliasPlaceId) ?? `#${aliasPlaceId}`,
        },
        candidates: [],
      });
      continue;
    }

    const match = matchForecastToPlace(
      { areaCd: itemAreaCd, signguCd: itemSignguCd, tAtsNm },
      candidates,
    );

    if (match.status === 'MATCHED') {
      counts.matched += 1;
      items.push({
        ...base,
        status: 'MATCHED',
        matchedPlace: {
          id: match.placeId,
          name: placeNameById.get(match.placeId) ?? `#${match.placeId}`,
        },
        candidates: [],
      });
    } else if (match.status === 'AMBIGUOUS') {
      counts.ambiguous += 1;
      items.push({
        ...base,
        status: 'AMBIGUOUS',
        matchedPlace: null,
        candidates: match.candidatePlaceIds.map((placeId) => ({
          id: placeId,
          name: placeNameById.get(placeId) ?? `#${placeId}`,
        })),
      });
    } else {
      counts.unmatched += 1;
      items.push({
        ...base,
        status: 'UNMATCHED',
        matchedPlace: null,
        candidates: [],
      });
    }
  }

  items.sort(
    (first, second) =>
      STATUS_ORDER[first.status] - STATUS_ORDER[second.status] ||
      first.tAtsNm.localeCompare(second.tAtsNm, 'ko'),
  );

  return {
    areaCd: String(areaCd).trim(),
    signguCd: String(signguCd).trim(),
    totalItems: items.length,
    counts,
    items,
    skipped,
    truncated,
  };
}

// ---------- alias CRUD ----------

export interface ForecastAliasDto {
  id: number;
  areaCd: string;
  signguCd: string;
  tAtsNm: string;
  place: { id: number; name: string };
  updatedAt: Date;
}

export async function listForecastAliases(): Promise<ForecastAliasDto[]> {
  const aliases = await prisma.forecastPlaceAlias.findMany({
    include: {
      place: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: {
      updatedAt: 'desc',
    },
  });

  return aliases.map((alias) => ({
    id: alias.id,
    areaCd: alias.areaCd,
    signguCd: alias.signguCd,
    tAtsNm: alias.tAtsNm,
    place: alias.place,
    updatedAt: alias.updatedAt,
  }));
}

export type UpsertForecastAliasResult =
  | { status: 'SAVED'; alias: ForecastAliasDto }
  | { status: 'PLACE_NOT_FOUND' };

/** alias 저장 — 같은 키면 대상 장소만 교체. 이름은 정규화 후 저장. */
export async function upsertForecastAlias(input: {
  areaCd: string;
  signguCd: string;
  tAtsNm: string;
  placeId: number;
}): Promise<UpsertForecastAliasResult> {
  const place = await prisma.place.findUnique({
    where: {
      id: input.placeId,
    },
    select: {
      id: true,
      name: true,
    },
  });

  if (!place) {
    return { status: 'PLACE_NOT_FOUND' };
  }

  const key = {
    areaCd: input.areaCd.trim(),
    signguCd: input.signguCd.trim(),
    tAtsNm: normalizePlaceName(input.tAtsNm),
  };

  const alias = await prisma.forecastPlaceAlias.upsert({
    where: {
      areaCd_signguCd_tAtsNm: key,
    },
    update: {
      placeId: place.id,
    },
    create: {
      ...key,
      placeId: place.id,
    },
  });

  return {
    status: 'SAVED',
    alias: {
      id: alias.id,
      areaCd: alias.areaCd,
      signguCd: alias.signguCd,
      tAtsNm: alias.tAtsNm,
      place,
      updatedAt: alias.updatedAt,
    },
  };
}

export type DeleteForecastAliasResult = 'DELETED' | 'NOT_FOUND';

export async function deleteForecastAlias(
  id: number,
): Promise<DeleteForecastAliasResult> {
  const deleted = await prisma.forecastPlaceAlias.deleteMany({
    where: {
      id,
    },
  });
  return deleted.count > 0 ? 'DELETED' : 'NOT_FOUND';
}
