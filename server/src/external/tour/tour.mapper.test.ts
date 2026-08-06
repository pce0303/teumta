import { PlaceType } from '@prisma/client';
import { describe, expect, it } from 'vitest';

import { ExternalApiResponseError } from '../common/external-api.error';
import type { TourApiListResponse, TourApiPlaceItem } from './tour.dto';
import {
  extractItems,
  mapContentTypeIdToPlaceType,
  mapTourPlaceList,
  mapTourPlaceListDetailed,
  mapTourPlaceToPlaceData,
} from './tour.mapper';

function makeItem(overrides: Partial<TourApiPlaceItem> = {}): TourApiPlaceItem {
  return {
    contentid: '100',
    contenttypeid: '12',
    title: '테스트 장소',
    addr1: '서울시 어딘가',
    mapx: '126.9',
    mapy: '37.5',
    ...overrides,
  };
}

describe('mapContentTypeIdToPlaceType', () => {
  it('관광지(12)/문화시설(14)은 TOURIST_SPOT', () => {
    expect(mapContentTypeIdToPlaceType('12')).toBe(PlaceType.TOURIST_SPOT);
    expect(mapContentTypeIdToPlaceType('14')).toBe(PlaceType.TOURIST_SPOT);
  });

  it('음식점(39)/쇼핑(38)은 LOCAL_PLACE', () => {
    expect(mapContentTypeIdToPlaceType('39')).toBe(PlaceType.LOCAL_PLACE);
    expect(mapContentTypeIdToPlaceType('38')).toBe(PlaceType.LOCAL_PLACE);
  });

  it('축제(15)/여행코스(25)/레포츠(28)/숙박(32)은 TOURIST_SPOT (기존 정책 고정)', () => {
    expect(mapContentTypeIdToPlaceType('15')).toBe(PlaceType.TOURIST_SPOT);
    expect(mapContentTypeIdToPlaceType('25')).toBe(PlaceType.TOURIST_SPOT);
    expect(mapContentTypeIdToPlaceType('28')).toBe(PlaceType.TOURIST_SPOT);
    expect(mapContentTypeIdToPlaceType('32')).toBe(PlaceType.TOURIST_SPOT);
  });

  it('알 수 없는 코드는 TOURIST_SPOT로 폴백', () => {
    expect(mapContentTypeIdToPlaceType('999')).toBe(PlaceType.TOURIST_SPOT);
  });
});

describe('extractItems', () => {
  const wrap = (body: TourApiListResponse['response']['body']): TourApiListResponse => ({
    response: { header: { resultCode: '0000', resultMsg: 'OK' }, body },
  });

  it('item 배열을 그대로 반환', () => {
    const res = wrap({ items: { item: [makeItem(), makeItem()] }, numOfRows: 2, pageNo: 1, totalCount: 2 });
    expect(extractItems(res)).toHaveLength(2);
  });

  it('단일 객체 item을 배열로 감싼다', () => {
    const res = wrap({ items: { item: makeItem() }, numOfRows: 1, pageNo: 1, totalCount: 1 });
    expect(extractItems(res)).toHaveLength(1);
  });

  it('빈 결과(items="")는 빈 배열', () => {
    const res = wrap({ items: '', numOfRows: 0, pageNo: 1, totalCount: 0 });
    expect(extractItems(res)).toEqual([]);
  });
});

describe('mapTourPlaceToPlaceData', () => {
  it('필드를 내부 PlaceData로 매핑한다', () => {
    const result = mapTourPlaceToPlaceData(
      makeItem({ contentid: '126508', title: '경복궁', addr1: '서울 종로구', addr2: '(세종로)', mapx: '126.977', mapy: '37.5788' }),
    );
    expect(result).toMatchObject({
      tourApiContentId: '126508',
      name: '경복궁',
      address: '서울 종로구 (세종로)',
      latitude: 37.5788,
      longitude: 126.977,
    });
    expect(typeof result.latitude).toBe('number');
  });

  it('이미지는 firstimage → firstimage2 → null 순으로 폴백', () => {
    expect(mapTourPlaceToPlaceData(makeItem({ firstimage: 'a.jpg', firstimage2: 'b.jpg' })).imageUrl).toBe('a.jpg');
    expect(mapTourPlaceToPlaceData(makeItem({ firstimage: '', firstimage2: 'b.jpg' })).imageUrl).toBe('b.jpg');
    expect(mapTourPlaceToPlaceData(makeItem({ firstimage: '', firstimage2: '' })).imageUrl).toBeNull();
  });

  it('주소가 모두 비면 null', () => {
    expect(mapTourPlaceToPlaceData(makeItem({ addr1: '', addr2: '' })).address).toBeNull();
  });

  it('좌표가 비었거나 0이면 ExternalApiResponseError', () => {
    expect(() => mapTourPlaceToPlaceData(makeItem({ mapx: '' }))).toThrow(ExternalApiResponseError);
    expect(() => mapTourPlaceToPlaceData(makeItem({ mapy: '0' }))).toThrow(ExternalApiResponseError);
  });

  it('detail 소스 필드는 null로 둔다', () => {
    const result = mapTourPlaceToPlaceData(makeItem());
    expect(result.description).toBeNull();
    expect(result.openingTime).toBeNull();
    expect(result.closingTime).toBeNull();
    expect(result.recommendedDuration).toBeNull();
  });

  it('최신 법정동/분류체계 필드를 매핑한다(v4.4)', () => {
    const result = mapTourPlaceToPlaceData(
      makeItem({
        lDongRegnCd: '11',
        lDongSignguCd: '110',
        lclsSystm1: 'VE',
        lclsSystm2: 'VE01',
        lclsSystm3: 'VE0101',
      }),
    );
    expect(result).toMatchObject({
      lDongRegnCd: '11',
      lDongSignguCd: '110',
      lclsSystm1: 'VE',
      lclsSystm2: 'VE01',
      lclsSystm3: 'VE0101',
    });
  });

  it('법정동/분류체계 필드가 없거나 빈 문자열이면 null', () => {
    const result = mapTourPlaceToPlaceData(makeItem({ lDongRegnCd: '', lclsSystm1: ' ' }));
    expect(result.lDongRegnCd).toBeNull();
    expect(result.lDongSignguCd).toBeNull();
    expect(result.lclsSystm1).toBeNull();
  });
});

describe('mapTourPlaceListDetailed', () => {
  const wrap = (items: TourApiPlaceItem[]): TourApiListResponse => ({
    response: {
      header: { resultCode: '0000', resultMsg: 'OK' },
      body: { items: { item: items }, numOfRows: items.length, pageNo: 1, totalCount: items.length },
    },
  });

  it('좌표 불량 항목은 skip으로 집계하고 나머지는 변환한다(전체 실패 없음)', () => {
    const result = mapTourPlaceListDetailed(
      wrap([makeItem({ contentid: '1' }), makeItem({ contentid: '2', mapx: '' }), makeItem({ contentid: '3', mapy: '0' })]),
    );
    expect(result.places.map((p) => p.tourApiContentId)).toEqual(['1']);
    expect(result.skipped).toHaveLength(2);
    expect(result.skipped[0]).toMatchObject({ contentId: '2' });
    expect(result.skipped[1]).toMatchObject({ contentId: '3' });
  });

  it('전부 유효하면 skipped는 빈 배열', () => {
    const result = mapTourPlaceListDetailed(wrap([makeItem()]));
    expect(result.places).toHaveLength(1);
    expect(result.skipped).toEqual([]);
  });
});

describe('mapTourPlaceList', () => {
  it('목록 응답 전체를 PlaceData[]로 변환', () => {
    const res: TourApiListResponse = {
      response: {
        header: { resultCode: '0000', resultMsg: 'OK' },
        body: {
          items: { item: [makeItem({ contentid: '1' }), makeItem({ contentid: '2', contenttypeid: '39' })] },
          numOfRows: 2,
          pageNo: 1,
          totalCount: 2,
        },
      },
    };
    const result = mapTourPlaceList(res);
    expect(result.map((p) => p.tourApiContentId)).toEqual(['1', '2']);
    expect(result[1].type).toBe(PlaceType.LOCAL_PLACE);
  });
});
