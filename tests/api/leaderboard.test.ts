import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "../../app/api/leaderboard/route";
import type { Leaderboard } from "@prisma/client";

type Row = Pick<Leaderboard, "id" | "name" | "time" | "difficulty" | "isAuthor">;

const leaderboardStore = vi.hoisted(() => ({
  rows: [] as Row[],
  sessions: new Map<string, { finishTime: number | null; difficulty: string }>(),
}));

vi.mock("../../lib/db", () => ({
  prisma: {
    leaderboard: {
      findMany: vi.fn(
        ({ where }: { where: { difficulty?: string } }) =>
          Promise.resolve(
            leaderboardStore.rows
              .filter((r) => !where?.difficulty || r.difficulty === where.difficulty)
              .sort((a, b) => a.time - b.time)
          )
      ),
      create: vi.fn(({ data }: { data: { name: string; time: number; difficulty: string; isAuthor?: boolean } }) => {
        const entry = { id: "new-id", ...data } as Row;
        leaderboardStore.rows.push(entry);
        return Promise.resolve(entry);
      }),
    },
    session: {
      findUnique: vi.fn(({ where }: { where: { id: string } }) => {
        const s = leaderboardStore.sessions.get(where.id);
        return Promise.resolve(s ? { id: where.id, ...s } : null);
      }),
    },
    characterLocation: {
      findMany: vi.fn(() => Promise.resolve([])),
      findUnique: vi.fn(() => Promise.resolve(null)),
    },
  },
}));

beforeEach(() => {
  leaderboardStore.rows = [];
  leaderboardStore.sessions.clear();
});

describe("GET /api/leaderboard (public)", () => {
  it("returns the top rows ordered by time asc without any session", async () => {
    leaderboardStore.rows = [
      { id: "a", name: "Reimu", time: 42, difficulty: "all", isAuthor: false },
      { id: "b", name: "Marisa", time: 17, difficulty: "all", isAuthor: false },
    ];
    const res = await GET(new Request("http://localhost/api/leaderboard"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([
      { name: "Marisa", time: 17, isAuthor: false },
      { name: "Reimu", time: 42, isAuthor: false },
    ]);
  });

  it("filters by difficulty", async () => {
    leaderboardStore.rows = [
      { id: "a", name: "Reimu", time: 42, difficulty: "all", isAuthor: false },
      { id: "b", name: "Marisa", time: 17, difficulty: "5", isAuthor: false },
      { id: "c", name: "Sakuya", time: 9, difficulty: "40", isAuthor: false },
    ];
    const res = await GET(new Request("http://localhost/api/leaderboard?difficulty=40"));
    expect(await res.json()).toEqual([{ name: "Sakuya", time: 9, isAuthor: false }]);
  });

  it("defaults to the all difficulty", async () => {
    leaderboardStore.rows = [
      { id: "a", name: "Reimu", time: 42, difficulty: "all", isAuthor: false },
      { id: "b", name: "Marisa", time: 17, difficulty: "5", isAuthor: false },
    ];
    const res = await GET(new Request("http://localhost/api/leaderboard"));
    expect(await res.json()).toEqual([{ name: "Reimu", time: 42, isAuthor: false }]);
  });

  it("marks the dev auto entry as the author", async () => {
    leaderboardStore.rows = [
      { id: "a", name: "ᗜˬᗜ", time: 10, difficulty: "all", isAuthor: true },
    ];
    const res = await GET(new Request("http://localhost/api/leaderboard"));
    expect(await res.json()).toEqual([{ name: "ᗜˬᗜ", time: 10, isAuthor: true }]);
  });

  it("rejects an unknown difficulty", async () => {
    const res = await GET(new Request("http://localhost/api/leaderboard?difficulty=50"));
    expect(res.status).toBe(400);
  });
});

describe("POST /api/leaderboard (requires finished session)", () => {
  it("rejects without a session cookie", async () => {
    const res = await POST(new Request("http://localhost/api/leaderboard", { method: "POST" }));
    expect(res.status).toBe(401);
  });

  it("rejects an unfinished session", async () => {
    leaderboardStore.sessions.set("s1", { finishTime: null, difficulty: "5" });
    const res = await POST(
      new Request("http://localhost/api/leaderboard", {
        method: "POST",
        headers: { cookie: "sessionId=s1" },
        body: JSON.stringify({ name: "Reimu" }),
      })
    );
    expect(res.status).toBe(403);
  });

  it("accepts a finished session and stores the server-side time and difficulty", async () => {
    leaderboardStore.sessions.set("s1", { finishTime: 23, difficulty: "5" });
    const res = await POST(
      new Request("http://localhost/api/leaderboard", {
        method: "POST",
        headers: { cookie: "sessionId=s1" },
        body: JSON.stringify({ name: "Reimu" }),
      })
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body).toEqual({ id: "new-id", name: "Reimu", time: 23, difficulty: "5" });
    expect(leaderboardStore.rows).toHaveLength(1);
  });

  it("rejects an empty or overlong name", async () => {
    leaderboardStore.sessions.set("s1", { finishTime: 5, difficulty: "all" });
    const empty = await POST(
      new Request("http://localhost/api/leaderboard", {
        method: "POST",
        headers: { cookie: "sessionId=s1" },
        body: JSON.stringify({ name: "   " }),
      })
    );
    expect(empty.status).toBe(400);

    const long = await POST(
      new Request("http://localhost/api/leaderboard", {
        method: "POST",
        headers: { cookie: "sessionId=s1" },
        body: JSON.stringify({ name: "x".repeat(21) }),
      })
    );
    expect(long.status).toBe(400);
  });

  it("ignores any client-supplied time", async () => {
    leaderboardStore.sessions.set("s1", { finishTime: 99, difficulty: "20" });
    const res = await POST(
      new Request("http://localhost/api/leaderboard", {
        method: "POST",
        headers: { cookie: "sessionId=s1" },
        body: JSON.stringify({ name: "Cheater", time: 1 }),
      })
    );
    const body = await res.json();
    expect(body.time).toBe(99);
    expect(body.difficulty).toBe("20");
  });
});
