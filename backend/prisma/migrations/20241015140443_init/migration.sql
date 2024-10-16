/*
  Warnings:

  - You are about to drop the `users` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
DROP TABLE "users";

-- CreateTable
CREATE TABLE "session" (
    "id" TEXT NOT NULL,
    "charactersClicked" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishTime" INTEGER,

    CONSTRAINT "session_pkey" PRIMARY KEY ("id")
);
