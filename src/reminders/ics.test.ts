import { describe, expect, it } from "vitest";
import { exportDailyRemindersIcs } from "@/reminders/ics";

describe("exportDailyRemindersIcs", () => {
  it("emits a daily RRULE and a display VALARM", () => {
    const ics = exportDailyRemindersIcs([
      {
        id: "lunch",
        title: "午餐",
        hour: 12,
        minute: 0,
        startDate: new Date(2026, 10, 21),
      },
    ]);

    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("SUMMARY:午餐");
    expect(ics).toMatch(/RRULE:FREQ=DAILY/);
    expect(ics).toContain("BEGIN:VALARM");
    expect(ics).toContain("ACTION:DISPLAY");
    expect(ics).toContain("END:VCALENDAR");
  });
});
