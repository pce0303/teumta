-- 개인정보 최소화(privacy): 사용자 GPS 좌표 및 장기 device identifier를 서버 스키마에서 제거.

-- TripEvent에서 사용자 실제 GPS 좌표 컬럼 제거 (사용자 위치는 서버에 저장하지 않는다)
ALTER TABLE `TripEvent` DROP COLUMN `latitude`;
ALTER TABLE `TripEvent` DROP COLUMN `longitude`;

-- Trip에서 장기 유지되는 device identifier 제거 (기기 연결 축적 방지)
DROP INDEX `Trip_deviceId_idx` ON `Trip`;
ALTER TABLE `Trip` DROP COLUMN `deviceId`;
