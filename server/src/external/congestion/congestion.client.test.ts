import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * SK 퍼즐 클라이언트 테스트. 실제 네트워크·실제 키를 쓰지 않는다.
 * 커버리지 밖 POI는 HTTP 400 + error 봉투로 오는데, 이는 연동 장애가 아니라 "데이터 없음"이다.
 */

const { requestJsonMock } = vi.hoisted(() => ({ requestJsonMock: vi.fn() }));

vi.mock('../common', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../common')>();
  return {
    ...actual,
    externalConfig: {
      ...actual.externalConfig,
      congestion: {
        baseUrl: 'https://apis.example.invalid/puzzle',
        apiKey: 'TEST_APP_KEY',
      },
    },
    requestJson: (...args: unknown[]) => requestJsonMock(...args),
  };
});

import {
  ExternalApiNotFoundError,
  ExternalApiResponseError,
} from '../common/external-api.error';
import { fetchRealtimeCongestion } from './congestion.client';

beforeEach(() => {
  requestJsonMock.mockReset();
});

describe('fetchRealtimeCongestion', () => {
  it('정상 응답(status.code=00)은 그대로 반환한다', async () => {
    const payload = {
      status: { code: '00', message: 'success' },
      contents: { poiId: '362105', rltm: [{ datetime: '20260814165000', congestionLevel: 1, type: 1 }] },
    };
    requestJsonMock.mockResolvedValue(payload);

    await expect(fetchRealtimeCongestion('362105')).resolves.toEqual(payload);
  });

  it('4xx 본문을 읽을 수 있도록 acceptStatuses를 넘긴다', async () => {
    requestJsonMock.mockResolvedValue({ status: { code: '00', message: 'ok' } });

    await fetchRealtimeCongestion('362105');

    expect(requestJsonMock.mock.calls[0][0]).toMatchObject({
      service: 'congestion',
      acceptStatuses: [400, 404],
    });
  });

  it('NOT_FOUND_POI는 장애가 아니라 데이터 없음이므로 NotFound 오류', async () => {
    requestJsonMock.mockResolvedValue({ error: { code: '404', message: 'NOT_FOUND_POI' } });

    const caught = await fetchRealtimeCongestion('736655').catch((error: unknown) => error);

    expect(caught).toBeInstanceOf(ExternalApiNotFoundError);
    expect((caught as ExternalApiNotFoundError).code).toBe('CONGESTION_DATA_NOT_FOUND');
  });

  it('그 외 error 봉투는 응답 오류로 처리한다', async () => {
    requestJsonMock.mockResolvedValue({ error: { code: '500', message: 'INTERNAL' } });

    await expect(fetchRealtimeCongestion('1')).rejects.toBeInstanceOf(ExternalApiResponseError);
  });

  it('status.code가 00이 아니면 응답 오류로 처리한다', async () => {
    requestJsonMock.mockResolvedValue({ status: { code: '99', message: 'fail' } });

    await expect(fetchRealtimeCongestion('1')).rejects.toBeInstanceOf(ExternalApiResponseError);
  });
});
