import { describe, it, expect } from "vitest";
import {
  checkInPoints,
  retroPoints,
  streakMult,
  canRetro,
  isMealOnTime,
  mealPoints,
  dietDayPoints,
  depositPoints,
  xpToNext,
  levelFromXp,
  balanceOf,
  reverseEntry,
  canRedeem,
  weightLossDayComplete,
  xpFor,
  xpOnce,
  netAwarded,
  undoReclaim,
  recheckAward,
  type LedgerEntry,
} from "./index.ts";

describe("连胜倍率与打卡积分", () => {
  it("T-P-01 倍率边界 2/3/6/7/20/21", () => {
    expect([0, 1, 2, 3, 6, 7, 20, 21, 100].map(streakMult)).toEqual([
      1, 1, 1, 1.2, 1.2, 1.5, 1.5, 2, 2,
    ]);
  });
  it("T-P-02 普通难度：连胜1=10（US-02），连胜7=15（US-03），连胜3=12，连胜21=20", () => {
    expect(checkInPoints("normal", 1)).toBe(10);
    expect(checkInPoints("normal", 7)).toBe(15);
    expect(checkInPoints("normal", 3)).toBe(12);
    expect(checkInPoints("normal", 21)).toBe(20);
  });
  it("T-P-03 四档难度 × 四档倍率全表（含 5×1.5=7.5→8 四舍五入）", () => {
    const t = (d: "easy" | "normal" | "hard" | "epic") =>
      [1, 3, 7, 21].map((s) => checkInPoints(d, s));
    expect(t("easy")).toEqual([5, 6, 8, 10]);
    expect(t("normal")).toEqual([10, 12, 15, 20]);
    expect(t("hard")).toEqual([20, 24, 30, 40]);
    expect(t("epic")).toEqual([40, 48, 60, 80]);
  });
  it("T-P-04 补卡 = 一半（easy 2.5→3），US-06 普通 +5", () => {
    expect(retroPoints("easy")).toBe(3);
    expect(retroPoints("normal")).toBe(5);
    expect(retroPoints("hard")).toBe(10);
    expect(retroPoints("epic")).toBe(20);
  });
  it("T-P-05 补卡资格：1/2 天前可补；3 天前不可（US-06）；今天/未来不可；每周 2 次", () => {
    const today = "2026-12-10";
    expect(canRetro("2026-12-09", today, 0, false)).toEqual({ ok: true });
    expect(canRetro("2026-12-08", today, 1, false)).toEqual({ ok: true });
    expect(canRetro("2026-12-07", today, 0, false)).toEqual({ ok: false, reason: "too_old" });
    expect(canRetro("2026-12-10", today, 0, false)).toEqual({
      ok: false,
      reason: "future_or_today",
    });
    expect(canRetro("2026-12-09", today, 2, false)).toEqual({ ok: false, reason: "weekly_limit" });
    expect(canRetro("2026-12-09", today, 0, true)).toEqual({
      ok: false,
      reason: "already_checked",
    });
  });
  it("T-P-06 补卡跨月/跨年/闰年", () => {
    expect(canRetro("2027-02-28", "2027-03-01", 0, false).ok).toBe(true);
    expect(canRetro("2028-02-28", "2028-03-01", 0, false).ok).toBe(true); // 闰年 2/29 在中间，相差 2 天
    expect(canRetro("2028-02-27", "2028-03-01", 0, false).ok).toBe(false);
    expect(canRetro("2026-12-31", "2027-01-01", 0, false).ok).toBe(true);
  });
});

describe("减重积分", () => {
  it("T-P-07 按时窗口 ±30 含边界：11:30/12:30 按时，11:29/12:31 不按时", () => {
    expect(isMealOnTime("12:00", 11 * 60 + 30)).toBe(true);
    expect(isMealOnTime("12:00", 12 * 60 + 30)).toBe(true);
    expect(isMealOnTime("12:00", 11 * 60 + 29)).toBe(false);
    expect(isMealOnTime("12:00", 12 * 60 + 31)).toBe(false);
    expect(isMealOnTime("07:30", 7 * 60 + 50, 15)).toBe(false);
  });
  it("T-P-08 US-21：12:20 打卡 + 清淡 = +5 +3 = 8", () => {
    expect(
      mealPoints({
        onTime: isMealOnTime("12:00", 12 * 60 + 20),
        tags: ["清淡"],
        violationTags: ["奶茶"],
      }),
    ).toBe(8);
  });
  it("T-P-09 清淡 + 违规标签 → 无加成；不按时 + 清淡 → 3", () => {
    expect(mealPoints({ onTime: true, tags: ["清淡", "奶茶"], violationTags: ["奶茶"] })).toBe(5);
    expect(mealPoints({ onTime: false, tags: ["清淡"], violationTags: [] })).toBe(3);
    expect(mealPoints({ onTime: false, tags: ["正常"], violationTags: [] })).toBe(0);
  });
  it("T-P-10 饮食达标日 +15：全部启用餐按时且无违规；缺一餐/一餐迟到/有违规 → 0", () => {
    const meals = ["breakfast", "lunch", "dinner"];
    const ok = meals.map((m) => ({ meal: m, onTime: true, hasViolation: false }));
    expect(dietDayPoints(meals, ok)).toBe(15);
    expect(dietDayPoints(meals, ok.slice(0, 2))).toBe(0);
    expect(
      dietDayPoints(meals, [
        ...ok.slice(0, 2),
        { meal: "dinner", onTime: false, hasViolation: false },
      ]),
    ).toBe(0);
    expect(dietDayPoints(meals, [...ok, { meal: "snack", onTime: true, hasViolation: true }])).toBe(
      0,
    );
    expect(dietDayPoints([], [])).toBe(0);
  });
  it("T-P-11 减重连胜日 = 称重 且 饮食达标", () => {
    expect(weightLossDayComplete(true, true)).toBe(true);
    expect(weightLossDayComplete(true, false)).toBe(false);
    expect(weightLossDayComplete(false, true)).toBe(false);
  });
});

describe("存钱积分", () => {
  it("T-P-12 按计划完成 = 打卡同公式；≥120% 再 +5；信封 +2；不足计划 0", () => {
    expect(depositPoints("normal", 1, 70000, 70000)).toBe(10);
    expect(depositPoints("normal", 1, 83999, 70000)).toBe(10);
    expect(depositPoints("normal", 1, 84000, 70000)).toBe(15); // 恰好 120%
    expect(depositPoints("normal", 7, 3700, 3700, true)).toBe(17);
    expect(depositPoints("normal", 1, 69999, 70000)).toBe(0);
  });
});

describe("等级与流水", () => {
  it("T-P-13 升级所需 100/150/200；累计 0/99/100/249/250", () => {
    expect([1, 2, 3].map(xpToNext)).toEqual([100, 150, 200]);
    expect(levelFromXp(0).level).toBe(1);
    expect(levelFromXp(99).level).toBe(1);
    expect(levelFromXp(100)).toEqual({ level: 2, intoLevel: 0, needed: 150 });
    expect(levelFromXp(249).level).toBe(2);
    expect(levelFromXp(250).level).toBe(3);
  });
  it("T-P-14 US-07 撤销：余额回退，流水有 -15，原记录保留", () => {
    const e: LedgerEntry = { id: "a", at: 1, kind: "points", delta: 15, reason: "checkin" };
    const ledger = [e, reverseEntry(e, "b", 2)];
    expect(ledger).toHaveLength(2);
    expect(ledger[1]!.delta).toBe(-15);
    expect(balanceOf(ledger)).toBe(0);
  });
  it("T-P-15 US-08 兑换：余额 520 兑 500 → 20；余额不足拒绝", () => {
    expect(canRedeem(520, 500)).toBe(true);
    expect(520 - 500).toBe(20);
    expect(canRedeem(499, 500)).toBe(false);
  });
});

describe("经验（Q-P3：只增不减，扣分/退款不影响）", () => {
  it("T-P-16 挣分来源产生等额经验", () => {
    expect(xpFor("checkin", 15)).toBe(15);
    expect(xpFor("meal", 8)).toBe(8);
    expect(xpFor("milestone", 50)).toBe(50);
  });
  it("T-P-17 扣分、退款、补偿奖励、兑换、撤销、买冻结卡 → 经验 0", () => {
    expect(xpFor("violation", -10)).toBe(0);
    expect(xpFor("refund", 15)).toBe(0);
    expect(xpFor("redeem", -500)).toBe(0);
    expect(xpFor("undo", -15)).toBe(0);
    expect(xpFor("freezeBuy", -30)).toBe(0);
  });
  it("T-P-18 防刷：撤销后再打卡同一 xpKey 不再给经验（积分照常）", () => {
    const granted = new Set<string>();
    expect(xpOnce(granted, "checkin:g1:2026-12-10", "checkin", 15)).toBe(15);
    granted.add("checkin:g1:2026-12-10");
    expect(xpOnce(granted, "checkin:g1:2026-12-10", "checkin", 15)).toBe(0);
    expect(xpOnce(granted, "checkin:g1:2026-12-11", "checkin", 15)).toBe(15);
  });
});

describe("撤销收回 / 重打去重（2026-11-21 已定）", () => {
  const K = "checkin:g1:2026-12-10";
  it("T-P-19 撤销收回当次积分：打卡 +15 → 撤销收回 15，余额回到原值", () => {
    const L: LedgerEntry[] = [
      { id: "0", at: 0, kind: "points", delta: 100, reason: "checkin", awardKey: "x" },
      { id: "1", at: 1, kind: "points", delta: 15, reason: "checkin", awardKey: K },
    ];
    const r = undoReclaim(netAwarded(L, K), balanceOf(L));
    expect(r).toEqual({ reclaim: 15, shortfall: 0 });
    L.push({ id: "2", at: 2, kind: "points", delta: -r.reclaim, reason: "undo", awardKey: K });
    expect(balanceOf(L)).toBe(100);
    expect(netAwarded(L, K)).toBe(0);
  });
  it("T-P-20 重打：撤销后再打卡补发 15（净发放仍是一次）；未撤销时重复提交不发", () => {
    const L: LedgerEntry[] = [
      { id: "1", at: 1, kind: "points", delta: 15, reason: "checkin", awardKey: K },
    ];
    expect(recheckAward(15, netAwarded(L, K))).toBe(0);
    L.push({ id: "2", at: 2, kind: "points", delta: -15, reason: "undo", awardKey: K });
    expect(recheckAward(15, netAwarded(L, K))).toBe(15);
  });
  it("T-P-21 余额不足以收回（已兑换花掉）：只收回余额部分、余额为 0 不为负；重打只补差额，不重复发", () => {
    const L: LedgerEntry[] = [
      { id: "1", at: 1, kind: "points", delta: 15, reason: "checkin", awardKey: K },
      { id: "2", at: 2, kind: "points", delta: -10, reason: "redeem" },
    ];
    const r = undoReclaim(netAwarded(L, K), balanceOf(L));
    expect(r).toEqual({ reclaim: 5, shortfall: 10 });
    L.push({ id: "3", at: 3, kind: "points", delta: -5, reason: "undo", awardKey: K });
    expect(balanceOf(L)).toBe(0);
    expect(netAwarded(L, K)).toBe(10);
    expect(recheckAward(15, netAwarded(L, K))).toBe(5); // 重打只补 5：该来源净发放 = 15，不超一次
  });
  it("T-P-22 经验：打卡-撤销-重打 只发一次且撤销不收回", () => {
    const granted = new Set<string>();
    let xp = 0;
    xp += xpOnce(granted, K, "checkin", 15);
    granted.add(K);
    xp += xpFor("undo", -15);
    xp += xpOnce(granted, K, "checkin", 15);
    expect(xp).toBe(15);
  });
  it("T-P-23 撤销流水沿用 awardKey；净发放永不为负", () => {
    const e: LedgerEntry = {
      id: "a",
      at: 1,
      kind: "points",
      delta: 15,
      reason: "checkin",
      awardKey: K,
    };
    expect(reverseEntry(e, "b", 2)).toMatchObject({ delta: -15, reason: "undo", awardKey: K });
    expect(netAwarded([e, reverseEntry(e, "b", 2), reverseEntry(e, "c", 3)], K)).toBe(0);
  });
});
