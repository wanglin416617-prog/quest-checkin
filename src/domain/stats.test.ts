import { describe, it, expect } from "vitest";
import {
  heatmap,
  heatLevel,
  thisWeekProgress,
  monthSummary,
  goalCompletion,
  pointsFlow,
  monthlyWeightChange,
  monthlyDeposits,
  daysInMonth,
  monthStart,
  nextMonthStart,
  prevMonthStart,
  addDays,
  type DaySummary,
  type LedgerEntry,
} from "./index.ts";

const H = (o: Record<string, DaySummary & { imperfect?: boolean }>) => new Map(Object.entries(o));
const ts = (date: string, hh = 12) =>
  Date.UTC(
    Number(date.slice(0, 4)),
    Number(date.slice(5, 7)) - 1,
    Number(date.slice(8, 10)),
    hh - 8,
  ); // 北京时间

describe("统计：自然月 / 近 16 周热力图", () => {
  it("T-ST-01 自然月边界：天数、月初、跨年、闰年", () => {
    expect([
      daysInMonth("2026-11-21"),
      daysInMonth("2027-02-10"),
      daysInMonth("2028-02-10"),
      daysInMonth("2026-12-31"),
    ]).toEqual([30, 28, 29, 31]);
    expect(monthStart("2026-11-21")).toBe("2026-11-01");
    expect(nextMonthStart("2026-12-05")).toBe("2027-01-01");
    expect(prevMonthStart("2027-01-05")).toBe("2026-12-01");
  });
  it("T-ST-02 热力图 16 列 × 7 行，周一起；最后一列含今天；今天之后 future", () => {
    const g = heatmap(new Map(), "2026-11-21");
    expect(g).toHaveLength(16);
    expect(g.every((c) => c.length === 7)).toBe(true);
    expect(g[15]![0]!.date).toBe("2026-11-16"); // 本周周一
    expect(g[0]![0]!.date).toBe("2026-08-03"); // 15 周前的周一
    expect(g[15]![5]!).toMatchObject({ date: "2026-11-21", future: false });
    expect(g[15]![6]!).toMatchObject({ date: "2026-11-22", future: true, level: 0 });
  });
  it("T-ST-03 强度分级（整数比较）：0/3→0，1/3→1，2/3→2，2/2.5→3，3/3→4，无到期但完成→4", () => {
    expect(heatLevel({ due: 3, completed: 0 })).toBe(0);
    expect(heatLevel({ due: 3, completed: 1 })).toBe(1);
    expect(heatLevel({ due: 3, completed: 2 })).toBe(2);
    expect(heatLevel({ due: 4, completed: 3 })).toBe(3);
    expect(heatLevel({ due: 3, completed: 3 })).toBe(4);
    expect(heatLevel({ due: 0, completed: 1 })).toBe(4);
    expect(heatLevel(undefined)).toBe(0);
  });
  it("T-ST-04 不完美日（有违规）琥珀点；无到期为中性格", () => {
    const g = heatmap(
      H({
        "2026-11-20": { due: 2, completed: 2, imperfect: true },
        "2026-11-19": { due: 0, completed: 0 },
      }),
      "2026-11-21",
    );
    expect(g[15]![4]).toMatchObject({ date: "2026-11-20", level: 4, imperfect: true });
    expect(g[15]![3]).toMatchObject({ neutral: true });
  });
  it("T-ST-05 本周 6/6 天达成（周六）", () => {
    const o: Record<string, DaySummary> = {};
    for (let i = 0; i < 6; i++) o[addDays("2026-11-16", i)] = { due: 4, completed: 1 };
    expect(thisWeekProgress(H(o), "2026-11-21")).toEqual({ achieved: 6, dueDays: 6 });
  });
  it("T-ST-06 月摘要：完成率 = Σ完成到期/Σ到期（截至今天），较上月百分点，打卡次数，本月最长连胜", () => {
    const o: Record<string, DaySummary> = {};
    for (let i = 0; i < 30; i++) o[addDays("2026-10-01", i)] = { due: 4, completed: 3 }; // 10 月 75%
    for (let i = 0; i < 21; i++)
      o[addDays("2026-11-01", i)] = { due: 5, completed: i === 9 ? 0 : 5 }; // 11-10 断
    const s = monthSummary(H(o), "2026-11-21");
    expect(s.month).toBe("2026-11");
    expect(s.checkIns).toBe(100);
    expect(s.completionPct).toBe(95); // 100/105
    expect(s.prevCompletionPct).toBe(75);
    expect(s.deltaPct).toBe(20);
    expect(s.longestStreak).toBe(11); // 11-11..11-21
  });
  it("T-ST-07 月摘要：完成数超过到期数时封顶，不出现 >100%；无数据 → null", () => {
    expect(
      monthSummary(H({ "2026-11-02": { due: 1, completed: 3 } }), "2026-11-21").completionPct,
    ).toBe(100);
    expect(monthSummary(new Map(), "2026-11-21").completionPct).toBeNull();
  });
  it("T-ST-08 单目标完成率分母 = 截至今天的到期天数（11-21 → 21 天，不是 30）", () => {
    const due = Array.from({ length: 30 }, (_, i) => addDays("2026-11-01", i));
    const done = new Set(due.slice(0, 19));
    expect(goalCompletion(due, done, "2026-11-21")).toEqual({ done: 19, due: 21, pct: 90 });
  });
  it("T-ST-09 积分收支：获得只含挣分来源；退还单列不计入获得来源；兑换/扣分/撤销分开；按自然周截断到本月", () => {
    const L: LedgerEntry[] = [
      { id: "1", at: ts("2026-11-02"), kind: "points", delta: 100, reason: "checkin" },
      { id: "2", at: ts("2026-11-03"), kind: "points", delta: 50, reason: "milestone" },
      { id: "3", at: ts("2026-11-10"), kind: "points", delta: -40, reason: "redeem" },
      { id: "4", at: ts("2026-11-10"), kind: "points", delta: -10, reason: "violation" },
      { id: "5", at: ts("2026-11-11"), kind: "points", delta: 15, reason: "refund" },
      { id: "6", at: ts("2026-11-12"), kind: "points", delta: -15, reason: "undo" },
      { id: "7", at: ts("2026-10-31"), kind: "points", delta: 999, reason: "checkin" },
      { id: "8", at: ts("2026-11-02"), kind: "xp", delta: 100, reason: "checkin" },
    ];
    const f = pointsFlow(L, "2026-11-21");
    expect([f.earned, f.redeemed, f.deducted, f.refunded, f.undone]).toEqual([150, 40, 10, 15, 15]);
    expect(f.sources).toEqual([
      { reason: "checkin", points: 100, pct: 67 },
      { reason: "milestone", points: 50, pct: 33 },
    ]);
    expect(f.sources.some((s) => s.reason === "refund")).toBe(false);
    expect(f.weeks.map((w) => w.weekStart)).toEqual(["2026-11-02", "2026-11-09"]);
    // 12-01 是周二，所在自然周从 11-30 开始 → 截断到 12-01
    const dec = pointsFlow(
      [{ id: "d", at: ts("2026-12-02"), kind: "points", delta: 7, reason: "checkin" }],
      "2026-12-15",
    );
    expect(dec.weeks).toEqual([{ weekStart: "2026-12-01", earned: 7, redeemed: 0, deducted: 0 }]);
  });
  it("T-ST-10 时区归属：北京时间 11-30 23:59 归 11 月，12-01 00:01 归 12 月", () => {
    const L: LedgerEntry[] = [
      { id: "a", at: Date.UTC(2026, 10, 30, 15, 59), kind: "points", delta: 10, reason: "checkin" },
      { id: "b", at: Date.UTC(2026, 10, 30, 16, 1), kind: "points", delta: 20, reason: "checkin" },
    ];
    expect(pointsFlow(L, "2026-11-15").earned).toBe(10);
    expect(pointsFlow(L, "2026-12-15").earned).toBe(20);
  });
  it("T-ST-11 体重月变化 = 本月最后 − 上月最后；无上月用本月第一次；不足两点 null。存款月增量", () => {
    const w = [
      { date: "2026-10-28", g: 68900 },
      { date: "2026-11-05", g: 67500 },
      { date: "2026-11-20", g: 65800 },
    ];
    expect(monthlyWeightChange(w, "2026-11-21")).toEqual({ latestG: 65800, deltaG: -3100 }); // −6.2 斤
    expect(monthlyWeightChange(w.slice(1), "2026-11-21")).toEqual({
      latestG: 65800,
      deltaG: -1700,
    });
    expect(monthlyWeightChange([{ date: "2026-11-05", g: 67500 }], "2026-11-21")).toBeNull();
    expect(
      monthlyDeposits(
        [
          { date: "2026-11-01", amountFen: 70000 },
          { date: "2026-10-31", amountFen: 1 },
          { date: "2026-11-21", amountFen: 210000 },
        ],
        "2026-11-21",
      ),
    ).toBe(280000);
  });
});
