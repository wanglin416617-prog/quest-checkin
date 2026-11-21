import { describe, it, expect } from "vitest";
import {
  addDays,
  bonusWeekKey,
  xpFor,
  xpOnce,
  netAwarded,
  undoReclaim,
  recheckAward,
  computeDeduction,
  createCompensation,
  completeCompensation,
  expireOverdue,
  canCreateCompensation,
  wastedDaysTenths,
  stepsFor,
  ropeMinutesFor,
  impulseDaysTenths,
  seededRng,
  applyViolationToStreak,
  balanceOf,
  canRedeem,
  COMPENSATION_WINDOW_MS,
  type LedgerEntry,
  type CompensationTask,
} from "./index.ts";

describe("违规扣分上限", () => {
  it("T-V-01 普通扣分：规则 10、余额 100、今日 0 → 扣 10", () => {
    expect(computeDeduction({ ruleDeduct: 10, balance: 100, deductedToday: 0 })).toEqual({
      deducted: 10,
      cappedBy: [],
      dailyCapReached: false,
    });
  });
  it("T-V-02 单次上限：规则 20 → 20；规则 21/100 → 20 且标记 single", () => {
    expect(computeDeduction({ ruleDeduct: 20, balance: 100, deductedToday: 0 }).deducted).toBe(20);
    const r = computeDeduction({ ruleDeduct: 21, balance: 100, deductedToday: 0 });
    expect(r.deducted).toBe(20);
    expect(r.cappedBy).toEqual(["single"]);
    expect(computeDeduction({ ruleDeduct: 100, balance: 100, deductedToday: 0 }).deducted).toBe(20);
  });
  it("T-V-03 US-24：今日已扣 45，再扣 10 → 只扣 5，提示今日已到上限", () => {
    const r = computeDeduction({ ruleDeduct: 10, balance: 100, deductedToday: 45 });
    expect(r.deducted).toBe(5);
    expect(r.cappedBy).toContain("daily");
    expect(r.dailyCapReached).toBe(true);
  });
  it("T-V-04 每日上限边界：已扣 50 → 0；已扣 30 扣 20 → 20 且恰好到上限；已扣 49 扣 20 → 1", () => {
    expect(computeDeduction({ ruleDeduct: 10, balance: 100, deductedToday: 50 }).deducted).toBe(0);
    const r = computeDeduction({ ruleDeduct: 20, balance: 100, deductedToday: 30 });
    expect(r.deducted).toBe(20);
    expect(r.dailyCapReached).toBe(true);
    expect(r.cappedBy).toEqual([]);
    expect(computeDeduction({ ruleDeduct: 20, balance: 100, deductedToday: 49 }).deducted).toBe(1);
  });
  it("T-V-05 余额不为负：余额 7 扣 10 → 7；余额 0 → 0（不足部分不扣）", () => {
    const r = computeDeduction({ ruleDeduct: 10, balance: 7, deductedToday: 0 });
    expect(r.deducted).toBe(7);
    expect(r.cappedBy).toEqual(["balance"]);
    expect(computeDeduction({ ruleDeduct: 10, balance: 0, deductedToday: 0 }).deducted).toBe(0);
  });
  it("T-V-06 三重上限叠加：规则 30、余额 3、今日 45 → 3", () => {
    const r = computeDeduction({ ruleDeduct: 30, balance: 3, deductedToday: 45 });
    expect(r.deducted).toBe(3);
    expect(r.cappedBy).toEqual(["single", "daily", "balance"]);
  });
  it("T-V-07 非法/零扣分：规则 0 或负数 → 0", () => {
    expect(computeDeduction({ ruleDeduct: 0, balance: 100, deductedToday: 0 }).deducted).toBe(0);
    expect(computeDeduction({ ruleDeduct: -5, balance: 100, deductedToday: 0 }).deducted).toBe(0);
  });
  it("T-V-08 连胜不清零（US-22）", () => {
    const st = { goalId: "g", current: 12, best: 12, lastCountedPeriod: "2026-12-09" };
    expect(applyViolationToStreak(st).streak.current).toBe(12);
  });
});

describe("补偿任务 48h", () => {
  const T0 = Date.UTC(2026, 11, 10, 4, 0, 0); // 2026-12-10（周四）12:00 北京时间
  const NONE = new Set<string>();
  it("T-V-09 US-23：48h 内完成 → 退还 10 + 奖励 5 = 15", () => {
    const t = createCompensation("c1", "v1", "g1", "快走 10000 步", T0, 10);
    expect(t.dueAt).toBe(T0 + COMPENSATION_WINDOW_MS);
    const r = completeCompensation(t, T0 + 47 * 3600e3, "2026-12-12", NONE);
    expect(r.refundPoints + r.bonusPoints).toBe(15);
    expect(r.task.status).toBe("done");
    expect(r.task.bonus).toBe(5);
  });
  it("T-V-10 恰好 48h 整（含）→ 退还；48h + 1ms → 过期，不退不罚", () => {
    const t = createCompensation("c1", "v1", "g1", "x", T0, 10);
    const ok = completeCompensation(t, T0 + COMPENSATION_WINDOW_MS, "2026-12-12", NONE);
    expect(ok.refundPoints + ok.bonusPoints).toBe(15);
    const late = completeCompensation(t, T0 + COMPENSATION_WINDOW_MS + 1, "2026-12-12", NONE);
    expect(late.refundPoints + late.bonusPoints).toBe(0);
    expect(late.task.status).toBe("expired");
  });
  it("T-V-11 退还“实际扣分”：被上限截断为 5 → 退 5 + 5 = 10；实际扣 0 → 退 0 + 5", () => {
    const a = completeCompensation(
      createCompensation("c", "v", "g", "x", T0, 5),
      T0 + 1,
      "2026-12-10",
      NONE,
    );
    expect(a.refundPoints + a.bonusPoints).toBe(10);
    const b = completeCompensation(
      createCompensation("c", "v", "g", "x", T0, 0),
      T0 + 1,
      "2026-12-10",
      NONE,
    );
    expect(b.refundPoints + b.bonusPoints).toBe(5);
  });
  it("T-V-12 重复完成不重复退款", () => {
    const t = createCompensation("c", "v", "g", "x", T0, 10);
    const r1 = completeCompensation(t, T0 + 1, "2026-12-10", NONE);
    const r2 = completeCompensation(r1.task, T0 + 2, "2026-12-10", NONE);
    expect(r2.refundPoints + r2.bonusPoints).toBe(0);
  });
  it("T-V-13 过期扫描只改状态，不产生流水", () => {
    const t = createCompensation("c", "v", "g", "x", T0, 10);
    const [e] = expireOverdue([t], T0 + COMPENSATION_WINDOW_MS + 1);
    expect(e!.status).toBe("expired");
    expect(e!.bonus).toBeUndefined();
    expect(expireOverdue([t], T0 + COMPENSATION_WINDOW_MS)[0]!.status).toBe("open");
  });
  it("T-V-14 同时最多 3 个未完成补偿任务", () => {
    expect([0, 1, 2, 3, 4].map(canCreateCompensation)).toEqual([true, true, true, false, false]);
  });
  it("T-V-20 奖励每目标每自然周 1 次：同目标同周第 2 次只退扣分、bonusSkipped；退扣分不限次", () => {
    const used = new Set<string>();
    const r1 = completeCompensation(
      createCompensation("c1", "v1", "g1", "x", T0, 10),
      T0 + 1,
      "2026-12-10",
      used,
    );
    expect(r1.bonusPoints).toBe(5);
    used.add(bonusWeekKey("g1", "2026-12-10"));
    const r2 = completeCompensation(
      createCompensation("c2", "v2", "g1", "x", T0, 20),
      T0 + 2,
      "2026-12-13",
      used,
    ); // 同周周日
    expect(r2.refundPoints).toBe(20);
    expect(r2.bonusPoints).toBe(0);
    expect(r2.bonusSkipped).toBe(true);
    expect(r2.task.bonus).toBe(0);
  });
  it("T-V-21 自然周边界（周一起）：周日 12-13 领过 → 周一 12-14 可再领", () => {
    const used = new Set([bonusWeekKey("g1", "2026-12-13")]);
    expect(bonusWeekKey("g1", "2026-12-13")).toBe("g1@2026-12-07");
    expect(bonusWeekKey("g1", "2026-12-14")).toBe("g1@2026-12-14");
    expect(
      completeCompensation(
        createCompensation("c", "v", "g1", "x", T0, 3),
        T0 + 1,
        "2026-12-14",
        used,
      ).bonusPoints,
    ).toBe(5);
  });
  it("T-V-22 不同目标各自 1 次、无全局上限：同一天 5 个目标都可领 +5", () => {
    const used = new Set<string>();
    let total = 0;
    for (const g of ["g1", "g2", "g3", "g4", "g5"]) {
      const r = completeCompensation(
        createCompensation("c" + g, "v", g, "x", T0, 0),
        T0 + 1,
        "2026-12-10",
        used,
      );
      total += r.bonusPoints;
      used.add(bonusWeekKey(g, "2026-12-10"));
    }
    expect(total).toBe(25);
  });
  it("T-V-23 奖励按完成日所在周：12-13（周日）创建、12-14（周一）完成 → 计入新一周", () => {
    const t = createCompensation("c", "v", "g1", "x", Date.UTC(2026, 11, 13, 4), 10);
    const r = completeCompensation(
      t,
      Date.UTC(2026, 11, 14, 4),
      "2026-12-14",
      new Set([bonusWeekKey("g1", "2026-12-13")]),
    );
    expect(r.bonusPoints).toBe(5);
    expect(r.task.doneDate).toBe("2026-12-14");
  });
});

describe("代价换算", () => {
  it("T-V-15 US-22：奶茶 400 kcal → 0.8 天、10000 步、40 分钟跳绳", () => {
    expect(wastedDaysTenths(400)).toBe(8);
    expect(stepsFor(400)).toBe(10000);
    expect(ropeMinutesFor(400)).toBe(40);
  });
  it("T-V-16 白费天数四舍五入 1 位：350→0.7，600→1.2，525→1.1（1.05 进位），自定义缺口 300 → 400/300=1.3", () => {
    expect(wastedDaysTenths(350)).toBe(7);
    expect(wastedDaysTenths(600)).toBe(12);
    expect(wastedDaysTenths(525)).toBe(11);
    expect(wastedDaysTenths(400, 300)).toBe(13);
  });
  it("T-V-17 US-28：350 元 / 每日应存 100 元 → 3.5 天（Q-V3：1 位小数）", () => {
    expect(impulseDaysTenths(35000, 10000)).toBe(35);
  });
  it("T-V-18 冲动消费 1 位小数四舍五入：320/100 → 3.2；325/100 → 3.3；33.33/100 → 0.3；300/100 → 3.0；应存 0 → null", () => {
    expect(impulseDaysTenths(32000, 10000)).toBe(32);
    expect(impulseDaysTenths(32500, 10000)).toBe(33);
    expect(impulseDaysTenths(3333, 10000)).toBe(3);
    expect(impulseDaysTenths(30000, 10000)).toBe(30);
    expect(impulseDaysTenths(100, 0)).toBeNull();
  });
});

describe("T-V-19 90 天随机序列不变量（3 个目标，每天 0~10 个事件：打卡/撤销/重打/兑换/违规/完成补偿）", () => {
  const coverage = { undo: 0, recheck: 0, shortfall: 0 };
  it.each([1, 2, 3, 42, 2026, 7, 99, 123456])("seed %i", (seed) => {
    const rng = seededRng(seed);
    const goals = ["g1", "g2", "g3"];
    const ledger: LedgerEntry[] = [];
    let tasks: CompensationTask[] = [];
    const deductedByDay: Record<string, number> = {};
    const refundedByDay: Record<string, number> = {};
    const bonusByGoalWeek: Record<string, number> = {};
    const bonusUsed = new Set<string>();
    let xp = 0;
    const targetPts: Record<string, number> = {};
    const activeCheck = new Set<string>();
    const xpGranted = new Set<string>();
    const xpByKey: Record<string, number> = {};
    const streak = { goalId: "g1", current: 5, best: 5, lastCountedPeriod: "2026-11-30" };
    let id = 0;
    const DAY = 86_400_000;
    const BASE_TS = Date.UTC(2026, 10, 30, 16, 0, 0); // 2026-12-01 00:00 北京时间
    for (let d = 0; d < 90; d++) {
      const date = addDays("2026-12-01", d);
      const events = rng.int(11);
      for (let k = 0; k < events; k++) {
        const now = BASE_TS + d * DAY + k * 60_000;
        tasks = expireOverdue(tasks, now);
        const goal = goals[rng.int(3)]!;
        const roll = rng.int(10);
        if (roll < 4) {
          // 打卡 / 撤销 / 重打（同目标同天一个挣分来源）
          const key = `checkin:${goal}:${date}`;
          const pts = targetPts[key] ?? (targetPts[key] = 5 + rng.int(36));
          const active = activeCheck.has(key);
          if (!active) {
            const award = recheckAward(pts, netAwarded(ledger, key));
            if (targetPts[key] !== undefined && xpGranted.has(key)) coverage.recheck++;
            if (award > 0)
              ledger.push({
                id: String(id++),
                at: now,
                kind: "points",
                delta: award,
                reason: "checkin",
                awardKey: key,
              });
            const gx = xpOnce(xpGranted, key, "checkin", pts);
            if (gx > 0) {
              xp += gx;
              xpGranted.add(key);
              xpByKey[key] = (xpByKey[key] ?? 0) + gx;
            }
            activeCheck.add(key);
          } else if (rng.int(2) === 0) {
            const r = undoReclaim(netAwarded(ledger, key), balanceOf(ledger));
            if (r.reclaim > 0)
              ledger.push({
                id: String(id++),
                at: now,
                kind: "points",
                delta: -r.reclaim,
                reason: "undo",
                awardKey: key,
              });
            coverage.undo++;
            if (r.shortfall > 0) coverage.shortfall++;
            xp += xpFor("undo", -r.reclaim);
            activeCheck.delete(key);
          }
          const net = netAwarded(ledger, key);
          expect(net).toBeGreaterThanOrEqual(0);
          expect(net).toBeLessThanOrEqual(pts); // 同一来源净发放永不超过一次
          expect(xpByKey[key] ?? 0).toBeLessThanOrEqual(pts); // 经验只发一次
        } else if (roll === 4) {
          // 兑换：把积分花掉，制造“撤销时余额不足”的情形
          const balance = balanceOf(ledger);
          if (balance > 0) {
            const cost = 1 + rng.int(balance);
            expect(canRedeem(balance, cost)).toBe(true);
            ledger.push({
              id: String(id++),
              at: now,
              kind: "points",
              delta: -cost,
              reason: "redeem",
            });
          }
        } else if (roll < 8) {
          const balance = balanceOf(ledger);
          const today = deductedByDay[date] ?? 0;
          const r = computeDeduction({ ruleDeduct: rng.int(60), balance, deductedToday: today });
          expect(r.deducted).toBeLessThanOrEqual(20);
          expect(r.deducted).toBeLessThanOrEqual(balance);
          deductedByDay[date] = today + r.deducted;
          if (r.deducted > 0)
            ledger.push({
              id: String(id++),
              at: now,
              kind: "points",
              delta: -r.deducted,
              reason: "violation",
            });
          xp += xpFor("violation", -r.deducted);
          expect(applyViolationToStreak(streak).streak.current).toBe(5);
          if (canCreateCompensation(tasks.filter((t) => t.status === "open").length)) {
            tasks.push(createCompensation(String(id++), "v", goal, "x", now, r.deducted));
          }
        } else {
          const open = tasks.filter((t) => t.status === "open");
          if (open.length) {
            const t = open[rng.int(open.length)]!;
            const res = completeCompensation(t, now, date, bonusUsed);
            if (res.task.status === "done") {
              expect(res.refundPoints).toBe(t.refund);
              refundedByDay[date] = (refundedByDay[date] ?? 0) + res.refundPoints;
              if (res.refundPoints > 0)
                ledger.push({
                  id: String(id++),
                  at: now,
                  kind: "points",
                  delta: res.refundPoints,
                  reason: "refund",
                  refId: t.id,
                });
              if (res.bonusPoints > 0) {
                ledger.push({
                  id: String(id++),
                  at: now,
                  kind: "points",
                  delta: res.bonusPoints,
                  reason: "refund",
                  refId: t.id,
                });
                const key = bonusWeekKey(t.goalId, date);
                bonusUsed.add(key);
                bonusByGoalWeek[key] = (bonusByGoalWeek[key] ?? 0) + res.bonusPoints;
              }
              xp += xpFor("refund", res.refundPoints + res.bonusPoints);
            }
            tasks = tasks.map((x) => (x.id === t.id ? res.task : x));
          }
        }
        // 每一步之后的不变量
        expect(balanceOf(ledger)).toBeGreaterThanOrEqual(0);
        expect(deductedByDay[date] ?? 0).toBeLessThanOrEqual(50); // 全局每日 ≤ 50，退款不释放额度
        expect(tasks.filter((t) => t.status === "open").length).toBeLessThanOrEqual(3);
        for (const v of Object.values(bonusByGoalWeek)) expect(v).toBeLessThanOrEqual(5); // 每目标每周奖励 ≤ 1 次
      }
    }
    // 全局：余额 = 流水之和；退回扣分总额 = 已完成任务 refund 之和；奖励 = 已完成任务 bonus 之和
    const done = tasks.filter((t) => t.status === "done");
    const refundEntries = ledger
      .filter((e) => e.reason === "refund")
      .reduce((a, e) => a + e.delta, 0);
    expect(refundEntries).toBe(done.reduce((a, t) => a + t.refund + (t.bonus ?? 0), 0));
    // 经验只来自打卡且每个来源只发一次；扣分/退款/奖励/撤销不影响经验，经验只增不减
    expect(xp).toBe(Object.values(xpByKey).reduce((a, b) => a + b, 0));
    expect(xp).toBe(Object.keys(xpByKey).reduce((a, k) => a + targetPts[k]!, 0));
    expect(xp).toBeGreaterThanOrEqual(0);
    // “退款不释放额度”：每日扣分合计仍 ≤ 50，即使当日有退款
    for (const k of Object.keys(deductedByDay)) expect(deductedByDay[k]).toBeLessThanOrEqual(50);
  });
  it("T-V-19b 随机序列确实覆盖了 撤销 / 重打 / 余额不足收回 三种路径", () => {
    expect(coverage.undo).toBeGreaterThan(0);
    expect(coverage.recheck).toBeGreaterThan(0);
    expect(coverage.shortfall).toBeGreaterThan(0);
  });
});
