import { applyTimeoutPenalty } from "../../../lib/game/click-service";
import { getSessionId } from "../../../lib/session-cookie";

/** Lunatic idle penalty: fired client-side after 15s without a selection. */
export async function POST(request: Request) {
  const sessionId = getSessionId(request);
  if (!sessionId) {
    return Response.json({ error: "no session" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const firedAt = body?.firedAt;
  if (typeof firedAt !== "number" || !Number.isFinite(firedAt)) {
    return Response.json({ error: "invalid firedAt" }, { status: 400 });
  }

  const outcome = await applyTimeoutPenalty(sessionId, firedAt);

  switch (outcome.kind) {
    case "no-session":
      return Response.json({ error: "session not found" }, { status: 401 });
    case "not-eligible":
      return Response.json({ error: "timeout only in Lunatic" }, { status: 403 });
    case "timeout":
      return Response.json({
        restored: outcome.restored,
        active: outcome.active,
      });
  }
}
