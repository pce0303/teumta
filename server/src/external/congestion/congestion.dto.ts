/**
 * SK 지오비전 퍼즐 "실시간 장소 혼잡도" 원본 응답 타입.
 * GET {CONGESTION_API_BASE_URL}/place/congestion/rltm/pois/{poiId} (헤더 appKey)
 * 실제 응답 샘플 기준(2026-08 검증).
 */

export interface SkPuzzleStatus {
  /** '00'이 정상. */
  code: string;
  message: string;
  totalCount?: number;
}

export interface SkCongestionRltmItem {
  /** 측정 시각(KST, yyyyMMddHHmmss). */
  datetime: string;
  /** 혼잡도 원본 지수(추정 방문자수/연면적). */
  congestion: number;
  /** 혼잡도 단계. 1 여유, 2 보통, 3 혼잡, 4 매우혼잡. */
  congestionLevel: number;
  /** 1 실시간, 2 전일 동시간, 3 지난주 동요일 동시간. */
  type: number;
  [key: string]: unknown;
}

export interface SkCongestionContents {
  poiId: string;
  poiName?: string;
  rltm?: SkCongestionRltmItem[];
}

/**
 * 오류 응답 봉투. 정상 응답과 달리 status 없이 error만.
 * 커버리지 밖 POI: HTTP 400 + `{"error":{"code":"404","message":"NOT_FOUND_POI"}}`(실응답 확인, 2026-08-14).
 */
export interface SkPuzzleError {
  code?: string;
  message?: string;
}

export interface SkCongestionResponse {
  status?: SkPuzzleStatus;
  contents?: SkCongestionContents;
  error?: SkPuzzleError;
}
