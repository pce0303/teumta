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
}
