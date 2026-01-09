-- AlterTable
-- This migration adds optional fields to the Driver table for profile customization

ALTER TABLE "Driver" ADD COLUMN "preferredClasses" TEXT;
ALTER TABLE "Driver" ADD COLUMN "country" TEXT;
ALTER TABLE "Driver" ADD COLUMN "timezone" TEXT;
ALTER TABLE "Driver" ADD COLUMN "twitch" TEXT;
ALTER TABLE "Driver" ADD COLUMN "twitter" TEXT;
ALTER TABLE "Driver" ADD COLUMN "discord" TEXT;
ALTER TABLE "Driver" ADD COLUMN "driverNotes" TEXT;
