# Route 데이터 구성 및 추천 기준

## 1. 문서 목적

틈타 서비스에서 우회 코스로 사용하는 `Route`와 `RouteStop` 데이터를 어떤 기준으로 구성하고 관리할지 정의한다.

본 문서는 현재 Prisma의 `Place`, `Route`, `RouteStop`, `Trip`, `TripEvent` 구조와 백엔드의 `route-calculation.service.ts` 기반 TMAP 경로 계산 방식, 현재 구현된 Route / Trip API를 기준으로 작성한다.

MVP에서는 사용자 요청 시 후보 Place를 조합해 새로운 Route를 동적으로 생성하기보다, 팀이 미리 구성하고 관리하는 Route 후보 중 사용자의 이용 가능 시간과 코스 조건에 맞는 Route를 활용하는 방식을 우선 적용한다.

현재 Route / Trip 조회 및 생성 API는 구현되어 있으며, 마지막 RouteStop에서 `mainPlace`로 복귀하는 구간의 저장 방식이나 Route 조회 시 TMAP 재계산 여부 등 현재 스키마와 API에 포함되지 않은 세부 동작은 추후 확정한다.

---

## 2. 현재 Route 데이터 구조

현재 백엔드의 주요 Route 관련 필드는 다음과 같다.

### Route

| 필드                              | 의미                   |
| ------------------------------- | -------------------- |
| `id`                            | Route 식별자            |
| `name`                          | 코스 이름                |
| `mainPlaceId`                   | 우회 코스의 기준이 되는 원래 관광지 |
| `description`                   | 코스 설명                |
| `estimatedTotalDurationMinutes` | Route의 예상 총 소요시간     |
| `estimatedTotalDistanceMeters`  | Route의 예상 총 이동거리     |

### RouteStop

| 필드                                    | 의미                          |
| ------------------------------------- | --------------------------- |
| `routeId`                             | 소속 Route                    |
| `placeId`                             | 방문 장소                       |
| `stopOrder`                           | Route 내 방문 순서               |
| `stayMinutes`                         | 해당 Route에서의 권장 체류시간         |
| `estimatedTravelMinutesFromPrevious`  | 이전 장소에서 현재 장소까지의 예상 이동시간    |
| `estimatedDistanceMetersFromPrevious` | 이전 장소에서 현재 장소까지의 예상 이동거리    |
| `pathFromPrevious`                    | 이전 장소에서 현재 장소까지의 TMAP 보행 경로 |

첫 번째 `RouteStop`의 이전 장소는 `Route.mainPlace`로 본다.

예시는 다음과 같다.

```text
mainPlace
→ RouteStop 1
→ RouteStop 2
→ RouteStop 3
```

Prisma 스키마에서는 동일한 Route 내에서 `routeId`와 `stopOrder`의 조합이 unique로 설정되어 있으므로 같은 Route 안에서 동일한 방문 순서를 중복해서 사용할 수 없다.

현재 `GET /api/routes/:routeId`에서는 Route 상세 조회 시 `RouteStop`을 `stopOrder` 오름차순으로 조회하고, 각 RouteStop과 연결된 내부 `Place` 정보를 함께 반환한다.

---

## 3. 외부 TourAPI 데이터와 내부 Route 데이터 구분

`GET /api/places/:id/local-places`에서 제공하는 주변 장소 정보는 요청 시 TourAPI와 TMAP 등 외부 API를 활용해 조회하는 데이터이다.

TourAPI에서 조회한 장소명, 주소, 좌표, 이미지 등의 관광정보 응답 자체를 틈타의 내부 `Place` 테이블에 그대로 적재하지 않는다.

```text
TourAPI 기반 local-places 결과
→ 사용자에게 주변 장소 정보로 제공
→ 외부 API 응답 자체를 DB에 그대로 저장하지 않음
→ RouteStop으로 자동 연결하지 않음
```

반면 저장형 Route의 `RouteStop.placeId`는 팀이 직접 관리하는 내부 `Place.id`를 참조한다.

```text
팀이 관리하는 내부 Place
→ Place.id
→ RouteStop.placeId로 연결
→ 저장형 Route 구성에 사용
```

따라서 외부 TourAPI 조회 결과와 내부 `Place` 데이터는 서로 다른 데이터 소스로 구분한다.

특정 장소를 팀이 저장형 Route의 구성 요소로 직접 관리할 필요가 있는 경우에는 해당 장소를 별도의 내부 Place 관리 기준에 따라 등록할 수 있다.

이 경우에도 TourAPI 응답 데이터를 그대로 복제하여 자동 저장하는 방식은 사용하지 않는다.

---

## 4. Route 구성 기본 원칙

MVP에서는 하나의 Route를 원래 관광지를 기준으로 여러 장소를 방문하는 형태로 구성한다.

```text
mainPlace
→ 내부 Place A
→ 내부 Place B
→ ...
→ 필요한 경우 mainPlace 복귀
```

Route의 장소 구성과 방문 순서는 미리 저장한다.

사용자 요청 시에는 새로운 장소 조합을 즉석에서 생성하기보다 해당 `mainPlace`에 등록된 저장형 Route 후보를 조회하는 방식을 우선 적용한다.

Route는 다음 기준을 만족하도록 구성한다.

* 기준 관광지인 `mainPlace`가 명확해야 한다.
* 최소 하나 이상의 `RouteStop`을 포함해야 한다.
* 모든 `RouteStop`은 DB에 존재하는 내부 `Place`를 참조해야 한다.
* 동일 Route 안에서 `stopOrder`가 중복되지 않아야 한다.
* 각 장소의 체류시간을 설정할 수 있어야 한다.
* 장소 사이의 TMAP 보행 경로 계산이 가능해야 한다.
* 사용자가 선택한 제한시간 안에 이용할 수 있는 코스인지 판단할 수 있어야 한다.

---

## 5. RouteStop 장소 선정 기준

Route에 포함할 내부 Place는 다음 기준을 바탕으로 검토한다.

### 필수 조건

* 팀이 관리하는 내부 DB의 `Place`에 등록되어 있다.
* `latitude`, `longitude`가 존재해 TMAP 경로 계산이 가능하다.
* 기준 관광지인 `mainPlace`에서 현실적으로 이동 가능한 위치에 있다.
* 실제 방문 장소로 사용자에게 제공할 수 있는 장소이다.

### 추가 고려 조건

* 장소의 운영시간
* 장소의 기본 권장 체류시간
* 장소 유형
* 태그
* mainPlace와의 이동거리
* 다른 RouteStop과의 위치 관계
* 전체 Route의 예상 소요시간

현재 `Place`에는 `openingTime`과 `closingTime`이 존재하지만, 요일별 영업시간, 정기 휴무일 및 임시 휴무 정보를 저장하는 구조는 없다.

따라서 현재 DB 정보만으로 장소의 정확한 실시간 영업 여부를 완전히 판단할 수 없으며, 저장된 운영시간 범위 안에서 확인 가능한 수준으로 활용한다.

외부 TourAPI에서 조회된 장소는 RouteStop 후보로 자동 등록하거나 연결하지 않는다.

---

## 6. 권장 체류시간 기준

장소 자체의 기본 권장 체류시간은 `Place.recommendedDuration`을 참고한다.

특정 Route에서 실제로 사용할 체류시간은 `RouteStop.stayMinutes`에 저장한다.

```text
Place.recommendedDuration
→ 장소 자체의 기본 권장 체류시간

RouteStop.stayMinutes
→ 해당 Route에서 실제 적용하는 체류시간
```

따라서 동일한 Place라도 Route의 전체 제한시간과 코스 성격에 따라 `stayMinutes`를 다르게 설정할 수 있다.

예를 들어 기본 권장 체류시간이 20분인 장소라도 짧은 Route에서는 10~15분 등 별도의 체류시간을 적용할 수 있다.

다만 지나치게 짧은 체류시간으로 인해 실제 방문 의미가 없어지지 않도록 장소별 최소 체류시간 기준은 추후 Route 데이터 구성 과정에서 정한다.

---

## 7. 30분 / 60분 / 90분 Route 구성 기준

사용자는 우회 코스를 이용할 수 있는 시간으로 다음 세 구간 중 하나를 선택한다.

| 코스 구분 | 사용자 선택 시간 |
| ----- | --------- |
| 짧은 코스 | 30분       |
| 기본 코스 | 60분       |
| 여유 코스 | 90분       |

30분, 60분, 90분은 Route가 정확히 해당 시간만큼 소요되어야 한다는 의미가 아니라 사용자가 허용하는 최대 이용시간으로 사용한다.

Route의 예상 총 소요시간은 다음 요소를 기준으로 계산한다.

```text
전체 Route 소요시간
= mainPlace → 첫 RouteStop 이동시간
+ 각 RouteStop 체류시간
+ RouteStop 간 이동시간
+ 필요한 경우 mainPlace 복귀 구간
```

원래 관광지로 다시 돌아오는 형태의 우회 코스라면 마지막 RouteStop에서 `mainPlace`까지의 복귀 이동시간도 전체 소요시간에 포함해야 한다.

다만 현재 `RouteStop` 스키마에는 마지막 RouteStop에서 `mainPlace`로 복귀하는 구간의 이동시간, 거리 및 경로를 별도로 저장하는 필드가 없다.

따라서 복귀 구간의 세부 저장 방식은 추후 별도로 확정한다.

추천 단계에서는 사용자가 선택한 시간보다 예상 총 소요시간이 긴 Route를 후보에서 제외하는 것을 기본 원칙으로 한다.

예시는 다음과 같다.

```text
사용자 선택 시간: 60분

Route A 예상 총 소요시간: 52분
→ 후보 포함

Route B 예상 총 소요시간: 67분
→ 후보 제외
```

현재 `GET /api/places/:placeId/routes` API 자체는 해당 `mainPlaceId`에 연결된 저장형 Route 목록을 조회한다.

현재 구현에는 30분 / 60분 / 90분 조건에 따른 별도의 서버 필터링 로직이 포함되어 있지 않으므로, 실제 시간 조건 필터링을 어느 계층에서 적용할지는 서비스 흐름에 맞춰 별도로 정한다.

---

## 8. RouteStop 순서 결정 기준

`RouteStop.stopOrder`는 Route에서 실제 장소를 방문하는 순서를 의미한다.

방문 순서는 다음 항목을 고려해 결정한다.

* mainPlace에서 첫 장소까지의 접근성
* RouteStop 사이의 실제 보행 이동시간
* 불필요한 왕복 이동 최소화
* 전체 이동거리
* 장소 운영시간
* 장소별 권장 체류시간
* 마지막 장소 이후 Route 종료 또는 mainPlace 복귀 가능성

Route 구성 시 TMAP 경로 계산 결과를 활용해 비효율적인 이동 순서를 줄인다.

예시는 다음과 같다.

```text
mainPlace
→ stopOrder 1
→ stopOrder 2
→ stopOrder 3
```

Prisma 스키마의 `@@unique([routeId, stopOrder])` 제약에 따라 동일 Route 안에서는 `stopOrder`가 중복되지 않는다.

현재 Route 상세 API에서도 RouteStop을 `stopOrder` 오름차순으로 반환한다.

---

## 9. TMAP 경로 계산 기준

Route 구성 과정의 보행 경로 계산은 백엔드의 `route-calculation.service.ts`를 활용한다.

경로 계산에는 DB에 저장된 내부 Place의 고정 좌표를 사용한다.

```text
Place.latitude
Place.longitude
```

TMAP 계산 결과는 다음 Route 데이터에 활용할 수 있다.

* `RouteStop.estimatedTravelMinutesFromPrevious`
* `RouteStop.estimatedDistanceMetersFromPrevious`
* `RouteStop.pathFromPrevious`
* `Route.estimatedTotalDurationMinutes`
* `Route.estimatedTotalDistanceMeters`

`pathFromPrevious`에는 이전 장소에서 현재 장소까지의 고정 보행 경로를 저장한다.

Prisma 스키마에서도 `pathFromPrevious`는 TMAP Place↔Place 경로에서 추출한 지도 폴리라인 렌더링용 경로 데이터로 정의되어 있다.

이는 내부 Place와 Place 사이의 고정 경로이며 사용자의 실제 GPS 좌표나 이동 기록이 아니다.

### 복귀 구간

현재 `RouteStop`의 경로 관련 필드는 모두 이전 장소에서 현재 RouteStop까지의 구간을 기준으로 한다.

따라서 마지막 RouteStop에서 `mainPlace`로 다시 돌아오는 복귀 구간을 사용하는 경우 해당 구간의 세부 경로를 어떤 방식으로 저장할지는 현재 스키마만으로 확정할 수 없다.

복귀 구간의 이동시간은 전체 Route 예상 소요시간 계산에 포함할 수 있지만, 세부 거리와 폴리라인 저장 방식은 추후 별도로 확정한다.

---

## 10. Route 소요시간 검증

Route 구성 시 `route-calculation.service.ts`를 이용해 내부 Place 간 보행 경로를 계산하고 예상 이동시간과 이동거리 정보를 Route 및 RouteStop 데이터에 반영하는 방식을 기준으로 한다.

현재 구현된 Route 조회 API는 DB에 저장된 Route 데이터를 조회한다.

Route 조회 요청마다 TMAP을 다시 호출해 최신 이동시간을 계산하는 동작은 현재 Route 조회 API에 포함되어 있지 않다.

MVP에서는 우선 저장된 Route의 예상 총 소요시간을 기준으로 사용자가 선택한 시간에 맞는 후보를 판단하는 방식을 사용한다.

```text
현재 관광지의 혼잡 상태 확인
→ 사용자가 30 / 60 / 90분 선택
→ 해당 mainPlace의 저장된 Route 조회
→ 저장된 예상 총 소요시간 기준 후보 판단
→ 선택 시간 내 이용 가능한 Route 추천
```

향후 사용자 요청 시 최신 TMAP 경로를 다시 계산하는 기능이 필요한 경우 다음 요소를 고려해 적용 여부를 결정한다.

* TMAP 보행자 API 호출 한도
* 응답 속도
* 저장된 경로와 최신 경로의 차이
* 사용자 요청당 필요한 API 호출 횟수

TMAP 보행자 API는 외부 API 호출 비용과 응답시간에 영향을 줄 수 있으므로 불필요한 반복 호출은 피하는 방향을 우선 검토한다.

---

## 11. Route 필터링 기준

사용자에게 Route를 추천하기 전에 다음 조건을 확인하는 것을 기본 원칙으로 한다.

### 1차 필터링

* 현재 관광지를 `mainPlace`로 하는 Route인지 확인한다.
* 사용자가 선택한 30분, 60분, 90분 시간 조건에 맞는지 확인한다.
* RouteStop 데이터가 정상적으로 구성되어 있는지 확인한다.
* 저장된 예상 총 소요시간이 사용자 선택 시간 이하인지 확인한다.
* 장소 운영시간 정보가 존재하는 경우 예상 방문 가능한 시간인지 확인한다.

### 최종 확인

* Route 구성에 필요한 TMAP 경로 계산이 정상적으로 완료된 데이터인지 확인한다.
* RouteStop의 이동시간과 체류시간 데이터가 존재하는지 확인한다.
* 사용자가 선택한 제한시간 내 이용 가능한지 확인한다.
* 명확하게 이용 불가능한 장소가 포함되어 있지 않은지 확인한다.
* 원래 관광지 복귀가 필요한 Route라면 복귀시간까지 포함한 총 소요시간을 확인한다.

향후 사용자 요청 시 TMAP 재계산 기능을 도입하는 경우에는 최신 계산 결과를 최종 소요시간 판단에 우선 적용할 수 있다.

조건을 만족하지 않는 Route는 추천 후보에서 제외한다.

현재 Route 목록 API는 `mainPlaceId` 기준 Route 조회를 담당하며, 위 추천 필터링 기준 전체가 해당 API 내부에 구현되어 있다는 의미는 아니다.

---

## 12. Route ranking 기준

여러 Route가 필터링 조건을 만족하는 경우 다음 항목을 ranking 후보 기준으로 활용할 수 있다.

* 사용자가 선택한 시간과 Route 예상 총 소요시간의 적합도
* 총 이동시간
* 총 이동거리
* RouteStop 수
* 각 장소에 확보된 체류시간
* Route 데이터의 완전성 및 유효성

초기 MVP에서는 복잡한 점수 기반 추천 모델보다 단순한 우선순위 규칙을 먼저 적용하는 방향을 검토한다.

예를 들어 동일한 60분 Route 후보가 여러 개 존재한다면 불필요한 이동이 적고 충분한 체류시간을 확보할 수 있는 Route를 우선할 수 있다.

구체적인 ranking 우선순위와 가중치는 실제 Route 데이터 구성 후 팀 논의를 통해 확정한다.

SK 실시간 혼잡도를 각 RouteStop의 ranking 요소로 활용할 수 있는지는 개별 장소의 SK POI 매칭 및 조회 가능 범위를 확인한 후 결정한다.

---

## 13. 데이터 누락 및 예외 처리

### Place 좌표가 없는 경우

TMAP 경로 계산이 불가능하므로 해당 내부 Place를 RouteStop으로 구성하지 않는다.

### `recommendedDuration`이 없는 경우

Route 구성 과정에서 `RouteStop.stayMinutes`를 별도로 설정할 수 있다.

공통 기본값을 사용할지 여부는 실제 Route 데이터 구성 과정에서 결정한다.

### `stayMinutes`가 없는 경우

전체 Route 소요시간을 정확하게 계산하기 어려우므로 추천에 사용할 수 있도록 Route 데이터 구성 단계에서 보완하는 것을 우선한다.

### 운영시간 정보가 없는 경우

현재 이용 가능 여부를 정확하게 판단하기 어렵다.

운영시간 정보가 없는 장소를 Route에서 허용할지 여부는 별도 추천 정책으로 정한다.

### 휴무일 정보가 없는 경우

현재 스키마에는 요일별 영업시간, 정기 휴무 및 임시 휴무 정보를 저장하는 구조가 없으므로 정확한 판단이 불가능하다.

추가 데이터 확보 여부에 따라 보완한다.

### TMAP 경로 계산 실패

Route 생성 또는 관리 단계에서 경로 계산이 완료되지 않은 Route는 정상 추천 후보로 사용하지 않는 것을 기본 원칙으로 한다.

### 선택 시간 내 Route가 없는 경우

사용자에게 선택한 시간 내 이용 가능한 우회 코스가 없음을 안내한다.

필요한 경우 더 긴 시간 조건을 선택하도록 안내할 수 있다.

```text
30분 → 60분
60분 → 90분
```

### RouteStop으로 사용할 내부 Place가 없는 경우

TourAPI 기반 `local-places` 조회 결과를 임의로 `RouteStop`에 연결하거나 외부 API 응답 전체를 내부 `Place`에 그대로 저장하지 않는다.

해당 장소를 저장형 Route에서 지속적으로 관리할 필요가 있는 경우, 팀의 내부 Place 관리 기준에 따라 별도의 내부 데이터로 등록할지 결정한 뒤 Route에 포함한다.

---

## 14. Route와 Trip의 역할 구분

`Route`는 팀이 미리 구성하고 관리하는 저장형 코스 데이터이다.

`Trip`은 사용자가 특정 Route를 선택했을 때 생성되는 Route 이용 단위이다.

서버에서는 선택한 `routeId`와 Trip의 상태, 시작·종료 시각 등을 관리한다.

```text
Route
→ 방문 장소와 순서, 예상 이동시간 및 체류시간 정의

Trip
→ 사용자가 선택한 Route의 이용 단위 및 Trip 수준의 상태 관리

TripEvent
→ Trip과 관련된 이벤트를 기록하기 위한 데이터 구조
```

Prisma의 `TripEventType`에는 다음 이벤트 타입이 정의되어 있다.

```text
TRIP_STARTED
PLACE_ARRIVED
PLACE_LEFT
MAIN_PLACE_RETURNED
TRIP_COMPLETED
TRIP_CANCELLED
```

다만 현재 서버의 `POST /api/trips/:tripId/events` API에서 실제로 허용하는 이벤트는 다음 세 종류로 제한되어 있다.

```text
TRIP_STARTED
TRIP_COMPLETED
TRIP_CANCELLED
```

현재 API에서는 `PLACE_ARRIVED`, `PLACE_LEFT`, `MAIN_PLACE_RETURNED` 이벤트를 서버에 기록하지 않는다.

`TRIP_STARTED`, `TRIP_COMPLETED`, `TRIP_CANCELLED` 이벤트가 발생하면 서버에서는 Trip의 `status`, `startedAt`, `endedAt` 등 Trip 수준의 상태를 갱신한다.

사용자의 위치를 기반으로 한 다음과 같은 세부 진행 판단은 모바일 local state에서 수행한다.

* 특정 장소에 도착했는지
* 특정 장소에서 출발했는지
* 현재 어느 RouteStop을 진행하고 있는지
* 원래 관광지로 복귀했는지

Prisma의 `TripEvent`에는 `placeId`와 `metadata` 필드가 존재하지만 사용자의 실제 GPS 좌표를 저장하는 `latitude`, `longitude` 필드는 의도적으로 두지 않는다.

또한 privacy 원칙에 따라 `metadata`에도 사용자의 현재 좌표나 실제 이동 경로 등의 위치정보를 저장하지 않는다.

현재 `POST /api/trips/:tripId/events` API 역시 요청에서 `eventType`만 사용하며 장소별 도착·출발 정보를 서버 이벤트로 처리하지 않는다.

따라서 서버의 `Trip` / `TripEvent`는 사용자의 실제 GPS 이동 경로나 장소별 진행 상황을 추적하기 위한 용도로 사용하지 않는다.

---

## 15. 현재 구현 상태와 역할 구분

현재 Route / Trip 관련 Prisma 구조와 Route / Trip API가 구현되어 있다.

주요 관련 항목은 다음과 같다.

* `Route`
* `RouteStop`
* `Trip`
* `TripEvent`
* `RouteStop.pathFromPrevious`
* `route-calculation.service.ts`

현재 구현된 Route / Trip API는 다음과 같다.

```text
GET /api/places/:placeId/routes
GET /api/routes/:routeId
POST /api/trips
POST /api/trips/:tripId/events
GET /api/trips/:tripId
```

### `GET /api/places/:placeId/routes`

해당 `placeId`를 `mainPlaceId`로 하는 저장형 Route 목록을 조회한다.

현재 구현에서는 `mainPlaceId`를 기준으로 Route를 조회하며, Route는 `id` 오름차순으로 반환한다.

30분 / 60분 / 90분 시간 조건에 따른 추가 필터링은 해당 API 내부에서 수행하지 않는다.

### `GET /api/routes/:routeId`

특정 Route의 상세 정보를 조회한다.

RouteStop은 `stopOrder` 오름차순으로 조회하며 각 RouteStop에 연결된 내부 `Place` 정보도 함께 반환한다.

존재하지 않는 Route인 경우 `ROUTE_NOT_FOUND`를 반환한다.

### `POST /api/trips`

요청의 `routeId`를 기준으로 해당 Route에 대한 Trip을 생성한다.

Prisma 스키마에서 Trip의 기본 상태는 `PLANNED`이다.

존재하지 않는 Route인 경우 `ROUTE_NOT_FOUND`를 반환한다.

### `POST /api/trips/:tripId/events`

특정 Trip에 TripEvent를 생성한다.

Prisma의 `TripEventType`에는 다음 여섯 종류가 정의되어 있다.

```text
TRIP_STARTED
PLACE_ARRIVED
PLACE_LEFT
MAIN_PLACE_RETURNED
TRIP_COMPLETED
TRIP_CANCELLED
```

그러나 현재 서버 API에서 허용하는 이벤트는 다음 세 종류이다.

```text
TRIP_STARTED
TRIP_COMPLETED
TRIP_CANCELLED
```

현재 구현에서는 각각의 이벤트에 따라 다음과 같이 Trip 상태 정보를 갱신한다.

```text
TRIP_STARTED
→ status를 IN_PROGRESS로 변경
→ startedAt 기록

TRIP_COMPLETED
→ status를 COMPLETED로 변경
→ endedAt 기록

TRIP_CANCELLED
→ status를 CANCELLED로 변경
→ endedAt 기록
```

`PLACE_ARRIVED`, `PLACE_LEFT`, `MAIN_PLACE_RETURNED`는 Prisma enum에는 정의되어 있으나 현재 서버 API의 허용 이벤트에는 포함되어 있지 않다.

장소 도착·출발·복귀 여부에 대한 GPS 기반 판정은 mobile local state에서 수행하며 사용자의 실제 GPS 좌표 및 이동경로는 서버에 저장하지 않는다.

### `GET /api/trips/:tripId`

Trip 정보와 해당 Trip에 기록된 TripEvent 목록을 조회한다.

TripEvent는 `occurredAt` 오름차순으로 조회한다.

존재하지 않는 Trip인 경우 `TRIP_NOT_FOUND`를 반환한다.

---

## 16. 추후 확인 및 결정 사항

* 실제 저장형 Route에 포함할 내부 Place 선정 방식
* 내부 Place 신규 등록 및 관리 절차
* 외부 TourAPI 데이터와 내부 Place 간 운영 기준
* 장소 유형별 기본 `recommendedDuration` 기준
* `RouteStop.stayMinutes` 설정 기준
* 30분 / 60분 / 90분 Route별 적정 RouteStop 개수
* 시간 조건에 따른 Route 필터링을 적용할 계층
* Route 소요시간에 별도 여유시간을 적용할지 여부
* 마지막 RouteStop → mainPlace 복귀 구간의 저장 방식
* 복귀 구간의 거리 및 경로 데이터 저장 방식
* 사용자 Route 조회 시 TMAP을 다시 호출해 경로를 재계산할지 여부
* 운영시간 정보가 없는 Place의 추천 정책
* 요일별 영업시간 및 휴무일 데이터 확보 방식
* Route ranking 우선순위 및 가중치
* SK 실시간 혼잡도를 Route ranking에 활용할지 여부
* 태그를 Route 추천에 활용할지 여부
* 관리자 웹의 Route 생성·수정 방식
* Prisma에는 정의되어 있지만 현재 서버에서 사용하지 않는 `PLACE_ARRIVED`, `PLACE_LEFT`, `MAIN_PLACE_RETURNED` 이벤트의 향후 처리 여부
* 동적 Route 생성 기능을 MVP 이후 도입할지 여부
