import { describe, expect, it } from "vitest";
import { checkinPoints, streakMultiplier } from "@/domain/points";

describe("streakMultiplier", () => {
  it("is 1x when streak is empty or negative", () => {
    expect(streakMultiplier(0)).toBe(1);
    expect(streakMultiplier(-3)).toBe(1);
  });

  it("adds 5% per full week and caps at 1.5", () => {
    expect(streakMultiplier(6)).toBe(1);
    expect(streakMultiplier(7)).toBe(1.05);
    expect(streakMultiplier(69)).toBe(1.45);
    expect(streakMultiplier(70)).toBe(1.5);
    expect(streakMultiplier(100)).toBe(1.5);
  });
});

describe("checkinPoints", () => {
  it("scales base difficulty points by the streak multiplier", () => {
    expect(checkinPoints("easy", 0)).toBe(10);
    expect(checkinPoints("normal", 7)).toBe(21);
    expect(checkinPoints("hard", 70)).toBe(60);
    expect(checkinPoints("epic", 14)).toBe(88);
  });
});
