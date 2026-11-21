import { describe, expect, it } from "vitest";
import { findMissedReminders, type DailyReminder } from "@/reminders/scheduler";

const lunch: DailyReminder = { id: "lunch", title: "午餐", hour: 12, minute: 0 };

describe("findMissedReminders", () => {
  it("returns a due reminder when the app opens late", () => {
    const lastOpened = new Date(2026, 10, 21, 8, 0);
    const now = new Date(2026, 10, 21, 12, 20);
    const missed = findMissedReminders([lunch], now, lastOpened);
    expect(missed).toHaveLength(1);
    expect(missed[0]?.id).toBe("lunch");
    expect(missed[0]?.overdueMinutes).toBe(20);
  });

  it("ignores reminders that are still in the future", () => {
    const lastOpened = new Date(2026, 10, 21, 8, 0);
    const now = new Date(2026, 10, 21, 11, 0);
    expect(findMissedReminders([lunch], now, lastOpened)).toHaveLength(0);
  });

  it("ignores reminders already seen in a previous session", () => {
    const lastOpened = new Date(2026, 10, 21, 13, 0);
    const now = new Date(2026, 10, 21, 18, 0);
    expect(findMissedReminders([lunch], now, lastOpened)).toHaveLength(0);
  });
});
