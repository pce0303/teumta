# Cloudtype 배포 가이드

> **상태(2026-08-07): 배포 완료.** 검증 ①~④ 전부 통과 — 서버·DB 유료 리소스(상시 실행),
> org main 연결, 영구 볼륨 확인됨. 아래는 재구축이 필요할 때를 위한 절차 기록.
> 운영 루틴: org main 머지 → 콘솔 "배포하기" 수동 실행.

목적: 최소 서버 + DB를 올려 4가지를 검증한다.
① Prisma migration 정상 적용 ② 상시 실행(잠들지 않음) ③ 팀원 4명 콘솔 접근 ④ 추천 API 실측 응답시간

## 1. DB 만들기 (MariaDB 템플릿)

1. Cloudtype 콘솔 → 새 프로젝트 → **MariaDB** 템플릿 배포
   - root 비밀번호, 데이터베이스명 `teumta` 설정
2. 생성 후 내부 접속 주소 확인 (예: `svc.sel4.cloudtype.app:포트` 또는 내부 호스트)
3. `DATABASE_URL` 형식: `mysql://root:<비밀번호>@<호스트>:<포트>/teumta`
   - Prisma `mysql` provider는 MariaDB와 호환. migration 적용 성공 여부가 ①의 판정 기준

## 2. 서버 배포

1. 같은 프로젝트 → 새 서비스 → **GitHub 저장소 연결** (`saesgil-yulamdan/teumta`, 브랜치 `main`)
2. 설정:
   - **Root Directory(서브 디렉터리)**: `server`
   - **Build**: `npm ci && npx prisma generate && npm run build`
   - **Start**: `npm run start:deploy`  ← 시작 시 `prisma migrate deploy` 자동 실행(①)
   - **Port**: 3000 (플랫폼이 PORT env를 주입하면 그 값 사용됨)
   - **Health check**: `/health`
3. 환경변수 등록(콘솔 시크릿):

   | 키 | 값 |
   |---|---|
   | `DATABASE_URL` | 1번에서 만든 값 |
   | `TOUR_API_KEY` / `PREDICTION_API_KEY` | 공공데이터포털 키(Encoding/Decoding 무관) |
   | `TMAP_API_KEY` / `CONGESTION_API_KEY` | SK appKey |
   | `TOUR_API_BASE_URL` | `https://apis.data.go.kr/B551011/KorService2` |
   | `PREDICTION_API_BASE_URL` | `https://apis.data.go.kr/B551011/TatsCnctrRateService` |
   | `TMAP_API_BASE_URL` | `https://apis.openapi.sk.com` |
   | `CONGESTION_API_BASE_URL` | `https://apis.openapi.sk.com/puzzle` |
   | `PREDICTION_INGEST_TARGETS` | `11:11110` (집중률 자동 적재. 실험 중엔 비워도 됨) |

4. 배포 로그에서 확인: `migrate deploy` 적용 로그(①) → `teumta-server listening` → health check 통과

## 3. 초기 데이터 적재 (검증 ④ 전 필요)

콘솔 터미널(또는 재배포 트리거)에서:
```bash
npm run ingest:tour -- 126.977 37.5788 2000
```

## 4. 검증 체크리스트

```bash
BASE=https://<배포주소>

# ① migration — 배포 로그에서 "4 migrations applied" 류 확인 + health의 database: connected
curl -s $BASE/health

# ④ 응답시간 실측 (로컬 기준치: 검색 ~0.3s, 추천 0.6~0.8s)
time curl -s "$BASE/api/search/places?keyword=%EA%B2%BD%EB%B3%B5%EA%B6%81" > /dev/null
time curl -s "$BASE/api/local-places?contentId=126508&radius=2000" > /dev/null   # 3회 반복 측정
time curl -s "$BASE/api/congestion?poiId=362105" > /dev/null

# ② 상시 실행 — 30분 이상 방치 후 재호출했을 때 즉시 응답(콜드스타트 없음)이면 통과
```

- ③ 팀원 접근: 콘솔 → 프로젝트 설정 → 멤버 초대 4명 등록되는지 확인
- ④ 판정 기준: 추천 API 2초 이내면 시연 충분. 3초+ 지속이면 Railway 재검토

## 5. 통과 후 마무리

- `mobile/.env`의 API 주소를 배포 주소로 교체 → 프론트 담당 전달
- `PREDICTION_INGEST_TARGETS` 설정 → 집중률 자동 적재 활성
- DB 백업: GitHub Actions cron으로 일 1회 `mysqldump` (별도 작업)

## 주의

- **무료 리소스는 매일 정지됨** — 반드시 유료 Hobby 플랜으로 실험(②가 무료에선 무조건 실패)
- 공공데이터포털 키가 IP 등록형이면 실패함(resultCode 32) — 포털 마이페이지에서 IP 제한 없음 확인
- 서버 재배포마다 기동 직후 집중률 적재 1회 실행됨(PREDICTION_INGEST_TARGETS 설정 시) — 정상 동작
