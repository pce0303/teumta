import {
  KTO_CONCENTRATION_FORECAST_SOURCE,
  type ConcentrationForecastData,
} from '../../dtos';
import { ExternalApiResponseError } from '../common';
import type {
  ConcentrationForecastListResponse,
  KtoConcentrationForecastItem,
} from './prediction.dto';

/**
 * 집중률 예측 원본 → ConcentrationForecastData.
 * 날짜별 예측이라 level·score 변환 없음(공식 등급 임계값 부재).
 * baseYmd(KST)는 +09:00 자정으로 변환해 하루 밀림 방지.
 */

const SERVICE = 'prediction';

/** 목록 변환 결과. 형식 불량 항목은 전체 실패 대신 skip 집계. */
export interface ConcentrationForecastMapResult {
  forecasts: ConcentrationForecastData[];
  skipped: { tAtsNm: string; baseYmd: string; reason: string }[];
}

/** 목록 응답 전체 → ConcentrationForecastData[] + skip 집계. */
export function mapConcentrationForecast(
  response: ConcentrationForecastListResponse,
): ConcentrationForecastMapResult {
  const forecasts: ConcentrationForecastData[] = [];
  const skipped: ConcentrationForecastMapResult['skipped'] = [];

  for (const item of extractForecastItems(response)) {
    try {
      forecasts.push(mapConcentrationForecastItem(item));
    } catch (error) {
      skipped.push({
        tAtsNm: String(item.tAtsNm ?? 'unknown'),
        baseYmd: String(item.baseYmd ?? 'unknown'),
        reason: error instanceof Error ? error.message : 'unknown error',
      });
    }
  }
  return { forecasts, skipped };
}

/** 항목 배열 안전 추출 — items="" 또는 단일 객체 케이스 방어. */
export function extractForecastItems(
  response: ConcentrationForecastListResponse,
): KtoConcentrationForecastItem[] {
  const items = response.response?.body?.items;
  if (!items) {
    return [];
  }
  const item = items.item;
  if (Array.isArray(item)) {
    return item;
  }
  return item ? [item] : [];
}

export function mapConcentrationForecastItem(
  item: KtoConcentrationForecastItem,
): ConcentrationForecastData {
  const { forecastDate, predictedFor } = parseBaseYmd(item.baseYmd);
  return {
    forecastDate,
    predictedFor,
    concentrationRate: parseConcentrationRate(item.cnctrRate),
    areaCd: String(item.areaCd ?? '').trim(),
    signguCd: String(item.signguCd ?? '').trim(),
    tAtsNm: String(item.tAtsNm ?? '').trim(),
    source: KTO_CONCENTRATION_FORECAST_SOURCE,
  };
}

/** baseYmd(YYYYMMDD, KST 달력 날짜) → forecastDate("YYYY-MM-DD") + KST 자정 Date. */
function parseBaseYmd(baseYmd: unknown): { forecastDate: string; predictedFor: Date } {
  const raw = String(baseYmd ?? '').trim();
  if (!/^\d{8}$/.test(raw)) {
    throw new ExternalApiResponseError(SERVICE, `Invalid baseYmd "${raw}"`);
  }
  const year = raw.slice(0, 4);
  const month = raw.slice(4, 6);
  const day = raw.slice(6, 8);
  const forecastDate = `${year}-${month}-${day}`;

  // KST 자정 고정 — UTC 변환 시 예측일이 하루 밀리지 않게
  const predictedFor = new Date(`${forecastDate}T00:00:00+09:00`);
  if (Number.isNaN(predictedFor.getTime())) {
    throw new ExternalApiResponseError(SERVICE, `Invalid baseYmd "${raw}"`);
  }
  // new Date는 '20260231'을 3월로 넘겨 해석 → 달력 날짜와 재대조 필요
  const kstCheck = new Date(predictedFor.getTime() + 9 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  if (kstCheck !== forecastDate) {
    throw new ExternalApiResponseError(SERVICE, `Invalid baseYmd "${raw}"`);
  }
  return { forecastDate, predictedFor };
}

/**
 * cnctrRate → 소수 문자열. Number로 유효성만 검증하고 원본 정밀도 보존을 위해
 * 문자열 그대로 유지(Prisma Decimal에 문자열 전달).
 */
function parseConcentrationRate(value: string | number | undefined): string {
  const raw = typeof value === 'number' ? String(value) : String(value ?? '').trim();
  const parsed = Number(raw);
  if (raw.length === 0 || !Number.isFinite(parsed)) {
    throw new ExternalApiResponseError(SERVICE, `Invalid cnctrRate "${raw}"`);
  }
  return raw;
}
