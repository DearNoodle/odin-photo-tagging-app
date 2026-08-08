import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "../../app/api/leaderboard/route";
import type { Leaderboard } from "@prisma/client";

type Row = Pick<
  Leaderboard,
  "id" | "name" | "time" | "difficulty" | "isAuthor" | "accuracy"
>;

const leaderboardStore = vi.hoisted(() => ({
  rows: [] as Row[],
  sessions: new Map<
    string,
    {
      finishTime: number | null;
      difficulty: string;
      totalClicks?: number;
      correctClicks?: number;
    }
  >(),
}));

vi.mock("../../lib/db", () => ({
  prisma: {
    leaderboard: {
      findMany: vi.fn(
        ({
          where,
          orderBy,
        }: {
          where?: { difficulty?: string };
          orderBy?: Record<string, "asc" | "desc">[];
        }) => {
          const primary = orderBy?.[0] ?? { time: "asc" };
          const tie = orderBy?.[1] ?? { accuracy: "desc" };
          const [primaryKey, primaryDir] = Object.entries(primary)[0];
          const [tieKey, tieDir] = Object.entries(tie)[0];
          return Promise.resolve(
            leaderboardStore.rows
              .filter((r) => !where?.difficulty || r.difficulty === where.difficulty)
              .sort((a, b) => {
                const cmp =
                  (a[primaryKey as keyof Row] as number) -
                  (b[primaryKey as keyof Row] as number);
                if (cmp !== 0) return primaryDir === "asc" ? cmp : -cmp;
                return tieDir === "asc"
                  ? (a[tieKey as keyof Row] as number) -
                      (b[tieKey as keyof Row] as number)
                  : (b[tieKey as keyof Row] as number) -
                      (a[tieKey as keyof Row] as number);
              })
          );
        }
      ),
      create: vi.fn(
        ({
          data,
        }: {
          data: {
            name: string;
            time: number;
            difficulty: string;
            isAuthor?: boolean;
            accuracy?: number;
          };
        }) => {
          const entry = { id: "new-id", ...data } as Row;
          leaderboardStore.rows.push(entry);
          return Promise.resolve(entry);
        }
      ),
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
      { id: "a", name: "Reimu", time: 42, difficulty: "lunatic", isAuthor: false, accuracy: 0.5 },
      { id: "b", name: "Marisa", time: 17, difficulty: "lunatic", isAuthor: false, accuracy: 1 },
    ];
    const res = await GET(new Request("http://localhost/api/leaderboard"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([
      { name: "Marisa", time: 17, accuracy: 1, isAuthor: false },
      { name: "Reimu", time: 42, accuracy: 0.5, isAuthor: false },
    ]);
  });

  it("filters by difficulty", async () => {
    leaderboardStore.rows = [
      { id: "a", name: "Reimu", time: 42, difficulty: "lunatic", isAuthor: false, accuracy: 1 },
      { id: "b", name: "Marisa", time: 17, difficulty: "easy", isAuthor: false, accuracy: 1 },
      { id: "c", name: "Sakuya", time: 9, difficulty: "hard", isAuthor: false, accuracy: 1 },
    ];
    const res = await GET(new Request("http://localhost/api/leaderboard?difficulty=hard"));
    expect(await res.json()).toEqual([
      { name: "Sakuya", time: 9, accuracy: 1, isAuthor: false },
    ]);
  });

  it("defaults to the lunatic difficulty", async () => {
    leaderboardStore.rows = [
      { id: "a", name: "Reimu", time: 42, difficulty: "lunatic", isAuthor: false, accuracy: 1 },
      { id: "b", name: "Marisa", time: 17, difficulty: "easy", isAuthor: false, accuracy: 1 },
    ];
    const res = await GET(new Request("http://localhost/api/leaderboard"));
    expect(await res.json()).toEqual([
      { name: "Reimu", time: 42, accuracy: 1, isAuthor: false },
    ]);
  });

  it("marks the dev auto entry as the author", async () => {
    leaderboardStore.rows = [
      { id: "a", name: "ᗜˬᗜ", time: 10, difficulty: "lunatic", isAuthor: true, accuracy: 1 },
    ];
    const res = await GET(new Request("http://localhost/api/leaderboard"));
    expect(await res.json()).toEqual([
      { name: "ᗜˬᗜ", time: 10, accuracy: 1, isAuthor: true },
    ]);
  });

  it("sorts by accuracy desc, breaking ties with the fastest time", async () => {
    leaderboardStore.rows = [
      { id: "a", name: "Slow Perfect", time: 99, difficulty: "lunatic", isAuthor: false, accuracy: 1 },
      { id: "b", name: "Fast Sloppy", time: 20, difficulty: "lunatic", isAuthor: false, accuracy: 0.6 },
      { id: "c", name: "Fast Perfect", time: 21, difficulty: "lunatic", isAuthor: false, accuracy: 1 },
      { id: "d", name: "Slow Sloppy", time: 22, difficulty: "lunatic", isAuthor: false, accuracy: 0.6 },
    ];
    const res = await GET(new Request("http://localhost/api/leaderboard?sort=accuracy"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([
      { name: "Fast Perfect", time: 21, accuracy: 1, isAuthor: false },
      { name: "Slow Perfect", time: 99, accuracy: 1, isAuthor: false },
      { name: "Fast Sloppy", time: 20, accuracy: 0.6, isAuthor: false },
      { name: "Slow Sloppy", time: 22, accuracy: 0.6, isAuthor: false },
    ]);
  });

  it("breaks time ties with accuracy (best accuracy first)", async () => {
    leaderboardStore.rows = [
      { id: "a", name: "Accurate", time: 30, difficulty: "lunatic", isAuthor: false, accuracy: 1 },
      { id: "b", name: "Sloppy", time: 30, difficulty: "lunatic", isAuthor: false, accuracy: 0.4 },
    ];
    const res = await GET(new Request("http://localhost/api/leaderboard"));
    expect(await res.json()).toEqual([
      { name: "Accurate", time: 30, accuracy: 1, isAuthor: false },
      { name: "Sloppy", time: 30, accuracy: 0.4, isAuthor: false },
    ]);
  });

  it("rejects an unknown difficulty", async () => {
    const res = await GET(new Request("http://localhost/api/leaderboard?difficulty=50"));
    expect(res.status).toBe(400);
  });

  it("rejects an unknown sort", async () => {
    const res = await GET(new Request("http://localhost/api/leaderboard?sort=random"));
    expect(res.status).toBe(400);
  });
});

describe("POST /api/leaderboard (requires finished session)", () => {
  it("rejects without a session cookie", async () => {
    const res = await POST(new Request("http://localhost/api/leaderboard", { method: "POST" }));
    expect(res.status).toBe(401);
  });

  it("rejects an unfinished session", async () => {
    leaderboardStore.sessions.set("s1", { finishTime: null, difficulty: "easy" });
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
    leaderboardStore.sessions.set("s1", { finishTime: 23, difficulty: "easy" });
    const res = await POST(
      new Request("http://localhost/api/leaderboard", {
        method: "POST",
        headers: { cookie: "sessionId=s1" },
        body: JSON.stringify({ name: "Reimu" }),
      })
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body).toEqual({
      id: "new-id",
      name: "Reimu",
      time: 23,
      difficulty: "easy",
      accuracy: 1,
    });
    expect(leaderboardStore.rows).toHaveLength(1);
  });

  it("stores accuracy computed from the session's click counters", async () => {
    leaderboardStore.sessions.set("s1", {
      finishTime: 50,
      difficulty: "hard",
      totalClicks: 10,
      correctClicks: 7,
    });
    const res = await POST(
      new Request("http://localhost/api/leaderboard", {
        method: "POST",
        headers: { cookie: "sessionId=s1" },
        body: JSON.stringify({ name: "Reimu" }),
      })
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.accuracy).toBe(0.7);
    expect(leaderboardStore.rows[0].accuracy).toBe(0.7);
  });

  it("rejects an empty or overlong name", async () => {
    leaderboardStore.sessions.set("s1", { finishTime: 5, difficulty: "lunatic" });
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
    leaderboardStore.sessions.set("s1", { finishTime: 99, difficulty: "normal" });
    const res = await POST(
      new Request("http://localhost/api/leaderboard", {
        method: "POST",
        headers: { cookie: "sessionId=s1" },
        body: JSON.stringify({ name: "Cheater", time: 1 }),
      })
    );
    const body = await res.json();
    expect(body.time).toBe(99);
    expect(body.difficulty).toBe("normal");
  });
});
