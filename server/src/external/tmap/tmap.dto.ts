/**
 * TMAP 보행자 경로안내 API 원본 응답 타입.
 *
 * 출처: SK Open API "보행자 경로안내"(POST /tmap/routes/pedestrian?version=1) 공식 스펙.
 * 응답은 GeoJSON FeatureCollection 이며, 요약(totalDistance/totalTime)은 첫 요약 feature의
 * properties에 담긴다(pointType "SP", 나머지 구간 feature에는 distance/time).
 *
 * ⚠️ 공식 스펙 기반. 실제 응답 샘플로 요약 feature 위치/필드명을 한 번 더 검증할 것.
 */

export interface TmapRouteFeatureProperties {
  /** 요약 feature에만 존재. 전체 이동거리(m). */
  totalDistance?: number;
  /** 요약 feature에만 존재. 전체 소요시간(초). */
  totalTime?: number;
  /** 구간(LineString) feature의 구간 거리(m). */
  distance?: number;
  /** 구간(LineString) feature의 구간 시간(초). */
  time?: number;
  index?: number;
  pointType?: string;
  [key: string]: unknown;
}

export interface TmapRouteGeometry {
  type: 'Point' | 'LineString';
  /** Point면 [x, y], LineString이면 [[x, y], ...]. */
  coordinates: number[] | number[][];
}

export interface TmapRouteFeature {
  type: 'Feature';
  geometry: TmapRouteGeometry;
  properties: TmapRouteFeatureProperties;
}

export interface TmapRouteResponse {
  type: 'FeatureCollection';
  features: TmapRouteFeature[];
}

/** 장소 통합 검색(GET /tmap/pois) 응답 항목. 실응답 기준(2026-08 검증). */
export interface TmapPoiSearchItem {
  id: string;
  name: string;
  /** 대표 좌표(문자열). */
  noorLat?: string;
  noorLon?: string;
  frontLat?: string;
  frontLon?: string;
  upperAddrName?: string;
  middleAddrName?: string;
  lowerAddrName?: string;
  detailAddrName?: string;
  roadName?: string;
  firstBuildNo?: string;
  [key: string]: unknown;
}

export interface TmapPoiSearchResponse {
  searchPoiInfo?: {
    totalCount?: string;
    count?: string;
    page?: string;
    pois?: { poi?: TmapPoiSearchItem[] };
  };
}

/** 명칭(POI) 상세 검색(GET /tmap/pois/{poiId}) 응답. 실응답 기준. */
export interface TmapPoiDetailResponse {
  poiDetailInfo?: {
    id?: string;
    name?: string;
    lat?: string;
    lon?: string;
    address?: string;
    bldAddr?: string;
    roadName?: string;
    bldNo1?: string;
    [key: string]: unknown;
  };
}
