# 틈타 서비스 전체 구조 (2026-08-12 기준)

**서비스 목적: 오버투어리즘 완화.** 혼잡도(실시간)와 집중률 예측(날짜별)을 판단 근거로,
붐비는 대형 관광지의 수요를 주변 로컬 장소로 분산시키는 우회 코스를 제안한다.
아래 유저플로우·데이터 흐름·API는 모두 이 "감지(혼잡) → 분산(우회)" 구조를 구현한 것이다.

유저플로우 · 데이터 흐름 · API 호출 구조 한눈에 보기.
상세 명세는 [api-spec.md](./api-spec.md), 담당별 할 일은 [team-todo.md](./team-todo.md) 참조.

---

## 1. 유저플로우

```
[검색]                [목적지 선택]           [우회 코스 후보]              [상세 판단]
 관광지·장소 검색  →   결과에서 목적지 탭  →   주변 로컬 장소 목록        →   혼잡도/집중률 확인
 (TOUR/TMAP 통합)      (contentId|poiId)       (TMAP 실제 보행거리 순)        (실시간 + 30일 예측)
                                                                              ↓
                                                              [코스/방문 — 팀원 A 구현 예정]
                                                               Route 저장 → Trip 진행 관리
```

| 단계 | 호출 API |
|---|---|
| 검색 | `GET /api/search/places?keyword=` |
| 주변 로컬 장소 | `GET /api/local-places?contentId=…` 또는 `?poiId=…` |
| 실시간 혼잡도 | `GET /api/congestion?poiId=` (TMAP 목적지만) |
| 날짜별 집중률 예측 | `GET /api/places/:id/concentration-forecast` (DB 장소) |
| 코스/방문 | 3.5~3.9 — **미구현(팀원 A)** |

---

## 2. 데이터 흐름 — "실시간(비저장)"과 "적재(DB)"의 구분

공모전 데이터 활용 기준: **관광정보(장소명·주소·좌표·이미지)는 요청 시점에 실시간 조회하며 DB에 저장하지 않는다.**

### 실시간 경로 (DB 미저장)

```
앱 요청 → teumta 서버 → 외부 API 호출 → 변환 → 응답 (저장 없음)

  검색:        TourAPI searchKeyword2 → 없으면 TMAP POI 검색 폴백
  주변 장소:   TourAPI detailCommon2(기준 좌표) + locationBasedList2(14/38/39)
               → 중복 제거·선별(최대 10) → TMAP 보행자 경로(동시 3) → 거리순 정렬
  혼잡도:      SK 퍼즐 실시간 장소 혼잡도 (서버 5분 캐시 — 쿼터 절약, DB 미저장)
```

### 적재 경로 (DB 저장 — 팀 관리 내부 데이터만)

```
  Place:       ingest:tour 스크립트(수동) — tourApiContentId·법정동 코드 등
               집중률 매칭용 참조 데이터. 주변 장소 API 런타임에서는 사용 안 함
  Congestion:  집중률 예측 스케줄러(자동) — 서버 기동 시 + 매일 05시 KST
               KTO 30일 예측 → 지역+이름 매칭(관리자 alias 우선) → MATCHED만 저장
               미매칭 항목은 관리자 웹 "데이터 매칭" 화면에서 수동 연결(ForecastPlaceAlias)
  Route/Trip:  팀원 A 구현 예정 — TMAP 경로 계산(route-calculation.service) 소비
```

### 개인정보 원칙 ([location-privacy.md](./location-privacy.md))

- 서버 API는 **좌표를 입력으로 받지 않는다** — 식별자(contentId/poiId)만 받고 서버가 좌표로 해석
- 사용자 GPS는 단말 내부에서만 처리, 서버 전송·저장 금지

---

## 3. 외부 API 호출량 구조 (쿼터 관리)

| 사용자 액션 | TourAPI | TMAP | 퍼즐 |
|---|---|---|---|
| 검색 1회 | 1 | 0~1 (폴백 시) | - |
| 주변 장소 1회 (contentId) | 4 (detail 1 + 목록 3) | 10 (보행자) | - |
| 주변 장소 1회 (poiId) | 3 (목록) | 11 (POI 상세 1 + 보행자 10) | - |
| 혼잡도 1회 | - | - | 0~1 (5분 캐시) |

**한도**: TourAPI 일 1,000(공공포털 개발계정) · TMAP 보행자 일 1,000 / POI 검색 일 20,000 (Free) · 퍼즐 월 3,000 (해커톤).
→ **하루 감당량 ≈ 주변 장소 조회 100회** (병목: TMAP 보행자). 프론트는 검색 자동완성 금지(debounce/버튼).

---

## 4. 배포 (Cloudtype, 서울 리전)

```
GitHub org main 머지 → Cloudtype 콘솔 "배포하기" → 반영
```

- 서버: `https://port-0-teumta-server-msh476v8e47b3c7e.sel3.cloudtype.app`
  (기동 시 `prisma migrate deploy` 자동 실행 — 스키마 변경도 머지→배포로 반영)
- 관리자 웹: `https://port-0-teumta-admin-web-msh476v8e47b3c7e.sel3.cloudtype.app`
  (로그인 필요 — 서버 환경변수 `ADMIN_PASSWORD`로 검증)
- DB: MariaDB 11.2, 영구 볼륨(재시작 시 데이터 유지 검증됨)
- DB 백업: GitHub Actions(`db-backup.yml`) 매일 05:30 KST → artifact 30일 보관
- 서버·DB 모두 유료 리소스 — 상시 실행
- 상세: [deploy-cloudtype.md](./deploy-cloudtype.md)

---

## 5. 서버 코드 구조 (담당 경계)

```
server/src/
├── external/          # [B] 외부 API 클라이언트·매퍼 (tour/tmap/congestion/prediction/common)
├── services/
│   ├── place.service.ts              # [A] 장소 도메인 (구 getNearbyLocalPlaces는 deprecated)
│   ├── tag.service.ts                # [B] 태그 관리 (관리자 웹용)
│   ├── concentration-matching.service.ts # [B] 집중률 매칭 preview/alias (관리자 웹용)
│   ├── nearby-local-place.service.ts # [B] 실시간 주변 장소
│   ├── place-search.service.ts       # [B] 목적지 검색
│   ├── congestion.service.ts         # [B] 혼잡도/예측 조회
│   ├── *-ingestion.service.ts        # [B] 적재
│   ├── prediction-scheduler.service.ts # [B] 일일 적재 스케줄러
│   └── route-calculation.service.ts  # [B 제공 → A 소비] TMAP 경로 계산
├── middlewares/                      # error / admin-auth / login-rate-limit
├── controllers/ · routes/            # [A/B 각자 담당 엔드포인트]
└── prisma/                           # [A] 스키마 (외부 연동 필드는 B와 협의)
```

관리자 웹은 `admin/` (React+TS+Vite, [B]) — API 명세는 [api-spec.md §6](./api-spec.md).
