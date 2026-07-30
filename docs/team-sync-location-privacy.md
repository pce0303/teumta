# [팀 공지] 위치정보 처리 구조 변경 — 로컬 최신화 & 준수사항

프론트/백엔드에 걸쳐 **사용자 위치정보 처리 구조**를 수정했습니다.
핵심 원칙: **사용자 실제 GPS는 단말기 안에서만 처리하고, 서버로 절대 전송/저장하지 않는다.**

## 관련 PR
- `PR #8` 위치정보 처리 구조 (front + backend) ← **이번 변경, 리뷰 후 머지 예정**
- (참고) `PR #6` 외부 API 연동 · `PR #7` mobile-setup 은 이미 `main`에 머지됨

## 바뀐 것 요약
- **백엔드**: `TripEvent.latitude/longitude` 제거, `Trip.deviceId` 제거 (+마이그레이션)
- **프론트**: 위치는 **foreground 전용**, 도착 판정/거리 계산은 단말에서(Haversine), 길찾기는 외부 지도앱에 **목적지만** 전달
- 자세한 배경: [`docs/location-privacy.md`](./location-privacy.md)

---

## 1) 로컬 최신화 방법 (PR #8 머지 후)

```bash
# 0. 지금 작업 중인 변경이 있으면 먼저 저장
git status
git stash            # 커밋 안 한 변경이 있을 때만

# 1. main 최신화
git checkout main
git fetch origin
git pull origin main

# 2. 내 작업 브랜치를 최신 main 위로
git checkout <내-작업-브랜치>
git rebase main       # (merge를 쓰던 사람은 git merge main)
git stash pop         # 위에서 stash 했다면
```

**백엔드 반영** (스키마/마이그레이션 변경 있음)
```bash
cd server
npm install
npx prisma migrate dev   # 새 마이그레이션 적용 + 클라이언트 재생성
```
> ⚠️ 마이그레이션이 `TripEvent`의 위치 컬럼과 `Trip.deviceId`를 DROP 합니다.
> 로컬 dev DB라 문제없지만, 꼬이면 (dev 한정) `npx prisma migrate reset` 후 다시 `migrate dev`.

**프론트 반영** (app.json 위치 플러그인 추가)
```bash
cd mobile
npm install
npx expo start -c        # 캐시 클리어 후 재시작
# 커스텀 dev build(프리빌드) 쓰는 사람만: npx expo prebuild --clean 로 권한 반영
```

---

## 2) 위치정보 — 꼭 지켜야 할 것

### ✅ 해도 되는 것
- `Place.latitude/longitude`(관광지 **고정 좌표**)는 서버에서 계속 관리
- TMAP 경로는 **Place ↔ Place 좌표**로만 계산
- 길찾기는 외부 지도앱 실행 시 **목적지(name/lat/lng)만** 전달 (출발지 미지정 → 외부앱이 자체 위치 사용)

### 🚫 절대 하면 안 되는 것
- 사용자 **현재 GPS를 서버로 전송** (request body / query / header / **로그** / analytics / `metadata` 어디에도)
- `user GPS → 우리 backend → TMAP` 형태 호출
- `TripEvent` / `metadata`에 사용자 위치 저장, 장기 `deviceId` 저장
- **background 위치 권한**(`ACCESS_BACKGROUND_LOCATION`) 추가, 앱 종료 후 추적
- 사용자 GPS를 `Coordinate` 타입에 담기 (이 타입은 **Place 좌표 전용**)

### 📱 프론트 구현 규칙
- 위치는 `requestForegroundPermissionsAsync`(**foreground 전용**)만 사용
- `watchPositionAsync` 구독은 화면 unmount 시 **반드시 `remove()`**
- 도착 반경 등은 `constants/location.ts`의 `ARRIVAL_RADIUS_METERS` 상수 사용
- 진행 상태(시작/도착/출발/복귀/완료)는 **서버 저장 없이 로컬 상태**로 관리

---

## 3) 그 외 협업 주의사항 / 규칙

- **스키마 변경은 A(지수)가 오너**: `schema.prisma` 수정 필요하면 먼저 공유 → 마이그레이션 만들어 커밋으로 공유. 받은 사람은 `npx prisma migrate dev` 필수
- **API 키/비밀은 `.env`에만**, 절대 커밋 금지. 새 변수는 `.env.example`에 **키 이름만** 추가
- **API 규약**: 경로는 `/api` 프리픽스, 응답은 `{ success, data, error }` 형태 유지
- **브랜치/PR**: `main` 직접 push 금지 → `feature/...` 브랜치 → PR 리뷰. 스키마/명세 변경 포함 PR은 상대방 리뷰 필수
- **커밋 전 확인**: `npm run typecheck`(또는 `tsc --noEmit`) / 서버는 `npm run test:run` 통과
- 막히면 바로 공유 🙏

> 배경/검증 체크리스트: [`docs/location-privacy.md`](./location-privacy.md) · 협업 규칙: [`docs/collaboration.md`](./collaboration.md)
