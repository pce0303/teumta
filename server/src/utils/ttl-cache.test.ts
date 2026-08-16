import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { TtlCache } from './ttl-cache';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('TtlCache', () => {
  it('set한 값을 TTL 안에서 돌려준다', async () => {
    const cache = new TtlCache<string>(1000, 10);
    cache.set('a', 'value');
    await expect(cache.get('a')).resolves.toBe('value');
  });

  it('만료된 항목은 undefined를 주고 내부에서도 삭제한다', () => {
    const cache = new TtlCache<string>(1000, 10);
    cache.set('a', 'value');
    vi.advanceTimersByTime(1001);
    expect(cache.get('a')).toBeUndefined();
    expect(cache.size).toBe(0);
  });

  it('상한을 넘으면 가장 오래 안 쓴 키부터 밀어낸다', () => {
    const cache = new TtlCache<number>(10_000, 2);
    cache.set('a', 1);
    cache.set('b', 2);
    // a를 적중시켜 최근 사용으로 올린다 → 다음 제거 대상은 b
    void cache.get('a');
    cache.set('c', 3);
    expect(cache.get('b')).toBeUndefined();
    expect(cache.get('a')).toBeDefined();
    expect(cache.get('c')).toBeDefined();
  });

  it('상한 도달 시 만료 항목을 먼저 정리한다', () => {
    const cache = new TtlCache<number>(1000, 2);
    cache.set('a', 1);
    vi.advanceTimersByTime(1001);
    cache.set('b', 2);
    cache.set('c', 3);
    // a는 만료 정리로 빠졌고 b·c는 살아 있다
    expect(cache.get('b')).toBeDefined();
    expect(cache.get('c')).toBeDefined();
    expect(cache.size).toBe(2);
  });

  it('getOrCreate: 같은 키 동시 미스는 factory 1회를 공유한다', async () => {
    const cache = new TtlCache<string>(1000, 10);
    const factory = vi.fn().mockResolvedValue('done');
    const [first, second] = await Promise.all([
      cache.getOrCreate('k', factory),
      cache.getOrCreate('k', factory),
    ]);
    expect(first).toBe('done');
    expect(second).toBe('done');
    expect(factory).toHaveBeenCalledTimes(1);
  });

  it('getOrCreate: 실패는 캐시하지 않아 다음 호출이 다시 시도한다', async () => {
    const cache = new TtlCache<string>(1000, 10);
    const factory = vi
      .fn()
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce('ok');
    await expect(cache.getOrCreate('k', factory)).rejects.toThrow('boom');
    await expect(cache.getOrCreate('k', factory)).resolves.toBe('ok');
    expect(factory).toHaveBeenCalledTimes(2);
  });

  it('null도 성공값으로 캐시한다(매칭 실패 캐시 용도)', async () => {
    const cache = new TtlCache<string | null>(1000, 10);
    const factory = vi.fn().mockResolvedValue(null);
    await expect(cache.getOrCreate('k', factory)).resolves.toBeNull();
    await expect(cache.getOrCreate('k', factory)).resolves.toBeNull();
    expect(factory).toHaveBeenCalledTimes(1);
  });
});
