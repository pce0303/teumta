# 팀 업무 분담 TODO (2026-08-12 3차 갱신 — 완성 로드맵)

> **서비스 프레임: 오버투어리즘 완화.** 혼잡 감지(실시간 혼잡도 + 날짜별 집중률) → 주변 로컬 장소로
> 수요 분산(우회 코스) → 원 관광지 복귀. 전체 구조는 [service-overview.md](./service-overview.md),
> 상세 명세는 [api-spec.md](./api-spec.md), 역할 경계는 [collaboration.md](./collaboration.md) 참조.
>
> **서버**: `https://port-0-teumta-server-msh476v8e47b3c7e.sel3.cloudtype.app` (24시간 상시 실행)
> **관리자 웹**: `https://port-0-teumta-admin-web-msh476v8e47b3c7e.sel3.cloudtype.app` (로그인 필요 — 비밀번호는 B에게 문의. **문서/저장소에 비밀번호를 적지 않는다** — [collaboration.md §6.5](./collaboration.md))

---

## 완성 기준 (Definition of Done)

| 축 | 완성 상태 |
|---|---|
| 사용자 앱 | 검색 → 목적지 → 혼잡 확인 → 우회 코스 선택 → 진행(도착/복귀 판정) → 완료. mock 0개, 실서버 전용 |
| 관리자 웹 | 5개 메뉴 전부 실데이터 동작 (대시보드 · 장소 · 매칭 · 코스 · 성과 분석) |
| 데이터 | 종로구 장소 큐레이션 완료(태그·체류시간·설명), 우회 코스 상품 N개 등록 |
| 스토리 | "분산 효과"를 지표로 설명 가능(우회 선택률 · 로컬 도착률 · 복귀율) |

## 의존성 순서 (병목 주의)

> Route/Trip 조회·방문 API(3.5~3.9)와 tag 필터는 **구현 완료**(PR #27, #28 머지됨).

```
[데이터로직] PR #5 우회 추천 기준 확정 ──> [프론트] 우회 제안 UX 기준 반영
[A+B] admin Route 쓰기 API 명세 합의 → [A] 구현 ──> [B] 코스 관리 화면 → 코스 데이터 입력
[프론트] 코스 선택·진행 화면 실연동 (지금 가능) → TripEvent 전송 ──> [B] 성과 분석 화면 (실데이터만)
```

지금 병목은 **admin Route 쓰기 API 합의**(코스 데이터를 넣을 수단이 없음)와 **PR #5 기준 확정**.

---

## 📱 프론트 담당

**목표: mock 전면 제거 + 전체 사용자 흐름 실연동 — 서버 API는 전부 준비됨, 지금 다 가능.**

### 지금 바로 가능

```bash
cp mobile/.env.example mobile/.env   # 배포 서버 주소가 기본값
```

1. `search.tsx` — TextInput을 `GET /api/search/places?keyword=&pageNo=`에 연결, mock `featuredPlaces` 제거
   - **자동완성 금지** — 버튼 실행 또는 500ms+ debounce (TMAP/TourAPI 쿼터: [service-overview §3](./service-overview.md))
2. `api/places.ts` — mock fallback 전부 제거 (실서버 전용)
3. `detours.tsx` — placeId 대신 검색 결과의 `contentId`/`poiId`로 `GET /api/local-places?...&radius=2000` 호출
   - 응답 항목엔 내부 `id` 없음 — 목록 키는 name+좌표 조합
4. `places/[id].tsx` — 혼잡도·집중률 표시
   - 실시간: `GET /api/congestion?poiId=` (TMAP 결과만 가능. TOUR 결과는 예측만)
   - 예측: `GET /api/places/:id/concentration-forecast` (30일 날짜별 — "이 날 덜 붐빔" 용도, 실시간 아님)
5. **우회 제안 UX** — 혼잡 level이 CROWDED 이상이면 우회 코스 진입을 강조 노출
   (구체 기준은 PR #5 확정 대기 — 확정 전엔 CROWDED 이상으로 가구현)

### 코스·진행 흐름 (Route/Trip API 머지됨 — 지금 가능. 단, 코스 실데이터는 B의 입력 대기)

6. 코스 목록/상세 화면 — `GET /api/places/:placeId/routes`, `GET /api/routes/:routeId`
   (stops의 `pathFromPrevious` 폴리라인으로 지도 경로 렌더링)
7. 코스 진행 화면 — `POST /api/trips`로 방문 시작, 진행 상태는 mobile local state
   (`use-course-progress.ts` 기존 훅 활용)
8. TripEvent 전송 — 도착/출발/복귀/완료 시 `POST /api/trips/:tripId/events`
   - **eventType + placeId만 전송. 사용자 좌표·이동경로 절대 금지** (metadata에도)
   - 도착 판정은 기존대로 단말 내 Haversine (`utils/arrival.ts`)

### 상시 원칙

- 사용자 GPS를 서버로 전송하지 않는다 — 서버 API에 좌표 파라미터 자체가 없음
- 길찾기는 외부 지도 앱에 목적지만 전달 (`utils/directions.ts`)

---

## 🔧 백엔드 A 담당

**목표: 코스 등록 경로(admin Route 쓰기 API) — 현재 코스 데이터를 DB에 넣을 수단이 없어 전체 병목.**

### 1순위 — admin Route 쓰기 API (B와 명세 합의 필요)

1. `POST/PATCH/DELETE /api/admin/routes` 명세를 api-spec §6에 추가 후 구현
   - B의 관리자 웹 "코스 관리" 화면이 소비. spec-first: 명세 합의 → 구현
   - 코스 조립 시 `route-calculation.service.calculateWalkingRoute(waypoints)`(B 제공) 호출해
     `estimatedTravelMinutesFromPrevious`/`estimatedDistanceMetersFromPrevious`/`pathFromPrevious` 채움
   - 인증은 기존 `admin-auth.middleware` 재사용 (`/api/admin/*` Bearer)

### 2순위 — 추천 로직 (PR #5 확정 후)

2. 30/60/90분 시간대별 코스 조합/추천 — 데이터로직 담당의 PR #5 기준 확정을 구현

### 완료 아카이브 (2026-08-12, PR #27·#28)

Route/Trip 조회·방문 API 5개(3.5~3.9) · `GET /api/places` tag 쿼리 필터

### 알아둘 것

- `Congestion.level`은 **nullable** — KTO 집중률은 level 없이 `concentrationRate`만 저장. null 처리 필수
- TripEvent에 사용자 좌표 저장 금지(privacy — 스키마 주석 참조). metadata 검증에서 좌표 키 거부 권장
- TMAP 직접 호출 금지 — `route-calculation.service` 경유
- `place.service.ts`의 구 `getNearbyLocalPlaces`는 deprecated — 신규 코드 사용 금지
- 배포 서버는 기동 시 `prisma migrate deploy` 자동 실행 — migration 머지 후 콘솔 "배포하기"만
- B 소유 영역(`external/`, `*-ingestion`, `nearby-local-place`, `congestion`, `place-search`,
  `prediction-scheduler`)은 수정 대신 요청

---

## 🛠 백엔드 B 담당 (외부 연동 · 관리자 웹 · 인프라)

**목표: 운영 데이터 입력(지금 가능) → 코스 관리 화면(admin Route 쓰기 API 이후) → 성과 분석(Trip 연동 이후).**

### 지금 바로 가능

1. **장소 큐레이션 운영 입력** — 태그·추천 체류시간·설명 (도구 완비, 대시보드에 미입력 현황 표시됨)
   - 우선순위: 우회 코스에 들어갈 로컬 장소부터
2. **오버투어리즘 프레임 문서 PR** — README·service-overview·api-spec 수정분 + admin 낡은 인증 배지 제거분
3. admin Route 쓰기 API **명세 초안 작성** → A와 합의 (A의 2순위 선행 조건)

### admin Route 쓰기 API(A 구현) 이후

4. **관리자 웹 "코스 관리" 화면** (`/routes` — 현재 ComingSoon)
   - 조회 API(3.5/3.6)는 이미 있음 — 목록/상세 읽기 화면은 먼저 착수 가능
   - 코스 생성/수정: mainPlace 선택 → stop 순서 구성 → 저장 시 서버가 TMAP 거리/시간 자동 계산
   - 우회 코스 상품 실데이터 등록 (시연용 종로구 코스 N개)

### 프론트 Trip 실연동 후

5. **관리자 웹 "성과 분석" 화면** (`/analytics` — 현재 ComingSoon)
   - TripEvent 집계 기반: 우회 선택률(TRIP_STARTED) · 로컬 도착률(PLACE_ARRIVED) ·
     복귀율(MAIN_PLACE_RETURNED) · 완료율(TRIP_COMPLETED) · 평균 우회시간
   - **Never Fake Analytics** — 실데이터 없으면 "수집 준비 중" empty state. 임의 숫자 금지
   - 집계 API가 필요하면 spec 먼저(§6 확장) — Trip 데이터 소유는 A라 협의
6. (선택) spec 3.4 placeId 기반 통합 혼잡도 엔드포인트 — 현재 3.4a(poiId)로 충분하면 스킵

### 상시 운영

- 배포 루틴: org main 머지 → Cloudtype 콘솔 "배포하기" — **서버·관리자 웹 각각**
- DB 백업 모니터링 — 실패 시 DB 외부 포트 변동 확인 후 `BACKUP_DATABASE_URL` secret 갱신
- 집중률 일일 적재(05시 KST) 정상 동작 확인, 미매칭 신규 항목은 매칭 화면에서 alias 처리

### 완료 아카이브 (2026-08-07)

외부 API 연동 전체 · 서버/관리자 웹 Cloudtype 배포 · 관리자 인증(HMAC 토큰 + rate limit) ·
장소/태그/삭제 API · 집중률 매칭 도구(preview+alias) · 종로구 528곳 적재 · KTO 매칭 98/113
(잔여 15건은 KTO 전용 항목 — 억지 연결 금지) · DB 백업 자동화(`db-backup.yml` 매일 05:30 KST)

---

## 📊 데이터로직 담당 (판단 기준 설계)

**목표: "언제 우회를 제안하고, 어떤 코스를 보여줄지"의 기준 확정 — 프론트 UX와 A의 추천 로직이 이 기준을 구현한다.**

1. **PR #5 (혼잡도 판단 및 우회 코스 추천 기준) 확정 — 최우선, 프론트/A 병목**
   - 우회 제안 트리거: 혼잡 level 기준 (예: CROWDED 이상 강조, VERY_CROWDED 적극 유도)
   - 실시간 혼잡도(SK)와 날짜별 집중률(KTO)의 역할 구분 명문화
     (실시간 = 오늘 우회 트리거 / 집중률 = 방문 날짜 자체 분산 — 혼용 금지)
   - 30/60/90분 시간대별 코스 조합 기준 (stayMinutes + 이동시간 합산 규칙)
   - 복귀 타이밍 판단 기준 (혼잡 완화 판단은 실시간 재조회? 단순 시간 경과?)
2. **PR #16 (KTO 집중률 데이터 처리 기준)** — 리뷰 코멘트 3건 반영(스케줄러 구현 반영 등) 후 머지
3. **분산 효과 지표 정의** — 성과 분석 화면(B)에 들어갈 지표의 공식 확정
   - 우회 선택률 · 로컬 도착률 · 복귀율 · 완료율의 분모/분자 정의 (TripEvent 종류 기준)
   - privacy 제약 안에서 정의: 좌표·이동경로 없이 이벤트 종류+placeId만으로 계산 가능해야 함
4. **공모전 스토리 정리** — "관광객을 줄이지 않고 발걸음과 지갑을 옆 골목으로 옮긴다" 프레임으로
   발표 자료 골격 작성 (지표는 "측정 계획"으로 제시 가능)

---

## 공통 규칙 리마인드

- `main` 직접 push 금지 — 항상 PR. 스키마/명세 변경은 상대방 리뷰 필수 ([collaboration.md](./collaboration.md))
- spec-first: [api-spec.md](./api-spec.md) 먼저 고치고 구현
- 사용자 GPS는 어떤 경로로도 서버에 오지 않는다 ([location-privacy.md](./location-privacy.md))
- 외부 API 쿼터: 주변 장소 조회 하루 ≈ 100회 한도(TMAP 병목) — 프론트 자동완성 금지 유지
