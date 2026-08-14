import { describe, expect, it } from 'vitest';

import { ExternalApiResponseError } from '../common/external-api.error';
import type { TmapRouteResponse } from './tmap.dto';
import {
  extractRoutePath,
  extractRouteSummary,
  mapPoiSearchToDestinations,
  mapTmapRouteToRouteCalculation,
} from './tmap.mapper';

function routeWith(totalDistance: number | undefined, totalTime: number | undefined): TmapRouteResponse {
  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [126.9, 37.5] },
        properties: { totalDistance, totalTime, index: 0, pointType: 'SP' },
      },
      {
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: [[126.9, 37.5], [126.91, 37.51]] },
        properties: { distance: 100, time: 60, index: 1 },
      },
    ],
  };
}

const SAMPLE_PATH = [
  { latitude: 37.5, longitude: 126.9 },
  { latitude: 37.51, longitude: 126.91 },
];

describe('extractRoutePath', () => {
  it('LineString 좌표를 [경도,위도]→{latitude,longitude}로 변환', () => {
    expect(extractRoutePath(routeWith(1250, 900))).toEqual(SAMPLE_PATH);
  });

  it('여러 LineString을 이어붙이고 구간 경계의 중복 좌표는 한 번만 남긴다', () => {
    const response: TmapRouteResponse = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: { type: 'LineString', coordinates: [[126.9, 37.5], [126.91, 37.51]] },
          properties: { distance: 100, time: 60, index: 0 },
        },
        {
          type: 'Feature',
          geometry: { type: 'LineString', coordinates: [[126.91, 37.51], [126.92, 37.52]] },
          properties: { distance: 100, time: 60, index: 1 },
        },
      ],
    };
    expect(extractRoutePath(response)).toEqual([
      { latitude: 37.5, longitude: 126.9 },
      { latitude: 37.51, longitude: 126.91 },
      { latitude: 37.52, longitude: 126.92 },
    ]);
  });

  it('LineString이 없으면 빈 배열', () => {
    const response: TmapRouteResponse = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [126.9, 37.5] },
          properties: { totalDistance: 100, totalTime: 60, index: 0, pointType: 'SP' },
        },
      ],
    };
    expect(extractRoutePath(response)).toEqual([]);
  });
});

describe('extractRouteSummary', () => {
  it('요약 feature에서 거리(m)·시간(초→분)·경로 도형을 추출', () => {
    expect(extractRouteSummary(routeWith(1250, 900))).toEqual({
      travelMinutes: 15,
      distanceMeters: 1250,
      path: SAMPLE_PATH,
    });
  });

  it('초를 분으로 반올림', () => {
    expect(extractRouteSummary(routeWith(500, 90)).travelMinutes).toBe(2); // 1.5분 → 2
  });

  it('요약 feature가 없으면 ExternalApiResponseError', () => {
    expect(() => extractRouteSummary(routeWith(undefined, undefined))).toThrow(ExternalApiResponseError);
  });
});

describe('mapTmapRouteToRouteCalculation', () => {
  it('단일 구간 RouteCalculationData로 변환', () => {
    expect(mapTmapRouteToRouteCalculation(routeWith(1250, 900))).toEqual({
      totalDurationMinutes: 15,
      totalDistanceMeters: 1250,
      segments: [{ travelMinutes: 15, distanceMeters: 1250, path: SAMPLE_PATH }],
    });
  });
});

describe('mapPoiSearchToDestinations', () => {
  /** TMAP은 같은 장소의 출입구·주차장을 별도 POI로 주면서 id는 공유한다(pkey로만 구분). */
  const DUPLICATE_ID_RESPONSE = {
    searchPoiInfo: {
      pois: {
        poi: [
          { id: '736655', pkey: '73665500', name: '교보문고 강남점', noorLat: '37.5036', noorLon: '127.0242' },
          { id: '736655', pkey: '73665501', name: '교보문고 강남점 주차장', noorLat: '37.5037', noorLon: '127.0238' },
          { id: '736655', pkey: '73665502', name: '교보문고 강남점 정문', noorLat: '37.5038', noorLon: '127.0239' },
          { id: '5985039', pkey: '598503901', name: '폴바셋 교보문고강남점', noorLat: '37.5035', noorLon: '127.0241' },
        ],
      },
    },
  };

  it('id가 같은 POI는 첫 항목만 남긴다(목적지 식별자가 id라 중복되면 구분 불가)', () => {
    const results = mapPoiSearchToDestinations(DUPLICATE_ID_RESPONSE);

    expect(results.map((result) => result.tmapPoiId)).toEqual(['736655', '5985039']);
    expect(results[0].name).toBe('교보문고 강남점');
  });

  it('좌표 없는 POI는 제외하고, 그 id는 중복 판정에 쓰지 않는다', () => {
    const results = mapPoiSearchToDestinations({
      searchPoiInfo: {
        pois: {
          poi: [
            { id: '1', name: '좌표없음' },
            { id: '1', name: '좌표있음', noorLat: '37.5', noorLon: '127.0' },
          ],
        },
      },
    });

    expect(results).toHaveLength(1);
    expect(results[0].name).toBe('좌표있음');
  });
});
