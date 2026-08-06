import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  ExternalApiAuthError,
  ExternalApiRateLimitError,
  ExternalApiResponseError,
} from './external-api.error';
import { requestJson } from './http-client';
import { normalizeResultCode, normalizeServiceKey, parsePublicDataXmlError } from './public-data';

/**
 * 공통 HTTP 클라이언트 테스트. 실제 네트워크·실제 키를 쓰지 않는다.
 * 공공데이터포털은 _type=json 요청에도 XML 오류 봉투를 반환할 수 있다.
 */

const FAKE_URL = 'https://apis.example.invalid/op?serviceKey=TEST_KEY&_type=json';

const AUTH_ERROR_XML = `<OpenAPI_ServiceResponse>
  <cmmMsgHeader>
    <errMsg>SERVICE ERROR</errMsg>
    <returnAuthMsg>SERVICE_KEY_IS_NOT_REGISTERED_ERROR</returnAuthMsg>
    <returnReasonCode>30</returnReasonCode>
  </cmmMsgHeader>
</OpenAPI_ServiceResponse>`;

const RATE_LIMIT_XML = `<OpenAPI_ServiceResponse>
  <cmmMsgHeader>
    <errMsg>SERVICE ERROR</errMsg>
    <returnAuthMsg>LIMITED_NUMBER_OF_SERVICE_REQUESTS_EXCEEDS_ERROR</returnAuthMsg>
    <returnReasonCode>22</returnReasonCode>
  </cmmMsgHeader>
</OpenAPI_ServiceResponse>`;

function mockFetchResponse(body: string, contentType: string, status = 200): void {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(
      new Response(body, { status, headers: { 'Content-Type': contentType } }),
    ),
  );
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('requestJson', () => {
  it('정상 JSON은 파싱해 반환한다', async () => {
    mockFetchResponse('{"ok":true}', 'application/json;charset=UTF-8');
    await expect(requestJson({ service: 'tour', url: FAKE_URL })).resolves.toEqual({ ok: true });
  });

  it('XML 인증 오류 봉투(30)는 ExternalApiAuthError로 변환한다', async () => {
    mockFetchResponse(AUTH_ERROR_XML, 'application/xml');
    await expect(requestJson({ service: 'tour', url: FAKE_URL })).rejects.toBeInstanceOf(
      ExternalApiAuthError,
    );
  });

  it('XML 요청 제한 오류 봉투(22)는 ExternalApiRateLimitError로 변환한다', async () => {
    mockFetchResponse(RATE_LIMIT_XML, 'application/xml');
    await expect(requestJson({ service: 'prediction', url: FAKE_URL })).rejects.toBeInstanceOf(
      ExternalApiRateLimitError,
    );
  });

  it('Content-Type이 JSON이어도 본문이 XML이면 오류 봉투로 처리한다', async () => {
    mockFetchResponse(AUTH_ERROR_XML, 'application/json');
    await expect(requestJson({ service: 'tour', url: FAKE_URL })).rejects.toBeInstanceOf(
      ExternalApiAuthError,
    );
  });

  it('오류 봉투 형태가 아닌 XML은 ExternalApiResponseError', async () => {
    mockFetchResponse('<html><body>gateway</body></html>', 'text/html');
    await expect(requestJson({ service: 'tour', url: FAKE_URL })).rejects.toBeInstanceOf(
      ExternalApiResponseError,
    );
  });

  it('JSON 파싱 실패는 ExternalApiResponseError', async () => {
    mockFetchResponse('not-json', 'application/json');
    await expect(requestJson({ service: 'tour', url: FAKE_URL })).rejects.toBeInstanceOf(
      ExternalApiResponseError,
    );
  });

  it('오류 message에 URL/serviceKey/원문 본문을 포함하지 않는다', async () => {
    mockFetchResponse(AUTH_ERROR_XML, 'application/xml');
    try {
      await requestJson({ service: 'tour', url: FAKE_URL });
      expect.unreachable('should have thrown');
    } catch (error) {
      const message = (error as Error).message;
      expect(message).not.toContain('TEST_KEY');
      expect(message).not.toContain(FAKE_URL);
      expect(message).not.toContain('OpenAPI_ServiceResponse');
    }
  });
});

describe('parsePublicDataXmlError', () => {
  it('returnReasonCode/returnAuthMsg를 추출한다', () => {
    expect(parsePublicDataXmlError(AUTH_ERROR_XML)).toEqual({
      resultCode: '30',
      resultMsg: 'SERVICE_KEY_IS_NOT_REGISTERED_ERROR',
    });
  });

  it('resultCode/resultMsg 형태도 추출한다', () => {
    const xml = '<response><header><resultCode>03</resultCode><resultMsg>NODATA_ERROR</resultMsg></header></response>';
    expect(parsePublicDataXmlError(xml)).toEqual({ resultCode: '03', resultMsg: 'NODATA_ERROR' });
  });

  it('코드가 없으면 null', () => {
    expect(parsePublicDataXmlError('<html>oops</html>')).toBeNull();
  });
});

describe('normalizeServiceKey', () => {
  it('Encoding 키(%XX 포함)는 한 번 디코딩한다', () => {
    expect(normalizeServiceKey('TEST%2BKEY%2F%3D%3D')).toBe('TEST+KEY/==');
  });

  it('Decoding 키(원본)는 그대로 통과한다', () => {
    expect(normalizeServiceKey('TEST+KEY/==')).toBe('TEST+KEY/==');
  });

  it('잘못된 % 시퀀스는 그대로 둔다', () => {
    expect(normalizeServiceKey('TEST%ZZKEY')).toBe('TEST%ZZKEY');
  });
});

describe('normalizeResultCode', () => {
  it('자릿수 표기를 두 자리 기준으로 정규화한다', () => {
    expect(normalizeResultCode('0000')).toBe('0');
    expect(normalizeResultCode('00')).toBe('00');
    expect(normalizeResultCode('0003')).toBe('03');
    expect(normalizeResultCode('30')).toBe('30');
  });
});
