import { describe, expect, it } from "vitest";
import { greetingOf } from "./clock";

describe("时段问候", () => {
  it("上海 5 点到 12 点前是早上好", () => {
    expect(greetingOf(Date.parse("2026-11-21T05:00:00+08:00"))).toBe("早上好");
    expect(greetingOf(Date.parse("2026-11-21T11:59:00+08:00"))).toBe("早上好");
  });

  it("上海 12 点到 18 点前是下午好", () => {
    expect(greetingOf(Date.parse("2026-11-21T12:00:00+08:00"))).toBe("下午好");
    expect(greetingOf(Date.parse("2026-11-21T17:59:00+08:00"))).toBe("下午好");
  });

  it("上海晚上和凌晨是晚上好", () => {
    expect(greetingOf(Date.parse("2026-11-21T18:00:00+08:00"))).toBe("晚上好");
    expect(greetingOf(Date.parse("2026-11-21T04:59:00+08:00"))).toBe("晚上好");
  });
});
