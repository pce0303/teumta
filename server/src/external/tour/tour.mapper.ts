import type { PlaceData } from '../../dtos';
import type { TourApiPlaceItem } from './tour.dto';

/**
 * TourAPI 원본 장소 항목 → 틈타 내부 PlaceData 변환.
 *
 * 향후 역할: 관광지/로컬 장소 정보 조회 결과를 내부 Place 계약으로 정규화한다.
 *
 * TODO(실제 연동 시):
 *  - contentid → tourApiContentId
 *  - title → name
 *  - addr1(+addr2) → address
 *  - mapy → latitude, mapx → longitude (문자열 → number 변환)
 *  - firstimage → imageUrl
 *  - contenttypeId → PlaceType(TOURIST_SPOT/LOCAL_PLACE) 매핑 규칙 정의
 */
export function mapTourPlaceToPlaceData(_item: TourApiPlaceItem): PlaceData {
  // TODO: 실제 필드 매핑 구현. 지금은 skeleton이므로 호출 시 즉시 실패시킨다.
  throw new Error('mapTourPlaceToPlaceData is not implemented yet');
}
