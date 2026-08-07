import { getSessionId, setSessionCookie, clearSessionCookie } from "../../../lib/session-cookie";
import { createSession, findSession, deleteSession, sessionPool } from "../../../lib/session-store";
import { CHARACTER_NAMES } from "../../../lib/character-names";
import {
  activeCharacters,
  isDifficultyId,
  pickPool,
  poolFinished,
} from "../../../lib/game/session-utils";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const difficulty = body?.difficulty;
  if (!isDifficultyId(difficulty)) {
    return Response.json({ error: "invalid difficulty" }, { status: 400 });
  }

  const existingId = getSessionId(request);
  if (existingId) {
    const existing = await findSession(existingId);
    if (
      existing &&
      existing.difficulty === difficulty &&
      existing.finishTime == null
    ) {
      const clicked = existing.charactersClicked as Record<string, boolean>;
      return Response.json({
        sessionId: existingId,
        difficulty,
        pool: sessionPool(existing),
        clicked,
        active: activeCharacters(sessionPool(existing), clicked),
        finished: poolFinished(clicked),
      });
    }
  }

  const sessionId = crypto.randomUUID();
  const pool = pickPool(CHARACTER_NAMES, difficulty);
  await createSession(sessionId, pool, difficulty);

  return new Response(
    JSON.stringify({
      sessionId,
      difficulty,
      pool,
      clicked: Object.fromEntries(pool.map((name) => [name, false])),
      active: activeCharacters(pool, {}),
      finished: false,
    }),
    { status: 201, headers: { "Set-Cookie": setSessionCookie(sessionId) } }
  );
}

/** Abandon the current session: delete its row and expire the cookie. */
export async function DELETE(request: Request) {
  const sessionId = getSessionId(request);
  if (sessionId) {
    await deleteSession(sessionId).catch(() => {});
  }
  return new Response(null, {
    status: 204,
    headers: { "Set-Cookie": clearSessionCookie() },
  });
}
