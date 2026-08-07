import { describe, expect, it } from "vitest";
import { formatTime } from "../lib/format-time";

describe("formatTime", () => {
  it("formats under a minute as MM:SS", () => {
    expect(formatTime(0)).toBe("00:00");
    expect(formatTime(5)).toBe("00:05");
    expect(formatTime(59)).toBe("00:59");
  });

  it("formats minutes as MM:SS", () => {
    expect(formatTime(60)).toBe("01:00");
    expect(formatTime(83)).toBe("01:23");
    expect(formatTime(599)).toBe("09:59");
  });

  it("formats over an hour as H:MM:SS", () => {
    expect(formatTime(3600)).toBe("1:00:00");
    expect(formatTime(3661)).toBe("1:01:01");
    expect(formatTime(7325)).toBe("2:02:05");
  });

  it("clamps negative input to zero", () => {
    expect(formatTime(-10)).toBe("00:00");
  });
});
