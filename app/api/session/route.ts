import { getSessionId, setSessionCookie, clearSessionCookie } from "../../../lib/session-cookie";
import { createSession, deleteSession } from "../../../lib/session-store";
import { CHARACTER_NAMES } from "../../../lib/character-names";
import { activeCharacters, isDifficultyId, pickPool } from "../../../lib/game/session-utils";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const difficulty = body?.difficulty;
  if (!isDifficultyId(difficulty)) {
    return Response.json({ error: "invalid difficulty" }, { status: 400 });
  }

  // Choosing a difficulty in the menu always opens a fresh game — the
  // previous session is dropped so progress and accuracy reset instead of
  // silently resuming (reload → same difficulty used to continue the old
  // game with its stale counters).
  const previousId = getSessionId(request);
  if (previousId) {
    await deleteSession(previousId).catch(() => {});
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
      totalClicks: 0,
      correctClicks: 0,
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
