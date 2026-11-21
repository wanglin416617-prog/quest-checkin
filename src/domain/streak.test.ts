import { describe, expect, it } from "vitest";
import { nextStreak } from "@/domain/streak";

describe("nextStreak", () => {
  it("increments when the user checks in", () => {
    expect(nextStreak(0, true)).toBe(1);
    expect(nextStreak(5, true)).toBe(6);
  });

  it("does not reset to zero on a miss", () => {
    expect(nextStreak(5, false)).toBe(5);
  });

  it("treats a negative current streak as zero", () => {
    expect(nextStreak(-2, false)).toBe(0);
    expect(nextStreak(-2, true)).toBe(1);
  });
});
