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
      delete: vi.fn(() => Promise.resolve({})),
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
    const res = await post({ difficulty: "easy" });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.difficulty).toBe("easy");
    expect(body.pool).toHaveLength(5);
    expect(new Set(body.pool).size).toBe(5);
    expect(body.active).toHaveLength(5);
    expect(body.finished).toBe(false);
    expect(body.totalClicks).toBe(0);
    expect(body.correctClicks).toBe(0);
  });

  it("picks the whole roster for 'lunatic'", async () => {
    const res = await post({ difficulty: "lunatic" });
    const body = await res.json();
    expect(body.pool).toHaveLength(51);
    expect(body.active).toHaveLength(5);
  });

  it("always starts a fresh session even with an unfinished session of the same difficulty", async () => {
    const first = await post({ difficulty: "normal" });
    const firstBody = await first.json();
    const cookie = first.headers.get("set-cookie") ?? "";
    const sessionId = /sessionId=([^;]+)/.exec(cookie)?.[1];

    const second = await post({ difficulty: "normal" }, `sessionId=${sessionId}`);
    const secondBody = await second.json();
    expect(secondBody.sessionId).not.toBe(firstBody.sessionId);
    expect(secondBody.finished).toBe(false);
    expect(secondBody.totalClicks).toBe(0);
    expect(secondBody.correctClicks).toBe(0);
  });

  it("starts a fresh session when the difficulty changes", async () => {
    const first = await post({ difficulty: "easy" });
    const cookie = first.headers.get("set-cookie") ?? "";
    const sessionId = /sessionId=([^;]+)/.exec(cookie)?.[1];

    const second = await post({ difficulty: "normal" }, `sessionId=${sessionId}`);
    const secondBody = await second.json();
    expect(secondBody.sessionId).not.toBe(undefined);
    expect(secondBody.difficulty).toBe("normal");
    expect(secondBody.pool).toHaveLength(20);
  });
});
