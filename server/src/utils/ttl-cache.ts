/**
 * TTL + 상한이 있는 인메모리 캐시.
 *
 * 기존에는 서비스마다 `Map<string, {value, expiresAt}>`을 직접 들었는데, 만료 항목을
 * 지우는 코드가 없어 오래 가동하면 조회된 키가 전부 잔류했다(느린 누수 — 특히
 * POI 매칭 캐시는 상세를 연 목적지마다 쌓인다). 여기로 통일한다:
 *
 *  - get: 만료 항목은 그 자리에서 삭제
 *  - 상한 초과 시 만료분 먼저 정리하고, 그래도 넘치면 가장 오래 안 쓴 키부터 제거
 *    (적중·갱신 시 재삽입으로 삽입 순서를 올리는 단순 LRU)
 *  - getOrCreate: 같은 키의 동시 미스가 몰려도 외부 호출은 1회(진행 중 Promise 공유).
 *    실패는 캐시에 남기지 않는다 — 일시 장애가 TTL 수명만큼 길어지면 안 된다.
 *    "실패도 캐시"가 필요하면 값으로 null을 저장한다(poi-matching 방식).
 */
export class TtlCache<V> {
  private readonly store = new Map<string, { value: Promise<V>; expiresAt: number }>();

  constructor(
    private readonly ttlMs: number,
    private readonly maxEntries: number,
  ) {}

  /** 유효한 항목의 값(진행 중이면 그 Promise). 부재·만료는 undefined. */
  get(key: string): Promise<V> | undefined {
    const entry = this.store.get(key);
    if (!entry) {
      return undefined;
    }
    if (entry.expiresAt <= Date.now()) {
      this.store.delete(key);
      return undefined;
    }
    // 적중한 키를 뒤로 보내 제거 순서에서 밀리게 한다
    this.store.delete(key);
    this.store.set(key, entry);
    return entry.value;
  }

  /** 미스면 factory를 1회 실행해 채운다. 동시 미스는 같은 Promise를 공유한다. */
  getOrCreate(key: string, factory: () => Promise<V>): Promise<V> {
    const existing = this.get(key);
    if (existing !== undefined) {
      return existing;
    }

    const value = factory().catch((error: unknown) => {
      this.store.delete(key);
      throw error;
    });
    this.insert(key, value);
    return value;
  }

  set(key: string, value: V): void {
    this.insert(key, Promise.resolve(value));
  }

  clear(): void {
    this.store.clear();
  }

  get size(): number {
    return this.store.size;
  }

  private insert(key: string, value: Promise<V>): void {
    if (!this.store.has(key) && this.store.size >= this.maxEntries) {
      this.evict();
    }
    // 재삽입으로 삽입 순서 갱신
    this.store.delete(key);
    this.store.set(key, { value, expiresAt: Date.now() + this.ttlMs });
  }

  private evict(): void {
    const now = Date.now();
    for (const [key, entry] of this.store) {
      if (entry.expiresAt <= now) {
        this.store.delete(key);
      }
    }
    while (this.store.size >= this.maxEntries) {
      const oldest = this.store.keys().next().value;
      if (oldest === undefined) {
        return;
      }
      this.store.delete(oldest);
    }
  }
}
