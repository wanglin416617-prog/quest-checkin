import { describe, expect, it } from "vitest";
import { addDays, isValidDateKey, toDateKey } from "@/domain/dateKey";

describe("dateKey", () => {
  it("formats a local calendar day", () => {
    expect(toDateKey(new Date(2026, 10, 21, 23, 30))).toBe("2026-11-21");
  });

  it("adds days across month boundaries", () => {
    expect(addDays("2026-11-30", 1)).toBe("2026-12-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("rejects impossible calendar dates", () => {
    expect(isValidDateKey("2026-11-21")).toBe(true);
    expect(isValidDateKey("2026-13-01")).toBe(false);
    expect(isValidDateKey("2026-02-30")).toBe(false);
    expect(isValidDateKey("26-11-21")).toBe(false);
  });
});
