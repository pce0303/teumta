# 팀 업무 분담 TODO (2026-08-06 기준)

> 서버 API 현황: 검색·주변 로컬 장소·실시간 혼잡도·집중률 예측 전부 구현 완료(PR #13, #14).
> 상세 명세는 `docs/api-spec.md` 참조.

---

## 📱 프론트 담당

**목표: mock 제거, 실제 API 연동.**

핵심 사용자 흐름:

```
검색 → 목적지 선택 → 주변 로컬 장소(우회 코스 후보) → 혼잡도/예측 표시
```

### 사용할 엔드포인트

| 엔드포인트 | 용도 |
|---|---|
| `GET /api/search/places?keyword=&pageNo=` | 목적지 검색. 응답 `source`가 `TOUR`면 `tourApiContentId`, `TMAP`이면 `tmapPoiId`가 식별자 |
| `GET /api/local-places?contentId=…` 또는 `?poiId=…&radius=2000` | 목적지 주변 로컬 장소. `distanceMeters`는 TMAP 실제 보행거리, `travelTimeMinutes`는 도보 분 |
| `GET /api/congestion?poiId=` | 실시간 혼잡도(`level`: RELAXED/NORMAL/CROWDED/VERY_CROWDED). 서버 5분 캐시 |
| `GET /api/places/:id/concentration-forecast` | 30일 날짜별 집중률 예측(실시간 아님 — "이 날 덜 붐빔" 용도) |
| `GET /api/places`, `GET /api/places/:id` | 기존 장소 목록/상세 |

### 수정 지점

- `search.tsx` — TextInput을 검색 API에 연결(mock `featuredPlaces` 제거)
- `api/places.ts` — mock fallback 제거
- `detours.tsx` — placeId 대신 `contentId`/`poiId` 전달
- `places/[id].tsx` — 집중률 예측/혼잡도 표시

### 주의사항

1. **검색 자동완성 금지** — 버튼 실행 또는 500ms+ debounce(TourAPI 일 1,000건 쿼터)
2. `local-places` 응답에는 내부 `id` 없음(DB 엔티티 아님) — 목록 키는 name+좌표 조합 사용
3. 실시간 혼잡도는 `tmapPoiId` 있는 목적지(TMAP 검색 결과)만 가능. TOUR 결과는 예측만
4. **사용자 GPS를 서버로 절대 전송 금지** — 서버 API에 좌표 파라미터 자체가 없음
   (`docs/location-privacy.md` 정책). 거리 계산·도착 판정은 기존대로 단말 내부

> ⚠️ 서버가 아직 로컬(개인 핫스팟)에만 있어 프론트 단독 테스트 환경이 없음.
> 서버 배포(아래 B 담당) 완료 후 배포 주소로 연동 테스트 진행.

---

## 🔧 백엔드 A 담당

**목표: Route/Trip 도메인 API 5개 구현 (api-spec 3.5~3.9). 스키마·계산 서비스는 준비 완료, API만 0개.**

### 구현할 엔드포인트

1. `GET /api/places/:placeId/routes` — 코스 목록
2. `GET /api/routes/:routeId` — 코스 상세(stops 포함)
3. `POST /api/trips` — 방문 생성
4. `POST /api/trips/:tripId/events` — 방문 이벤트 로깅
5. `GET /api/trips/:tripId` — 방문 상세

### 준비돼 있는 것

- Prisma 스키마 완성: `Route` / `RouteStop`(+`pathFromPrevious` 폴리라인 Json) / `Trip` / `TripEvent`
- `route-calculation.service.ts`(B 제공): `calculateWalkingRoute(waypoints)` —
  좌표 배열 in → 구간별 거리/시간/경로도형 out.
  Route 조립 시 호출해서 `estimatedTravelMinutesFromPrevious`/`pathFromPrevious` 채우면 됨

### 주의사항

- TripEvent에 사용자 좌표 저장 금지(privacy — 스키마 주석 참조)
- TMAP 직접 호출 금지 — `route-calculation.service` 경유
- 추가 건: `GET /api/places`의 `tag` 쿼리 필터가 spec(3.2)에 있는데 미구현(type만 동작)

### 담당 경계

`external/`, `*-ingestion.service`, `nearby-local-place.service`, `congestion.service`,
`place-search.service`는 B 소유 — 수정 대신 요청.

---

## 🛠 백엔드 B 담당 (외부 연동)

1. **서버 배포** (최우선) — 클라우드 서버 + MySQL + `.env` 구성.
   프론트·A 작업이 로컬 서버에 의존 중이라 팀 전체 차단 요인.
   배포 시 `PREDICTION_INGEST_TARGETS` 설정하면 집중률 자동 적재 활성화됨.
2. **관리자 웹** — 배포 후 착수:
   - 집중률 매칭 UNMATCHED/AMBIGUOUS 해소 도구(현재 로그로만 확인 가능)
   - 장소 큐레이션: 태그·추천 체류시간·설명 입력(`POST/PATCH /admin/places` 기존 API 활용)
   - 코스 구성 입력기(A의 Route API 완성 후)
