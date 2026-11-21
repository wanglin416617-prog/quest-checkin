/**
 * 违规与补偿（通用，硬性宽松原则）：
 *  扣分 = min(rule.deductPoints, 20)；当天累计扣分 ≤ 50；余额下限 0（不足部分不扣）
 *  补偿任务（含冲动消费）统一 48h 窗口：按时完成 → 退还该事件实际扣分（不限次数）
 *    + 5 奖励：每个目标每自然周（Asia/Shanghai，周一起）最多 1 次，无全局上限（Q-V1 已定 2026-11-21）
 *  超时只记录，不再加罚；同时最多 3 个未完成补偿任务；违规永不清零连胜
 *  扣分、退款、奖励只影响积分余额，不产生经验（Q-P3）
 */
import { divRound } from "./int.ts";
import { weekStart, type DateKey } from "./dates.ts";

export const SINGLE_CAP = 20;
export const DAILY_CAP = 50;
export const COMPENSATION_BONUS = 5;
export const COMPENSATION_WINDOW_MS = 48 * 3600 * 1000;
export const MAX_OPEN_COMPENSATIONS = 3;

export type CapReason = "single" | "daily" | "balance";

export interface DeductionInput {
  ruleDeduct: number; // 规则设定的扣分（非负整数）
  balance: number; // 当前积分余额（= 流水之和，≥ 0）
  deductedToday: number; // 当天（违规事件 date）全局（所有目标合计）已实际扣分；退款不释放额度（Q-V1 已定）
}
export interface DeductionResult {
  deducted: number; // 实际扣分（≥ 0）
  cappedBy: CapReason[]; // 哪些上限生效了（可多个）
  dailyCapReached: boolean; // 扣完后今日是否已达上限 → 提示“今日扣分已到上限”
}

export function computeDeduction(i: DeductionInput): DeductionResult {
  const want = Math.max(0, Math.floor(i.ruleDeduct));
  const single = Math.min(want, SINGLE_CAP);
  const dailyRoom = Math.max(0, DAILY_CAP - Math.max(0, i.deductedToday));
  const balanceRoom = Math.max(0, i.balance);
  const deducted = Math.min(single, dailyRoom, balanceRoom);
  const cappedBy: CapReason[] = [];
  if (want > SINGLE_CAP) cappedBy.push("single");
  if (dailyRoom < single) cappedBy.push("daily");
  if (balanceRoom < Math.min(single, dailyRoom)) cappedBy.push("balance");
  return { deducted, cappedBy, dailyCapReached: i.deductedToday + deducted >= DAILY_CAP };
}

export interface CompensationTask {
  id: string;
  violationId: string;
  goalId: string;
  title: string;
  dueAt: number;
  status: "open" | "done" | "expired";
  doneAt?: number;
  doneDate?: DateKey; // 完成时刻与本地日期（奖励按 doneDate 所在自然周计）
  refund: number; // 应退还的“实际扣分”（创建时写死）
  bonus?: number; // 实际发放的奖励（0 或 5），完成时写入
}

/** 是否允许再生成补偿任务（已有 3 个 open 时不再生成，扣分照常；Q-V2 已定） */
export function canCreateCompensation(openCount: number): boolean {
  return openCount < MAX_OPEN_COMPENSATIONS;
}

export function createCompensation(
  id: string,
  violationId: string,
  goalId: string,
  title: string,
  violationAt: number,
  deducted: number,
): CompensationTask {
  return {
    id,
    violationId,
    goalId,
    title,
    dueAt: violationAt + COMPENSATION_WINDOW_MS,
    status: "open",
    refund: Math.max(0, deducted),
  };
}

/** 奖励周键：目标 + 自然周（周一 DateKey） */
export function bonusWeekKey(goalId: string, doneDate: DateKey): string {
  return `${goalId}@${weekStart(doneDate)}`;
}

export interface CompletionResult {
  task: CompensationTask;
  refundPoints: number; // 退还的扣分
  bonusPoints: number; // 0 或 5
  bonusSkipped: boolean; // 按时完成但本周该目标已领过奖励 → UI 提示“本周奖励已领取，扣分已全额退回”
}

/**
 * 完成补偿：dueAt 当刻（含）之前完成 → 退还实际扣分（不限次）；
 * 若该目标本自然周尚未领过 +5 奖励则再发 +5。之后 → expired，不退不罚。
 * bonusWeeksUsed：已发放奖励的 bonusWeekKey 集合（由 services 从 compensationTasks 查询 bonus>0 的记录得到）。
 */
export function completeCompensation(
  t: CompensationTask,
  now: number,
  doneDate: DateKey,
  bonusWeeksUsed: ReadonlySet<string>,
): CompletionResult {
  if (t.status !== "open") return { task: t, refundPoints: 0, bonusPoints: 0, bonusSkipped: false };
  if (now > t.dueAt)
    return {
      task: { ...t, status: "expired" },
      refundPoints: 0,
      bonusPoints: 0,
      bonusSkipped: false,
    };
  const eligible = !bonusWeeksUsed.has(bonusWeekKey(t.goalId, doneDate));
  const bonus = eligible ? COMPENSATION_BONUS : 0;
  return {
    task: { ...t, status: "done", doneAt: now, doneDate, bonus },
    refundPoints: t.refund,
    bonusPoints: bonus,
    bonusSkipped: !eligible,
  };
}

/** 到期扫描：open 且已过 dueAt → expired（只记录，不产生任何流水） */
export function expireOverdue(tasks: CompensationTask[], now: number): CompensationTask[] {
  return tasks.map((t) =>
    t.status === "open" && now > t.dueAt ? { ...t, status: "expired" as const } : t,
  );
}

// ---------- 代价换算（只提示，不影响数据） ----------
export interface ConversionCfg {
  dailyDeficitKcal: number;
  kcalPerStep: number /* 0.04 */;
  ropeKcalPerMin: number;
}
export const DEFAULT_CONVERSION: ConversionCfg = {
  dailyDeficitKcal: 500,
  kcalPerStep: 0.04,
  ropeKcalPerMin: 10,
};

/** 白费天数 = kcal ÷ 每日缺口，保留 1 位小数（四舍五入），返回“十分之一天”整数 */
export function wastedDaysTenths(kcal: number, dailyDeficitKcal = 500): number {
  return divRound(Math.round(kcal) * 10, Math.round(dailyDeficitKcal));
}
/** 步数 = kcal ÷ 每步 kcal（默认 0.04 → ×25），取整 */
export function stepsFor(kcal: number, kcalPerStep = 0.04): number {
  // 每步 kcal 以“万分之一 kcal”整数参与计算，避免 400/0.04 的浮点误差
  return divRound(Math.round(kcal) * 10000, Math.round(kcalPerStep * 10000));
}
/** 跳绳分钟 = kcal ÷ 每分钟 kcal，取整 */
export function ropeMinutesFor(kcal: number, ropeKcalPerMin = 10): number {
  return divRound(Math.round(kcal), Math.round(ropeKcalPerMin));
}

/**
 * 冲动消费“离目标又远了 X 天” = amountFen ÷ 每日应存(分)，保留 1 位小数（四舍五入）。
 * Q-V3 已定（2026-11-21）：统一 1 位小数，取消“向上取整到 0.5 天”。返回“十分之一天”整数；应存 ≤ 0 → null。
 */
export function impulseDaysTenths(amountFen: number, dailyRequiredFen: number): number | null {
  if (dailyRequiredFen <= 0) return null;
  return divRound(amountFen * 10, dailyRequiredFen);
}
