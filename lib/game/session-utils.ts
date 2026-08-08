export const ACTIVE_SLOTS = 5;

export type DifficultyId = "easy" | "normal" | "hard" | "lunatic";

export const DIFFICULTIES: DifficultyId[] = ["easy", "normal", "hard", "lunatic"];

export function isDifficultyId(value: unknown): value is DifficultyId {
  return value === "easy" || value === "normal" || value === "hard" || value === "lunatic";
}

/** Fisher–Yates shuffle (returns a new array). */
export function shuffle<T>(items: readonly T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/** Pool size per difficulty id. */
const DIFFICULTY_POOL_SIZES: Record<DifficultyId, number> = {
  easy: 5,
  normal: 20,
  hard: 40,
  lunatic: 51,
};

/**
 * The session's character pool: a shuffled subset of the names.
 * "lunatic" maps to the full list. Size is capped by the list length.
 */
export function pickPool(names: string[], difficulty: DifficultyId): string[] {
  const target = DIFFICULTY_POOL_SIZES[difficulty];
  return shuffle(names).slice(0, Math.min(target, names.length));
}

/** The first `limit` characters in pool order that have not been clicked yet. */
export function activeCharacters(
  pool: string[],
  clicked: Record<string, boolean>,
  limit: number = ACTIVE_SLOTS
): string[] {
  const active: string[] = [];
  for (const name of pool) {
    if (!clicked[name]) active.push(name);
    if (active.length >= limit) break;
  }
  return active;
}

/**
 * The character that joins the active window after a find: the last member
 * of the updated active window. Null when the window has shrunk below the
 * slot limit (pool nearly exhausted).
 */
export function nextReplacement(
  pool: string[],
  clicked: Record<string, boolean>,
  limit: number = ACTIVE_SLOTS
): string | null {
  const window = activeCharacters(pool, clicked, limit);
  return window.length >= limit ? window[limit - 1] : null;
}

export function poolFinished(clicked: Record<string, boolean>): boolean {
  const values = Object.values(clicked);
  return values.length > 0 && values.every(Boolean);
}
