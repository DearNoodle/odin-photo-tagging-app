-- AlterTable
ALTER TABLE "leaderboard" ALTER COLUMN "difficulty" SET DEFAULT 'lunatic';

-- AlterTable
ALTER TABLE "session" ALTER COLUMN "difficulty" SET DEFAULT 'lunatic';

-- Migrate existing rows to the new difficulty ids
UPDATE "session" SET "difficulty" = 'easy' WHERE "difficulty" = '5';
UPDATE "session" SET "difficulty" = 'normal' WHERE "difficulty" = '20';
UPDATE "session" SET "difficulty" = 'hard' WHERE "difficulty" = '40';
UPDATE "session" SET "difficulty" = 'lunatic' WHERE "difficulty" = 'all';

UPDATE "leaderboard" SET "difficulty" = 'easy' WHERE "difficulty" = '5';
UPDATE "leaderboard" SET "difficulty" = 'normal' WHERE "difficulty" = '20';
UPDATE "leaderboard" SET "difficulty" = 'hard' WHERE "difficulty" = '40';
UPDATE "leaderboard" SET "difficulty" = 'lunatic' WHERE "difficulty" = 'all';
