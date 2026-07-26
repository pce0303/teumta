/*
  Warnings:

  - You are about to drop the column `openingHours` on the `Place` table. All the data in the column will be lost.
  - The values [ROUTE_VIEWED,ROUTE_SELECTED] on the enum `TripEvent_eventType` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterTable
ALTER TABLE `Place` DROP COLUMN `openingHours`,
    ADD COLUMN `closingTime` VARCHAR(5) NULL,
    ADD COLUMN `openingTime` VARCHAR(5) NULL;

-- AlterTable
ALTER TABLE `TripEvent` MODIFY `eventType` ENUM('TRIP_STARTED', 'PLACE_ARRIVED', 'PLACE_LEFT', 'MAIN_PLACE_RETURNED', 'TRIP_COMPLETED', 'TRIP_CANCELLED') NOT NULL;
