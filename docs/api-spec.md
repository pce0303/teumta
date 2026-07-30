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
