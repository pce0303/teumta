-- CreateTable
CREATE TABLE `ForecastPlaceAlias` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `areaCd` VARCHAR(8) NOT NULL,
    `signguCd` VARCHAR(8) NOT NULL,
    `tAtsNm` VARCHAR(191) NOT NULL,
    `placeId` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ForecastPlaceAlias_placeId_idx`(`placeId`),
    UNIQUE INDEX `ForecastPlaceAlias_areaCd_signguCd_tAtsNm_key`(`areaCd`, `signguCd`, `tAtsNm`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `ForecastPlaceAlias` ADD CONSTRAINT `ForecastPlaceAlias_placeId_fkey` FOREIGN KEY (`placeId`) REFERENCES `Place`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
