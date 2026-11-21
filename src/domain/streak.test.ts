import { describe, it, expect } from "vitest";
import {
  reconcileStreak,
  applyCheckIn,
  applyPeriodCheckIn,
  periodStreakCount,
  previousAnchor,
  grantWeeklyFreeze,
  applyViolationToStreak,
  applyRetroToStreak,
  overallStreak,
  isGoalDue,
  retroPoints,
  canRetro,
  type StreakState,
  type DaySummary,
} from "./index.ts";

const s = (current: number, last: string): StreakState => ({
  goalId: "g",
  current,
  best: Math.max(current, 10),
  lastCountedPeriod: last,
});

describe("按周期累计的单目标连胜", () => {
  const blank: StreakState = { goalId: "g", current: 0, best: 0, lastCountedPeriod: "" };

  it("连续三个自然周连胜 3，同一周再记不增加", () => {
    let st = applyPeriodCheckIn(blank, "2026-11-16", previousAnchor("week", "2026-11-16"));
    expect(st.current).toBe(1);
    st = applyPeriodCheckIn(st, "2026-11-23", previousAnchor("week", "2026-11-23"));
    expect(st.current).toBe(2);
    st = applyPeriodCheckIn(st, "2026-11-23", previousAnchor("week", "2026-11-23"));
    expect(st.current).toBe(2);
    st = applyPeriodCheckIn(st, "2026-11-30", previousAnchor("week", "2026-11-30"));
    expect(st.current).toBe(3);
  });

  it("跳过一周后从 1 重新计", () => {
    let st = applyPeriodCheckIn(blank, "2026-11-16", previousAnchor("week", "2026-11-16"));
    st = applyPeriodCheckIn(st, "2026-11-30", previousAnchor("week", "2026-11-30"));
    expect(st.current).toBe(1);
  });

  it("按月连续，以及从已完成周期往回数", () => {
    const count = periodStreakCount(
      ["2026-09-01", "2026-10-01", "2026-11-01"],
      "2026-11-01",
      (anchor) => previousAnchor("month", anchor),
    );
    expect(count).toBe(3);
    expect(
      periodStreakCount(["2026-09-01", "2026-10-01"], "2026-11-01", (anchor) =>
        previousAnchor("month", anchor),
      ),
    ).toBe(2);
    expect(
      periodStreakCount(["2026-09-01"], "2026-11-01", (anchor) => previousAnchor("month", anchor)),
    ).toBe(0);
  });
});

describe("连胜与冻结卡", () => {
  it("T-S-01 首次打卡连胜 1；连续 +1；同日重复幂等", () => {
    let st: StreakState = { goalId: "g", current: 0, best: 0, lastCountedPeriod: "" };
    st = applyCheckIn(st, "2026-12-01");
    expect(st.current).toBe(1);
    st = applyCheckIn(st, "2026-12-02");
    expect(st.current).toBe(2);
    st = applyCheckIn(st, "2026-12-02");
    expect(st.current).toBe(2);
    expect(st.best).toBe(2);
  });
  it("T-S-02 US-04：连胜 10，冻结卡 1，昨日漏打 → 冻结卡 0，连胜 10；今天打卡 → 11", () => {
    const r = reconcileStreak(s(10, "2026-12-08"), "2026-12-10", 1);
    expect(r.freezeCardsUsed).toBe(1);
    expect(r.frozenDays).toEqual(["2026-12-09"]);
    expect(r.streak.current).toBe(10);
    expect(r.broken).toBe(false);
    expect(applyCheckIn(r.streak, "2026-12-10").current).toBe(11);
  });
  it("T-S-03 US-05：连胜 10，冻结卡 0，昨日漏打 → 连胜 0，broken（显示“新的开始”），best 保留", () => {
    const r = reconcileStreak(s(10, "2026-12-08"), "2026-12-10", 0);
    expect(r.streak.current).toBe(0);
    expect(r.streak.best).toBe(10);
    expect(r.broken).toBe(true);
    expect(r.freezeCardsUsed).toBe(0);
  });
  it("T-S-04 昨天已打卡 → 不消耗冻结卡；重复 reconcile 不重复扣卡", () => {
    expect(reconcileStreak(s(5, "2026-12-09"), "2026-12-10", 2).freezeCardsUsed).toBe(0);
    const r1 = reconcileStreak(s(5, "2026-12-07"), "2026-12-10", 3);
    expect(r1.freezeCardsUsed).toBe(2);
    const r2 = reconcileStreak(r1.streak, "2026-12-10", 1);
    expect(r2.freezeCardsUsed).toBe(0);
  });
  it("T-S-05 Q-S1：漏 2 天只有 1 张卡 → 一张不扣、连胜 0、提示“卡不够，已为你保留 1 张”", () => {
    const r = reconcileStreak(s(10, "2026-12-07"), "2026-12-10", 1);
    expect(r.freezeCardsUsed).toBe(0);
    expect(r.keptFreezeCards).toBe(1);
    expect(r.missedDays).toBe(2);
    expect(r.streak.current).toBe(0);
    expect(r.broken).toBe(true);
    expect(r.notice).toBe("卡不够，已为你保留 1 张");
  });
  it("T-S-09 Q-S1：漏 5 天持有 3 张 → 保留 3 张；0 张时无此提示；卡够时无提示且 kept = 剩余", () => {
    expect(reconcileStreak(s(10, "2026-12-04"), "2026-12-10", 3).notice).toBe(
      "卡不够，已为你保留 3 张",
    );
    expect(reconcileStreak(s(10, "2026-12-04"), "2026-12-10", 0).notice).toBeUndefined();
    const ok = reconcileStreak(s(10, "2026-12-07"), "2026-12-10", 3);
    expect(ok.notice).toBeUndefined();
    expect(ok.keptFreezeCards).toBe(1);
    expect(ok.freezeCardsUsed).toBe(2);
  });
  it("T-S-10 Q-S2：补卡不恢复连胜、不吃连胜倍率（normal 连胜 21 补卡仍 +5）", () => {
    const broken = reconcileStreak(s(10, "2026-12-07"), "2026-12-10", 0).streak;
    expect(canRetro("2026-12-08", "2026-12-10", 0, false).ok).toBe(true);
    expect(applyRetroToStreak(broken)).toEqual(broken);
    expect(applyRetroToStreak(broken).current).toBe(0);
    expect(retroPoints("normal")).toBe(5);
  });
  it("T-S-06 违规不影响连胜（仅标记不完美）", () => {
    const st = s(10, "2026-12-09");
    const r = applyViolationToStreak(st);
    expect(r.streak).toEqual(st);
    expect(r.imperfect).toBe(true);
  });
  it("T-S-07 冻结卡每周 +1，上限 3；同周不重复；离线 5 周补到 3", () => {
    expect(
      grantWeeklyFreeze({ freezeCards: 0, lastFreezeGrant: "2026-11-30" }, "2026-12-06"),
    ).toEqual({ freezeCards: 0, lastFreezeGrant: "2026-11-30" }); // 同周（周一 11-30 ~ 周日 12-06）
    expect(
      grantWeeklyFreeze({ freezeCards: 0, lastFreezeGrant: "2026-11-30" }, "2026-12-07")
        .freezeCards,
    ).toBe(1);
    expect(
      grantWeeklyFreeze({ freezeCards: 3, lastFreezeGrant: "2026-11-30" }, "2026-12-07")
        .freezeCards,
    ).toBe(3);
    expect(
      grantWeeklyFreeze({ freezeCards: 1, lastFreezeGrant: "2026-11-30" }, "2027-01-05")
        .freezeCards,
    ).toBe(3);
    expect(grantWeeklyFreeze({ freezeCards: 0, lastFreezeGrant: "" }, "2026-12-02")).toEqual({
      freezeCards: 1,
      lastFreezeGrant: "2026-11-30",
    });
  });
  it("T-S-08 跨年连胜：12-31 → 01-01 连续", () => {
    const st = applyCheckIn(s(3, "2026-12-31"), "2027-01-01");
    expect(st.current).toBe(4);
  });
});

describe("总连胜（Q-S4：当天至少完成 1 个到期目标）", () => {
  const H = (o: Record<string, DaySummary>) => new Map(Object.entries(o));
  it("T-S-11 连续 3 天各完成 ≥1 个（不要求全部）→ 3", () => {
    expect(
      overallStreak(
        H({
          "2026-12-08": { due: 3, completed: 1 },
          "2026-12-09": { due: 2, completed: 2 },
          "2026-12-10": { due: 3, completed: 1 },
        }),
        "2026-12-10",
      ),
    ).toBe(3);
  });
  it("T-S-12 今天还没完成 → 今天不计也不中断，从昨天数起", () => {
    expect(
      overallStreak(
        H({
          "2026-12-08": { due: 1, completed: 1 },
          "2026-12-09": { due: 1, completed: 1 },
          "2026-12-10": { due: 2, completed: 0 },
        }),
        "2026-12-10",
      ),
    ).toBe(2);
  });
  it("T-S-13 中间某天有到期目标却 0 完成 → 中断", () => {
    expect(
      overallStreak(
        H({
          "2026-12-07": { due: 1, completed: 1 },
          "2026-12-08": { due: 2, completed: 0 },
          "2026-12-09": { due: 1, completed: 1 },
          "2026-12-10": { due: 1, completed: 1 },
        }),
        "2026-12-10",
      ),
    ).toBe(2);
  });
  it("T-S-14 当天无到期目标（due=0 或无记录）→ 中性日：不加 1、不中断", () => {
    expect(
      overallStreak(
        H({
          "2026-12-07": { due: 1, completed: 1 },
          "2026-12-08": { due: 0, completed: 0 },
          "2026-12-10": { due: 1, completed: 1 },
        }),
        "2026-12-10",
      ),
    ).toBe(2); // 12-09 无记录也中性
  });
  it("T-S-15 无到期目标但主动完成了（如每周 3 次已达标后又打卡）→ 计 1 天", () => {
    expect(
      overallStreak(
        H({ "2026-12-09": { due: 0, completed: 1 }, "2026-12-10": { due: 1, completed: 1 } }),
        "2026-12-10",
      ),
    ).toBe(2);
  });
  it("T-S-16 到期目标都被冻结卡保住 → 中性；只保住一部分 → 中断", () => {
    expect(
      overallStreak(
        H({
          "2026-12-08": { due: 1, completed: 1 },
          "2026-12-09": { due: 2, completed: 0, frozen: 2 },
          "2026-12-10": { due: 1, completed: 1 },
        }),
        "2026-12-10",
      ),
    ).toBe(2);
    expect(
      overallStreak(
        H({
          "2026-12-08": { due: 1, completed: 1 },
          "2026-12-09": { due: 2, completed: 0, frozen: 1 },
          "2026-12-10": { due: 1, completed: 1 },
        }),
        "2026-12-10",
      ),
    ).toBe(1);
  });
  it("T-S-17 空历史 → 0；只有今天完成 → 1；跨年连续", () => {
    expect(overallStreak(new Map(), "2026-12-10")).toBe(0);
    expect(overallStreak(H({ "2026-12-10": { due: 1, completed: 1 } }), "2026-12-10")).toBe(1);
    expect(
      overallStreak(
        H({ "2026-12-31": { due: 1, completed: 1 }, "2027-01-01": { due: 1, completed: 1 } }),
        "2027-01-01",
      ),
    ).toBe(2);
  });
  it("T-S-18 到期判定：daily 每天；weekdays 指定星期；timesPerWeek 达标后不再到期", () => {
    expect(isGoalDue({ kind: "daily" }, "2026-12-10")).toBe(true);
    expect(isGoalDue({ kind: "weekdays", days: [1, 3, 5] }, "2026-12-09")).toBe(true); // 周三
    expect(isGoalDue({ kind: "weekdays", days: [1, 3, 5] }, "2026-12-10")).toBe(false); // 周四
    expect(isGoalDue({ kind: "timesPerWeek", n: 3 }, "2026-12-10", 2)).toBe(true);
    expect(isGoalDue({ kind: "timesPerWeek", n: 3 }, "2026-12-10", 3)).toBe(false);
  });
});
