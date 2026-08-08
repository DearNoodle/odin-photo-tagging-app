import {
  findBounds,
  findSession,
  markFinished,
  recordClick,
  sessionPool,
  updateClickState,
  updateSessionActivity,
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
  | {
      kind: "incorrect";
      restored: string | null;
      active: string[];
      totalClicks: number;
      correctClicks: number;
    }
  | {
      kind: "correct";
      finished: boolean;
      finishTime: number | null;
      replacement: string | null;
      totalClicks: number;
      correctClicks: number;
    };

export type TimeoutPenaltyResult =
  | { kind: "no-session" }
  | { kind: "not-eligible" }
  | { kind: "timeout"; restored: string | null; active: string[] };

/**
 * Wrong-pick fallout. Lunatic and Hard also return one random found character
 * to the pool; every mode except Easy reshuffles the pool order when more than
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
    const recorded = await recordClick(sessionId, false);
    const { restored, active } = await handleMiss(
      sessionId,
      pool,
      clicked,
      session.difficulty === "lunatic" || session.difficulty === "hard",
      session.difficulty !== "easy"
    );
    return {
      kind: "incorrect",
      restored,
      active,
      totalClicks: recorded.totalClicks,
      correctClicks: recorded.correctClicks,
    };
  }

  const recorded = await recordClick(sessionId, true);
  const alreadyClicked = clicked[character] === true;
  const updated: ClickState = alreadyClicked
    ? clicked
    : { ...clicked, [character]: true };
  const finished = poolFinished(updated);

  if (finished) {
    if (session.finishTime != null) {
      return {
        kind: "correct",
        finished,
        finishTime: session.finishTime,
        replacement: null,
        totalClicks: recorded.totalClicks,
        correctClicks: recorded.correctClicks,
      };
    }
    const penalty = session.penaltySeconds ?? 0;
    const finishTime = Math.floor(
      (Date.now() - session.createdAt.getTime()) / 1000
    ) + penalty;
    await markFinished(sessionId, updated, finishTime);
    if (process.env.NODE_ENV === "development" && isDifficultyId(session.difficulty)) {
      await addLeaderboardEntry(
        DEV_AUTO_NAME,
        finishTime,
        session.difficulty,
        true,
        recorded.totalClicks > 0 ? recorded.correctClicks / recorded.totalClicks : 1
      );
    }
    return {
      kind: "correct",
      finished,
      finishTime,
      replacement: null,
      totalClicks: recorded.totalClicks,
      correctClicks: recorded.correctClicks,
    };
  }

  if (!alreadyClicked) {
    await updateClickState(sessionId, updated);
  }
  return {
    kind: "correct",
    finished,
    finishTime: null,
    replacement: nextReplacement(pool, updated),
    totalClicks: recorded.totalClicks,
    correctClicks: recorded.correctClicks,
  };
}

/**
 * Lunatic idle penalty: after 15s without a selection the player "loses
 * focus", so a random found character is restored and the pool is reshuffled
 * — exactly the wrong-pick fallout.
 *
 * `firedAt` is the moment the client's countdown hit zero. The penalty is
 * skipped when the player has been active since then (a selection sent before
 * the timer ended, or during the request's latency, cancels it). The check
 * re-reads the session so a click committed after the first read still wins.
 */
export async function applyTimeoutPenalty(
  sessionId: string,
  firedAt: number
): Promise<TimeoutPenaltyResult> {
  const session = await findSession(sessionId);
  if (!session) return { kind: "no-session" };
  if (session.difficulty !== "lunatic" || session.finishTime != null) {
    return { kind: "not-eligible" };
  }

  const fresh = (await findSession(sessionId)) ?? session;
  const lastActivity = fresh.lastActivityAt?.getTime() ?? 0;
  if (lastActivity > firedAt) {
    return {
      kind: "timeout",
      restored: null,
      active: activeCharacters(sessionPool(fresh), fresh.charactersClicked as ClickState),
    };
  }

  const pool = sessionPool(fresh);
  const clicked = fresh.charactersClicked as ClickState;
  const found = Object.values(clicked).filter(Boolean).length;

  // Nothing to restore yet, but the pool still gets reshuffled — the
  // shuffle is the penalty even at 0/51 found.
  if (found === 0) {
    let newPool = pool;
    if (pool.length > ACTIVE_SLOTS) {
      newPool = shuffle(pool);
      await updateSessionPool(sessionId, newPool);
    }
    await updateSessionActivity(sessionId);
    return { kind: "timeout", restored: null, active: activeCharacters(newPool, clicked) };
  }

  const { restored, active } = await handleMiss(sessionId, pool, clicked, true, true);
  await updateSessionActivity(sessionId);
  return { kind: "timeout", restored, active };
}
