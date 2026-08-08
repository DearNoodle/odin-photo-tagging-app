-- AlterTable
ALTER TABLE "session" ADD COLUMN     "totalClicks" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "session" ADD COLUMN     "correctClicks" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "leaderboard" ADD COLUMN     "accuracy" DOUBLE PRECISION NOT NULL DEFAULT 1;
