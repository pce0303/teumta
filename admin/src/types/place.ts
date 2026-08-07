/** server/prisma/schema.prisma PlaceType enum과 동일. */
export const PLACE_TYPES = ['TOURIST_SPOT', 'LOCAL_PLACE'] as const;

export type PlaceType = (typeof PLACE_TYPES)[number];

export const PLACE_TYPE_LABELS: Record<PlaceType, string> = {
  TOURIST_SPOT: '관광지',
  LOCAL_PLACE: '로컬 장소',
};

export interface Tag {
  id: number;
  name: string;
}

/**
 * GET /api/places, GET /api/places/:id 응답 항목.
 * server/src/services/place.service.ts transformPlace 기준 —
 * tourApiContentId는 응답에서 제거되므로 여기에 없다.
 */
export interface Place {
  id: number;
  name: string;
  type: PlaceType;
  address: string | null;
  latitude: number;
  longitude: number;
  imageUrl: string | null;
  description: string | null;
  /** "HH:mm" */
  openingTime: string | null;
  /** "HH:mm" */
  closingTime: string | null;
  /** 추천 체류 시간(분). */
  recommendedDuration: number | null;
  /** 법정동 코드/분류체계(TourAPI 적재 데이터). 관리자에서는 조회만 한다. */
  lDongRegnCd: string | null;
  lDongSignguCd: string | null;
  lclsSystm1: string | null;
  lclsSystm2: string | null;
  lclsSystm3: string | null;
  createdAt: string;
  updatedAt: string;
  tags: Tag[];
}

/**
 * POST /api/admin/places 요청 본문.
 * 서버는 tourApiContentId도 받지만 응답으로 조회할 수 없어(관측 불가) UI에서 다루지 않는다.
 * tagIds는 전체 교체 방식 — 전달하면 해당 장소의 태그 연결이 이 목록으로 대체된다.
 */
export interface CreatePlaceInput {
  name: string;
  type: PlaceType;
  latitude: number;
  longitude: number;
  address?: string | null;
  imageUrl?: string | null;
  description?: string | null;
  openingTime?: string | null;
  closingTime?: string | null;
  recommendedDuration?: number | null;
  tagIds?: number[];
}

/** PATCH /api/admin/places/:id 요청 본문(부분 수정). */
export type UpdatePlaceInput = Partial<CreatePlaceInput>;
