# teumta API 명세 (초안 v1)

> 작성: B / 검토·구현 반영: A
> 기준: `server/prisma/schema.prisma`
> 상태: **초안** — 팀 합의 후 확정

---

## 1. 공통 규약

### 1.1 Base URL / 프리픽스
- 헬스체크는 루트: `GET /health`
- 모든 도메인 API는 `/api` 하위: `app.use('/api', ...)`

### 1.2 응답 봉투 (Response Envelope)
모든 응답은 아래 형태로 통일한다.

```jsonc
{
  "success": true,        // boolean
  "data": {},             // 성공 시 payload, 실패 시 null
  "error": null           // 실패 시 { code, message }, 성공 시 null
}
```

실패 예시:
```jsonc
{
  "success": false,
  "data": null,
  "error": { "code": "PLACE_NOT_FOUND", "message": "장소를 찾을 수 없습니다." }
}
```

> `error.code`는 클라이언트 분기용 문자열 코드(신규 제안). 최소 요구는 `message`.

### 1.3 필드/직렬화 규약
- JSON 필드명은 **camelCase** (Prisma 모델과 동일)
- 날짜/시간은 **ISO 8601 문자열** (`2026-07-30T12:00:00.000Z`)
- **좌표(`latitude`, `longitude`)는 `number`** — ⚠️ Prisma `Decimal`은 기본 직렬화 시 문자열로 나가므로 `Number()` 변환 필수
- `tags`는 **평탄화된 배열** `[{ id, name }]` (내부 `placeTags[].tag` 중첩 구조를 노출하지 않는다)

### 1.4 HTTP 상태 코드
| 코드 | 의미 |
|------|------|
| 200 | 조회 성공 |
| 201 | 생성 성공 (POST) |
| 400 | 잘못된 요청(파라미터/바디 검증 실패) |
| 404 | 리소스 없음 |
| 500 | 서버 내부 오류 |
| 502 / 503 | 외부 API 연동 실패/지연 (B 영역) |

---

## 2. 데이터 타입

### enum
```
PlaceType        = TOURIST_SPOT | LOCAL_PLACE
CongestionType   = PREDICTED | REALTIME
CongestionLevel  = RELAXED | NORMAL | CROWDED | VERY_CROWDED
TripStatus       = PLANNED | IN_PROGRESS | COMPLETED | CANCELLED
TripEventType    = TRIP_STARTED | PLACE_ARRIVED | PLACE_LEFT
                 | MAIN_PLACE_RETURNED | TRIP_COMPLETED | TRIP_CANCELLED
```

### Place
```jsonc
{
  "id": 1,
  "name": "경복궁",
  "type": "TOURIST_SPOT",
  "address": "서울 종로구 사직로 161",
  "latitude": 37.5796,
  "longitude": 126.9770,
  "imageUrl": "https://...",
  "description": "조선의 법궁...",
  "openingTime": "09:00",       // "HH:mm" | null
  "closingTime": "18:00",       // "HH:mm" | null
  "recommendedDuration": 90,     // 분 | null
  "tags": [{ "id": 3, "name": "고궁" }],
  "createdAt": "2026-07-27T00:00:00.000Z",
  "updatedAt": "2026-07-27T00:00:00.000Z"
}
```
> `tourApiContentId`는 내부 연동용이라 응답에서 제외(필요 시 노출).

### Congestion
```jsonc
{
  "level": "NORMAL",            // CongestionLevel
  "score": 45,                   // 0~100 | null
  "source": "SK",                // 데이터 출처 | null
  "measuredAt": "...",          // REALTIME 측정 시각 | null
  "predictedFor": "..."          // PREDICTED 대상 시각 | null
}
```

### Route / RouteStop
```jsonc
{
  "id": 10,
  "name": "경복궁 주변 반나절 코스",
  "mainPlaceId": 1,
  "description": "...",
  "estimatedTotalDurationMinutes": 210,
  "estimatedTotalDistanceMeters": 3200,
  "stops": [
    {
      "stopOrder": 1,
      "place": { /* Place 요약 */ },
      "stayMinutes": 60,
      "estimatedTravelMinutesFromPrevious": 0,
      "estimatedDistanceMetersFromPrevious": 0
    }
  ]
}
```

### Trip / TripEvent
```jsonc
{
  "id": 100,
  "routeId": 10,
  "deviceId": "device-uuid",     // 익명 식별자 | null
  "status": "IN_PROGRESS",
  "startedAt": "...",           // | null
  "endedAt": null,
  "events": [
    {
      "id": 1,
      "eventType": "TRIP_STARTED",
      "placeId": null,
      "latitude": 37.5796,
      "longitude": 126.9770,
      "occurredAt": "...",
      "metadata": null            // JSON | null
    }
  ]
}
```

---

## 3. 엔드포인트

담당 표기: **A**=내부 도메인 API, **B**=외부 연동/가공

### 3.1 Health — [A/공통]
```
GET /health
```
200:
```jsonc
{ "success": true, "data": { "status": "ok", "service": "teumta-server", "database": "connected" }, "error": null }
```

---

### 3.2 장소 목록 — [A] (데이터 적재: B/TourAPI)
```
GET /api/places
```
Query (모두 optional):
| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `type` | PlaceType | `TOURIST_SPOT`/`LOCAL_PLACE` 필터 (관광지/로컬 구분) |
| `tag` | string | 태그명 필터 |

200: `data`는 `Place[]`.

> 향후 확장(선택): 위치 기반 검색 `?lat=&lng=&radiusMeters=` — "근처 빈 시간 관광지" 핵심 시나리오. v1에서는 보류 가능.

---

### 3.3 장소 상세 — [A]
```
GET /api/places/:placeId
```
- `400 INVALID_PLACE_ID` — placeId가 양의 정수가 아님
- `404 PLACE_NOT_FOUND`
- 200: `data`는 `Place`.

---

### 3.3a 목적지 검색 — [B] (실시간 TourAPI)
```
GET /api/search/places?keyword=경복궁&pageNo=1
```
사용자가 목적지를 직접 검색하는 흐름의 진입점(DB 미저장).
**TourAPI(`searchKeyword2`, 관광지) 우선 → 결과 없으면 TMAP 장소 통합 검색(전국 POI) 폴백** —
등록 관광지가 아닌 일반 상점·건물도 검색된다. 폴백 구조라 검색 1회당 외부 호출 1~2건.
응답 항목의 `source`에 따라 `tourApiContentId`(TOUR) 또는 `tmapPoiId`(TMAP)가 목적지 식별자다.
```jsonc
{
  "success": true,
  "data": [
    {
      "tourApiContentId": "126508",
      "contentTypeId": "12",
      "name": "경복궁",
      "address": "서울특별시 종로구 사직로 161 (세종로)",
      "latitude": 37.5760307,     // 없으면 null
      "longitude": 126.9767218,
      "imageUrl": "https://..."
    }
  ],
  "error": null
}
```
- `400` — keyword 누락/공백, pageNo가 양의 정수 아님.

### 3.3b 주변 로컬 장소 조회 — [B] (실시간 외부 API)

**목적지 기반(권장, 검색 흐름):** 사용자가 검색으로 고른 목적지 기준. DB 불필요.
```
GET /api/local-places?contentId=126508&radius=2000   # TourAPI 목적지
GET /api/local-places?poiId=10817049&radius=2000     # TMAP POI 목적지
```
- `contentId`/`poiId` 중 **정확히 하나**만 전달(둘 다/둘 다 없음 → 400).
- **좌표는 API 입력으로 받지 않는다**(location-privacy 정책) — 서버가 식별자를 좌표로 해석.
- `400` — 식별자 규칙 위반, radius 범위 밖. `404` — 상세 조회 결과 없음/좌표 없음.
- 응답 형태·동작·실패 정책은 아래와 동일.

**내부 Place 기반(기존):**
```
GET /api/places/:id/local-places?radius=2000
```

**공모전 데이터 활용 기준(핵심):** 관광정보는 요청 시점에 TourAPI를 **실시간 호출**하여 사용하며,
응답받은 장소명/주소/좌표/이미지를 **Place 테이블에 적재(create/upsert)하거나 DB 캐시하지 않는다.**
DB는 기준 관광지 1건 읽기(findUnique)에만 사용한다.

**동작 흐름:**
1. 내부 Place에서 기준 관광지 확인 — 없으면 404, `TOURIST_SPOT` 아니면 400, `tourApiContentId` 없으면 400
2. TourAPI `detailCommon2`로 기준 관광지의 현재 좌표 실시간 조회(실패 시 DB 좌표 fallback)
3. TourAPI `locationBasedList2`를 contentTypeId 14(문화시설)/38(쇼핑)/39(음식점)별 호출 후 병합
4. contentId 중복 제거, 좌표 없는 후보·기준 관광지 자신 제외
5. **호출량 제한:** TourAPI dist(선별용)로 가까운 순 최대 10개만 TMAP 호출(동시 3개 제한)
6. TMAP 보행자 경로(`POST /tmap/routes/pedestrian?version=1`)의 `totalDistance`로 실제 보행거리 계산
7. 보행거리 ≤ radius 만 반환, `distanceMeters` 오름차순 정렬

**radius:** 양의 정수, 기본 2000, 최대 20000(초과 시 400). TourAPI 후보 검색 반경이자
최종 TMAP 보행거리 필터 기준.

**응답:** 항목은 DB Place 엔티티가 아니므로 내부 `id`가 없다(`tourApiContentId`도 기존 정책대로 미노출).
```jsonc
{
  "success": true,
  "data": [
    {
      "name": "통인시장",
      "address": "서울 종로구 ...",
      "latitude": 37.58,
      "longitude": 126.97,
      "imageUrl": "https://...",
      "distanceMeters": 850,        // ⚠️ 직선거리가 아니라 TMAP 실제 보행거리(totalDistance)
      "travelTimeMinutes": 13       // TMAP totalTime 기반 Math.ceil(초/60)
    }
  ],
  "error": null
}
```

**외부 API 실패 정책:**
- TourAPI 목록 호출 전부 실패 → 502/503/504 (`error.code`: AUTH_FAILED/RATE_LIMITED/TIMEOUT 등)
- `detailCommon2` 실패 → DB 좌표 fallback으로 부분 성공
- TMAP 일부 후보 실패 → **해당 후보만 제외**하고 부분 성공(기존 클라이언트가 distanceMeters로
  정렬/표시하므로 null 노출보다 제외가 안전)
- TMAP 전부 실패 → 502 + `error.code = EXTERNAL_API_UNAVAILABLE`
- timeout: `EXTERNAL_API_TIMEOUT_MS`(기본 5000ms) 공통 적용

**환경변수:** `TOUR_API_KEY`(Decoding 키), `TOUR_API_BASE_URL`, `TMAP_API_KEY`(SK appKey),
`TMAP_API_BASE_URL`. serviceKey는 URLSearchParams가 정확히 한 번 인코딩하므로 Decoding 키 사용.

> **기존 적재 코드 처리:** `place-ingestion.service.ts` / `scripts/ingest-tour.ts`(`npm run ingest:tour`)는
> 이 API 런타임에서 **호출되지 않는다**. 집중률 예측 매칭용 내부 참조 데이터(법정동 코드 등) 적재
> 용도로만 남아 있으며, 주변 로컬 장소 조회 목적의 관광정보 DB 적재에는 사용 금지.
> `place.service.ts`의 구 `getNearbyLocalPlaces`(DB 전체 조회 + 하버사인)는 deprecated.

---

### 3.4 장소 혼잡도 — [B]
```
GET /api/places/:placeId/congestion
```
실시간(pass-through) + 예측(DB 조회)을 함께 반환.
```jsonc
{
  "success": true,
  "data": {
    "placeId": 1,
    "realtime": { "level": "CROWDED", "score": 78, "source": "SK", "measuredAt": "..." },
    "predictions": [
      { "level": "NORMAL", "score": 40, "source": "...", "predictedFor": "2026-07-30T15:00:00.000Z" }
    ]
  },
  "error": null
}
```
- 실시간 데이터가 없거나 외부 API 실패 시 `realtime: null` 로 **부분 성공**(전체 실패 아님).
- `404 PLACE_NOT_FOUND` — 장소 자체가 없을 때만 404.
- 이 placeId 기반 통합 엔드포인트는 미구현. 실시간 혼잡도는 검색 흐름용 3.4a(poiId 기반)로 제공.

### 3.4a 실시간 혼잡도 — [B] (SK 퍼즐, 구현됨)
```
GET /api/congestion?poiId=362105
```
SK 지오비전 퍼즐 "실시간 장소 혼잡도". `poiId`는 검색 결과(3.3a)의 `tmapPoiId`.
서버 5분 캐시(해커톤 요금제 월 3,000건 쿼터 절약). DB 미저장.
```jsonc
{
  "success": true,
  "data": {
    "poiId": "362105",
    "poiName": "경복궁",
    "level": "NORMAL",              // RELAXED | NORMAL | CROWDED | VERY_CROWDED
    "source": "SK_PUZZLE",
    "measuredAt": "2026-08-06T03:50:00.000Z",
    "fetchedAt": "2026-08-06T03:52:10.000Z",  // 캐시 히트면 과거 값
    "isRealtime": true
  },
  "error": null
}
```
- `400` — poiId 누락. 외부 오류 → 502/503/504.

### 3.4b 장소 집중률 예측 — [B] (구현됨)
```
GET /api/places/:id/concentration-forecast
```
한국관광공사 "관광지 집중률 방문자 추이 예측"(TatsCnctrRateService) 기반, DB 조회 전용.

**데이터 의미와 한계 (중요):**
- 현재 날짜 기준 **향후 30일의 날짜별** 집중률 예측이다(일 1회 갱신).
- **실시간 혼잡도가 아니다.** 시간대별 예측도 아니다. "30분/60분 후 혼잡 완화" 판단에 쓸 수 없다.
- 공식 API가 혼잡 등급 임계값을 제공하지 않으므로 level/score 로 변환하지 않고 원본 소수값을 그대로 제공한다.

```jsonc
{
  "success": true,
  "data": {
    "placeId": 1,
    "isRealtime": false,
    "forecasts": [
      {
        "forecastDate": "2026-08-06",          // 예측 대상 달력 날짜(KST)
        "concentrationRate": 23.45,             // 집중률 원본 소수값
        "source": "KTO_CONCENTRATION_FORECAST",
        "fetchedAt": "2026-08-06T03:00:00.000Z", // 마지막 적재/갱신 시각
        "isRealtime": false
      }
    ]
  },
  "error": null
}
```
- `400` — id가 양의 정수가 아님. `404` — 장소 없음.
- 적재는 `npm run ingest:prediction -- --areaCd=11 --signguCd=11110 [--name=경복궁]` 수동 실행(조회 API는 DB만 바라봄).
- 집중률 API에는 TourAPI contentid가 없어, 지역(법정동) + 정규화된 관광지명이 정확히 일치하는 경우에만 저장한다(UNMATCHED/AMBIGUOUS는 저장하지 않고 집계만).

---

### 3.5 장소별 코스 목록 — [A] (이동시간/거리: B/TMAP 계산)
```
GET /api/places/:placeId/routes
```
해당 장소를 `mainPlace`로 하는 코스 목록. 200: `data`는 `Route[]`.

### 3.6 코스 상세 — [A]
```
GET /api/routes/:routeId
```
- `404 ROUTE_NOT_FOUND`
- 200: `data`는 `Route`(stops 포함).

---

### 3.7 방문(Trip) 생성 — [A]
```
POST /api/trips
```
Body:
```jsonc
{ "routeId": 10, "deviceId": "device-uuid" }   // deviceId optional
```
- `400 INVALID_ROUTE_ID`, `404 ROUTE_NOT_FOUND`
- 201: `data`는 생성된 `Trip`(status=`PLANNED`).

### 3.8 방문 이벤트 로깅 — [A]
```
POST /api/trips/:tripId/events
```
Body:
```jsonc
{
  "eventType": "PLACE_ARRIVED",   // TripEventType (필수)
  "placeId": 1,                     // optional
  "latitude": 37.5796,              // optional
  "longitude": 126.9770,            // optional
  "metadata": { }                    // optional JSON
}
```
- `400 INVALID_EVENT_TYPE`, `404 TRIP_NOT_FOUND`
- 201: `data`는 생성된 `TripEvent`.

### 3.9 방문 상세 조회 — [A]
```
GET /api/trips/:tripId
```
- `404 TRIP_NOT_FOUND`
- 200: `data`는 `Trip`(events 포함).

---

## 4. 외부 API 실패 처리 규약 (B)

- 외부 API(TourAPI/SK/TMAP) 호출은 **타임아웃 + 재시도(backoff)** 를 B 연동 계층에서 처리한다.
- 실시간성 데이터(혼잡도 realtime, 이동시간)는 실패 시 **해당 필드만 null/생략하여 부분 성공**으로 응답하고, 전체 요청을 500으로 실패시키지 않는다.
- 저장형 데이터(TourAPI 장소, 예측 혼잡도)는 **동기화 작업**에서 적재하며, 조회 API는 항상 DB만 바라본다(외부 API에 직접 의존하지 않음).
- 외부 API가 필수 경로에서 완전히 불가한 경우에만 `502`/`503` + `error.code = EXTERNAL_API_UNAVAILABLE`.

---

## 5. A가 이 명세 기준으로 반영할 변경점 (요약)

1. **`/api` 프리픽스 적용** — `app.use('/api', placeRouter)` 등. `/health`만 루트 유지.
2. **`GET /places` → `GET /api/places`** + `type`, `tag` 쿼리 필터 추가.
3. **`tags` 응답 평탄화** — `placeTags[].tag` 중첩 대신 `tags: [{id, name}]`.
4. **좌표 number 변환** — `Decimal` → `Number` 직렬화.
5. **신규 엔드포인트 구현** — 코스(3.5/3.6), 방문(3.7~3.9).
6. **`error.code` 도입**(선택) — 클라이언트 분기용 코드 문자열.

> B는 3.4(혼잡도)와 3.2/3.5의 데이터 적재·가공(TourAPI/SK/TMAP)을 담당한다.
