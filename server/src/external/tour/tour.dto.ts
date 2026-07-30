/**
 * 한국관광공사 TourAPI (KorService2) 원본 응답 타입.
 *
 * 출처: 공공데이터포털 "한국관광공사_국문 관광정보 서비스(GW)" 공식 스펙.
 * 아래 타입은 공식 문서 기준으로 작성했다.
 * ⚠️ 실제 응답 샘플 확보 후 필드/옵셔널 여부를 한 번 더 검증할 것(특히 빈 결과/단일 결과 케이스).
 *
 * 응답 공통 구조:
 *   { response: { header: {...}, body: { items: {...} | "", numOfRows, pageNo, totalCount } } }
 * - totalCount 가 0이면 items 가 빈 문자열("")로 오는 알려진 케이스가 있다.
 * - 결과가 1건이면 item 이 배열이 아닌 단일 객체로 올 수 있어 방어가 필요하다(mapper에서 처리).
 */

export interface TourApiHeader {
  /** '0000' 이면 정상. 그 외는 오류 코드(예: '30' 미등록 키, '22' 요청제한 초과). */
  resultCode: string;
  resultMsg: string;
}

/**
 * areaBasedList2 / locationBasedList2 등의 개별 장소 항목.
 * 알려진 필드만 명시하고, 나머지는 확장 허용한다.
 */
export interface TourApiPlaceItem {
  /** 콘텐츠 ID. 내부 Place.tourApiContentId(unique)와 매칭. */
  contentid: string;
  /** 콘텐츠 타입 ID(12=관광지, 14=문화시설, 39=음식점 등). */
  contenttypeid: string;
  title: string;
  addr1?: string;
  addr2?: string;
  /** 경도(longitude). 문자열로 온다. */
  mapx?: string;
  /** 위도(latitude). 문자열로 온다. */
  mapy?: string;
  firstimage?: string;
  firstimage2?: string;
  areacode?: string;
  sigungucode?: string;
  cat1?: string;
  cat2?: string;
  cat3?: string;
  tel?: string;
  /** locationBasedList2 응답에만 존재(중심점으로부터 거리, m). */
  dist?: string;
  createdtime?: string;
  modifiedtime?: string;
  [key: string]: unknown;
}

export interface TourApiListBody {
  /** 결과가 없으면 빈 문자열("")로 오는 케이스가 있다. */
  items: { item: TourApiPlaceItem | TourApiPlaceItem[] } | '';
  numOfRows: number;
  pageNo: number;
  totalCount: number;
}

export interface TourApiListResponse {
  response: {
    header: TourApiHeader;
    body: TourApiListBody;
  };
}
