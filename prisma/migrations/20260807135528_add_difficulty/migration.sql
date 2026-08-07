-- AlterTable
ALTER TABLE "leaderboard" ADD COLUMN     "difficulty" TEXT NOT NULL DEFAULT 'all';

-- AlterTable
ALTER TABLE "session" ADD COLUMN     "difficulty" TEXT NOT NULL DEFAULT 'all',
ADD COLUMN     "pool" JSONB;
