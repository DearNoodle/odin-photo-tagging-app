import { describe, expect, it } from "vitest";
import {
  ACTIVE_SLOTS,
  activeCharacters,
  isDifficultyId,
  nextReplacement,
  pickPool,
  poolFinished,
  shuffle,
} from "../lib/game/session-utils";

const roster: string[] = Array.from({ length: 10 }, (_, i) => `C${i}`);

describe("shuffle", () => {
  it("keeps the same elements", () => {
    expect(shuffle(["a", "b", "c"]).sort()).toEqual(["a", "b", "c"]);
  });
});

describe("pickPool", () => {
  it("picks exactly the difficulty count", () => {
    for (let round = 0; round < 20; round++) {
      expect(pickPool(roster, "easy")).toHaveLength(5);
      expect(pickPool(roster, "normal")).toHaveLength(10);
      expect(pickPool(roster, "hard")).toHaveLength(10);
    }
  });

  it("returns the whole roster for 'lunatic'", () => {
    expect(pickPool(roster, "lunatic")).toHaveLength(10);
  });

  it("never repeats a character", () => {
    const pool = pickPool(roster, "normal");
    expect(new Set(pool).size).toBe(pool.length);
  });

  it("caps at roster length when the difficulty exceeds it", () => {
    expect(pickPool(roster, "hard")).toHaveLength(roster.length);
  });
});

describe("activeCharacters", () => {
  const pool = ["a", "b", "c", "d", "e", "f", "g"];

  it("shows the first 5 in pool order when nothing is clicked", () => {
    expect(activeCharacters(pool, {})).toEqual(["a", "b", "c", "d", "e"]);
  });

  it("fills the first slots with unclicked characters in order", () => {
    expect(activeCharacters(pool, { a: true, b: true })).toEqual([
      "c",
      "d",
      "e",
      "f",
      "g",
    ]);
  });

  it("shrinks below the limit when the pool is nearly exhausted", () => {
    expect(
      activeCharacters(pool, { a: true, b: true, c: true, d: true, e: true })
    ).toEqual(["f", "g"]);
  });
});

describe("nextReplacement", () => {
  const pool = ["a", "b", "c", "d", "e", "f", "g", "h"];

  it("returns the new member of the active window", () => {
    expect(nextReplacement(pool, { a: true })).toBe("f");
    expect(nextReplacement(pool, { a: true, b: true })).toBe("g");
    expect(nextReplacement(pool, { a: true, b: true, c: true })).toBe("h");
  });

  it("returns the window's last member when the clicked character is outside the window", () => {
    expect(nextReplacement(pool, { f: true })).toBe("e");
  });

  it("returns null when the pool has no full window left", () => {
    const nearlyDone = { a: true, b: true, c: true, d: true };
    expect(nextReplacement(pool, nearlyDone)).toBe(null);
    expect(
      nextReplacement(pool, { a: true, b: true, c: true, d: true, e: true })
    ).toBe(null);
  });
});

describe("poolFinished", () => {
  it("is false until every entry is true", () => {
    expect(poolFinished({ a: true, b: false })).toBe(false);
    expect(poolFinished({ a: true, b: true })).toBe(true);
  });

  it("is false for an empty click state", () => {
    expect(poolFinished({})).toBe(false);
  });
});

describe("isDifficultyId", () => {
  it("accepts the four difficulty ids only", () => {
    expect(isDifficultyId("easy")).toBe(true);
    expect(isDifficultyId("normal")).toBe(true);
    expect(isDifficultyId("hard")).toBe(true);
    expect(isDifficultyId("lunatic")).toBe(true);
    expect(isDifficultyId("medium")).toBe(false);
    expect(isDifficultyId("25")).toBe(false);
    expect(isDifficultyId(5)).toBe(false);
    expect(isDifficultyId(null)).toBe(false);
  });
});

describe("ACTIVE_SLOTS", () => {
  it("is five", () => {
    expect(ACTIVE_SLOTS).toBe(5);
  });
});
