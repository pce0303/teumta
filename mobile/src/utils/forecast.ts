import type { ConcentrationForecastEntry } from '@/types/place';

/**
 * 집중률 예측 해석.
 *
 * KTO는 혼잡 등급 임계값을 제공하지 않는다. 그래서 원본 값(예: 91.9)에 "혼잡" 같은 등급을 붙이면
 * 근거 없는 값을 만드는 셈이다. 대신 **분포 안에서의 상대 위치**로 읽는다 —
 * 중앙값 대비 얼마나 높은지, 앞으로 언제가 가장 한산한지. 이건 원본에서 그대로 나오는 사실이다.
 */

/** 중앙값 대비 이 비율(%) 이상 벗어나면 "붐빔/한산"으로 본다. 그 사이는 "비슷". */
const NOTABLE_DIFFERENCE_PERCENT = 15;

/** 그래프에 보여줄 일수. 30일 전부는 너무 촘촘하다. */
export const FORECAST_CHART_DAYS = 14;

export type ForecastTone = 'busy' | 'usual' | 'quiet';

export interface ForecastSummary {
  today: ConcentrationForecastEntry;
  /** 30일 중앙값. */
  median: number;
  /** 중앙값 대비 오늘의 차이(%). 양수면 평소보다 붐빔. */
  differenceFromMedian: number;
  tone: ForecastTone;
  /** 그래프용 앞으로 N일. */
  upcoming: ConcentrationForecastEntry[];
  /** upcoming 중 가장 한산한 날(오늘 제외). 오늘보다 낮을 때만 준다. */
  quietest: ConcentrationForecastEntry | null;
  /** quietest가 오늘보다 얼마나 낮은지(%). */
  quietestDropPercent: number;
}

function median(values: number[]): number {
  const sorted = [...values].sort((first, second) => first - second);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

/** 예측 목록(날짜 오름차순, 첫 항목이 오늘)을 화면에서 읽을 수 있는 형태로 요약한다. */
export function summarizeForecast(
  forecasts: ConcentrationForecastEntry[],
): ForecastSummary | null {
  if (forecasts.length === 0) {
    return null;
  }

  const today = forecasts[0];
  const rates = forecasts.map((entry) => entry.concentrationRate);
  const middle = median(rates);

  const differenceFromMedian =
    middle === 0 ? 0 : Math.round(((today.concentrationRate - middle) / middle) * 100);

  const tone: ForecastTone =
    differenceFromMedian >= NOTABLE_DIFFERENCE_PERCENT
      ? 'busy'
      : differenceFromMedian <= -NOTABLE_DIFFERENCE_PERCENT
        ? 'quiet'
        : 'usual';

  const upcoming = forecasts.slice(0, FORECAST_CHART_DAYS);
  const later = upcoming.slice(1);
  const lowest = later.reduce<ConcentrationForecastEntry | null>(
    (best, entry) => (best === null || entry.concentrationRate < best.concentrationRate ? entry : best),
    null,
  );

  const quietest =
    lowest && lowest.concentrationRate < today.concentrationRate ? lowest : null;
  const quietestDropPercent =
    quietest && today.concentrationRate > 0
      ? Math.round(((today.concentrationRate - quietest.concentrationRate) / today.concentrationRate) * 100)
      : 0;

  return {
    today,
    median: middle,
    differenceFromMedian,
    tone,
    upcoming,
    quietest,
    quietestDropPercent,
  };
}

/** 막대 높이 비율(0~1). 최저값도 보이도록 바닥을 남긴다. */
export function chartRatio(rate: number, entries: ConcentrationForecastEntry[]): number {
  const rates = entries.map((entry) => entry.concentrationRate);
  const min = Math.min(...rates);
  const max = Math.max(...rates);
  if (max === min) {
    return 1;
  }
  return 0.25 + ((rate - min) / (max - min)) * 0.75;
}

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

/** "2026-08-25" → "8월 25일(화)". */
export function formatForecastDate(forecastDate: string): string {
  const [year, month, day] = forecastDate.split('-').map(Number);
  const weekday = WEEKDAYS[new Date(year, month - 1, day).getDay()];
  return `${month}월 ${day}일(${weekday})`;
}

/** "2026-08-25" → "25". 그래프 눈금용. */
export function forecastDayLabel(forecastDate: string): string {
  return String(Number(forecastDate.split('-')[2]));
}
