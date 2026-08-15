/**
 * 홈 화면에서 소개하는 대표 목적지.
 *
 * 선정 기준(전부 실제 API 응답으로 확인한 값이다):
 *  1. 집중률 예측이 제공되는 곳 — 여행 전 "언제 덜 붐비나"를 판단할 근거가 있어야 한다
 *  2. 우회 코스가 실제로 생성되는 곳 — 걸어서 갈 로컬 장소가 주변에 있어야 한다
 *     (만장굴처럼 주변에 아무것도 없는 곳은 코스가 0개라 제외했다)
 *  3. 실제로 붐비는 대표 관광지 — 오버투어리즘 완화라는 서비스 목적의 출발점
 *  4. 지역당 2곳
 *
 * 실시간 혼잡도(SK)는 기준에 넣지 않는다. 커버리지가 좁아(경복궁·해운대·전주한옥마을 등)
 * 이걸 요구하면 후보가 거의 남지 않는다. 혼잡도가 없는 곳은 상세에서 집중률 예측을 보여준다.
 *
 * 관광정보는 전부 서버에서 실시간 조회하므로 여기에는 **식별자와 표시용 값만** 둔다.
 */

/** 광역시·특별시와 도(남/북을 나누지 않는다). 목적지가 있는 지역만 화면에 노출된다. */
export const ALL_REGIONS = [
  '서울',
  '부산',
  '대구',
  '인천',
  '광주',
  '대전',
  '울산',
  '세종',
  '경기',
  '강원',
  '충청',
  '전라',
  '경상',
  '제주',
] as const;

export type Region = (typeof ALL_REGIONS)[number];

export type FeaturedDestination = {
  /** 한국관광공사 관광정보 서비스의 콘텐츠 ID. 상세 화면이 이 값으로 모든 정보를 조회한다. */
  tourApiContentId: string;
  /** 화면 표시용 이름(TourAPI 원본의 지역 접두사·대괄호 표기를 걷어낸 것). */
  name: string;
  region: Region;
  areaLabel: string;
  /** TourAPI 대표 이미지. 없는 곳도 있어 null을 허용한다. */
  imageUrl: string | null;
};

export const FEATURED_DESTINATIONS: FeaturedDestination[] = [
  {
    tourApiContentId: '126508',
    name: '경복궁',
    region: '서울',
    areaLabel: '서울 종로구',
    imageUrl: 'https://tong.visitkorea.or.kr/cms/resource/98/3487598_image2_1.jpg',
  },
  {
    tourApiContentId: '126535',
    name: '남산서울타워',
    region: '서울',
    areaLabel: '서울 용산구',
    imageUrl: null,
  },
  {
    tourApiContentId: '126081',
    name: '해운대해수욕장',
    region: '부산',
    areaLabel: '부산 해운대구',
    imageUrl: 'https://tong.visitkorea.or.kr/cms/resource/34/3090534_image2_1.JPG',
  },
  {
    tourApiContentId: '126078',
    name: '광안리해수욕장',
    region: '부산',
    areaLabel: '부산 수영구',
    imageUrl: 'https://tong.visitkorea.or.kr/cms/resource/45/3311245_image2_1.jpg',
  },
  {
    tourApiContentId: '2480899',
    name: '수원화성',
    region: '경기',
    areaLabel: '경기 수원시',
    imageUrl: 'https://tong.visitkorea.or.kr/cms/resource/36/3500936_image2_1.jpg',
  },
  {
    tourApiContentId: '127797',
    name: '에버랜드',
    region: '경기',
    areaLabel: '경기 용인시',
    imageUrl: 'https://tong.visitkorea.or.kr/cms/resource/53/3486453_image2_1.jpg',
  },
  {
    tourApiContentId: '128019',
    name: '남이섬',
    region: '강원',
    areaLabel: '강원 춘천시',
    imageUrl: 'https://tong.visitkorea.or.kr/cms/resource/45/4067545_image2_1.jpg',
  },
  {
    tourApiContentId: '128758',
    name: '경포해수욕장',
    region: '강원',
    areaLabel: '강원 강릉시',
    imageUrl: 'https://tong.visitkorea.or.kr/cms/resource/25/4075925_image2_1.jpg',
  },
  {
    tourApiContentId: '264284',
    name: '전주 한옥마을',
    region: '전라',
    areaLabel: '전북 전주시',
    imageUrl: 'https://tong.visitkorea.or.kr/cms/resource_photo/67/3516667_image2_1.jpg',
  },
  {
    tourApiContentId: '126621',
    name: '오목대와 이목대',
    region: '전라',
    areaLabel: '전북 전주시',
    imageUrl: 'http://tong.visitkorea.or.kr/cms/resource/46/3533046_image2_1.jpg',
  },
  {
    tourApiContentId: '126166',
    name: '불국사',
    region: '경상',
    areaLabel: '경북 경주시',
    imageUrl: 'https://tong.visitkorea.or.kr/cms/resource/70/3506170_image2_1.jpg',
  },
  {
    tourApiContentId: '126207',
    name: '첨성대',
    region: '경상',
    areaLabel: '경북 경주시',
    imageUrl: 'https://tong.visitkorea.or.kr/cms/resource/35/4097535_image2_1.JPG',
  },
  {
    tourApiContentId: '126435',
    name: '성산일출봉',
    region: '제주',
    areaLabel: '제주 서귀포시',
    imageUrl: 'http://tong.visitkorea.or.kr/cms/resource/82/2944282_image2_1.bmp',
  },
  {
    tourApiContentId: '126471',
    name: '성읍민속마을',
    region: '제주',
    areaLabel: '제주 서귀포시',
    imageUrl: 'http://tong.visitkorea.or.kr/cms/resource/64/3551564_image2_1.jpg',
  },
];

/** 목적지가 하나라도 있는 지역만 필터 칩으로 노출한다. */
export const AVAILABLE_REGIONS: Region[] = ALL_REGIONS.filter((region) =>
  FEATURED_DESTINATIONS.some((destination) => destination.region === region),
);

export function destinationsInRegion(region: Region | null): FeaturedDestination[] {
  return region === null
    ? FEATURED_DESTINATIONS
    : FEATURED_DESTINATIONS.filter((destination) => destination.region === region);
}
