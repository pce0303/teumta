import {
  ExternalApiAuthError,
  ExternalApiError,
  ExternalApiRateLimitError,
  ExternalApiResponseError,
} from './external-api.error';

/**
 * 공공데이터포털 공통 응답 처리.
 * 게이트웨이는 _type=json 요청에도 XML 오류 봉투(cmmMsgHeader/returnReasonCode)를 반환할 수 있음
 * — 구조가 고정이라 태그 추출로 충분(파서 불필요).
 * 오류 message에 원문 본문·URL·serviceKey 포함 금지.
 */

/** 응답 header(resultCode/resultMsg). TourAPI·집중률 예측 API 공통 구조. */
export interface PublicDataResponseHeader {
  resultCode: string;
  resultMsg: string;
}

export interface PublicDataXmlErrorEnvelope {
  resultCode: string;
  resultMsg: string;
}

/** 인증/키 계열 결과 코드. 20 접근거부, 21 일시중지 키, 30 미등록 키, 31 기간만료, 32 미등록 IP, 33 서명되지 않은 호출. */
const AUTH_RESULT_CODES = new Set(['20', '21', '30', '31', '32', '33']);
/** 22: 서비스 요청제한 횟수 초과. */
const RATE_LIMIT_RESULT_CODE = '22';

/**
 * 결과 헤더 추출. 정상·일부 오류는 response.header,
 * 파라미터 오류 등은 최상위 {resultCode, resultMsg} flat 형태(실응답 확인).
 */
export function extractPublicDataHeader(payload: unknown): PublicDataResponseHeader | null {
  if (typeof payload !== 'object' || payload === null) {
    return null;
  }
  const root = payload as Record<string, unknown>;
  const nested = (root.response as Record<string, unknown> | undefined)?.header as
    | PublicDataResponseHeader
    | undefined;
  if (nested?.resultCode !== undefined) {
    return { resultCode: String(nested.resultCode), resultMsg: String(nested.resultMsg ?? '') };
  }
  if (root.resultCode !== undefined) {
    return { resultCode: String(root.resultCode), resultMsg: String(root.resultMsg ?? '') };
  }
  return extractGatewayErrorHeader(root);
}

/**
 * 게이트웨이 오류 봉투(`OpenAPI_ServiceResponse.cmmMsgHeader`)에서 결과 코드 추출.
 *
 * 포털은 키 오류·요청제한 초과를 XML뿐 아니라 **JSON**으로도 내려줌(실응답 확인, 2026-08-14).
 * 못 읽으면 resultCode가 'UNKNOWN' → 인증 실패·쿼터 초과가 전부 INVALID_RESPONSE(502)로 뭉개져
 * 운영에서 원인 추적 불가.
 */
function extractGatewayErrorHeader(root: Record<string, unknown>): PublicDataResponseHeader | null {
  const envelope = root.OpenAPI_ServiceResponse as Record<string, unknown> | undefined;
  const header = envelope?.cmmMsgHeader as Record<string, unknown> | undefined;
  if (header?.returnReasonCode === undefined) {
    return null;
  }
  return {
    resultCode: String(header.returnReasonCode),
    resultMsg: String(header.returnAuthMsg ?? header.errMsg ?? 'Unknown error'),
  };
}

/**
 * serviceKey 정규화. Encoding 키(%2B 등)는 한 번 디코딩해 원본으로 —
 * URLSearchParams가 다시 인코딩하므로 그대로 쓰면 이중 인코딩. Decoding 키는 통과.
 */
export function normalizeServiceKey(key: string): string {
  if (!/%[0-9A-Fa-f]{2}/.test(key)) {
    return key;
  }
  try {
    return decodeURIComponent(key);
  } catch {
    return key;
  }
}

/** 본문이 XML 오류 봉투인지 판별(Content-Type 또는 첫 문자 기준). */
export function looksLikeXml(contentType: string | null, bodyText: string): boolean {
  if (contentType && /xml/i.test(contentType)) {
    return true;
  }
  return bodyText.trimStart().startsWith('<');
}

/** XML 오류 봉투 → 결과 코드·사유. 형태가 다르면 null. */
export function parsePublicDataXmlError(xml: string): PublicDataXmlErrorEnvelope | null {
  const code = extractTagText(xml, 'returnReasonCode') ?? extractTagText(xml, 'resultCode');
  if (!code) {
    return null;
  }
  const message =
    extractTagText(xml, 'returnAuthMsg') ??
    extractTagText(xml, 'resultMsg') ??
    extractTagText(xml, 'errMsg') ??
    'Unknown error';
  return { resultCode: code.trim(), resultMsg: message.trim() };
}

/**
 * 결과 코드 → 오류 계층 분류.
 * 정상 코드 판정은 서비스마다 다르므로(0000 vs 00) 호출부에서 먼저 거른 뒤 사용.
 */
export function classifyPublicDataResultCode(
  service: string,
  resultCode: string,
  resultMsg: string,
): ExternalApiError {
  const code = normalizeResultCode(resultCode);

  if (AUTH_RESULT_CODES.has(code)) {
    return new ExternalApiAuthError(service);
  }
  if (code === RATE_LIMIT_RESULT_CODE) {
    return new ExternalApiRateLimitError(service);
  }
  return new ExternalApiResponseError(
    service,
    `Public data API returned resultCode ${resultCode}: ${resultMsg}`,
  );
}

/** 자릿수가 섞여 오는 코드를 두 자리로 정규화('0003' → '03'). */
export function normalizeResultCode(resultCode: string): string {
  const trimmed = resultCode.trim();
  if (/^\d{3,}$/.test(trimmed)) {
    const stripped = trimmed.replace(/^0+/, '');
    return stripped.length === 0 ? '0' : stripped.padStart(2, '0');
  }
  return trimmed;
}

function extractTagText(xml: string, tagName: string): string | null {
  const match = xml.match(new RegExp(`<${tagName}>([^<]*)</${tagName}>`, 'i'));
  return match ? match[1] : null;
}
