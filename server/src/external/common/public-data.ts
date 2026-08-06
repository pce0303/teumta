import {
  ExternalApiAuthError,
  ExternalApiError,
  ExternalApiRateLimitError,
  ExternalApiResponseError,
} from './external-api.error';

/**
 * 공공데이터포털 공통 응답 처리. 게이트웨이는 _type=json 요청에도 XML 오류 봉투
 * (cmmMsgHeader/returnReasonCode)를 반환할 수 있다 — 구조가 고정적이라 태그 추출로 충분(파서 불필요).
 * 오류 message에 원문 본문·URL·serviceKey는 넣지 않는다.
 */

/** 서비스별 응답 header(resultCode/resultMsg). TourAPI·집중률 예측 API가 같은 구조를 쓴다. */
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
 * serviceKey 정규화. 포털의 Encoding 키(%2B 등 포함)는 한 번 디코딩해 원본으로 만든다
 * (URLSearchParams가 다시 인코딩하므로 그대로 쓰면 이중 인코딩). Decoding 키는 그대로 통과.
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

/** 본문이 XML 오류 봉투로 보이는지 판별한다(Content-Type 또는 첫 문자 기준). */
export function looksLikeXml(contentType: string | null, bodyText: string): boolean {
  if (contentType && /xml/i.test(contentType)) {
    return true;
  }
  return bodyText.trimStart().startsWith('<');
}

/** XML 오류 봉투에서 결과 코드/사유를 추출한다. 형태가 다르면 null. */
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
 * 공공데이터포털 결과 코드를 오류 계층으로 분류한다.
 * 정상 코드 판정은 서비스별로 다르므로(0000 vs 00) 호출부에서 먼저 걸러낸 뒤 사용한다.
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

/** '0000'/'03' 등 자릿수 표기가 섞여 오는 코드를 두 자리 기준으로 정규화한다('0003' → '03'). */
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
