/**
 * 홈 화면에서 소개하는 대표 목적지.
 *
 * 후보는 사람이 고르고 검증만 자동화했다. TourAPI에는 인기도 정렬이 없어
 * 목록 조회로 뽑으면 "가새기오름" 같은 항목이 올라온다(제목순 정렬).
 *
 * 필수 조건(전부 실제 API 응답으로 확인):
 *  1. 주변 로컬 장소 3곳 이상 — 없으면 우회 코스가 0개다(만장굴이 그렇다)
 *  2. 대표 이미지 보유
 *
 * 혼잡 정보는 필수로 두지 않았다. KTO 집중률은 이름 정확 일치로 매칭돼
 * 청계천·천지연폭포처럼 유명한 곳도 빠지고, SK 실시간 혼잡도는 커버리지가 더 좁다.
 * 필수로 걸면 지역 절반이 빈다. 없는 곳은 상세 화면이 "제공하지 않음"을 안내한다.
 *
 * 관광정보는 서버 실시간 조회라 여기엔 **식별자와 표시용 값만**.
 * 주소는 TourAPI detailCommon2 값이며, 실재하지 않는 행정구역명으로 오는 건만 바로잡았다.
 */

/** 광역시·특별시와 도(남북 구분 없음). 목적지가 있는 지역만 노출. */
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
  /** TourAPI 콘텐츠 ID. 상세 화면이 이 값으로 모든 정보 조회. */
  tourApiContentId: string;
  /** 표시용 이름 — TourAPI 원본의 지역 접두사·대괄호 제거. */
  name: string;
  region: Region;
  areaLabel: string;
  /** TourAPI 주소(detailCommon2 addr1+addr2). 상세·북마크 표시에 쓴다. */
  address: string;
  /** TourAPI 대표 이미지. 없는 곳이 있어 null 허용. */
  imageUrl: string | null;
  /**
   * 혼잡 정보 보유 여부(2026-08-16 전수 측정).
   *
   * **정렬 힌트 전용이다. 화면에 "실시간 제공" 같은 표시로 쓰지 않는다.**
   * SK 커버리지와 KTO 이름 매칭은 우리가 통제할 수 없어 언제든 바뀔 수 있다.
   * 배지로 쓰면 틀렸을 때 거짓말이 되지만, 정렬에만 쓰면 순서가 어긋날 뿐이다.
   */
  hasRealtimeCongestion: boolean;
  hasConcentrationForecast: boolean;
};

export const FEATURED_DESTINATIONS: FeaturedDestination[] = [
  {
    tourApiContentId: '126508',
    name: '경복궁',
    region: '서울',
    areaLabel: '서울 종로구',
    address: '서울특별시 종로구 사직로 161 (세종로)',
    imageUrl: 'https://tong.visitkorea.or.kr/cms/resource/98/3487598_image2_1.jpg',
    hasRealtimeCongestion: true,
    hasConcentrationForecast: true,
  },
  {
    tourApiContentId: '126535',
    name: '남산서울타워',
    region: '서울',
    areaLabel: '서울 용산구',
    address: '서울특별시 용산구 남산공원길 105',
    imageUrl: null,
    hasRealtimeCongestion: false,
    hasConcentrationForecast: true,
  },
  {
    tourApiContentId: '126081',
    name: '해운대해수욕장',
    region: '부산',
    areaLabel: '부산 해운대구',
    address: '부산광역시 해운대구 해운대해변로 264 (우동)',
    imageUrl: 'https://tong.visitkorea.or.kr/cms/resource/34/3090534_image2_1.JPG',
    hasRealtimeCongestion: true,
    hasConcentrationForecast: true,
  },
  {
    tourApiContentId: '126078',
    name: '광안리해수욕장',
    region: '부산',
    areaLabel: '부산 수영구',
    address: '부산광역시 수영구 광안해변로 219 (광안동)',
    imageUrl: 'https://tong.visitkorea.or.kr/cms/resource/45/3311245_image2_1.jpg',
    hasRealtimeCongestion: true,
    hasConcentrationForecast: true,
  },
  {
    tourApiContentId: '2480899',
    name: '수원화성',
    region: '경기',
    areaLabel: '경기 수원시',
    address: '경기도 수원시 팔달구 정조로 780 (팔달로2가)',
    imageUrl: 'https://tong.visitkorea.or.kr/cms/resource/36/3500936_image2_1.jpg',
    hasRealtimeCongestion: true,
    hasConcentrationForecast: true,
  },
  {
    tourApiContentId: '127797',
    name: '에버랜드',
    region: '경기',
    areaLabel: '경기 용인시',
    address: '경기도 용인시 처인구 포곡읍 에버랜드로 199',
    imageUrl: 'https://tong.visitkorea.or.kr/cms/resource/53/3486453_image2_1.jpg',
    hasRealtimeCongestion: true,
    hasConcentrationForecast: true,
  },
  {
    tourApiContentId: '128019',
    name: '남이섬',
    region: '강원',
    areaLabel: '강원 춘천시',
    address: '강원특별자치도 춘천시 남이섬길 1 남이섬',
    imageUrl: 'https://tong.visitkorea.or.kr/cms/resource/45/4067545_image2_1.jpg',
    hasRealtimeCongestion: false,
    hasConcentrationForecast: true,
  },
  {
    tourApiContentId: '128758',
    name: '경포해수욕장',
    region: '강원',
    areaLabel: '강원 강릉시',
    address: '강원특별자치도 강릉시 창해로 514 (안현동)',
    imageUrl: 'https://tong.visitkorea.or.kr/cms/resource/25/4075925_image2_1.jpg',
    hasRealtimeCongestion: true,
    hasConcentrationForecast: true,
  },
  {
    tourApiContentId: '264284',
    name: '전주 한옥마을',
    region: '전라',
    areaLabel: '전북 전주시',
    address: '전북특별자치도 전주시 완산구 기린대로 99 (남노송동)',
    imageUrl: 'https://tong.visitkorea.or.kr/cms/resource_photo/67/3516667_image2_1.jpg',
    hasRealtimeCongestion: true,
    hasConcentrationForecast: true,
  },
  {
    tourApiContentId: '126621',
    name: '오목대와 이목대',
    region: '전라',
    areaLabel: '전북 전주시',
    address: '전북특별자치도 전주시 완산구 기린대로 55',
    imageUrl: 'https://tong.visitkorea.or.kr/cms/resource/46/3533046_image2_1.jpg',
    hasRealtimeCongestion: false,
    hasConcentrationForecast: true,
  },
  {
    tourApiContentId: '126166',
    name: '불국사',
    region: '경상',
    areaLabel: '경북 경주시',
    address: '경상북도 경주시 불국로 385 (진현동)',
    imageUrl: 'https://tong.visitkorea.or.kr/cms/resource/70/3506170_image2_1.jpg',
    hasRealtimeCongestion: false,
    hasConcentrationForecast: true,
  },
  {
    tourApiContentId: '126207',
    name: '첨성대',
    region: '경상',
    areaLabel: '경북 경주시',
    address: '경상북도 경주시 첨성로 140-25',
    imageUrl: 'https://tong.visitkorea.or.kr/cms/resource/35/4097535_image2_1.JPG',
    hasRealtimeCongestion: false,
    hasConcentrationForecast: true,
  },
  {
    tourApiContentId: '126435',
    name: '성산일출봉',
    region: '제주',
    areaLabel: '제주 서귀포시',
    address: '제주특별자치도 서귀포시 성산읍 일출로 284-12',
    imageUrl: 'https://tong.visitkorea.or.kr/cms/resource/82/2944282_image2_1.bmp',
    hasRealtimeCongestion: false,
    hasConcentrationForecast: true,
  },
  {
    tourApiContentId: '126471',
    name: '성읍민속마을',
    region: '제주',
    areaLabel: '제주 서귀포시',
    address: '제주특별자치도 서귀포시 표선면 성읍리 3294',
    imageUrl: 'https://tong.visitkorea.or.kr/cms/resource/64/3551564_image2_1.jpg',
    hasRealtimeCongestion: false,
    hasConcentrationForecast: true,
  },
  {
    tourApiContentId: '129507',
    name: '청계천',
    region: '서울',
    areaLabel: '서울 종로구',
    address: '서울특별시 종로구 창신동',
    imageUrl: 'https://tong.visitkorea.or.kr/cms/resource_photo/34/3538134_image2_1.jpg',
    hasRealtimeCongestion: false,
    hasConcentrationForecast: false,
  },
  {
    tourApiContentId: '126537',
    name: '북촌한옥마을',
    region: '서울',
    areaLabel: '서울 종로구',
    address: '서울특별시 종로구 계동길 37 (계동)',
    imageUrl: 'https://tong.visitkorea.or.kr/cms/resource/04/3304404_image2_1.jpg',
    hasRealtimeCongestion: false,
    hasConcentrationForecast: true,
  },
  {
    tourApiContentId: '2476731',
    name: '롯데월드 아쿠아리움',
    region: '서울',
    areaLabel: '서울 송파구',
    address: '서울특별시 송파구 올림픽로 300 (신천동) 지하 1층',
    imageUrl: 'https://tong.visitkorea.or.kr/cms/resource/45/2384845_image2_1.jpg',
    hasRealtimeCongestion: false,
    hasConcentrationForecast: true,
  },
  {
    tourApiContentId: '128611',
    name: '서울숲',
    region: '서울',
    areaLabel: '서울 성동구',
    address: '서울특별시 성동구 뚝섬로 273',
    imageUrl: 'https://tong.visitkorea.or.kr/cms/resource_photo/99/3580599_image2_1.jpg',
    hasRealtimeCongestion: true,
    hasConcentrationForecast: true,
  },
  {
    tourApiContentId: '1997221',
    name: '감천문화마을',
    region: '부산',
    areaLabel: '부산 사하구',
    address: '부산광역시 사하구 감내2로 203',
    imageUrl: 'https://tong.visitkorea.or.kr/cms/resource/91/3365491_image2_1.jpg',
    hasRealtimeCongestion: true,
    hasConcentrationForecast: false,
  },
  {
    tourApiContentId: '126658',
    name: '태종대',
    region: '부산',
    areaLabel: '부산 영도구',
    address: '부산광역시 영도구 전망로 24 (동삼동)',
    imageUrl: 'https://tong.visitkorea.or.kr/cms/resource/83/3506383_image2_1.jpg',
    hasRealtimeCongestion: true,
    hasConcentrationForecast: true,
  },
  {
    tourApiContentId: '1871383',
    name: '김광석다시그리기길',
    region: '대구',
    areaLabel: '대구 중구',
    address: '대구광역시 중구 달구벌대로 2238',
    imageUrl: 'https://tong.visitkorea.or.kr/cms/resource/95/2947395_image2_1.jpg',
    hasRealtimeCongestion: false,
    hasConcentrationForecast: true,
  },
  {
    tourApiContentId: '128627',
    name: '이월드',
    region: '대구',
    areaLabel: '대구 달서구',
    address: '대구광역시 달서구 두류공원로 200 (두류동)',
    imageUrl: 'https://tong.visitkorea.or.kr/cms/resource/82/2818982_image2_1.jpg',
    hasRealtimeCongestion: true,
    hasConcentrationForecast: true,
  },
  {
    tourApiContentId: '1626349',
    name: '팔공산 케이블카',
    region: '대구',
    areaLabel: '대구 동구',
    address: '대구광역시 동구 팔공산로185길 51',
    imageUrl: 'https://tong.visitkorea.or.kr/cms/resource/56/3572056_image2_1.jpg',
    hasRealtimeCongestion: false,
    hasConcentrationForecast: true,
  },
  {
    tourApiContentId: '127585',
    name: '월미도',
    region: '인천',
    areaLabel: '인천 제물포구',
    address: '인천광역시 제물포구 월미문화로 36 (북성동1가)',
    imageUrl: 'https://tong.visitkorea.or.kr/cms/resource/94/3518594_image2_1.jpg',
    hasRealtimeCongestion: false,
    hasConcentrationForecast: false,
  },
  {
    tourApiContentId: '128767',
    name: '을왕리해수욕장',
    region: '인천',
    areaLabel: '인천 영종구',
    address: '인천광역시 영종구 용유서로302번길 16-15 (을왕동)',
    imageUrl: 'https://tong.visitkorea.or.kr/cms/resource/78/3518478_image2_1.jpg',
    hasRealtimeCongestion: true,
    hasConcentrationForecast: false,
  },
  {
    tourApiContentId: '128027',
    name: '인천대공원',
    region: '인천',
    areaLabel: '인천 남동구',
    address: '인천광역시 남동구 무네미로 236',
    imageUrl: 'https://tong.visitkorea.or.kr/cms/resource/53/4061653_image2_1.jpg',
    hasRealtimeCongestion: true,
    hasConcentrationForecast: true,
  },
  {
    tourApiContentId: '2009775',
    name: '국립아시아문화전당',
    region: '광주',
    areaLabel: '광주 동구',
    address: '광주광역시 동구 문화전당로 38 (광산동)',
    imageUrl: 'https://tong.visitkorea.or.kr/cms/resource/59/3083359_image2_1.jpg',
    hasRealtimeCongestion: true,
    hasConcentrationForecast: false,
  },
  {
    tourApiContentId: '125994',
    name: '대전엑스포과학공원',
    region: '대전',
    areaLabel: '대전 유성구',
    address: '대전광역시 유성구 대덕대로 480 (도룡동)',
    imageUrl: 'https://tong.visitkorea.or.kr/cms/resource/27/3486427_image2_1.jpg',
    hasRealtimeCongestion: false,
    hasConcentrationForecast: true,
  },
  {
    tourApiContentId: '127515',
    name: '대왕암공원',
    region: '울산',
    areaLabel: '울산 동구',
    address: '울산광역시 동구 등대로 95 (일산동)',
    imageUrl: 'https://tong.visitkorea.or.kr/cms/resource/16/3583516_image2_1.jpg',
    hasRealtimeCongestion: true,
    hasConcentrationForecast: true,
  },
  {
    tourApiContentId: '128201',
    name: '태화강',
    region: '울산',
    areaLabel: '울산 남구',
    address: '울산광역시 남구 무거동 (무거동)',
    imageUrl: 'https://tong.visitkorea.or.kr/cms/resource/21/3008621_image2_1.jpg',
    hasRealtimeCongestion: true,
    hasConcentrationForecast: true,
  },
  {
    tourApiContentId: '130649',
    name: '장생포 고래박물관',
    region: '울산',
    areaLabel: '울산 남구',
    address: '울산광역시 남구 장생포고래로 244 (매암동)',
    imageUrl: 'https://tong.visitkorea.or.kr/cms/resource/05/3581305_image2_1.jpg',
    hasRealtimeCongestion: false,
    hasConcentrationForecast: false,
  },
  {
    tourApiContentId: '1946955',
    name: '세종호수공원',
    region: '세종',
    areaLabel: '세종 다솜로',
    address: '세종특별자치시 다솜로 216 (세종동)',
    imageUrl: 'https://tong.visitkorea.or.kr/cms/resource/76/3353976_image2_1.jpg',
    hasRealtimeCongestion: false,
    hasConcentrationForecast: false,
  },
  {
    tourApiContentId: '2675068',
    name: '국립세종수목원',
    region: '세종',
    areaLabel: '세종 수목원로',
    address: '세종특별자치시 수목원로 136 (세종동)',
    imageUrl: 'https://tong.visitkorea.or.kr/cms/resource/89/4065589_image2_1.jpg',
    hasRealtimeCongestion: true,
    hasConcentrationForecast: false,
  },
  {
    tourApiContentId: '125578',
    name: '한국민속촌',
    region: '경기',
    areaLabel: '경기 용인시',
    address: '경기도 용인시 기흥구 민속촌로 90 (보라동)',
    imageUrl: 'https://tong.visitkorea.or.kr/cms/resource/87/3563987_image2_1.jpg',
    hasRealtimeCongestion: true,
    hasConcentrationForecast: true,
  },
  {
    tourApiContentId: '126668',
    name: '아침고요수목원',
    region: '경기',
    areaLabel: '경기 가평군',
    address: '경기도 가평군 상면 수목원로 432',
    imageUrl: 'https://tong.visitkorea.or.kr/cms/resource/38/4079238_image2_1.jpg',
    hasRealtimeCongestion: true,
    hasConcentrationForecast: true,
  },
  {
    tourApiContentId: '2649975',
    name: '광명동굴',
    region: '경기',
    areaLabel: '경기 광명시',
    address: '경기도 광명시 가학로85번길 142',
    imageUrl: 'https://tong.visitkorea.or.kr/cms/resource/27/4095727_image2_1.jpg',
    hasRealtimeCongestion: true,
    hasConcentrationForecast: false,
  },
  {
    tourApiContentId: '127722',
    name: '안목해변',
    region: '강원',
    areaLabel: '강원 강릉시',
    address: '강원특별자치도 강릉시 창해로14번길 20-1',
    imageUrl: 'https://tong.visitkorea.or.kr/cms/resource/58/4075958_image2_1.jpg',
    hasRealtimeCongestion: false,
    hasConcentrationForecast: true,
  },
  {
    tourApiContentId: '251738',
    name: '아바이마을',
    region: '강원',
    areaLabel: '강원 속초시',
    address: '강원특별자치도 속초시 청호로 122-1',
    imageUrl: 'https://tong.visitkorea.or.kr/cms/resource_photo/13/4076913_image2_1.jpg',
    hasRealtimeCongestion: false,
    hasConcentrationForecast: true,
  },
  {
    tourApiContentId: '2605193',
    name: '정동진역',
    region: '강원',
    areaLabel: '강원 강릉시',
    address: '강원특별자치도 강릉시 강동면 정동역길 17',
    imageUrl: 'https://tong.visitkorea.or.kr/cms/resource/12/4093712_image2_1.jpg',
    hasRealtimeCongestion: false,
    hasConcentrationForecast: false,
  },
  {
    tourApiContentId: '1260275',
    name: '속초관광수산시장',
    region: '강원',
    areaLabel: '강원 속초시',
    address: '강원특별자치도 속초시 중앙로147번길 12',
    imageUrl: 'https://tong.visitkorea.or.kr/cms/resource/67/4041467_image2_1.jpg',
    hasRealtimeCongestion: false,
    hasConcentrationForecast: true,
  },
  {
    tourApiContentId: '125984',
    name: '궁남지',
    region: '충청',
    areaLabel: '충남 부여군',
    address: '충청남도 부여군 부여읍 궁남로 52',
    imageUrl: 'https://tong.visitkorea.or.kr/cms/resource/24/4063424_image2_1.jpg',
    hasRealtimeCongestion: false,
    hasConcentrationForecast: true,
  },
  {
    tourApiContentId: '127866',
    name: '대천해수욕장',
    region: '충청',
    areaLabel: '충남 보령시',
    address: '충청남도 보령시 머드로 123',
    imageUrl: 'https://tong.visitkorea.or.kr/cms/resource/66/3513866_image2_1.jpg',
    hasRealtimeCongestion: true,
    hasConcentrationForecast: true,
  },
  {
    tourApiContentId: '125949',
    name: '공주 공산성',
    region: '충청',
    areaLabel: '충남 공주시',
    address: '충청남도 공주시 웅진로 280 (금성동)',
    imageUrl: 'https://tong.visitkorea.or.kr/cms/resource_photo/41/3404541_image2_1.jpg',
    hasRealtimeCongestion: false,
    hasConcentrationForecast: true,
  },
  {
    tourApiContentId: '126730',
    name: '순천만습지',
    region: '전라',
    areaLabel: '전남 순천시',
    address: '전라남도 순천시 순천만길 513-25',
    imageUrl: 'https://tong.visitkorea.or.kr/cms/resource/14/4088614_image2_1.jpg',
    hasRealtimeCongestion: false,
    hasConcentrationForecast: false,
  },
  {
    tourApiContentId: '128834',
    name: '죽녹원',
    region: '전라',
    areaLabel: '전남 담양군',
    address: '전라남도 담양군 담양읍 죽녹원로 119',
    imageUrl: 'https://tong.visitkorea.or.kr/cms/resource/36/4017136_image2_1.jpg',
    hasRealtimeCongestion: true,
    hasConcentrationForecast: false,
  },
  {
    tourApiContentId: '1492402',
    name: '대릉원',
    region: '경상',
    areaLabel: '경북 경주시',
    address: '경상북도 경주시 황남동 31-1',
    imageUrl: 'https://tong.visitkorea.or.kr/cms/resource/71/4056771_image2_1.jpg',
    hasRealtimeCongestion: false,
    hasConcentrationForecast: true,
  },
  {
    tourApiContentId: '126175',
    name: '해인사',
    region: '경상',
    areaLabel: '경남 합천군',
    address: '경상남도 합천군 가야면 해인사길 122',
    imageUrl: 'https://tong.visitkorea.or.kr/cms/resource/27/4092527_image2_1.jpg',
    hasRealtimeCongestion: false,
    hasConcentrationForecast: true,
  },
  {
    tourApiContentId: '126438',
    name: '천지연폭포',
    region: '제주',
    areaLabel: '제주 서귀포시',
    address: '제주특별자치도 서귀포시 서홍동 666-1',
    imageUrl: 'https://tong.visitkorea.or.kr/cms/resource/43/4094043_image2_1.jpg',
    hasRealtimeCongestion: false,
    hasConcentrationForecast: false,
  },
  {
    tourApiContentId: '127490',
    name: '협재해수욕장',
    region: '제주',
    areaLabel: '제주 제주시',
    address: '제주특별자치도 제주시 한림읍 한림로 329-10',
    imageUrl: 'https://tong.visitkorea.or.kr/cms/resource/66/3096066_image2_1.jpg',
    hasRealtimeCongestion: true,
    hasConcentrationForecast: false,
  },
];

/** 목적지가 하나라도 있는 지역만 필터 칩으로 노출. */
export const AVAILABLE_REGIONS: Region[] = ALL_REGIONS.filter((region) =>
  FEATURED_DESTINATIONS.some((destination) => destination.region === region),
);

/**
 * 혼잡 정보가 있는 곳을 앞에 둔다.
 *
 * 실시간 혼잡도(SK)는 49곳 중 23곳, 집중률(KTO)은 35곳만 제공한다.
 * (21곳은 2026-08-16 서버 매칭 개선 — SK 제공 장소 인덱스 + 실조회 검증 — 후 전수 재측정값.
 *  서버 `npm run measure:congestion`으로 언제든 재측정할 수 있다.)
 * 어디가 되는지 알 수 없으면 사용자가 눌러 보고 실망하기를 반복하게 된다.
 * 배지로 알리는 대신 순서로 알린다 — 틀려도 순서만 어긋난다.
 */
function infoScore(destination: FeaturedDestination): number {
  return (destination.hasRealtimeCongestion ? 2 : 0) + (destination.hasConcentrationForecast ? 1 : 0);
}

export function destinationsInRegion(region: Region | null): FeaturedDestination[] {
  const list =
    region === null
      ? FEATURED_DESTINATIONS
      : FEATURED_DESTINATIONS.filter((destination) => destination.region === region);
  // 같은 점수면 원래 순서를 지킨다(Array.prototype.sort는 안정 정렬).
  return [...list].sort((first, second) => infoScore(second) - infoScore(first));
}
