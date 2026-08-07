import { resolveClick } from "../../../lib/game/click-service";
import { getSessionId } from "../../../lib/session-cookie";

export async function PUT(request: Request) {
  const sessionId = getSessionId(request);
  if (!sessionId) {
    return Response.json({ error: "no session" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const { normalX, normalY, character } = body ?? {};

  const isCoord = (value: unknown): value is number =>
    typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1;
  if (!isCoord(normalX) || !isCoord(normalY) || typeof character !== "string" || !character) {
    return Response.json({ error: "invalid request body" }, { status: 400 });
  }

  const outcome = await resolveClick(sessionId, character, normalX, normalY);

  switch (outcome.kind) {
    case "no-session":
      return Response.json({ error: "session not found" }, { status: 401 });
    case "unknown-character":
      return Response.json({ error: "unknown character" }, { status: 400 });
    case "not-in-pool":
      return Response.json({ error: "character not in session" }, { status: 400 });
    case "incorrect":
      return Response.json({
        result: "incorrect",
        restored: outcome.restored,
        active: outcome.active,
      });
    case "correct":
      return Response.json({
        result: "correct",
        finished: outcome.finished,
        replacement: outcome.replacement,
      });
  }
}
