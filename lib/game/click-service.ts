import {
  findBounds,
  findSession,
  markFinished,
  sessionPool,
  updateClickState,
  updateSessionPool,
  addLeaderboardEntry,
} from "../session-store";
import type { ClickState } from "../domain";
import { DEV_AUTO_NAME } from "../domain";
import { checkBounds } from "./check-bounds";
import { ACTIVE_SLOTS, activeCharacters, isDifficultyId, nextReplacement, poolFinished, shuffle } from "./session-utils";

export type ClickServiceResult =
  | { kind: "no-session" }
  | { kind: "unknown-character" }
  | { kind: "not-in-pool" }
  | { kind: "incorrect"; restored: string | null; active: string[] }
  | {
      kind: "correct";
      finished: boolean;
      finishTime: number | null;
      replacement: string | null;
    };

/**
 * Wrong-pick fallout. Lunatic also returns one random found character to the
 * pool; every mode except Easy reshuffles the pool order when more than
 * ACTIVE_SLOTS characters remain — so the visible window becomes a fresh
 * random set. Easy keeps its pool (all characters stay on screen anyway).
 */
async function handleMiss(
  sessionId: string,
  pool: string[],
  clicked: ClickState,
  allowRestore: boolean,
  allowShuffle: boolean
): Promise<{ restored: string | null; active: string[] }> {
  let updated = clicked;
  let restored: string | null = null;

  if (allowRestore) {
    const foundNames = Object.entries(clicked)
      .filter(([, value]) => value)
      .map(([name]) => name);
    if (foundNames.length > 0) {
      const pick = foundNames[Math.floor(Math.random() * foundNames.length)];
      updated = { ...clicked, [pick]: false };
      restored = pick;
      await updateClickState(sessionId, updated);
    }
  }

  let newPool = pool;
  if (allowShuffle) {
    const remaining = pool.filter((name) => !updated[name]).length;
    if (remaining > ACTIVE_SLOTS) {
      newPool = shuffle(pool);
      await updateSessionPool(sessionId, newPool);
    }
  }

  return { restored, active: activeCharacters(newPool, updated) };
}

export async function resolveClick(
  sessionId: string,
  character: string,
  x: number,
  y: number
): Promise<ClickServiceResult> {
  const session = await findSession(sessionId);
  if (!session) return { kind: "no-session" };

  const pool = sessionPool(session);
  if (!pool.includes(character)) return { kind: "not-in-pool" };

  const bounds = await findBounds(character);
  if (!bounds) return { kind: "unknown-character" };

  const clicked = session.charactersClicked as ClickState;

  if (!checkBounds(x, y, bounds)) {
    const { restored, active } = await handleMiss(
      sessionId,
      pool,
      clicked,
      session.difficulty === "all",
      session.difficulty !== "5"
    );
    return { kind: "incorrect", restored, active };
  }

  const alreadyClicked = clicked[character] === true;
  const updated: ClickState = alreadyClicked
    ? clicked
    : { ...clicked, [character]: true };
  const finished = poolFinished(updated);

  if (finished) {
    if (session.finishTime != null) {
      return { kind: "correct", finished, finishTime: session.finishTime, replacement: null };
    }
    const penalty = session.penaltySeconds ?? 0;
    const finishTime = Math.floor(
      (Date.now() - session.createdAt.getTime()) / 1000
    ) + penalty;
    await markFinished(sessionId, updated, finishTime);
    if (process.env.NODE_ENV === "development" && isDifficultyId(session.difficulty)) {
      await addLeaderboardEntry(DEV_AUTO_NAME, finishTime, session.difficulty, true);
    }
    return { kind: "correct", finished, finishTime, replacement: null };
  }

  if (!alreadyClicked) {
    await updateClickState(sessionId, updated);
  }
  return {
    kind: "correct",
    finished,
    finishTime: null,
    replacement: nextReplacement(pool, updated),
  };
}
