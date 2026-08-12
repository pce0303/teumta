export type CongestionLevel = 'low' | 'medium' | 'high' | 'veryHigh';

export type Coordinate = {
  latitude: number;
  longitude: number;
};

export type DetourCourse = {
  id: string;
  name: string;
  durationMinutes: number;
  distanceKm: number;
  description: string;
  coordinates: Coordinate[];
  /** 코스 경유지 이름 (표시용, 마지막은 복귀 지점) */
  stops?: string[];
  /** 코스 내 추천 체류 시간(분) */
  stayMinutes?: number;
};

export type Place = {
  id: string;
  name: string;
  area: string;
  shortDescription: string;
  description: string;
  congestionLevel: CongestionLevel;
  congestionLabel: string;
  congestionMessage: string;
  recommendedDurationMinutes: number;
  detours: DetourCourse[];
};

/** GET /api/search/places 응답 항목. DB 미저장 — source에 따라 식별자가 다름. */
export type SearchPlaceResult = {
  source: 'TOUR' | 'TMAP';
  tourApiContentId: string | null;
  tmapPoiId: string | null;
  contentTypeId: string | null;
  name: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  imageUrl: string | null;
};

/** GET /api/congestion?poiId= 응답. tmapPoiId가 있는(TMAP) 장소만 조회 가능. */
export type RealtimeCongestion = {
  poiId: string;
  poiName: string;
  level: 'RELAXED' | 'NORMAL' | 'CROWDED' | 'VERY_CROWDED';
  source: string;
  measuredAt: string;
  fetchedAt: string;
  isRealtime: boolean;
};

/** GET /api/local-places 응답 항목. DB 미저장 — 내부 id 없음, name+좌표로 구분. */
export type NearbyLocalPlaceResult = {
  name: string;
  address: string | null;
  latitude: number;
  longitude: number;
  imageUrl: string | null;
  /** TMAP 실제 보행거리(m). 직선거리 아님. */
  distanceMeters: number;
  travelTimeMinutes: number;
};
