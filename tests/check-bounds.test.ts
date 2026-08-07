import { describe, expect, it } from "vitest";
import { checkBounds, type Bounds } from "../lib/game/check-bounds";

const box: Bounds = { xMin: 0.2, xMax: 0.8, yMin: 0.1, yMax: 0.9 };

describe("checkBounds", () => {
  it("hits inside the bounds", () => {
    expect(checkBounds(0.5, 0.5, box)).toBe(true);
  });

  it("misses outside the bounds", () => {
    expect(checkBounds(0.05, 0.5, box)).toBe(false);
    expect(checkBounds(0.9, 0.5, box)).toBe(false);
    expect(checkBounds(0.5, 0.05, box)).toBe(false);
    expect(checkBounds(0.5, 0.95, box)).toBe(false);
  });

  it("misses on the exact boundary (open interval)", () => {
    expect(checkBounds(box.xMin, 0.5, box)).toBe(false);
    expect(checkBounds(box.xMax, 0.5, box)).toBe(false);
    expect(checkBounds(0.5, box.yMin, box)).toBe(false);
    expect(checkBounds(0.5, box.yMax, box)).toBe(false);
  });

  it("hits just inside the boundary", () => {
    const eps = 1e-9;
    expect(checkBounds(box.xMin + eps, 0.5, box)).toBe(true);
    expect(checkBounds(0.5, box.yMax - eps, box)).toBe(true);
  });
});
