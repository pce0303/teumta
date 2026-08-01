import { describe, expect, it } from 'vitest';

import { ExternalApiResponseError } from '../common/external-api.error';
import type { TmapRouteResponse } from './tmap.dto';
import { extractRoutePath, extractRouteSummary, mapTmapRouteToRouteCalculation } from './tmap.mapper';

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
