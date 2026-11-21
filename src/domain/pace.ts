/** 减重节奏、安全提示、BMI、计划线与里程碑（体重全部为整数克） */
import { divCeil, divRound } from "./int.ts";

export type PaceLevel = "ok" | "gentle" | "strong";
export const RECOMMENDED_KG_PER_WEEK_G = 750; // 0.75 kg/周

export interface PaceResult {
  deltaG: number;
  dailyG: number; // 四舍五入到克，仅展示
  weeklyG: number; // 四舍五入到克，仅展示
  level: PaceLevel;
  recommendedDays: number; // 按 0.75 kg/周反推
}

/**
 * 每日节奏 = Δ ÷ 天数；每周 = ×7。
 * 安全分级用“精确有理数比较”（Δ×7 与 1000×天数比较），避免 1.0/1.5 边界被舍入误判：
 *   每周 ≤ 1.0 kg → ok；1.0 < 每周 ≤ 1.5 → gentle；> 1.5 → strong
 */
export function computePace(startG: number, targetG: number, days: number): PaceResult {
  if (days <= 0) throw new RangeError("天数必须 > 0");
  const deltaG = startG - targetG;
  const weekNumer = deltaG * 7; // 每周克数 = weekNumer / days
  let level: PaceLevel = "ok";
  if (weekNumer > 1500 * days) level = "strong";
  else if (weekNumer > 1000 * days) level = "gentle";
  return {
    deltaG,
    dailyG: divRound(deltaG, days),
    weeklyG: divRound(weekNumer, days),
    level,
    recommendedDays: recommendedDays(deltaG),
  };
}

/** 推荐期限天数 = ceil(Δkg ÷ 0.75 × 7) */
export function recommendedDays(deltaG: number): number {
  if (deltaG <= 0) return 0;
  return divCeil(deltaG * 7, RECOMMENDED_KG_PER_WEEK_G);
}

export type BmiCategory = "underweight" | "normal" | "overweight" | "obese";
export const BMI_LABEL: Record<BmiCategory, string> = {
  underweight: "偏瘦",
  normal: "正常",
  overweight: "超重",
  obese: "肥胖",
};

/** BMI ×10 的整数（保留 1 位小数，四舍五入）。BMI = kg / m² = g×10 / cm² （×10 后 = g×100/cm²） */
export function bmiTenths(g: number, heightCm: number): number {
  if (heightCm <= 0) throw new RangeError("身高必须 > 0");
  const hMm = Math.round(heightCm * 10); // 允许 165.5 cm
  // BMI = (g/1000) / (hMm/1000)^2 = g*1000 / hMm^2 ；×10 → g*10000 / hMm^2
  return divRound(g * 10000, hMm * hMm);
}

/** 中国成人标准（按 1 位小数 BMI 判断）：<18.5 偏瘦；18.5–23.9 正常；24–27.9 超重；≥28 肥胖 */
export function bmiCategory(bmiT: number): BmiCategory {
  if (bmiT < 185) return "underweight";
  if (bmiT < 240) return "normal";
  if (bmiT < 280) return "overweight";
  return "obese";
}

export function targetBmiTooLow(targetG: number, heightCm: number): boolean {
  return bmiTenths(targetG, heightCm) < 185;
}

/** 第 n 天（0..days）计划体重（克，四舍五入） */
export function plannedWeightG(startG: number, targetG: number, days: number, n: number): number {
  const k = Math.min(Math.max(n, 0), days);
  return startG - divRound((startG - targetG) * k, days);
}

/** 领先(+)/落后(−)计划克数 = 计划体重 − 实际体重 */
export function leadVsPlanG(
  startG: number,
  targetG: number,
  days: number,
  n: number,
  actualG: number,
): number {
  return plannedWeightG(startG, targetG, days, n) - actualG;
}

/** 已过关卡数：每减 stepG（默认 3 斤 = 1500 g）一关，上限 = 总关数 */
export function milestonesReached(
  startG: number,
  currentG: number,
  targetG: number,
  stepG = 1500,
): { reached: number; total: number } {
  const total = Math.max(1, divCeil(startG - targetG, stepG));
  const lost = Math.max(0, startG - currentG);
  return { reached: Math.min(total, Math.floor(lost / stepG)), total };
}

/**
 * 预计达成日：用近 14 天称重做最小二乘线性回归（x=天序号, y=克）。
 * 速度 ≥ 0（没在下降）返回 null。返回距离最后一次称重还需的天数（向上取整）。
 */
export function forecastDaysToTarget(
  points: { day: number; g: number }[],
  targetG: number,
  windowDays = 14,
): number | null {
  if (points.length < 2) return null;
  const lastDay = Math.max(...points.map((p) => p.day));
  const pts = points.filter((p) => p.day > lastDay - windowDays);
  if (pts.length < 2) return null;
  const n = pts.length;
  const sx = pts.reduce((a, p) => a + p.day, 0),
    sy = pts.reduce((a, p) => a + p.g, 0);
  const sxx = pts.reduce((a, p) => a + p.day * p.day, 0),
    sxy = pts.reduce((a, p) => a + p.day * p.g, 0);
  const den = n * sxx - sx * sx;
  if (den === 0) return null;
  const slope = (n * sxy - sx * sy) / den; // 克/天（展示用途，允许浮点）
  if (slope >= 0) return null;
  const intercept = (sy - slope * sx) / n;
  const nowFit = intercept + slope * lastDay;
  if (nowFit <= targetG) return 0;
  return Math.ceil((targetG - nowFit) / slope);
}
