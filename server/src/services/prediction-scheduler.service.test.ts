import { describe, expect, it } from 'vitest';

import { msUntilNextKstHour, parseIngestTargets } from './prediction-scheduler.service';

describe('parseIngestTargets', () => {
  it('"areaCd:signguCd" 쉼표 구분 문자열을 파싱한다', () => {
    expect(parseIngestTargets('11:11110,26:26350')).toEqual([
      { areaCd: '11', signguCd: '11110' },
      { areaCd: '26', signguCd: '26350' },
    ]);
  });

  it('빈 문자열이면 빈 배열(스케줄러 비활성)', () => {
    expect(parseIngestTargets('')).toEqual([]);
    expect(parseIngestTargets('  ')).toEqual([]);
  });

  it('형식이 잘못된 항목은 무시하고 나머지만 반환한다', () => {
    expect(parseIngestTargets('11:11110,bad,26:,:'.trim())).toEqual([
      { areaCd: '11', signguCd: '11110' },
    ]);
  });

  it('공백을 허용한다', () => {
    expect(parseIngestTargets(' 11 : 11110 , 26:26350 ')).toEqual([
      { areaCd: '11', signguCd: '11110' },
      { areaCd: '26', signguCd: '26350' },
    ]);
  });
});

describe('msUntilNextKstHour', () => {
  it('당일 실행 시각 이전이면 오늘 시각까지 남은 ms', () => {
    // 2026-08-06 03:00 KST = 2026-08-05T18:00Z → 05시 KST까지 2시간
    const now = new Date('2026-08-05T18:00:00Z');
    expect(msUntilNextKstHour(5, now)).toBe(2 * 60 * 60 * 1000);
  });

  it('실행 시각을 지났으면 다음 날 시각까지 남은 ms', () => {
    // 2026-08-06 06:00 KST → 다음 날 05시 KST까지 23시간
    const now = new Date('2026-08-05T21:00:00Z');
    expect(msUntilNextKstHour(5, now)).toBe(23 * 60 * 60 * 1000);
  });

  it('정확히 실행 시각이면 다음 날로 넘어간다', () => {
    // 2026-08-06 05:00 KST
    const now = new Date('2026-08-05T20:00:00Z');
    expect(msUntilNextKstHour(5, now)).toBe(24 * 60 * 60 * 1000);
  });
});
