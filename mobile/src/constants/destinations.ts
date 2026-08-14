/**
 * 홈 화면에서 소개하는 대표 목적지.
 *
 * 관광정보(혼잡도·주변 장소·코스)는 전부 서버에서 실시간으로 가져오므로 여기에는 **식별자만** 둔다.
 * `tourApiContentId`는 한국관광공사 관광정보 서비스의 실제 콘텐츠 ID이며,
 * 상세 화면에서 이 값으로 혼잡도·집중률·우회 코스를 조회한다.
 */

export const HOME_REGIONS = ['전체', '서울', '부산', '전주', '제주'] as const;

export type HomeRegion = (typeof HOME_REGIONS)[number];

export type FeaturedDestination = {
  tourApiContentId: string;
  name: string;
  /** 화면 표시용 지역명. 필터에도 쓴다. */
  region: Exclude<HomeRegion, '전체'>;
  areaLabel: string;
};

export const FEATURED_DESTINATIONS: FeaturedDestination[] = [
  {
    tourApiContentId: '126508',
    name: '경복궁',
    region: '서울',
    areaLabel: '서울 종로구',
  },
  {
    tourApiContentId: '126535',
    name: '남산서울타워',
    region: '서울',
    areaLabel: '서울 용산구',
  },
  {
    tourApiContentId: '126081',
    name: '해운대해수욕장',
    region: '부산',
    areaLabel: '부산 해운대구',
  },
  {
    tourApiContentId: '1997221',
    name: '감천문화마을',
    region: '부산',
    areaLabel: '부산 사하구',
  },
  {
    tourApiContentId: '264284',
    name: '전주 한옥마을',
    region: '전주',
    areaLabel: '전북 전주시',
  },
  {
    tourApiContentId: '126435',
    name: '성산일출봉',
    region: '제주',
    areaLabel: '제주 서귀포시',
  },
];

export function destinationsInRegion(region: HomeRegion): FeaturedDestination[] {
  return region === '전체'
    ? FEATURED_DESTINATIONS
    : FEATURED_DESTINATIONS.filter((destination) => destination.region === region);
}
