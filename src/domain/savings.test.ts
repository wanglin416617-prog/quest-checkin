import { describe, it, expect } from "vitest";
import {
  remainingFen,
  requiredRates,
  week52Amount,
  week52Cumulative,
  incrementalAmount,
  incrementalCumulative,
  fixedCumulative,
  envelopeTotal,
  drawEnvelope,
  linearPlannedCumulative,
  leadBehindFen,
  savingsMilestones,
  seededRng,
  yuanIntToFen,
  formatFen,
} from "./index.ts";

describe("存钱计算", () => {
  it("T-$-01 US-25：目标 20000、起始 2000、180 天 → 每日 100、每周 700、每月 3040 元", () => {
    const rem = remainingFen({
      targetFen: yuanIntToFen(20000),
      startFen: yuanIntToFen(2000),
      depositsFen: [],
      impulsesFen: [],
      impulseCountsAgainstGoal: false,
    });
    expect(rem).toBe(1800000);
    const r = requiredRates(rem, 180);
    expect(formatFen(r.dailyFen)).toBe("100.00");
    expect(formatFen(r.weeklyFen)).toBe("700.00");
    expect(formatFen(r.monthlyFen)).toBe("3040.00");
  });
  it("T-$-02 除不尽向上取整到分：1000 元 / 3 天 → 333.34；每周 2333.34", () => {
    const r = requiredRates(100000, 3);
    expect(r.dailyFen).toBe(33334);
    expect(r.weeklyFen).toBe(233334);
  });
  it("T-$-03 还需存：存入扣减；冲动消费仅在“计入目标”时加回；下限 0", () => {
    const base = {
      targetFen: 100000,
      startFen: 0,
      depositsFen: [30000, 20000],
      impulsesFen: [5000],
    };
    expect(remainingFen({ ...base, impulseCountsAgainstGoal: false })).toBe(50000);
    expect(remainingFen({ ...base, impulseCountsAgainstGoal: true })).toBe(55000);
    expect(remainingFen({ ...base, depositsFen: [200000], impulseCountsAgainstGoal: false })).toBe(
      0,
    );
  });
  it("T-$-04 已达成 → 应存 0；截止日当天/已过 → 剩余全额", () => {
    expect(requiredRates(0, 10)).toEqual({ dailyFen: 0, weeklyFen: 0, monthlyFen: 0 });
    expect(requiredRates(5000, 0).dailyFen).toBe(5000);
  });
  it("T-$-05 US-26：52 周基数 10 元 → 第 1 周 10、第 52 周 520、总计 13780", () => {
    expect(week52Amount(1, 1000)).toBe(1000);
    expect(week52Amount(52, 1000)).toBe(52000);
    expect(week52Cumulative(52, 1000)).toBe(1378000);
    expect(() => week52Amount(53, 1000)).toThrow();
    expect(week52Cumulative(60, 1000)).toBe(1378000);
  });
  it("T-$-06 递增存法：首日 1 元每天 +1 → 第 10 天 10 元，前 365 天 66795 元", () => {
    expect(incrementalAmount(10, 100, 100)).toBe(1000);
    expect(incrementalCumulative(365, 100, 100)).toBe(6679500);
    expect(incrementalCumulative(0, 100, 100)).toBe(0);
  });
  it("T-$-07 固定金额：每周 400 元 × 5 周 = 2000 元", () => {
    expect(fixedCumulative(5, 40000)).toBe(200000);
    expect(fixedCumulative(-1, 40000)).toBe(0);
  });
  it("T-$-08 信封：100 个共 5050 元", () => {
    expect(envelopeTotal(100)).toBe(505000);
    expect(envelopeTotal(1)).toBe(100);
  });
  it("T-$-09 US-27：已抽 37 → 新号码 ∈ 1..100 且 ≠ 37；抽满 100 个后返回 null；全程无重复", () => {
    const rng = seededRng(7);
    const drawn = [37];
    const n = drawEnvelope(100, drawn, rng)!;
    expect(n).toBeGreaterThanOrEqual(1);
    expect(n).toBeLessThanOrEqual(100);
    expect(n).not.toBe(37);
    const all: number[] = [];
    for (let i = 0; i < 100; i++) all.push(drawEnvelope(100, all, rng)!);
    expect(new Set(all).size).toBe(100);
    expect(drawEnvelope(100, all, rng)).toBeNull();
  });
  it("T-$-10 信封均匀性：剩 4 个号码抽 40000 次，每个约 25%（±2%）", () => {
    const rng = seededRng(99);
    const drawn = Array.from({ length: 96 }, (_, i) => i + 1);
    const c: Record<number, number> = {};
    for (let i = 0; i < 40000; i++) {
      const n = drawEnvelope(100, drawn, rng)!;
      c[n] = (c[n] ?? 0) + 1;
    }
    for (const k of [97, 98, 99, 100]) expect(Math.abs(c[k]! / 40000 - 0.25)).toBeLessThan(0.02);
  });
  it("T-$-11 领先/落后：线性计划第 30/180 天应存 3000 元，已存 3320 → 领先 320；2850 → 落后 150", () => {
    const plan = linearPlannedCumulative(2000000, 200000, 180, 30);
    expect(plan).toBe(300000);
    expect(formatFen(leadBehindFen(332000, plan))).toBe("320.00");
    expect(formatFen(leadBehindFen(285000, plan))).toBe("-150.00");
  });
  it("T-$-12 计划累计除不尽向下取整到分；elapsed 越界截断", () => {
    expect(linearPlannedCumulative(100000, 0, 3, 1)).toBe(33333);
    expect(linearPlannedCumulative(100000, 0, 3, 5)).toBe(100000);
    expect(linearPlannedCumulative(100000, 0, 3, -1)).toBe(0);
  });
  it("T-$-13 里程碑 25/50/75/100%：恰好 25% 触发，24.99% 不触发", () => {
    expect(savingsMilestones(500000, 2000000)).toEqual([25]);
    expect(savingsMilestones(499999, 2000000)).toEqual([]);
    expect(savingsMilestones(2000000, 2000000)).toEqual([25, 50, 75, 100]);
  });
  it("T-$-14 大额无误差：999,999,999.99 元级别仍为安全整数", () => {
    const big = 99999999999;
    expect(Number.isSafeInteger(big * 304)).toBe(true);
    expect(formatFen(big, { thousands: true })).toBe("999,999,999.99");
  });
});
