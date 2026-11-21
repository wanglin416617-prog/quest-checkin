/** 存钱计划与进度（金额全部为整数“分”） */
import { diffDays, weekStart, type DateKey } from "./dates.ts";
import { divCeil, divFloor } from "./int.ts";
import type { Rng } from "./rng.ts";

export interface RemainingInput {
  targetFen: number;
  startFen: number;
  depositsFen: number[];
  impulsesFen: number[];
  impulseCountsAgainstGoal: boolean;
}
/** 还需存 = 目标 − 起始 − Σ存入 + Σ冲动消费（开启“计入目标”时），下限 0 */
export function remainingFen(i: RemainingInput): number {
  const dep = i.depositsFen.reduce((a, b) => a + b, 0);
  const imp = i.impulseCountsAgainstGoal ? i.impulsesFen.reduce((a, b) => a + b, 0) : 0;
  return Math.max(0, i.targetFen - i.startFen - dep + imp);
}

export interface RequiredRates {
  dailyFen: number;
  weeklyFen: number;
  monthlyFen: number;
}
/**
 * 每日应存 = 还需存 ÷ 剩余天数；每周 = ×7；每月 = ×30.4。
 * 取整方式：向上取整到分（保证按应存执行一定能达标，见 Q-M1）；每周/每月直接用精确比例再向上取整，
 * 而不是“取整后的日额 ×7”，避免误差放大。
 * remainingDays = 截止日 − 今天（不含今天，见 Q-M2）。
 */
export function requiredRates(remaining: number, remainingDays: number): RequiredRates {
  if (remaining <= 0) return { dailyFen: 0, weeklyFen: 0, monthlyFen: 0 };
  if (remainingDays <= 0)
    return { dailyFen: remaining, weeklyFen: remaining, monthlyFen: remaining };
  return {
    dailyFen: divCeil(remaining, remainingDays),
    weeklyFen: divCeil(remaining * 7, remainingDays),
    monthlyFen: divCeil(remaining * 304, remainingDays * 10),
  };
}

// ---------- 52 周挑战 ----------
/**
 * 挑战周序号：按 Asia/Shanghai 自然周（周一 00:00 起）。
 * 创建当周是第 1 周，之后每过一个自然周 +1。不按“从开始日数满 7 天”。
 */
export function week52Index(start: DateKey, day: DateKey): number {
  const from = weekStart(start);
  const current = weekStart(day);
  if (current < from) return 0;
  return Math.floor(diffDays(from, current) / 7) + 1;
}

export function week52Amount(n: number, baseFen: number): number {
  if (n < 1 || n > 52) throw new RangeError("周序号 1..52");
  return n * baseFen;
}
/** 前 k 周累计 = base × k(k+1)/2；k=52 → base × 1378 */
export function week52Cumulative(k: number, baseFen: number): number {
  const kk = Math.min(Math.max(k, 0), 52);
  return (baseFen * (kk * (kk + 1))) / 2;
}

// ---------- 递增存法 ----------
export function incrementalAmount(k: number, firstFen: number, stepFen: number): number {
  return firstFen + (k - 1) * stepFen;
}
/** 前 k 次累计 = k×first + step×k(k−1)/2 */
export function incrementalCumulative(k: number, firstFen: number, stepFen: number): number {
  if (k <= 0) return 0;
  return k * firstFen + (stepFen * (k * (k - 1))) / 2;
}

// ---------- 固定金额 ----------
export function fixedCumulative(periodsElapsed: number, amountFen: number): number {
  return Math.max(0, periodsElapsed) * amountFen;
}

// ---------- 存钱盲盒（信封） ----------
/** 信封总额 = unit × N(N+1)/2；N=100、unit=1 元 → 5050 元 */
export function envelopeTotal(count: number, unitFen = 100): number {
  return (unitFen * (count * (count + 1))) / 2;
}
/** 只从未抽过的号码中均匀抽取；全部抽完返回 null */
export function drawEnvelope(count: number, drawn: readonly number[], rng: Rng): number | null {
  const used = new Set(drawn);
  const left: number[] = [];
  for (let i = 1; i <= count; i++) if (!used.has(i)) left.push(i);
  if (left.length === 0) return null;
  return left[rng.int(left.length)]!;
}

// ---------- 领先/落后 ----------
/** 线性计划线：计划累计(今天) = (目标 − 起始) × 已过天数 ÷ 总天数（向下取整到分） */
export function linearPlannedCumulative(
  targetFen: number,
  startFen: number,
  totalDays: number,
  elapsedDays: number,
): number {
  if (totalDays <= 0) return targetFen - startFen;
  const e = Math.min(Math.max(elapsedDays, 0), totalDays);
  return divFloor((targetFen - startFen) * e, totalDays);
}
/** 领先(+)/落后(−) = Σ存入 − 计划累计应存 */
export function leadBehindFen(sumDepositsFen: number, plannedCumulativeFen: number): number {
  return sumDepositsFen - plannedCumulativeFen;
}

/** 存钱里程碑：25/50/75/100%（按“已存(含起始) / 目标”整数比较） */
export function savingsMilestones(savedFen: number, targetFen: number): number[] {
  return [25, 50, 75, 100].filter((p) => savedFen * 100 >= targetFen * p);
}
