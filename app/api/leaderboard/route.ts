import { NAME_MAX_LENGTH } from "../../../lib/domain";
import { addLeaderboardEntry, findSession, getLeaderboardRows } from "../../../lib/session-store";
import { getSessionId, clearSessionCookie } from "../../../lib/session-cookie";
import { isDifficultyId } from "../../../lib/game/session-utils";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const difficultyParam = url.searchParams.get("difficulty") ?? "all";
  if (!isDifficultyId(difficultyParam)) {
    return Response.json({ error: "invalid difficulty" }, { status: 400 });
  }
  const rows = await getLeaderboardRows(difficultyParam);
  return Response.json(
    rows.map(({ name, time, isAuthor }) => ({ name, time, isAuthor }))
  );
}

export async function POST(request: Request) {
  const sessionId = getSessionId(request);
  if (!sessionId) {
    return Response.json({ error: "no session" }, { status: 401 });
  }

  const session = await findSession(sessionId);
  if (!session) {
    return Response.json({ error: "session not found" }, { status: 401 });
  }
  if (session.finishTime === null) {
    return Response.json({ error: "session not finished" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const rawName = typeof body?.name === "string" ? body.name.trim() : "";
  if (rawName.length === 0 || rawName.length > NAME_MAX_LENGTH) {
    return Response.json({ error: "invalid name" }, { status: 400 });
  }

  const difficulty = isDifficultyId(session.difficulty) ? session.difficulty : "all";
  const entry = await addLeaderboardEntry(rawName, session.finishTime, difficulty);
  return Response.json(
    { id: entry.id, name: entry.name, time: entry.time, difficulty: entry.difficulty },
    {
      status: 201,
      headers: { "Set-Cookie": clearSessionCookie() },
    }
  );
}
