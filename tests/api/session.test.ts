import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "../../app/api/session/route";

const store = vi.hoisted(() => {
  const sessions = new Map<
    string,
    { difficulty: string; finishTime: number | null; charactersClicked: Record<string, boolean>; pool: string[] }
  >();
  return { sessions };
});

vi.mock("../../lib/db", () => ({
  prisma: {
    session: {
      create: vi.fn(({ data }: { data: Record<string, unknown> }) => {
        store.sessions.set(data.id as string, {
          difficulty: data.difficulty as string,
          finishTime: null,
          charactersClicked: data.charactersClicked as Record<string, boolean>,
          pool: data.pool as string[],
        });
        return Promise.resolve({ id: data.id });
      }),
      findUnique: vi.fn(({ where }: { where: { id: string } }) => {
        const s = store.sessions.get(where.id);
        return Promise.resolve(
          s ? { id: where.id, ...s, createdAt: new Date() } : null
        );
      }),
    },
  },
}));

const post = (body: unknown, cookie?: string) =>
  POST(
    new Request("http://localhost/api/session", {
      method: "POST",
      headers: cookie
        ? { cookie, "Content-Type": "application/json" }
        : { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
  );

beforeEach(() => {
  store.sessions.clear();
});

describe("POST /api/session", () => {
  it("rejects an unknown difficulty", async () => {
    const res = await post({ difficulty: "50" });
    expect(res.status).toBe(400);
  });

  it("creates a shuffled pool of the requested size", async () => {
    const res = await post({ difficulty: "5" });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.difficulty).toBe("5");
    expect(body.pool).toHaveLength(5);
    expect(new Set(body.pool).size).toBe(5);
    expect(body.active).toHaveLength(5);
    expect(body.finished).toBe(false);
  });

  it("picks the whole roster for 'all'", async () => {
    const res = await post({ difficulty: "all" });
    const body = await res.json();
    expect(body.pool).toHaveLength(51);
    expect(body.active).toHaveLength(5);
  });

  it("reuses an unfinished session with the same difficulty", async () => {
    const first = await post({ difficulty: "20" });
    const firstBody = await first.json();
    const cookie = first.headers.get("set-cookie") ?? "";
    const sessionId = /sessionId=([^;]+)/.exec(cookie)?.[1];

    const second = await post({ difficulty: "20" }, `sessionId=${sessionId}`);
    const secondBody = await second.json();
    expect(secondBody.sessionId).toBe(firstBody.sessionId);
    expect(secondBody.pool).toEqual(firstBody.pool);
  });

  it("starts a fresh session when the difficulty changes", async () => {
    const first = await post({ difficulty: "5" });
    const cookie = first.headers.get("set-cookie") ?? "";
    const sessionId = /sessionId=([^;]+)/.exec(cookie)?.[1];

    const second = await post({ difficulty: "20" }, `sessionId=${sessionId}`);
    const secondBody = await second.json();
    expect(secondBody.sessionId).not.toBe(undefined);
    expect(secondBody.difficulty).toBe("20");
    expect(secondBody.pool).toHaveLength(20);
  });
});
