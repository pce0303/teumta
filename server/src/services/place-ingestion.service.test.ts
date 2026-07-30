import { PlaceType } from '@prisma/client';
import { describe, expect, it } from 'vitest';

import type { PlaceData } from '../dtos';
import { toPlaceCreateInput, toPlaceUpdateInput } from './place-ingestion.service';

function makePlaceData(overrides: Partial<PlaceData> = {}): PlaceData {
  return {
    tourApiContentId: '100',
    name: '경복궁',
    type: PlaceType.TOURIST_SPOT,
    address: '서울 종로구',
    latitude: 37.5788,
    longitude: 126.977,
    imageUrl: 'a.jpg',
    description: null,
    openingTime: null,
    closingTime: null,
    recommendedDuration: null,
    ...overrides,
  };
}

describe('toPlaceCreateInput', () => {
  it('모든 필드를 포함한다', () => {
    const input = toPlaceCreateInput(makePlaceData({ description: '설명', openingTime: '09:00' }));
    expect(input).toMatchObject({
      tourApiContentId: '100',
      name: '경복궁',
      type: PlaceType.TOURIST_SPOT,
      description: '설명',
      openingTime: '09:00',
    });
  });

  it('type이 없으면 TOURIST_SPOT로 기본값', () => {
    expect(toPlaceCreateInput(makePlaceData({ type: undefined })).type).toBe(PlaceType.TOURIST_SPOT);
  });
});

describe('toPlaceUpdateInput', () => {
  it('detail 소스 필드(description/운영시간/추천체류)는 제외해 덮어쓰지 않는다', () => {
    const input = toPlaceUpdateInput(makePlaceData());
    expect(input).not.toHaveProperty('description');
    expect(input).not.toHaveProperty('openingTime');
    expect(input).not.toHaveProperty('closingTime');
    expect(input).not.toHaveProperty('recommendedDuration');
  });

  it('목록에서 신뢰 가능한 필드는 포함한다', () => {
    const input = toPlaceUpdateInput(makePlaceData());
    expect(input).toMatchObject({ name: '경복궁', address: '서울 종로구', imageUrl: 'a.jpg' });
  });
});
