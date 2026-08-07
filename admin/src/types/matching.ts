/** 서버 concentration-matching.service.ts 응답 타입. */

export type MatchingPreviewStatus =
  | 'MATCHED'
  | 'ALIAS_MATCHED'
  | 'UNMATCHED'
  | 'AMBIGUOUS';

export const MATCHING_STATUS_LABELS: Record<MatchingPreviewStatus, string> = {
  MATCHED: '자동 매칭',
  ALIAS_MATCHED: '수동 연결',
  UNMATCHED: '미매칭',
  AMBIGUOUS: '후보 다수',
};

export interface MatchingPreviewItem {
  tAtsNm: string;
  areaCd: string;
  signguCd: string;
  status: MatchingPreviewStatus;
  forecastCount: number;
  averageRate: number | null;
  matchedPlace: { id: number; name: string } | null;
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
  skipped: { tAtsNm: string; baseYmd: string; reason: string }[];
  truncated: boolean;
}

export interface ForecastAlias {
  id: number;
  areaCd: string;
  signguCd: string;
  tAtsNm: string;
  place: { id: number; name: string };
  updatedAt: string;
}

export interface MatchingIngestResult {
  matchedPlaces: number;
  aliasMatchedPlaces: number;
  inserted: number;
  deleted: number;
  unmatched: { tAtsNm: string }[];
  ambiguous: { tAtsNm: string; candidatePlaceIds: number[] }[];
  skippedCount: number;
}
