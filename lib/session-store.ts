import { prisma } from "./db";
import {
  LEADERBOARD_SIZE,
  type Bounds,
  type ClickState,
  type DifficultyId,
} from "./domain";

export async function findBounds(character: string): Promise<Bounds | null> {
  const row = await prisma.characterLocation.findUnique({
    where: { character },
  });
  return row ? (row.bounds as Bounds) : null;
}

export async function createSession(
  id: string,
  pool: string[],
  difficulty: DifficultyId
) {
  const charactersClicked: ClickState = Object.fromEntries(
    pool.map((name) => [name, false])
  );
  return prisma.session.create({
    data: { id, pool, difficulty, charactersClicked },
  });
}

export async function findSession(id: string) {
  return prisma.session.findUnique({ where: { id } });
}

export async function deleteSession(id: string) {
  return prisma.session.delete({ where: { id } });
}

export async function updateClickState(id: string, charactersClicked: ClickState) {
  return prisma.session.update({
    where: { id },
    data: { charactersClicked },
  });
}

/** Record a player action — cancels any in-flight idle penalty. */
export async function updateSessionActivity(id: string) {
  return prisma.session.update({
    where: { id },
    data: { lastActivityAt: new Date() },
  });
}

/**
 * Record one selection: bumps the click counters (accuracy = correct /
 * total) and touches the activity timestamp — the same write that cancels
 * an in-flight idle penalty.
 */
export async function recordClick(id: string, hit: boolean) {
  return prisma.session.update({
    where: { id },
    data: {
      lastActivityAt: new Date(),
      totalClicks: { increment: 1 },
      ...(hit ? { correctClicks: { increment: 1 } } : {}),
    },
  });
}

export async function updateSessionPool(id: string, pool: string[]) {
  return prisma.session.update({
    where: { id },
    data: { pool },
  });
}

/** Reroll: replace pool, reset progress and add the penalty (30s). */
export async function rerollSession(
  id: string,
  pool: string[],
  charactersClicked: ClickState
) {
  return prisma.session.update({
    where: { id },
    data: {
      pool,
      charactersClicked,
      penaltySeconds: { increment: 30 },
    },
  });
}

export async function markFinished(id: string, charactersClicked: ClickState, finishTime: number) {
  return prisma.session.update({
    where: { id },
    data: { charactersClicked, finishTime },
  });
}

/** Pool of a session, falling back to its clicked keys for legacy sessions. */
export function sessionPool(session: {
  pool: unknown;
  charactersClicked: unknown;
}): string[] {
  if (Array.isArray(session.pool) && session.pool.every((n) => typeof n === "string")) {
    return session.pool;
  }
  const clicked = session.charactersClicked as ClickState;
  return Object.keys(clicked);
}

export type LeaderboardSort = "time" | "accuracy";

/**
 * Top leaderboard rows for a difficulty. Primary sort follows `sort`, the
 * other metric breaks ties — always best-first (fastest time, then highest
 * accuracy — or vice versa), never reversed.
 */
export async function getLeaderboardRows(
  difficulty: DifficultyId,
  sort: LeaderboardSort = "time"
) {
  return prisma.leaderboard.findMany({
    where: { difficulty },
    orderBy:
      sort === "accuracy"
        ? [{ accuracy: "desc" }, { time: "asc" }]
        : [{ time: "asc" }, { accuracy: "desc" }],
    take: LEADERBOARD_SIZE,
  });
}

export async function addLeaderboardEntry(
  name: string,
  time: number,
  difficulty: DifficultyId,
  isAuthor = false,
  accuracy = 1
) {
  return prisma.leaderboard.create({
    data: { name, time, difficulty, isAuthor, accuracy },
  });
}
