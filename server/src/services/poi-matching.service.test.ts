import { beforeEach, describe, expect, it, vi } from 'vitest';

/** TourAPI 관광지 ↔ TMAP POI 매칭 테스트. 외부 API는 전부 mock. */

const { fetchTourPlaceDetailMock, fetchPoiSearchMock } = vi.hoisted(() => ({
  fetchTourPlaceDetailMock: vi.fn(),
  fetchPoiSearchMock: vi.fn(),
}));

vi.mock('../external/tour', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../external/tour')>();
  return { ...actual, fetchTourPlaceDetail: fetchTourPlaceDetailMock };
});

vi.mock('../external/tmap', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../external/tmap')>();
  return { ...actual, fetchPoiSearch: fetchPoiSearchMock };
});

import {
  clearPoiMatchCache,
  pickBestPoiMatch,
  resolveTmapPoiId,
} from './poi-matching.service';

/** 경복궁 실제 좌표. */
const GYEONGBOKGUNG = { latitude: 37.5760307, longitude: 126.9767218 };

function tourDetail(item: Record<string, unknown> | null) {
  return {
    response: {
      header: { resultCode: '0000', resultMsg: 'OK' },
      body: { items: item === null ? '' : { item }, numOfRows: 1, pageNo: 1, totalCount: 1 },
    },
  };
}

function poiSearch(pois: Record<string, unknown>[]) {
  return { searchPoiInfo: { pois: { poi: pois } } };
}

beforeEach(() => {
  clearPoiMatchCache();
  fetchTourPlaceDetailMock.mockReset();
  fetchPoiSearchMock.mockReset();

  fetchTourPlaceDetailMock.mockResolvedValue(
    tourDetail({
      contentid: '126508',
      title: '경복궁',
      mapy: String(GYEONGBOKGUNG.latitude),
      mapx: String(GYEONGBOKGUNG.longitude),
    }),
  );
  fetchPoiSearchMock.mockResolvedValue(
    poiSearch([
      { id: '362105', name: '경복궁', noorLat: '37.5765', noorLon: '126.9770' },
    ]),
  );
});

describe('pickBestPoiMatch', () => {
  const target = { name: '경복궁', coordinate: GYEONGBOKGUNG };

  it('부속 시설이 더 가까워도 이름이 정확히 맞는 본 시설을 고른다', () => {
    // 실제 TMAP 응답: "경복궁 주차장"(id 10051350)이 "경복궁"(id 362105)보다 근소하게 가깝다.
    // SK 혼잡도는 본 시설만 커버해서 거리만 보면 "데이터 없음"이 된다.
    const picked = pickBestPoiMatch(
      [
        { tmapPoiId: '10051350', name: '경복궁 주차장', latitude: 37.57714741, longitude: 126.97885402 },
        { tmapPoiId: '362105', name: '경복궁', latitude: 37.57806394, longitude: 126.97688195 },
      ],
      target,
    );
    expect(picked).toBe('362105');
  });

  it('TourAPI가 지역 접두사·대괄호 표기를 붙여도 본 시설을 고른다', () => {
    // 실제 사례: TourAPI "전북 전주 한옥마을 [슬로시티]" ↔ TMAP "전주한옥마을"(130m).
    // 관광안내소가 7m로 훨씬 가깝지만 SK 혼잡도는 본 시설만 커버한다.
    const picked = pickBestPoiMatch(
      [
        { tmapPoiId: '1555653', name: '전주한옥마을 관광안내소', latitude: 35.81821389, longitude: 127.15363618 },
        { tmapPoiId: '8846569', name: '전주한옥마을 1공영주차장', latitude: 35.81860274, longitude: 127.1539417 },
        { tmapPoiId: '737851', name: '전주한옥마을', latitude: 35.81724177, longitude: 127.15294182 },
      ],
      { name: '전북 전주 한옥마을 [슬로시티]', coordinate: { latitude: 35.8182727649, longitude: 127.1536126138 } },
    );
    expect(picked).toBe('737851');
  });

  it('정확히 맞는 이름이 없으면 포함 관계를 우선한다', () => {
    const picked = pickBestPoiMatch(
      [
        { tmapPoiId: 'parking', name: '경복궁 주차장', latitude: 37.5761, longitude: 126.9767 },
        { tmapPoiId: 'main', name: '경복궁', latitude: 37.5765, longitude: 126.977 },
      ],
      { name: '경복궁(사적)', coordinate: GYEONGBOKGUNG },
    );
    expect(picked).toBe('main');
  });

  it('이름 등급이 같으면 가까운 쪽을 고른다', () => {
    const picked = pickBestPoiMatch(
      [
        { tmapPoiId: 'far', name: '경복궁', latitude: 37.5785, longitude: 126.9767 },
        { tmapPoiId: 'near', name: '경복궁', latitude: 37.5762, longitude: 126.9767 },
      ],
      target,
    );
    expect(picked).toBe('near');
  });

  it('반경 밖만 있으면 억지로 잇지 않는다', () => {
    // 부산의 동명 상호 — 이름만 같다고 매칭하면 엉뚱한 혼잡도를 보여주게 된다.
    const picked = pickBestPoiMatch(
      [{ tmapPoiId: 'busan', name: '경복궁', latitude: 35.1796, longitude: 129.0756 }],
      target,
    );
    expect(picked).toBeNull();
  });

  it('좌표가 없는 후보는 건너뛴다', () => {
    expect(
      pickBestPoiMatch(
        [{ tmapPoiId: 'no-coord', name: '경복궁', latitude: null, longitude: null }],
        target,
      ),
    ).toBeNull();
  });
});

describe('resolveTmapPoiId', () => {
  it('이름+좌표가 맞는 POI의 id를 반환한다', async () => {
    await expect(resolveTmapPoiId('126508')).resolves.toBe('362105');
    expect(fetchPoiSearchMock).toHaveBeenCalledWith('경복궁', { count: 5 });
  });

  it('두 번째 호출은 캐시로 답하고 외부 API를 다시 부르지 않는다', async () => {
    await resolveTmapPoiId('126508');
    await resolveTmapPoiId('126508');

    expect(fetchTourPlaceDetailMock).toHaveBeenCalledTimes(1);
    expect(fetchPoiSearchMock).toHaveBeenCalledTimes(1);
  });

  it('매칭 실패도 캐시한다(같은 장소로 쿼터를 반복 소모하지 않도록)', async () => {
    fetchPoiSearchMock.mockResolvedValue(
      poiSearch([{ id: '999', name: '경복궁', noorLat: '35.1796', noorLon: '129.0756' }]),
    );

    await expect(resolveTmapPoiId('126508')).resolves.toBeNull();
    await expect(resolveTmapPoiId('126508')).resolves.toBeNull();
    expect(fetchTourPlaceDetailMock).toHaveBeenCalledTimes(1);
  });

  it('상세에 좌표가 없으면 이름만으로 잇지 않고 null', async () => {
    fetchTourPlaceDetailMock.mockResolvedValue(
      tourDetail({ contentid: '126508', title: '경복궁', mapx: '', mapy: '' }),
    );

    await expect(resolveTmapPoiId('126508')).resolves.toBeNull();
    expect(fetchPoiSearchMock).not.toHaveBeenCalled();
  });

  it('상세 항목이 없으면 null', async () => {
    fetchTourPlaceDetailMock.mockResolvedValue(tourDetail(null));

    await expect(resolveTmapPoiId('126508')).resolves.toBeNull();
    expect(fetchPoiSearchMock).not.toHaveBeenCalled();
  });
});
