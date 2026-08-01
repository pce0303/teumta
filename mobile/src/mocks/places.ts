import type { Place } from '@/types/place';

export const featuredPlaces: Place[] = [
  {
    id: 'gyeongbokgung',
    name: '경복궁',
    area: '서울 종로구',
    shortDescription: '궁궐 산책과 주변 골목 탐방을 함께 묶기 좋은 대표 관광지입니다.',
    description:
      '경복궁은 짧은 여유 시간에도 관람 동선이 명확하고 주변 이동 선택지가 많아 틈타 코스의 기준 관광지로 사용합니다.',
    congestionLevel: 'medium',
    congestionLabel: '보통',
    congestionMessage: '광화문 방향 입구가 붐빌 수 있어 국립민속박물관 방향 우회 진입을 추천합니다.',
    recommendedDurationMinutes: 70,
    detours: [
      {
        id: 'folk-museum-loop',
        name: '민속박물관 우회 루프',
        durationMinutes: 42,
        distanceKm: 2.1,
        description: '혼잡한 정문 구간을 피해 북촌 방향으로 둘러봐요.',
        stops: ['국립민속박물관', '북촌 입구', '경복궁'],
        stayMinutes: 30,
        coordinates: [
          { latitude: 37.5796, longitude: 126.977 },
          { latitude: 37.5811, longitude: 126.9792 },
          { latitude: 37.5828, longitude: 126.9821 },
        ],
      },
      {
        id: 'seochon-cafe-route',
        name: '서촌 카페 골목 코스',
        durationMinutes: 55,
        distanceKm: 2.8,
        description: '카페와 시장 골목을 가볍게 둘러봐요.',
        stops: ['서촌 카페거리', '통인시장', '경복궁'],
        stayMinutes: 40,
        coordinates: [
          { latitude: 37.5796, longitude: 126.977 },
          { latitude: 37.5782, longitude: 126.9734 },
          { latitude: 37.5763, longitude: 126.9707 },
        ],
      },
    ],
  },
  {
    id: 'seoul-forest',
    name: '서울숲',
    area: '서울 성동구',
    shortDescription: '넓은 산책로와 성수동 이동이 쉬운 도심 공원 코스입니다.',
    description: '서울숲은 출입구가 많아 실시간 혼잡도에 따라 코스를 유연하게 바꾸기 좋습니다.',
    congestionLevel: 'low',
    congestionLabel: '여유',
    congestionMessage: '주요 산책로가 여유로운 편입니다. 성수동 방향 이동을 함께 추천합니다.',
    recommendedDurationMinutes: 60,
    detours: [
      {
        id: 'ttukseom-link',
        name: '뚝섬 연결 코스',
        durationMinutes: 38,
        distanceKm: 1.9,
        description: '서울숲역 혼잡을 피해 뚝섬 방향으로 걸어요.',
        stops: ['서울숲 산책로', '뚝섬역 골목', '서울숲'],
        stayMinutes: 25,
        coordinates: [
          { latitude: 37.5444, longitude: 127.0374 },
          { latitude: 37.5468, longitude: 127.0435 },
          { latitude: 37.5472, longitude: 127.0474 },
        ],
      },
    ],
  },
  {
    id: 'namsan-tower',
    name: 'N서울타워',
    area: '서울 용산구',
    shortDescription: '전망대 방문 전후로 남산 산책 동선을 조합하기 좋은 관광지입니다.',
    description: 'N서울타워는 케이블카 대기가 길어질 수 있어 보행 우회 코스 선택이 중요합니다.',
    congestionLevel: 'high',
    congestionLabel: '혼잡',
    congestionMessage: '케이블카 탑승 대기가 길 수 있습니다. 남산순환로 도보 코스를 추천합니다.',
    recommendedDurationMinutes: 90,
    detours: [
      {
        id: 'walking-ring',
        name: '남산순환로 도보 코스',
        durationMinutes: 65,
        distanceKm: 3.2,
        description: '케이블카 대기를 피해 순환로로 전망을 즐겨요.',
        stops: ['남산순환로', '전망 포인트', 'N서울타워'],
        stayMinutes: 45,
        coordinates: [
          { latitude: 37.5512, longitude: 126.9882 },
          { latitude: 37.5496, longitude: 126.9916 },
          { latitude: 37.5517, longitude: 126.994 },
        ],
      },
    ],
  },
];

export function getMockPlaceById(id?: string) {
  return featuredPlaces.find((place) => place.id === id);
}

export type NearbyLocalPlace = {
  id: string;
  name: string;
  walkMinutes: number;
  stayMinutes: number;
  congestionLabel: string;
  description: string;
  /** 로컬 장소의 고정 좌표(사용자 위치 아님). 외부 지도 길찾기 목적지로 사용. */
  latitude: number;
  longitude: number;
  /** 이 장소를 지나는 틈타 코스(detour) id 목록. */
  detourIds: string[];
};

export const nearbyLocalPlacesByPlaceId: Record<string, NearbyLocalPlace[]> = {
  gyeongbokgung: [
    {
      id: 'seochon-cafe-street',
      name: '서촌 로컬 카페거리',
      walkMinutes: 6,
      stayMinutes: 40,
      congestionLabel: '여유',
      description:
        '경복궁 서쪽 담장 너머 한옥 골목 사이로 작은 카페와 공방이 이어지는 거리예요. 대기 줄 없이 들러 쉬어가기 좋아요.',
      latitude: 37.5794,
      longitude: 126.9707,
      detourIds: ['seochon-cafe-route'],
    },
    {
      id: 'tongin-market',
      name: '통인시장 골목',
      walkMinutes: 9,
      stayMinutes: 25,
      congestionLabel: '여유',
      description:
        '엽전 도시락으로 유명한 전통시장이에요. 골목을 따라 분식·반찬 가게를 구경하며 가볍게 한 바퀴 돌기 좋아요.',
      latitude: 37.5806,
      longitude: 126.9692,
      detourIds: ['seochon-cafe-route'],
    },
  ],
  'seoul-forest': [
    {
      id: 'seongsu-cafe-street',
      name: '성수동 카페거리',
      walkMinutes: 8,
      stayMinutes: 35,
      congestionLabel: '보통',
      description:
        '붉은 벽돌 공장 건물을 개조한 카페와 편집숍이 모여 있는 거리예요. 서울숲에서 천천히 걸어가며 동네 분위기를 즐겨보세요.',
      latitude: 37.5427,
      longitude: 127.0561,
      detourIds: [],
    },
    {
      id: 'understand-avenue',
      name: '언더스탠드에비뉴',
      walkMinutes: 5,
      stayMinutes: 30,
      congestionLabel: '여유',
      description:
        '컨테이너 건물로 지어진 복합문화공간이에요. 서울숲 입구 바로 옆이라 자투리 시간에 들르기 좋아요.',
      latitude: 37.5443,
      longitude: 127.0374,
      detourIds: ['ttukseom-link'],
    },
  ],
  'namsan-tower': [
    {
      id: 'sopa-road',
      name: '남산 소파길 산책로',
      walkMinutes: 7,
      stayMinutes: 20,
      congestionLabel: '여유',
      description:
        '남산 중턱을 따라 완만하게 이어지는 산책로예요. 케이블카 대기 없이 서울 시내 전망을 즐길 수 있어요.',
      latitude: 37.5535,
      longitude: 126.988,
      detourIds: ['walking-ring'],
    },
    {
      id: 'haebangchon-alley',
      name: '해방촌 카페골목',
      walkMinutes: 12,
      stayMinutes: 30,
      congestionLabel: '보통',
      description:
        '언덕길을 따라 개성 있는 카페와 독립서점이 이어지는 동네 골목이에요. 노을 무렵 풍경이 특히 좋아요.',
      latitude: 37.5453,
      longitude: 126.9873,
      detourIds: [],
    },
  ],
};

export function getNearbyLocalPlaces(placeId?: string): NearbyLocalPlace[] {
  return (placeId && nearbyLocalPlacesByPlaceId[placeId]) || [];
}

/** 로컬 장소 id로 로컬 장소와 그 기준 관광지(parent)를 함께 찾는다. */
export function getLocalPlaceById(
  localPlaceId?: string,
): { local: NearbyLocalPlace; parent: Place } | undefined {
  for (const [placeId, locals] of Object.entries(nearbyLocalPlacesByPlaceId)) {
    const local = locals.find((item) => item.id === localPlaceId);
    if (local) {
      const parent = getMockPlaceById(placeId);
      if (parent) {
        return { local, parent };
      }
    }
  }
  return undefined;
}
