import { fetchCongestionPoiPage } from '../external/congestion';
import { toPlaceMatchKey } from '../utils/place-name';

/**
 * SK 퍼즐 "데이터 제공 가능 장소" 인덱스.
 *
 * 왜: 관광지↔POI 매칭이 TMAP 검색에만 의존하면 SK가 아는 본시설 poiId를 놓친다.
 * 2026-08-16 전수 대조 — 대표 49곳 중 "실시간 미제공"으로 측정된 35곳 가운데
 * 31곳이 실제로는 이 목록에 있었다(에버랜드 실조회로 확인). 목록을 받아
 * poiId 존재 확인(후보 우선순위)과 이름 역매칭(폴백)에 쓴다.
 *
 * 쿼터: 전체 로드 ≈ 30콜(limit 1000). lazy 1회 + 24시간 보관 — 하루 최대 1회.
 * 로드 실패는 10분 동안 기억해 매 요청이 30콜짜리 재로드를 반복하지 않게 한다.
 * 실패 시 null — 호출부는 기존 TMAP 매칭만으로 동작한다(조용한 폴백).
 *
 * offset 상한(30,000) 때문에 마지막 ~3,700곳은 목록에 못 담는다. 그 poiId는
 * 인덱스에 없어도 최종 rltm 조회가 진실이므로 기존 매칭 경로로는 여전히 잡힌다.
 */

const PAGE_LIMIT = 1000;
/** 이 값 이상의 offset은 API가 400을 준다(2026-08-16 실측). */
const MAX_OFFSET = 30_000;
const INDEX_TTL_MS = 24 * 60 * 60 * 1000;
const FAILURE_RETRY_MS = 10 * 60 * 1000;

export interface SkPoiIndex {
  hasPoi(poiId: string): boolean;
  /** 정규화 이름 정확 일치 poiId 목록(동명 다수 가능). */
  findPoiIdsByName(name: string): string[];
  /**
   * 목록 이름이 target 안에 포함되는(즉 더 짧은 본시설 표기) poiId 목록, 긴 이름 우선.
   *
   * 방향이 중요하다: TourAPI가 "수원화성 관광특구"처럼 부가 표기를 붙일 때
   * 목록의 "수원화성"을 찾는 용도다. 반대 방향(목록명이 target을 포함 —
   * "청계천" 조회에 "청계천박물관")은 다른 장소로 새는 오매칭이라 허용하지 않는다.
   * 짧은 범용 명칭 폭주 방지로 정규화 3자 미만 키는 제외.
   */
  findPoiIdsContainedInName(name: string): string[];
  size: number;
}

/** 포함 매칭에 허용하는 정규화 키 최소 길이. */
const CONTAINED_NAME_MIN_LENGTH = 3;

let cached: { index: SkPoiIndex; expiresAt: number } | null = null;
let failedUntil = 0;
let inFlight: Promise<SkPoiIndex | null> | null = null;

/** 테스트용 초기화. */
export function clearSkPoiIndexCache(): void {
  cached = null;
  failedUntil = 0;
  inFlight = null;
}

/** 인덱스(24시간 캐시). 로드 중이면 같은 Promise 공유, 실패 상태면 즉시 null. */
export async function getSkPoiIndex(): Promise<SkPoiIndex | null> {
  if (cached && cached.expiresAt > Date.now()) {
    return cached.index;
  }
  if (failedUntil > Date.now()) {
    return null;
  }
  if (inFlight) {
    return inFlight;
  }
  inFlight = loadIndex()
    .then((index) => {
      cached = { index, expiresAt: Date.now() + INDEX_TTL_MS };
      return index;
    })
    .catch(() => {
      failedUntil = Date.now() + FAILURE_RETRY_MS;
      return null;
    })
    .finally(() => {
      inFlight = null;
    });
  return inFlight;
}

async function loadIndex(): Promise<SkPoiIndex> {
  const poiIds = new Set<string>();
  const poiIdsByName = new Map<string, string[]>();

  for (let offset = 0; offset + PAGE_LIMIT <= MAX_OFFSET; offset += PAGE_LIMIT) {
    let rows;
    try {
      rows = (await fetchCongestionPoiPage(offset, PAGE_LIMIT)).contents ?? [];
    } catch (error) {
      if (offset === 0) {
        // 첫 페이지부터 실패 = 진짜 장애 — 빈 인덱스로 오판하지 않는다
        throw error;
      }
      // 중간 실패(일시 오류·상한) — 확보한 만큼으로 진행
      break;
    }

    for (const row of rows) {
      const poiId = String(row.poiId ?? '').trim();
      if (poiId.length === 0) {
        continue;
      }
      poiIds.add(poiId);
      const nameKey = toPlaceMatchKey(String(row.poiName ?? ''));
      if (nameKey.length > 0) {
        const list = poiIdsByName.get(nameKey);
        if (list) {
          list.push(poiId);
        } else {
          poiIdsByName.set(nameKey, [poiId]);
        }
      }
    }

    if (rows.length < PAGE_LIMIT) {
      break;
    }
  }

  if (poiIds.size === 0) {
    throw new Error('SK POI list is empty');
  }

  return {
    hasPoi: (poiId) => poiIds.has(poiId),
    findPoiIdsByName: (name) => poiIdsByName.get(toPlaceMatchKey(name)) ?? [],
    findPoiIdsContainedInName: (name) => {
      const target = toPlaceMatchKey(name);
      if (target.length < CONTAINED_NAME_MIN_LENGTH) {
        return [];
      }
      // 전체 키 순회(≈3만) — 매칭 캐시가 24시간이라 장소당 1회뿐이다.
      const hits: { key: string; poiIds: string[] }[] = [];
      for (const [key, ids] of poiIdsByName) {
        if (key.length >= CONTAINED_NAME_MIN_LENGTH && key !== target && target.includes(key)) {
          hits.push({ key, poiIds: ids });
        }
      }
      // 긴 이름 우선 — target과 가장 구체적으로 겹치는 표기가 본시설일 확률이 높다
      hits.sort((first, second) => second.key.length - first.key.length);
      return hits.flatMap((hit) => hit.poiIds);
    },
    size: poiIds.size,
  };
}
