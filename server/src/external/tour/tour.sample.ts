import type { TourApiListResponse } from './tour.dto';

/**
 * 공식 스펙 기반 예시 응답(오프라인 mapper 테스트용).
 *
 * ⚠️ 실제 API 응답이 아니라 문서 스펙을 토대로 만든 placeholder다.
 *    실제 응답 샘플을 확보하면 이 값을 교체하고 mapper 검증에 사용한다.
 *
 * 사용 예:
 *   import { mapTourPlaceList } from './tour.mapper';
 *   import { SAMPLE_AREA_BASED_LIST } from './tour.sample';
 *   console.log(mapTourPlaceList(SAMPLE_AREA_BASED_LIST));
 */
export const SAMPLE_AREA_BASED_LIST: TourApiListResponse = {
  response: {
    header: { resultCode: '0000', resultMsg: 'OK' },
    body: {
      items: {
        item: [
          {
            contentid: '126508',
            contenttypeid: '12', // 관광지 → TOURIST_SPOT
            title: '경복궁',
            addr1: '서울특별시 종로구 사직로 161',
            addr2: '(세종로)',
            mapx: '126.9769930325',
            mapy: '37.5788412226',
            firstimage: 'http://tong.visitkorea.or.kr/cms/resource/23/xxxxx23_image2.jpg',
            firstimage2: 'http://tong.visitkorea.or.kr/cms/resource/23/xxxxx23_image3.jpg',
            areacode: '1',
            sigungucode: '23',
            cat1: 'A02',
            tel: '',
          },
          {
            contentid: '2792858',
            contenttypeid: '39', // 음식점 → LOCAL_PLACE
            title: '토속촌삼계탕',
            addr1: '서울특별시 종로구 자하문로5길 5',
            mapx: '126.9720000000',
            mapy: '37.5790000000',
            firstimage: '',
            firstimage2: '',
            areacode: '1',
            sigungucode: '23',
          },
        ],
      },
      numOfRows: 2,
      pageNo: 1,
      totalCount: 2,
    },
  },
};

/** 빈 결과 케이스(totalCount=0, items=""). */
export const SAMPLE_EMPTY_LIST: TourApiListResponse = {
  response: {
    header: { resultCode: '0000', resultMsg: 'OK' },
    body: { items: '', numOfRows: 0, pageNo: 1, totalCount: 0 },
  },
};
