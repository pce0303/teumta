import type { PlaceType } from '@prisma/client';

/**
 * 틈타 내부 장소 데이터 계약.
 *
 * 외부 소스(TourAPI 등)와 무관하게 서버 내부에서 사용하는 정규화된 형태다.
 * 외부 API 원본 응답 타입(external/tour/tour.dto.ts)과 반드시 분리한다.
 *
 * 필드는 Prisma `Place` 모델을 기준으로 정렬했다(DB 적재/매칭 편의).
 */
export interface PlaceData {
  /** 외부 콘텐츠 식별자. Prisma `Place.tourApiContentId`(unique)와 매칭/ upsert 키로 사용. */
  tourApiContentId: string;
  name: string;
  /** TODO: 외부 분류코드(contentTypeId 등) → PlaceType 매핑 규칙 확정. */
  type?: PlaceType;
  address: string | null;
  latitude: number;
  longitude: number;
  imageUrl: string | null;
  description: string | null;
  /** "HH:mm" 형식. */
  openingTime: string | null;
  /** "HH:mm" 형식. */
  closingTime: string | null;
  /** 추천 체류 시간(분). */
  recommendedDuration: number | null;
  /** 법정동 시도 코드(TourAPI v4.4). 집중률 예측 지역 매칭에 사용. */
  lDongRegnCd?: string | null;
  /** 법정동 시군구 코드(TourAPI v4.4). */
  lDongSignguCd?: string | null;
  /** 분류체계 1~3Depth(TourAPI v4.4). */
  lclsSystm1?: string | null;
  lclsSystm2?: string | null;
  lclsSystm3?: string | null;
}

/** 주변 로컬 장소 후보. 요청 스코프 전용 — DB 미저장(공모전 기준), 내부 id 없음. */
export interface NearbyLocalPlaceCandidate {
  /** 중복 제거·자기 자신 제외용. 응답에는 미노출. */
  tourApiContentId: string;
  /** TourAPI 분류(14 문화시설 / 38 쇼핑 / 39 음식점). 코스 체류시간 기본값 산정에 쓴다. */
  contentTypeId: string | null;
  /** 세부 분류코드(cat3, 예: A05020900 카페·찻집). 표시용 라벨 산정에 쓴다. */
  categoryCode: string | null;
  name: string;
  address: string | null;
  latitude: number;
  longitude: number;
  imageUrl: string | null;
  /** TourAPI dist(m). 선별용 전용, 응답에 미노출. */
  tourDistanceMeters: number | null;
}

/**
 * 목적지 검색 결과 항목(요청 스코프 전용, DB 미저장).
 * source에 따라 tourApiContentId 또는 tmapPoiId가 목적지 식별자가 된다(응답에 노출).
 */
export interface DestinationSearchResult {
  source: 'TOUR' | 'TMAP';
  tourApiContentId: string | null;
  tmapPoiId: string | null;
  contentTypeId: string | null;
  name: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  imageUrl: string | null;
  /**
   * 내부 Place id. `tourApiContentId`가 적재된 관광지와 일치할 때만 채워지고 그 외에는 null이다.
   * 집중률 예측 조회(`GET /api/places/:id/concentration-forecast`)가 내부 id를 요구하는데
   * 검색 결과는 DB 미저장이라 연결 고리가 없었다 — 조회 전용 매칭이며 적재는 하지 않는다.
   */
  placeId: number | null;
}

/** 주변 로컬 장소 응답 항목. distanceMeters는 직선거리가 아닌 TMAP 실제 보행거리. */
export interface NearbyLocalPlaceDto {
  name: string;
  address: string | null;
  latitude: number;
  longitude: number;
  imageUrl: string | null;
  /** 분류 라벨(문화시설/쇼핑/음식점). 알 수 없으면 null. */
  category: string | null;
  /** TMAP 보행거리(m). */
  distanceMeters: number;
  /** TMAP 보행시간(분, ceil). */
  travelTimeMinutes: number;
}
