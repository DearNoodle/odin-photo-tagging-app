import { beforeEach, describe, expect, it, vi } from "vitest";
import { PUT } from "../../app/api/click/route";
import type { Bounds } from "../../lib/domain";

const store = vi.hoisted(() => {
  const pool = ["a", "b", "c", "d", "e", "f", "g", "h"];
  const session = {
    id: "s1",
    difficulty: "lunatic",
    pool,
    charactersClicked: Object.fromEntries(pool.map((n) => [n, false])) as Record<string, boolean>,
    createdAt: new Date(),
    finishTime: null as number | null,
    totalClicks: 0,
    correctClicks: 0,
  };
  const boundsByCharacter = new Map<string, Bounds>([
    ["a", { xMin: 0.1, xMax: 0.2, yMin: 0.1, yMax: 0.2 }],
    ["b", { xMin: 0.3, xMax: 0.4, yMin: 0.3, yMax: 0.4 }],
    ["c", { xMin: 0.5, xMax: 0.6, yMin: 0.5, yMax: 0.6 }],
    ["d", { xMin: 0.7, xMax: 0.8, yMin: 0.7, yMax: 0.8 }],
    ["e", { xMin: 0.1, xMax: 0.2, yMin: 0.7, yMax: 0.8 }],
    ["f", { xMin: 0.3, xMax: 0.4, yMin: 0.7, yMax: 0.8 }],
    ["g", { xMin: 0.5, xMax: 0.6, yMin: 0.1, yMax: 0.2 }],
    ["h", { xMin: 0.7, xMax: 0.8, yMin: 0.1, yMax: 0.2 }],
  ]);
  const updates: { charactersClicked: Record<string, boolean>; finishTime: number | null; pool?: string[] }[] =
    [];
  const poolUpdateCount = 0;
  return { session, boundsByCharacter, updates, poolUpdateCount };
});

vi.mock("../../lib/db", () => ({
  prisma: {
    session: {
      findUnique: vi.fn(() => Promise.resolve({ ...store.session })),
      update: vi.fn(({ data }: { data: Record<string, unknown> }) => {
        store.updates.push({
          charactersClicked: (data.charactersClicked ?? store.session.charactersClicked) as Record<string, boolean>,
          finishTime: (data.finishTime ?? null) as number | null,
          ...(Array.isArray(data.pool) ? { pool: data.pool as string[] } : {}),
        });
        if (typeof data.charactersClicked === "object" && data.charactersClicked !== null) {
          store.session.charactersClicked = data.charactersClicked as Record<string, boolean>;
        }
        if (typeof data.finishTime === "number") {
          store.session.finishTime = data.finishTime;
        }
        if (Array.isArray(data.pool)) {
          store.session.pool = data.pool as string[];
          store.poolUpdateCount += 1;
        }
        const increments = data as Record<string, { increment?: number } | undefined>;
        if (typeof increments.totalClicks?.increment === "number") {
          store.session.totalClicks += increments.totalClicks.increment;
        }
        if (typeof increments.correctClicks?.increment === "number") {
          store.session.correctClicks += increments.correctClicks.increment;
        }
        return Promise.resolve({ ...store.session });
      }),
    },
    characterLocation: {
      findUnique: vi.fn(({ where }: { where: { character: string } }) => {
        const bounds = store.boundsByCharacter.get(where.character);
        return Promise.resolve(bounds ? { character: where.character, bounds } : null);
      }),
    },
  },
}));

const put = (body: unknown) =>
  PUT(
    new Request("http://localhost/api/click", {
      method: "PUT",
      headers: { cookie: "sessionId=s1", "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
  );

beforeEach(() => {
  store.session.pool = ["a", "b", "c", "d", "e", "f", "g", "h"];
  store.session.difficulty = "lunatic";
  store.session.charactersClicked = Object.fromEntries(
    store.session.pool.map((n: string) => [n, false])
  );
  store.session.finishTime = null;
  store.session.totalClicks = 0;
  store.session.correctClicks = 0;
  store.updates.length = 0;
  store.poolUpdateCount = 0;
});

describe("PUT /api/click", () => {
  it("returns incorrect when the click misses the bounds (Easy — no fallout)", async () => {
    store.session.difficulty = "easy";
    const res = await put({ normalX: 0.9, normalY: 0.9, character: "a" });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      result: "incorrect",
      restored: null,
      active: ["a", "b", "c", "d", "e"],
      totalClicks: 1,
      correctClicks: 0,
    });
    expect(store.updates).toHaveLength(1); // only the click (activity + counter)
    expect(store.poolUpdateCount).toBe(0);
  });

  it("reshuffles the pool on a wrong pick in Normal mode (no restore)", async () => {
    store.session.difficulty = "normal";
    const res = await put({ normalX: 0.9, normalY: 0.9, character: "a" });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.result).toBe("incorrect");
    expect(body.restored).toBeNull();
    expect(store.poolUpdateCount).toBe(1);
    expect(body.active).toHaveLength(5);
    expect(new Set(body.active).size).toBe(5);
    for (const name of body.active) {
      expect(store.session.pool).toContain(name);
    }
  });

  it("restores a random found character and reshuffles the pool (Hard)", async () => {
    store.session.difficulty = "hard";
    await put({ normalX: 0.15, normalY: 0.15, character: "a" });
    expect(store.session.charactersClicked.a).toBe(true);

    const res = await put({ normalX: 0.9, normalY: 0.9, character: "b" });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.result).toBe("incorrect");
    expect(body.restored).toBe("a");
    expect(store.session.charactersClicked.a).toBe(false);
    expect(store.poolUpdateCount).toBe(1);
    expect(body.active).toHaveLength(5);
  });

  it("restores a random found character and reshuffles the pool (Lunatic)", async () => {
    await put({ normalX: 0.15, normalY: 0.15, character: "a" });
    expect(store.session.charactersClicked.a).toBe(true);

    const res = await put({ normalX: 0.9, normalY: 0.9, character: "b" });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.result).toBe("incorrect");
    expect(body.restored).toBe("a");
    expect(store.session.charactersClicked.a).toBe(false);

    // Pool was reshuffled because more than 5 characters remain
    expect(store.poolUpdateCount).toBe(1);
    expect([...store.session.pool].sort()).toEqual(
      ["a", "b", "c", "d", "e", "f", "g", "h"].sort()
    );

    // The new active window is 5 unique characters from the pool
    expect(body.active).toHaveLength(5);
    expect(new Set(body.active).size).toBe(5);
    for (const name of body.active) {
      expect(store.session.pool).toContain(name);
    }
  });

  it("does not reshuffle when fewer than 5 characters remain", async () => {
    store.session.charactersClicked = {
      a: true,
      b: true,
      c: true,
      d: true,
      e: false,
      f: true,
      g: true,
      h: true,
    };
    store.session.finishTime = null;

    const res = await put({ normalX: 0.9, normalY: 0.9, character: "a" });
    const body = await res.json();
    expect(body.result).toBe("incorrect");
    expect(store.poolUpdateCount).toBe(0);
    expect(body.active).toHaveLength(2);
    expect(body.active).toContain("e");
    expect(body.active).toContain(body.restored);
  });

  it("marks a correct find and offers the new window member as replacement", async () => {
    const res = await put({ normalX: 0.15, normalY: 0.15, character: "a" });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      result: "correct",
      finished: false,
      replacement: "f",
      totalClicks: 1,
      correctClicks: 1,
    });
    expect(store.session.charactersClicked.a).toBe(true);
  });

  it("rejects a character outside the session pool", async () => {
    const res = await put({ normalX: 0.15, normalY: 0.15, character: "z" });
    expect(res.status).toBe(400);
  });

  it("handles a duplicate click idempotently", async () => {
    await put({ normalX: 0.15, normalY: 0.15, character: "a" });
    const res = await put({ normalX: 0.15, normalY: 0.15, character: "a" });
    expect(await res.json()).toEqual({
      result: "correct",
      finished: false,
      replacement: "f",
      totalClicks: 2,
      correctClicks: 2,
    });
    expect(store.session.charactersClicked.a).toBe(true);
  });

  it("finishes the game on the last find and records the server-side time", async () => {
    store.session.charactersClicked = {
      a: true,
      b: true,
      c: true,
      d: true,
      e: true,
      f: true,
      g: true,
    };
    const res = await put({ normalX: 0.75, normalY: 0.15, character: "h" });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      result: "correct",
      finished: true,
      replacement: null,
      totalClicks: 1,
      correctClicks: 1,
    });
    expect(store.session.finishTime).not.toBeNull();
    expect(typeof body.finishTime).toBe("undefined");
  });

  it("counts a miss against accuracy and a hit toward it", async () => {
    await put({ normalX: 0.9, normalY: 0.9, character: "a" });
    await put({ normalX: 0.35, normalY: 0.35, character: "b" });
    const res = await put({ normalX: 0.9, normalY: 0.9, character: "c" });
    const body = await res.json();
    expect(body.totalClicks).toBe(3);
    expect(body.correctClicks).toBe(1);
  });
});
