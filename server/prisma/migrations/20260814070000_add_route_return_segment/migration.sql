-- Route: 마지막 RouteStop → mainPlace 복귀 구간(이동시간/거리/보행 경로).
-- RouteStop의 경로 필드는 모두 "이전 장소 → 현재 정류지" 기준이라 복귀 구간을 담을 자리가 없었다.
-- 전부 nullable — 기존 행은 영향 없고(복귀 미포함으로 해석), 신규 코스는 저장 시 서버가 채운다.
ALTER TABLE `Route` ADD COLUMN `returnTravelMinutes` INTEGER NULL,
    ADD COLUMN `returnDistanceMeters` INTEGER NULL,
    ADD COLUMN `returnPath` JSON NULL;
