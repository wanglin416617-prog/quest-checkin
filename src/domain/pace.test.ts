import { describe, it, expect } from "vitest";
import {
  computePace,
  recommendedDays,
  bmiTenths,
  bmiCategory,
  targetBmiTooLow,
  plannedWeightG,
  leadVsPlanG,
  milestonesReached,
  forecastDaysToTarget,
  formatWeight,
  parseWeightToGrams,
  diffDays,
} from "./index.ts";

describe("减重节奏与安全提示", () => {
  it("T-W-01 验收：90 天减 30 斤 → 1.17 kg/周（2.33 斤/周）、0.17 kg/天，gentle", () => {
    const p = computePace(70000, 55000, 90);
    expect(p.deltaG).toBe(15000);
    expect(formatWeight(p.weeklyG, "kg", 2)).toBe("1.17");
    expect(formatWeight(p.weeklyG, "jin", 2)).toBe("2.33");
    expect(formatWeight(p.dailyG, "kg", 3)).toBe("0.167");
    expect(formatWeight(p.dailyG, "jin", 2)).toBe("0.33");
    expect(p.level).toBe("gentle");
  });
  it("T-W-02 边界：每周恰好 1.0 kg → ok；恰好 1.5 kg → gentle；略超 1.5 → strong", () => {
    expect(computePace(80000, 70000, 70).level).toBe("ok"); // 10kg/70天 = 1.0/周
    expect(computePace(80000, 65000, 70).level).toBe("gentle"); // 15kg/70天 = 1.5/周
    expect(computePace(80000, 64999, 70).level).toBe("strong");
    expect(computePace(80000, 69999, 70).level).toBe("gentle"); // 1.0001/周
  });
  it("T-W-03 推荐期限 = ceil(Δ ÷ 0.75 × 7)：15 kg → 140 天；1 kg → 10 天（9.33 进位）", () => {
    expect(recommendedDays(15000)).toBe(140);
    expect(recommendedDays(1000)).toBe(10);
    expect(recommendedDays(0)).toBe(0);
    expect(computePace(70000, 55000, 140).level).toBe("ok");
  });
  it("T-W-04 天数 ≤ 0 抛错；增重目标（Δ<0）→ ok", () => {
    expect(() => computePace(70000, 60000, 0)).toThrow();
    expect(computePace(60000, 62000, 30).level).toBe("ok");
  });
  it("T-W-05 targetByDate 天数：跨月与闰年", () => {
    expect(diffDays("2026-12-01", "2027-03-01")).toBe(90);
    expect(diffDays("2028-02-01", "2028-03-01")).toBe(29);
    expect(diffDays("2027-02-01", "2027-03-01")).toBe(28);
  });
});

describe("BMI", () => {
  it("T-W-06 US-15：165 cm、140 斤 → 25.7 超重", () => {
    const b = bmiTenths(parseWeightToGrams("140", "jin"), 165);
    expect(b).toBe(257);
    expect(bmiCategory(b)).toBe("overweight");
  });
  it("T-W-07 分类边界 18.4/18.5/23.9/24.0/27.9/28.0", () => {
    expect([184, 185, 239, 240, 279, 280].map(bmiCategory)).toEqual([
      "underweight",
      "normal",
      "normal",
      "overweight",
      "overweight",
      "obese",
    ]);
  });
  it("T-W-08 目标 BMI < 18.5 提示：165 cm 目标 50 kg (18.4) 提示；50.4 kg (18.5) 不提示", () => {
    expect(targetBmiTooLow(50000, 165)).toBe(true);
    expect(targetBmiTooLow(50400, 165)).toBe(false);
  });
  it("T-W-09 身高 0 抛错；支持 165.5 cm", () => {
    expect(() => bmiTenths(70000, 0)).toThrow();
    expect(bmiTenths(70000, 165.5)).toBe(256);
  });
});

describe("计划线、领先落后、关卡、预测", () => {
  it("T-W-10 US-16：第 10 天录入 136.2 斤 → 计划 136.67 斤，领先 0.5 斤", () => {
    const start = parseWeightToGrams("140", "jin"),
      target = parseWeightToGrams("110", "jin");
    expect(formatWeight(plannedWeightG(start, target, 90, 10), "jin", 2)).toBe("136.67");
    const lead = leadVsPlanG(start, target, 90, 10, parseWeightToGrams("136.2", "jin"));
    expect(lead).toBe(233);
    expect(formatWeight(lead, "jin")).toBe("0.5");
  });
  it("T-W-11 计划线端点：第 0 天=起始、第 90 天=目标、超出期限按目标", () => {
    expect(plannedWeightG(70000, 55000, 90, 0)).toBe(70000);
    expect(plannedWeightG(70000, 55000, 90, 90)).toBe(55000);
    expect(plannedWeightG(70000, 55000, 90, 120)).toBe(55000);
  });
  it("T-W-12 关卡：每 3 斤一关，30 斤 10 关；减 8.4 斤 → 2 关；反弹不倒退为负；超额封顶", () => {
    expect(milestonesReached(70000, 70000, 55000)).toEqual({ reached: 0, total: 10 });
    expect(milestonesReached(70000, 70000 - 4200, 55000).reached).toBe(2);
    expect(milestonesReached(70000, 71000, 55000).reached).toBe(0);
    expect(milestonesReached(70000, 50000, 55000).reached).toBe(10);
    expect(milestonesReached(70000, 68500, 55000).reached).toBe(1); // 恰好 3 斤
  });
  it("T-W-13 预测：每天稳定 -100 g，距目标 1000 g → 10 天；不降反升 → null；点数不足 → null", () => {
    const pts = Array.from({ length: 14 }, (_, i) => ({ day: i, g: 70000 - 100 * i }));
    expect(forecastDaysToTarget(pts, 68700 - 1000)).toBe(10);
    expect(
      forecastDaysToTarget(
        pts.map((p) => ({ ...p, g: 70000 + p.day })),
        60000,
      ),
    ).toBeNull();
    expect(forecastDaysToTarget([{ day: 0, g: 70000 }], 60000)).toBeNull();
  });
});
