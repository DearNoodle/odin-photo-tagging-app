import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "../../app/api/reroll/route";

const store = vi.hoisted(() => {
  const session = {
    id: "s1",
    difficulty: "easy",
    pool: ["a", "b", "c", "d", "e"],
    charactersClicked: {
      a: true,
      b: false,
      c: false,
      d: false,
      e: false,
    } as Record<string, boolean>,
    createdAt: new Date(),
    finishTime: null as number | null,
    penaltySeconds: 0,
  };
  const updates: Record<string, unknown>[] = [];
  return { session, updates };
});

vi.mock("../../lib/db", () => ({
  prisma: {
    session: {
      findUnique: vi.fn(() => Promise.resolve({ ...store.session })),
      update: vi.fn(({ data }: { data: Record<string, unknown> }) => {
        store.updates.push(data);
        if (Array.isArray(data.pool)) store.session.pool = data.pool as string[];
        if (data.charactersClicked) {
          store.session.charactersClicked = data.charactersClicked as Record<string, boolean>;
        }
        return Promise.resolve({ ...store.session });
      }),
    },
  },
}));

const post = () =>
  POST(
    new Request("http://localhost/api/reroll", {
      method: "POST",
      headers: { cookie: "sessionId=s1" },
    })
  );

beforeEach(() => {
  store.session.difficulty = "easy";
  store.session.finishTime = null;
  store.session.penaltySeconds = 0;
  store.updates.length = 0;
});

describe("POST /api/reroll", () => {
  it("returns a fresh 5-character window from the full roster and adds 30s", async () => {
    const res = await post();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.active).toHaveLength(5);
    expect(new Set(body.active).size).toBe(5);
    expect(body.penaltySeconds).toBe(30);
    expect(Object.values(body.clicked).every((v) => v === false)).toBe(true);

    const update = store.updates[0] as {
      penaltySeconds?: { increment: number };
    };
    expect(update?.penaltySeconds).toEqual({ increment: 30 });
    expect(store.session.charactersClicked).toEqual(body.clicked);
  });

  it("accumulates the penalty across rerolls", async () => {
    store.session.penaltySeconds = 30;
    const body = await (await post()).json();
    expect(body.penaltySeconds).toBe(60);
  });

  it("rejects non-Easy sessions", async () => {
    store.session.difficulty = "normal";
    const res = await post();
    expect(res.status).toBe(403);
    expect(store.updates).toHaveLength(0);
  });

  it("rejects finished sessions", async () => {
    store.session.finishTime = 42;
    const res = await post();
    expect(res.status).toBe(403);
    expect(store.updates).toHaveLength(0);
  });

  it("rejects a request without a session cookie", async () => {
    const res = await POST(new Request("http://localhost/api/reroll", { method: "POST" }));
    expect(res.status).toBe(401);
  });
});
