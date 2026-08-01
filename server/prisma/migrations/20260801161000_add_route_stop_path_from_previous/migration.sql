-- RouteStop.pathFromPrevious: 이전 정류지 → 현재 정류지 보행 경로 도형(JSON).
-- TMAP Place↔Place 경로에서 추출한 [{ latitude, longitude }, ...] 배열로, 지도 폴리라인 렌더링용.
-- privacy: 장소 사이의 고정 경로 데이터이며 사용자 GPS/이동 기록이 아니다.
ALTER TABLE `RouteStop` ADD COLUMN `pathFromPrevious` JSON NULL;
