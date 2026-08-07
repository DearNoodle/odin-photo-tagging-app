import type { Bounds } from "./game/check-bounds";

export type { Bounds };

export type Character = {
  name: string;
  bounds: Bounds;
};

export type ClickState = Record<string, boolean>;

export const SESSION_COOKIE = "sessionId";
export const SESSION_TTL_SECONDS = 30 * 60;
export const LEADERBOARD_SIZE = 10;
export const NAME_MAX_LENGTH = 20;
/** Dev-only auto entry posted when a game finishes (rendered blue). */
export const DEV_AUTO_NAME = "ᗜˬᗜ";

export type { DifficultyId } from "./game/session-utils";
