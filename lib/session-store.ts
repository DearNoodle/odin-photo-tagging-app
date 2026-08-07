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

export async function getLeaderboardRows(difficulty: DifficultyId) {
  return prisma.leaderboard.findMany({
    where: { difficulty },
    orderBy: { time: "asc" },
    take: LEADERBOARD_SIZE,
  });
}

export async function addLeaderboardEntry(
  name: string,
  time: number,
  difficulty: DifficultyId,
  isAuthor = false
) {
  return prisma.leaderboard.create({ data: { name, time, difficulty, isAuthor } });
}
