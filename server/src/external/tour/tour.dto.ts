/**
 * 한국관광공사 TourAPI (KorService2) 원본 응답 타입.
 *
 * 출처: 공공데이터포털 "한국관광공사_국문 관광정보 서비스" 공식 매뉴얼 v4.4 기준.
 *
 * 응답 공통 구조:
 *   { response: { header: {...}, body: { items: {...} | "", numOfRows, pageNo, totalCount } } }
 * - totalCount 가 0이면 items 가 빈 문자열("")로 오는 알려진 케이스가 있다.
 * - 결과가 1건이면 item 이 배열이 아닌 단일 객체로 올 수 있어 방어가 필요하다(mapper에서 처리).
 * - 숫자 필드(numOfRows/totalCount 등)가 문자열로 오는 경우가 있어 number | string 으로 둔다.
 *
 * v4.4 주의: 기존 areacode/sigungucode/cat1~cat3 대신 법정동 코드(lDongRegnCd/lDongSignguCd)와
 * 분류체계(lclsSystm1~3)가 최신 필드다. 내부 로직은 최신 필드에만 의존한다.
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
  zipcode?: string;
  /** 경도(longitude). 문자열로 온다. 빈 문자열("")로 오는 경우가 있다. */
  mapx?: string;
  /** 위도(latitude). 문자열로 온다. 빈 문자열("")로 오는 경우가 있다. */
  mapy?: string;
  firstimage?: string;
  firstimage2?: string;
  /** 저작권 유형(Type1: 출처표시-권장, Type3: 제한). */
  cpyrhtDivCd?: string;
  /** 지도 레벨. */
  mlevel?: string;
  tel?: string;
  /** locationBasedList2 응답에만 존재(중심점으로부터 거리, m). */
  dist?: string;
  createdtime?: string;
  modifiedtime?: string;
  /** 법정동 시도 코드. */
  lDongRegnCd?: string;
  /** 법정동 시군구 코드. */
  lDongSignguCd?: string;
  /** 분류체계 1Depth. */
  lclsSystm1?: string;
  /** 분류체계 2Depth. */
  lclsSystm2?: string;
  /** 분류체계 3Depth. */
  lclsSystm3?: string;
  /**
   * 구 분류코드 3Depth(예: A05020900 카페·찻집). v4.4 요청 파라미터에서는 빠졌지만
   * 응답에는 계속 들어온다. 세부 분류 라벨은 공식 코드표가 있는 이 값을 쓴다.
   */
  cat3?: string;
  [key: string]: unknown;
}

/**
 * detailCommon2 응답의 상세 항목.
 * 기준 관광지의 "현재 좌표"를 실시간으로 얻는 용도로 사용한다(mapinfoYN=Y).
 */
export interface TourApiDetailItem {
  contentid: string;
  contenttypeid?: string;
  title?: string;
  /** 경도(longitude). 문자열로 온다. */
  mapx?: string;
  /** 위도(latitude). 문자열로 온다. */
  mapy?: string;
  addr1?: string;
  addr2?: string;
  firstimage?: string;
  firstimage2?: string;
  overview?: string;
  [key: string]: unknown;
}

export interface TourApiDetailBody {
  items: { item: TourApiDetailItem | TourApiDetailItem[] } | '';
  numOfRows: number | string;
  pageNo: number | string;
  totalCount: number | string;
}

export interface TourApiDetailResponse {
  response: {
    header: TourApiHeader;
    body: TourApiDetailBody;
  };
}

export interface TourApiListBody {
  /** 결과가 없으면 빈 문자열("")로 오는 케이스가 있다. */
  items: { item: TourApiPlaceItem | TourApiPlaceItem[] } | '';
  numOfRows: number | string;
  pageNo: number | string;
  totalCount: number | string;
}

export interface TourApiListResponse {
  response: {
    header: TourApiHeader;
    body: TourApiListBody;
  };
}
