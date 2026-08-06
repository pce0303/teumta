# 팀 업무 분담 TODO (2026-08-07 갱신)

> **서버 배포 완료** — 백엔드 외부 연동 API 전부 구현·검증됨. 전체 구조는 [service-overview.md](./service-overview.md), 상세 명세는 [api-spec.md](./api-spec.md) 참조.
>
> **배포 주소**: `https://port-0-teumta-server-msh476v8e47b3c7e.sel3.cloudtype.app` (24시간 상시 실행)

---

## 📱 프론트 담당

**목표: mock 제거, 배포 서버 실연동. 지금 바로 시작 가능.**

### 시작하기

```bash
cp mobile/.env.example mobile/.env   # 배포 서버 주소가 기본값 — 핫스팟/로컬 서버 불필요
```

### 핵심 사용자 흐름과 엔드포인트

```
검색 → 목적지 선택 → 주변 로컬 장소(우회 코스 후보) → 혼잡도/예측 표시
```

| 엔드포인트 | 용도 |
|---|---|
| `GET /api/search/places?keyword=&pageNo=` | 목적지 검색. `source`가 `TOUR`면 `tourApiContentId`, `TMAP`이면 `tmapPoiId`가 식별자 |
| `GET /api/local-places?contentId=…` 또는 `?poiId=…&radius=2000` | 목적지 주변 로컬 장소. `distanceMeters`는 TMAP 실제 보행거리, `travelTimeMinutes`는 도보 분 |
| `GET /api/congestion?poiId=` | 실시간 혼잡도(`level`: RELAXED/NORMAL/CROWDED/VERY_CROWDED). `tmapPoiId` 있는 목적지만 |
| `GET /api/places/:id/concentration-forecast` | 30일 날짜별 집중률 예측(실시간 아님 — "이 날 덜 붐빔" 용도) |
| `GET /api/places`, `GET /api/places/:id` | DB 장소 목록/상세 (서울 종로구 117곳 적재됨) |

### 수정 지점

- `search.tsx` — TextInput을 검색 API에 연결(mock `featuredPlaces` 제거)
- `api/places.ts` — mock fallback 제거
- `detours.tsx` — placeId 대신 `contentId`/`poiId` 전달
- `places/[id].tsx` — 집중률 예측/혼잡도 표시

### 주의사항

1. **검색 자동완성 금지** — 버튼 실행 또는 500ms+ debounce (외부 API 쿼터: [service-overview §3](./service-overview.md))
2. `local-places` 응답에는 내부 `id` 없음(DB 엔티티 아님) — 목록 키는 name+좌표 조합
3. 실시간 혼잡도는 TMAP 검색 결과(`tmapPoiId` 보유)만 가능. TOUR 결과는 예측만
4. **사용자 GPS를 서버로 절대 전송 금지** — 서버 API에 좌표 파라미터 자체가 없음. 거리 계산·도착 판정은 기존대로 단말 내부

---

## 🔧 백엔드 A 담당

**목표: Route/Trip 도메인 API 5개 (api-spec 3.5~3.9). 스키마·계산 서비스 준비 완료, API만 0개.**

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

### 알아둘 변경사항 (외부 연동 작업 반영)

- `Congestion.level`이 **nullable**로 변경됨 — KTO 집중률은 공식 등급 기준이 없어 level 없이
  원본 소수값(`concentrationRate`)만 저장. 혼잡도 조회 코드 작성 시 null 처리 필요
- `Place`에 법정동 코드(`lDongRegnCd`/`lDongSignguCd`)·분류체계(`lclsSystm1~3`) 컬럼 추가됨
- `place.service.ts`의 구 `getNearbyLocalPlaces`(DB 전체 조회+하버사인)는 **deprecated** —
  실시간 방식으로 대체됐고 신규 코드에서 사용 금지
- 배포 서버는 기동 시 `prisma migrate deploy` 자동 실행 — migration 파일 머지하면 배포로 반영됨

### 주의사항

- TripEvent에 사용자 좌표 저장 금지(privacy — 스키마 주석 참조)
- TMAP 직접 호출 금지 — `route-calculation.service` 경유
- 추가 건: `GET /api/places`의 `tag` 쿼리 필터가 spec(3.2)에 있는데 미구현(type만 동작)

### 담당 경계

`external/`, `*-ingestion.service`, `nearby-local-place.service`, `congestion.service`,
`place-search.service`, `prediction-scheduler.service`는 B 소유 — 수정 대신 요청.

---

## 🛠 백엔드 B 담당 (외부 연동·인프라)

완료: 외부 API 연동 전체, 배포(Cloudtype 유료, 서울), 집중률 일일 자동 적재, 실시간 혼잡도 API.

다음:
1. **관리자 웹** —
   - 집중률 매칭 UNMATCHED/AMBIGUOUS 해소 도구(현재 로그로만 확인 가능)
   - 장소 큐레이션: 태그·추천 체류시간·설명 입력(`POST/PATCH /admin/places` 기존 API 활용)
   - 코스 구성 입력기(A의 Route API 완성 후)
2. 운영 루틴: org main 머지 → Cloudtype 콘솔 "배포하기" 수동 실행(자동 배포 웹훅 검토)
3. DB 백업 자동화(GitHub Actions mysqldump) — 여유 될 때

---

## 열린 문서 PR (로직 설계 담당)

- **#16** KTO 집중률 데이터 처리 기준 — 리뷰 코멘트 반영 대기(스케줄러 구현 반영 등 3건)
- **#5** 혼잡도 판단 및 우회 코스 추천 기준 — 리뷰 필요
