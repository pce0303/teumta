# teumta 서버 역할 분담 & 협업 규칙

> 대상: 백엔드 서버(`server/`)
> 담당: **A (지수)** · **B (초은)**
> 관련 문서: [API 명세](./api-spec.md) · [전체 구조](./service-overview.md) · [팀 TODO](./team-todo.md)

---

## 1. 한눈에 보기

| | A (지수) | B (초은) |
|--|----------|----------|
| **한 줄 정의** | 우리 서버가 **무엇을 저장하고 어떤 API로 제공할지** | 외부 데이터를 가져와 **앱/내부 API가 쓰기 좋은 형태로 가공** |
| **핵심 영역** | DB 모델링 · 핵심 도메인 API | 외부 API 연동 · 데이터 가공 |
| **주 작업 폴더** | `prisma/`, `src/routes`, `src/controllers`, `src/services` | `src/integrations`(신규), `src/services`(연동용) |

---

## 2. 상세 역할 분담

### A (지수) — 내부 데이터 모델링 + 핵심 API
- ERD 구체화 및 테이블 생성 (`schema.prisma`, 마이그레이션)
- 관광지(TOURIST_SPOT) API
- 로컬 장소(LOCAL_PLACE) API
- 코스(Route) API
- 방문 로그(Trip/TripEvent) API
- 집중률 예측 데이터 **저장/조회 구조 설계** (`Congestion` 스키마)
- API 응답 형식/규약 관리

### B (초은) — 외부 API 연동 + 데이터 가공
- 한국관광공사 TourAPI 연동
- SK 실시간 혼잡도 API 연동
- TMAP 경로·이동시간 API 연동
- 관광지 집중률 **예측 데이터** 연동
- 외부 응답 → 내부 DTO 변환
- 외부 API 실패/지연 예외 처리(타임아웃·재시도)
- 앱/내부 API로 가공 데이터 전달

---

## 3. 소유권 경계표

| 항목 | A 소유 | B 소유 | 인계 지점 |
|------|:------:|:------:|-----------|
| DB 스키마 · 마이그레이션 | ✅ | | — |
| Place **읽기 API** | ✅ | | DB |
| Place **쓰기(TourAPI 적재)** | | ✅ | **DB (upsert)** |
| Congestion **예측 적재** | | ✅ | **DB** |
| Congestion **조회 API** | ✅ | | DB |
| Congestion **실시간 fetch** | | ✅ | **서비스 함수** |
| Route/코스 조립 로직 | ✅ | | — |
| TMAP 이동시간 계산 | | ✅ | **서비스 함수** |
| 외부 API 예외/재시도/타임아웃 | | ✅ | (B 내부) |
| API 경로 · 응답 규약 | ✅ | | (B가 준수) |

---

## 4. 데이터 인계 규칙 (가장 중요)

데이터 성격에 따라 **A에게 넘기는 방식**을 다르게 한다.

| 데이터 성격 | 예시 | 인계 방식 | 규칙 |
|------------|------|-----------|------|
| **정적/준정적** | 관광지 정보(TourAPI) | **DB 테이블** | B가 `tourApiContentId` 기준 **upsert**, A는 DB만 read |
| **예측/축적형** | 집중률 예측 | **DB 테이블** | B가 `Congestion(type=PREDICTED)`에 적재, A가 조회 API 제공 |
| **휘발성/실시간** | 실시간 혼잡도, 이동시간 | **서비스 함수** | 저장하지 않고 B의 함수를 A/컨트롤러가 호출 (필요 시 짧은 TTL 캐시) |

> 원칙: **B는 A의 테이블 구조에 최대한 의존하지 않는다.** 실시간/파생 데이터는 "입력 → DTO 출력" 순수 함수로 넘겨 결합도를 낮춘다.

**서비스 함수 인터페이스 예시** (시그니처는 합의 후 확정):
```ts
// 실시간 혼잡도
getRealtimeCongestion(placeId: number): Promise<CongestionDTO | null>
// TMAP 이동시간
getTravelTime(from: Coord, to: Coord): Promise<{ durationMinutes: number; distanceMeters: number }>
```

---

## 5. 필수 합의 3가지

착수 전 A·B가 반드시 합의할 항목:

1. **Place 테이블은 B만 쓴다(A는 읽기 전용), upsert 키는 `tourApiContentId`.**
2. **실시간·이동시간은 저장하지 않고 B의 서비스 함수로 넘긴다** (DTO 시그니처 합의).
3. **API 경로는 `/api` 프리픽스로 통일** (`/health`만 루트). A가 확정.

---

## 6. 협업 규칙

### 6.1 Git 브랜치
- `main`은 **직접 push 금지**, 항상 PR로 병합.
- 브랜치 네이밍: `feature/<영역>-<내용>`
  - A 예: `feature/course-api`, `feature/trip-api`
  - B 예: `feature/tour-api`, `feature/congestion-integration`, `feature/tmap-integration`
- 작업 전 `main` 최신화 후 브랜치 생성.

### 6.2 PR 규칙
- PR 제목: `feat: ...`, `fix: ...`, `refactor: ...` (Conventional Commits)
- 본문에 **무엇을/왜/영향 범위** 기재.
- **스키마 변경** 또는 **API 명세 변경**이 포함되면 **상대방 리뷰 필수**.
- 그 외 자기 영역 단독 변경은 셀프 머지 허용.

### 6.3 스키마 변경 규칙 (충돌 예방 핵심)
- `schema.prisma` 변경 권한은 **A가 오너**.
- B가 저장 구조가 필요하면 → **이슈/메시지로 A에게 요청**, A가 마이그레이션 생성.
- 마이그레이션 파일은 **반드시 커밋**해 공유 (`npx prisma migrate dev --name <name>`).
- 마이그레이션 병합 후 각자 `npm run db:generate` 재실행.

### 6.4 API 명세 변경 규칙
- 정본은 [`docs/api-spec.md`](./api-spec.md).
- **명세를 먼저 고치고 → 구현**한다 (spec-first).
- 응답 봉투 `{ success, data, error }`, camelCase, ISO8601, 좌표 number, tags 평탄화 규약을 **양쪽 모두 준수**.

### 6.5 코드 컨벤션
- 레이어 구조 유지: `routes → controllers → services → prisma`.
- B의 외부 연동은 `services`(또는 `integrations`)에 격리하고, 컨트롤러는 얇게.
- 환경변수는 `src/config/env.ts`의 Zod 스키마에 추가 (`TOUR_API_KEY`, `CONGESTION_API_KEY`, `TMAP_API_KEY` 이미 존재).
- 비밀 키는 `.env`에만, 절대 커밋 금지. 새 변수는 `.env.example`에 키만 추가.

### 6.6 폴더 구조 (제안)
```
server/src/
├── config/            # env 등 (공용)
├── routes/            # A: 도메인 라우터
├── controllers/       # A: 도메인 컨트롤러
├── services/          # A: 도메인 서비스 / B: 연동 서비스
│   ├── place.service.ts        (A)
│   ├── congestion.service.ts   (B, 실시간 fetch + 예측 조회 가공)
│   └── ...
├── integrations/      # B: 외부 API 클라이언트 (신규)
│   ├── tour/          # TourAPI
│   ├── congestion/    # SK 혼잡도
│   ├── tmap/          # TMAP
│   └── http-client.ts # 공통 타임아웃/재시도 래퍼
├── dtos/              # B: 외부응답 → 내부 DTO 변환 (신규)
├── middlewares/
└── utils/
```

---

## 7. 커뮤니케이션 규칙
- **경계에 걸치는 변경**(스키마, API 명세, 서비스 함수 시그니처)은 반드시 사전 공유.
- 외부 API 스펙(응답 필드/제약)이 확인되면 문서화해 공유.
- 막히면 빨리 공유 — 특히 스키마/명세 의존이 서로의 진행을 막을 수 있음.

---

## 8. 현재 진행 상황 (2026-07-30 기준)
- **A**: 스키마·응답규약·프로젝트 구조 확정 완료. 관광지 조회 2개(`/places`, `/places/:id`) 구현. 코스/방문/혼잡도 조회 API 미구현.
- **B**: 착수 가능 상태. 스키마·DTO 규약·환경변수 스캐폴딩이 준비됨. 권장 시작 순서: **① SK 혼잡도 → ② TourAPI → ③ TMAP**.
