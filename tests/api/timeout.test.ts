import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "../../app/api/timeout/route";

const store = vi.hoisted(() => {
  const BASE_TIME = new Date("2026-08-08T00:00:00Z").getTime();
  const session = {
    id: "s1",
    difficulty: "lunatic",
    pool: ["a", "b", "c", "d", "e", "f", "g", "h"],
    charactersClicked: {
      a: true,
      b: false,
      c: false,
      d: false,
      e: false,
      f: false,
      g: false,
      h: false,
    } as Record<string, boolean>,
    createdAt: new Date(),
    lastActivityAt: new Date(BASE_TIME),
    finishTime: null as number | null,
    penaltySeconds: 0,
  };
  const updates: Record<string, unknown>[] = [];
  const poolUpdateCount = 0;
  return { session, updates, poolUpdateCount, BASE_TIME };
});

vi.mock("../../lib/db", () => ({
  prisma: {
    session: {
      findUnique: vi.fn(() => Promise.resolve({ ...store.session })),
      update: vi.fn(({ data }: { data: Record<string, unknown> }) => {
        store.updates.push(data);
        if (Array.isArray(data.pool)) {
          store.session.pool = data.pool as string[];
          store.poolUpdateCount += 1;
        }
        if (data.charactersClicked) {
          store.session.charactersClicked = data.charactersClicked as Record<string, boolean>;
        }
        if (data.lastActivityAt instanceof Date) {
          store.session.lastActivityAt = data.lastActivityAt;
        }
        return Promise.resolve({ ...store.session });
      }),
    },
  },
}));

const post = (firedAt: number) =>
  POST(
    new Request("http://localhost/api/timeout", {
      method: "POST",
      headers: { cookie: "sessionId=s1", "Content-Type": "application/json" },
      body: JSON.stringify({ firedAt }),
    })
  );

beforeEach(() => {
  store.session.difficulty = "lunatic";
  store.session.pool = ["a", "b", "c", "d", "e", "f", "g", "h"];
  store.session.charactersClicked = {
    a: true,
    b: false,
    c: false,
    d: false,
    e: false,
    f: false,
    g: false,
    h: false,
  };
  store.session.lastActivityAt = new Date(store.BASE_TIME);
  store.session.finishTime = null;
  store.updates.length = 0;
  store.poolUpdateCount = 0;
});

describe("POST /api/timeout", () => {
  it("rejects a request without a session cookie", async () => {
    const res = await POST(
      new Request("http://localhost/api/timeout", {
        method: "POST",
        body: JSON.stringify({ firedAt: store.BASE_TIME + 1 }),
      })
    );
    expect(res.status).toBe(401);
  });

  it("rejects non-Lunatic sessions", async () => {
    store.session.difficulty = "hard";
    const res = await post(store.BASE_TIME + 1);
    expect(res.status).toBe(403);
    expect(store.updates).toHaveLength(0);
  });

  it("rejects finished sessions", async () => {
    store.session.finishTime = 42;
    const res = await post(store.BASE_TIME + 1);
    expect(res.status).toBe(403);
    expect(store.updates).toHaveLength(0);
  });

  it("rejects a missing or invalid firedAt", async () => {
    const missing = await POST(
      new Request("http://localhost/api/timeout", {
        method: "POST",
        headers: { cookie: "sessionId=s1", "Content-Type": "application/json" },
        body: "{}",
      })
    );
    expect(missing.status).toBe(400);
  });

  it("skips the penalty when the player acted after the penalty fired", async () => {
    const res = await post(store.BASE_TIME - 1000);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      restored: null,
      active: ["b", "c", "d", "e", "f"],
    });
    expect(store.poolUpdateCount).toBe(0);
    expect(store.updates).toHaveLength(0);
  });

  it("restores a random found character and reshuffles when idle", async () => {
    const res = await post(store.BASE_TIME + 1000);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.restored).toBe("a");
    expect(store.session.charactersClicked.a).toBe(false);
    expect(store.poolUpdateCount).toBe(1);
    expect(body.active).toHaveLength(5);
    expect(new Set(body.active).size).toBe(5);
  });

  it("shuffles without restoring when nothing has been found yet", async () => {
    store.session.charactersClicked = Object.fromEntries(
      store.session.pool.map((n) => [n, false])
    );
    const res = await post(store.BASE_TIME + 1000);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.restored).toBeNull();
    expect(store.poolUpdateCount).toBe(1);
    expect(body.active).toHaveLength(5);
    expect(new Set(body.active).size).toBe(5);
  });
});
