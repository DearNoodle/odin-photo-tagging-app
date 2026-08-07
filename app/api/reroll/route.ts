import { getSessionId } from "../../../lib/session-cookie";
import { findSession, rerollSession } from "../../../lib/session-store";
import { CHARACTER_NAMES } from "../../../lib/character-names";
import { activeCharacters, pickPool } from "../../../lib/game/session-utils";
import type { ClickState } from "../../../lib/domain";

/** Easy-only escape hatch: fresh 5 characters from the full roster, +30s. */
export async function POST(request: Request) {
  const sessionId = getSessionId(request);
  if (!sessionId) {
    return Response.json({ error: "no session" }, { status: 401 });
  }

  const session = await findSession(sessionId);
  if (!session) {
    return Response.json({ error: "session not found" }, { status: 401 });
  }
  if (session.difficulty !== "5" || session.finishTime != null) {
    return Response.json({ error: "reroll only in Easy" }, { status: 403 });
  }

  const pool = pickPool(CHARACTER_NAMES, "5");
  const charactersClicked: ClickState = Object.fromEntries(
    pool.map((name) => [name, false])
  );
  const penalty = (session.penaltySeconds ?? 0) + 30;
  await rerollSession(sessionId, pool, charactersClicked);

  return Response.json({
    pool,
    active: activeCharacters(pool, charactersClicked),
    clicked: charactersClicked,
    penaltySeconds: penalty,
  });
}
