-- Place: TourAPI v4.4 법정동 코드/분류체계(집중률 예측 매칭용)
ALTER TABLE `Place` ADD COLUMN `lDongRegnCd` VARCHAR(8) NULL,
    ADD COLUMN `lDongSignguCd` VARCHAR(8) NULL,
    ADD COLUMN `lclsSystm1` VARCHAR(16) NULL,
    ADD COLUMN `lclsSystm2` VARCHAR(16) NULL,
    ADD COLUMN `lclsSystm3` VARCHAR(16) NULL;

-- Congestion: KTO 집중률 예측 원본 소수값 저장 + level nullable 전환
-- (공식 API가 혼잡 등급 임계값을 제공하지 않아 임의 등급을 만들지 않는다.
--  기존 데이터는 영향 없음: 컬럼 추가는 nullable, level은 NOT NULL → NULL 완화만 수행)
ALTER TABLE `Congestion` ADD COLUMN `concentrationRate` DECIMAL(5, 2) NULL,
    MODIFY `level` ENUM('RELAXED', 'NORMAL', 'CROWDED', 'VERY_CROWDED') NULL;

-- CreateIndex
CREATE INDEX `Place_lDongRegnCd_lDongSignguCd_idx` ON `Place`(`lDongRegnCd`, `lDongSignguCd`);

-- 같은 장소·source·예측일 중복 방지(upsert/범위 교체 전략의 안전장치)
CREATE UNIQUE INDEX `Congestion_placeId_source_predictedFor_key` ON `Congestion`(`placeId`, `source`, `predictedFor`);
