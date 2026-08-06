import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ConcentrationForecastListResponse } from './prediction.dto';

/**
 * 집중률 예측 클라이언트 테스트. 실제 네트워크·실제 키를 쓰지 않는다(TEST_KEY 고정).
 */

const { FAKE_KEY, requestJsonMock } = vi.hoisted(() => ({
  FAKE_KEY: 'TEST_KEY_PREDICTION',
  requestJsonMock: vi.fn(),
}));

vi.mock('../common', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../common')>();
  return {
    ...actual,
    externalConfig: {
      ...actual.externalConfig,
      prediction: {
        baseUrl: 'https://apis.data.go.kr/B551011/TatsCnctrRateService',
        apiKey: FAKE_KEY,
      },
    },
    requestJson: (...args: unknown[]) => requestJsonMock(...args),
  };
});

import { ExternalApiError } from '../common/external-api.error';
import {
  buildForecastQuery,
  fetchConcentrationForecast,
  normalizeForecastResponse,
} from './prediction.client';

function response(resultCode: string, items: unknown = ''): ConcentrationForecastListResponse {
  return {
    response: {
      header: { resultCode, resultMsg: 'OK' },
      body: { items: items as ConcentrationForecastListResponse['response']['body']['items'], numOfRows: 0, pageNo: 1, totalCount: 0 },
    },
  };
}

beforeEach(() => {
  requestJsonMock.mockReset();
  requestJsonMock.mockResolvedValue(response('0000'));
});

describe('buildForecastQuery', () => {
  it('필수 파라미터(areaCd/signguCd)가 없으면 즉시 입력 오류', () => {
    expect(() => buildForecastQuery({ areaCd: '', signguCd: '11110' })).toThrow(ExternalApiError);
    expect(() => buildForecastQuery({ areaCd: '11', signguCd: '  ' })).toThrow(ExternalApiError);
  });

  it('선택 파라미터(tAtsNm)는 값이 있을 때만 포함한다', () => {
    expect(buildForecastQuery({ areaCd: 11, signguCd: 11110 })).not.toHaveProperty('tAtsNm');
    expect(buildForecastQuery({ areaCd: 11, signguCd: 11110, tAtsNm: '경복궁' })).toMatchObject({
      areaCd: '11',
      signguCd: '11110',
      tAtsNm: '경복궁',
    });
  });
});

describe('fetchConcentrationForecast', () => {
  it('정확한 오퍼레이션 경로(tatsCnctrRatedList)와 공통 파라미터로 호출한다', async () => {
    await fetchConcentrationForecast({ areaCd: 11, signguCd: 11110 });

    const { url } = requestJsonMock.mock.calls[0][0] as { url: string };
    const parsed = new URL(url);
    expect(parsed.pathname).toBe('/B551011/TatsCnctrRateService/tatsCnctrRatedList');
    expect(parsed.searchParams.get('MobileOS')).toBe('ETC');
    expect(parsed.searchParams.get('MobileApp')).toBe('teumta');
    expect(parsed.searchParams.get('_type')).toBe('json');
    expect(parsed.searchParams.get('areaCd')).toBe('11');
    expect(parsed.searchParams.get('signguCd')).toBe('11110');
  });

  it('필수 파라미터 누락 시 외부 API를 호출하지 않는다', async () => {
    await expect(fetchConcentrationForecast({ areaCd: '', signguCd: '' })).rejects.toThrow(
      ExternalApiError,
    );
    expect(requestJsonMock).not.toHaveBeenCalled();
  });
});

describe('normalizeForecastResponse', () => {
  it("정상 코드 '0000'과 '00'을 모두 허용한다", () => {
    expect(() => normalizeForecastResponse(response('0000'))).not.toThrow();
    expect(() => normalizeForecastResponse(response('00'))).not.toThrow();
  });

  it("'03'(데이터 없음)은 빈 목록으로 정규화한다", () => {
    const normalized = normalizeForecastResponse(response('03'));
    expect(normalized.response.body.items).toBe('');
    expect(normalized.response.body.totalCount).toBe(0);
  });

  it('JSON 논리 오류(예: 10 잘못된 요청)는 빈 결과로 숨기지 않고 오류를 던진다', () => {
    expect(() => normalizeForecastResponse(response('10'))).toThrow(ExternalApiError);
  });

  it('인증 오류(30)는 AUTH_FAILED 코드로 변환한다', () => {
    try {
      normalizeForecastResponse(response('30'));
      expect.unreachable('should have thrown');
    } catch (error) {
      expect((error as ExternalApiError).code).toBe('AUTH_FAILED');
      expect((error as Error).message).not.toContain('TEST_KEY');
    }
  });
});
