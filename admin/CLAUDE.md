# CLAUDE.md

## 1. Project Overview

이 저장소는 2026 관광데이터 활용 공모전 프로젝트 **틈타(teumta)** 이다.

틈타는 혼잡한 관광지 방문을 포기하거나 다른 관광지로 완전히 보내는 서비스가 아니다.

핵심 흐름은 다음과 같다.

관광지 선택
→ 현재 혼잡도 확인
→ 혼잡한 경우 사용 가능한 시간에 맞는 주변 로컬 우회 코스 추천
→ 로컬 장소 방문
→ 적절한 시점에 원래 관광지로 복귀

핵심 제품 가치는 다음 문장으로 요약한다.

> 기다릴 시간을 여행으로 바꾸고, 원래 관광지로 돌아갈 시간을 계산한다.

단순한 주변 장소 추천 서비스로 변질시키지 않는다.

---

# 2. Repository Structure

현재 주요 구조는 다음과 같다.

```text
teumta/
├── mobile/      # Expo + React Native 사용자 앱
├── server/      # Express + TypeScript + Prisma 백엔드
├── docs/        # 서비스/API/협업 문서
└── admin/       # 관리자 웹. 신규 개발 영역
```

관리자 웹은 사용자 앱과 별도의 웹 애플리케이션으로 개발한다.

권장 스택:

```text
React
TypeScript
Vite
```

필요한 라이브러리는 실제 필요성이 있을 때만 최소한으로 추가한다.

---

# 3. Current Development Status

## Backend

백엔드는 다음 기반이 구현되어 있다.

* Express + TypeScript
* Prisma
* MariaDB/MySQL
* TourAPI
* TMAP
* SK 실시간 장소 혼잡도
* KTO 관광지 집중률 예측
* Cloudtype 배포

현재 주요 모델:

```text
Place
Tag
PlaceTag
Congestion
Route
RouteStop
Trip
TripEvent
```

`Route`, `RouteStop`, `Trip`, `TripEvent` 스키마는 존재하지만,
Route/Trip 도메인 API는 다른 팀원이 구현 중일 수 있다.

반드시 실제 현재 코드를 확인하고 판단한다.

---

# 4. Team Ownership Boundaries

현재 협업 충돌 방지를 위해 아래 경계를 매우 중요하게 취급한다.

## Backend A 영역

주로 다음 영역을 담당한다.

```text
Route
RouteStop
Trip
TripEvent
코스 추천/조합 로직
Route/Trip API
```

예:

```text
GET  /api/places/:placeId/routes
GET  /api/routes/:routeId
POST /api/trips
POST /api/trips/:tripId/events
GET  /api/trips/:tripId
```

이 영역은 다른 팀원이 동시에 작업 중일 수 있다.

### 관리자 웹 작업 중 임의로 수정하지 않는다.

특히 다음 작업을 하지 않는다.

* Route 추천 알고리즘 구현
* 30/60/90분 코스 조합 로직 수정
* Trip 진행 로직 수정
* TripEvent 구조 변경
* Route/RouteStop Prisma 모델 변경

필요성이 발견되면 코드를 직접 바꾸지 말고 작업 종료 시 blocker 또는 TODO로 보고한다.

---

## Backend B / 외부 연동 영역

주요 코드:

```text
server/src/external/
server/src/services/nearby-local-place.service.ts
server/src/services/place-search.service.ts
server/src/services/congestion.service.ts
server/src/services/*-ingestion.service.ts
server/src/services/prediction-scheduler.service.ts
server/src/services/route-calculation.service.ts
```

외부 API 동작을 관리자 웹 편의를 위해 중복 구현하거나 임의 변경하지 않는다.

관리자 웹은 가능하면 기존 서버 API를 소비한다.

---

# 5. Admin Web Purpose

관리자 웹의 목적은 단순한 CRUD 백오피스가 아니다.

> 틈타를 통한 관광객의 우회와 복귀 흐름을 운영하고,
> 혼잡 분산 및 로컬 유입 효과를 확인하는 운영 도구

로 설계한다.

사용자 앱이 여행자용 틈타라면,
관리자 웹은 관광지 운영자/지자체/관광기관 관점의 틈타다.

---

# 6. Admin Information Architecture

목표 구조:

```text
Admin
├── Dashboard
├── Places
├── Data Matching
├── Routes
└── Analytics
```

단, 모든 기능을 한 번에 구현하지 않는다.

현재 우선순위는 다음과 같다.

## Phase 1

```text
Admin project foundation
Dashboard shell
Place management
```

## Phase 2

```text
KTO concentration matching management
Tag management
Admin authentication
```

## Phase 3

Route API가 실제 완성된 이후:

```text
Route management
```

## Phase 4

Trip / TripEvent가 실제 앱과 연동된 이후:

```text
Analytics
우회율
로컬 장소 도착률
원 관광지 복귀율
코스 완료율
평균 우회 시간
평균 방문 시각 이동량
```

---

# 7. Never Fake Analytics

관리자 웹에서 가장 중요한 규칙 중 하나다.

실제 DB/API에서 얻을 수 없는 지표를 임의의 숫자로 만들어 표시하지 않는다.

금지 예:

```text
오늘 이용자 1,203명
우회 선택률 73%
복귀율 82%
```

실제 데이터 수집이 구현되지 않았다면 이런 값을 mock으로 만들지 않는다.

대신 다음 중 하나를 사용한다.

```text
아직 수집되지 않음
데이터 수집 준비 중
TripEvent 연동 후 제공 예정
```

Dashboard 초기 버전에서는 실제 `Place` 데이터처럼 현재 서버에서 조회 가능한 데이터만 사용해도 된다.

---

# 8. Existing APIs Relevant to Admin

실제 코드를 항상 최종 source of truth로 확인한다.

현재 기준 주요 장소 API는 다음과 같다.

```text
GET /api/places
GET /api/places/:id

POST /api/admin/places
PATCH /api/admin/places/:id
```

장소는 다음과 같은 정보를 가진다.

```text
name
type
address
latitude
longitude
imageUrl
description
openingTime
closingTime
recommendedDuration
tags
```

`PlaceType`:

```text
TOURIST_SPOT
LOCAL_PLACE
```

응답 envelope는 일반적으로 다음 형태다.

```json
{
  "success": true,
  "data": {},
  "error": null
}
```

API 타입을 작성할 때 이 구조를 반영한다.

---

# 9. Tag Limitation

현재 `Place ↔ Tag` 모델과 `tagIds` 기반 수정 기능은 존재하지만,
관리자용 Tag 목록/CRUD API가 아직 없을 수 있다.

실제 코드를 확인한다.

Tag API가 없으면 관리자 프론트에서 임의로 API를 가정하거나 가짜 태그를 만들지 않는다.

Phase 1에서는:

* 기존 tag 표시: 가능
* tag 수정 UI: 필요하면 비활성/보류
* 필요한 API: TODO로 보고

한다.

---

# 10. Admin Authentication

현재 `/api/admin/*`가 인증 없이 노출되어 있을 가능성이 있다.

이는 배포 전 반드시 해결해야 하는 문제다.

하지만 별도의 명시적인 작업 요청이 없는 한,
관리자 프론트 작업 중 임의로 복잡한 사용자/회원 시스템을 만들지 않는다.

필요한 것은 추후 최소 관리자 인증이다.

예:

```text
단일 관리자 또는 소수 관리자
로그인
서버 검증
admin API 보호
```

클라이언트 번들에 관리자 비밀번호나 secret을 하드코딩하는 방식은 절대 사용하지 않는다.

인증이 구현되지 않은 상태의 관리자 웹은 외부 공개 배포가 완료된 것으로 간주하지 않는다.

---

# 11. Location Privacy

틈타는 위치 개인정보 최소화 원칙을 따른다.

사용자 실제 GPS 좌표를 서버에 저장하지 않는다.

특히:

```text
TripEvent
metadata
Admin analytics
```

에 사용자 현재 위치나 실제 이동 경로를 추가하지 않는다.

도착 여부 등은 이벤트 형태로 기록한다.

예:

```text
PLACE_ARRIVED
MAIN_PLACE_RETURNED
```

관리자 웹을 만들기 위해 privacy 정책을 약화시키지 않는다.

---

# 12. Admin Frontend Rules

관리자 웹은 `admin/`에 독립적으로 작성한다.

환경변수 예:

```text
VITE_API_BASE_URL
```

API 주소를 컴포넌트 내부에 하드코딩하지 않는다.

API 호출 로직과 UI를 분리한다.

권장 구조 예:

```text
admin/src/
├── api/
├── components/
├── layouts/
├── pages/
├── types/
└── utils/
```

과도한 추상화는 하지 않는다.

현재 규모에서 Redux 같은 전역 상태 관리 라이브러리를 필요 없이 추가하지 않는다.

---

# 13. Visual Direction

관리자 웹은 사용자 앱과 동일한 브랜드라는 느낌은 유지하되,
모바일 화면을 그대로 확대 복사하지 않는다.

관리자 UI의 우선순위:

```text
가독성
정보 구조
운영 효율
데이터 비교
```

과도한 gradient, glassmorphism, 지나친 card 남용 등
전형적인 AI-generated dashboard 느낌을 피한다.

틈타 브랜드의 green 계열을 accent로 사용할 수 있지만
전체 화면을 초록색으로 채우지 않는다.

Desktop-first 관리자 웹으로 설계한다.

---

# 14. Engineering Rules

작업을 시작하기 전에 반드시 확인한다.

```bash
git status
git branch --show-current
```

그리고 다음 파일을 우선 읽는다.

```text
docs/service-overview.md
docs/team-todo.md
docs/api-spec.md
server/prisma/schema.prisma
server/src/routes/
```

문서와 코드가 충돌하면 실제 현재 코드가 우선이다.

단, 코드가 협업 중인 미완성 상태일 가능성도 있으므로
`team-todo.md`와 최근 변경사항도 함께 참고한다.

---

# 15. Existing Work Safety

다른 팀원의 작업을 보호한다.

절대:

```text
git reset --hard
git clean -fd
강제 checkout
임의 rebase
다른 사람 변경사항 되돌리기
```

를 수행하지 않는다.

사용자가 명시적으로 요청하지 않는 한:

```text
commit
push
PR 생성
```

도 하지 않는다.

현재 working tree에 사용자 변경사항이 있으면 보존한다.

---

# 16. Scope Discipline

요청받은 기능을 구현하기 위해 필요하지 않은 파일은 수정하지 않는다.

특히 관리자 웹 작업 중:

```text
mobile/
```

은 수정하지 않는 것을 기본 원칙으로 한다.

서버 변경 역시 기존 API로 해결할 수 없는 경우에만 제안한다.

서버 변경이 필요한 경우:

1. 왜 필요한지 설명
2. 어떤 API/스키마 변경인지 명시
3. 다른 담당 영역과 충돌하는지 확인

한 뒤 진행한다.

---

# 17. No Mock-Driven Production Features

초기 UI 검증 목적이 아니라면 관리자 웹에 mock 데이터를 추가하지 않는다.

기존 서버 API를 사용할 수 있으면 반드시 실제 API와 연결한다.

API가 없으면:

```text
가짜 API 작성
임의 JSON 생성
임의 분석 숫자 생성
```

대신 명확한 empty state와 TODO를 사용한다.

---

# 18. Quality Gate

작업 종료 전 가능한 범위에서 반드시 확인한다.

```text
TypeScript typecheck
lint
production build
```

실행 가능한 테스트가 있으면 관련 테스트를 수행한다.

기존 오류와 새로 만든 오류를 구분해서 보고한다.

---

# 19. Work Completion Report

작업을 마치면 다음을 간단히 정리한다.

```text
1. 구현한 것
2. 수정한 주요 파일
3. 사용한 기존 API
4. 새로 발견한 blocker/TODO
5. 실행한 검증
6. 다음 권장 작업
```

코드 변경이 실제보다 더 완성된 것처럼 표현하지 않는다.

---

# 20. Most Important Principle

관리자 웹을 만드는 과정에서 사용자 앱의 핵심 기능 개발을 방해하지 않는다.

현재 핵심 사용자 기능 중 특히:

```text
30/60/90분 시간 맞춤 우회 코스 추천
Route
Trip
TripEvent
```

영역은 병렬 작업 중일 수 있다.

관리자 웹은 해당 영역을 기다리지 않고 독립적으로 개발할 수 있는 기능부터 진행한다.

현재 가장 안전한 시작점은:

```text
Admin foundation
→ Place management
→ 실제 데이터 기반의 최소 Dashboard
```

이다.
