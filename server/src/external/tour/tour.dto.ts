/**
 * 한국관광공사 TourAPI 원본 응답 타입.
 *
 * ⚠️ 아직 공식 스펙/실제 응답 샘플을 확인하지 않았다.
 *    실제 필드를 추측하지 않고 느슨한 타입으로 둔다.
 *
 * TODO: 공식 스펙 확인 후 실제 필드로 대체한다. (예상 후보 필드)
 *   - contentid, contenttypeid, title, addr1, addr2
 *   - mapx(경도), mapy(위도), firstimage, overview 등
 *   - response.body.items.item[] 구조, response.header.resultCode 등
 */

/** TourAPI가 반환하는 개별 장소 항목(원본). */
export type TourApiPlaceItem = Record<string, unknown>;

/** TourAPI 목록 조회 응답(원본 전체). */
export type TourApiPlaceListResponse = Record<string, unknown>;
