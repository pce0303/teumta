# teumta

틈타(teumta)는 빈 시간에 방문하기 좋은 관광지를 찾고, 실시간 혼잡도를 고려해 우회 코스와 진행 지도를 제공하는 모바일 서비스입니다.

## 기술 스택

- Mobile: React Native, Expo, TypeScript, Expo Router, Axios, expo-location, expo-notifications, react-native-maps
- Server: Node.js, Express, TypeScript, Prisma ORM, MySQL, Zod, dotenv, cors
- Database: MySQL 8.4, Docker Compose, Prisma migration

## 폴더 구조

```text
teumta/
├── mobile/
├── server/
├── docs/
├── compose.yaml
├── .gitignore
├── .env.example
└── README.md
```

현재 모바일 앱은 기존 Expo 설정을 유지해 `mobile/src/app` 아래에 Expo Router 화면을 둡니다.

## 사전 설치 항목

- Node.js 22 이상 권장
- npm
- Docker Compose v2
- macOS: OrbStack 또는 Docker Desktop
- Windows: Docker Desktop
- 모바일 실행용 Expo Go 또는 시뮬레이터

## 환경변수 설정

루트:

```sh
cp .env.example .env
```

서버:

```sh
cp server/.env.example server/.env
```

모바일:

```sh
cp mobile/.env.example mobile/.env
```

실제 비밀번호와 API 키는 `.env` 파일에만 작성합니다. `.env` 파일은 Git에 올리지 않습니다.

## MySQL 실행

macOS OrbStack:

1. OrbStack을 실행합니다.
2. 프로젝트 루트에서 실행합니다.

```sh
docker compose up -d
docker compose ps
```

Windows Docker Desktop:

1. Docker Desktop을 실행합니다.
2. WSL 또는 PowerShell에서 프로젝트 루트로 이동합니다.
3. 실행합니다.

```sh
docker compose up -d
docker compose ps
```

종료:

```sh
docker compose stop
```

데이터까지 삭제되는 `docker compose down -v`는 필요한 경우에만 실행합니다.

## 백엔드 실행

```sh
cd server
npm install
npm run db:generate
npm run db:migrate
npm run dev
```

헬스체크:

```sh
curl http://localhost:3000/health
```

정상 응답:

```json
{
  "success": true,
  "data": {
    "status": "ok",
    "service": "teumta-server",
    "database": "connected"
  },
  "error": null
}
```

## 모바일 앱 실행

```sh
cd mobile
npm install
npm run start
```

Expo Go에서 QR 코드를 스캔하거나 iOS/Android 시뮬레이터로 실행합니다.

## Prisma migration 적용

```sh
cd server
npm run db:migrate
```

새 모델을 추가한 뒤에는 migration 파일을 생성해 Git으로 공유합니다.

```sh
npx prisma migrate dev --name <migration_name>
```

## 자주 발생하는 오류

### Docker daemon이 실행되지 않음

`Cannot connect to the Docker daemon`이 나오면 OrbStack 또는 Docker Desktop이 켜져 있는지 확인합니다.

### 3306 포트 충돌

로컬 MySQL이 이미 3306을 쓰고 있으면 `Bind for 0.0.0.0:3306 failed`가 발생합니다. 루트 `.env`에서 `MYSQL_PORT=3307`처럼 바꾼 뒤 `server/.env`의 `DATABASE_URL` 포트도 같이 바꿉니다.

### MySQL healthcheck 대기

처음 실행 시 MySQL 초기화 때문에 `starting` 상태가 30초 이상 유지될 수 있습니다.

```sh
docker compose ps
docker logs teumta-mysql
```

### 기존 volume 때문에 계정 정보가 반영되지 않음

MySQL 공식 이미지는 데이터 디렉터리가 이미 있으면 초기 DB와 사용자를 다시 만들지 않습니다. 비밀번호를 바꿨는데 적용되지 않으면 기존 named volume 때문일 수 있습니다. 이 경우 데이터 삭제 위험이 있으므로 팀과 확인한 뒤 처리합니다.

### Docker 저장공간 부족

`no space left on device`가 나오면 자동 정리하지 말고 먼저 사용량을 확인합니다.

```sh
df -h /
docker system df
```

이미지, 빌드 캐시, 중지된 컨테이너는 삭제 후보가 될 수 있지만 volume 삭제는 DB 데이터 손실 위험이 있습니다.
