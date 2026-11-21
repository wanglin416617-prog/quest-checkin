/** 积分公式（计划书“交付简报 · 全栈开发工程师 / 积分公式”） */
import { divRound } from "./int.ts";
import { diffDays, type DateKey } from "./dates.ts";

export type Difficulty = "easy" | "normal" | "hard" | "epic";
export const BASE: Record<Difficulty, number> = { easy: 5, normal: 10, hard: 20, epic: 40 };

export const ALL_CLEAR_BONUS = 20;
export const MILESTONE_BONUS = 50;
export const RETRO_MAX_DAYS_BACK = 2;
export const RETRO_MAX_PER_WEEK = 2;

/** 连胜倍率，返回“十分之一”整数：10=1.0、12=1.2、15=1.5、20=2.0 */
export function streakMultTenths(s: number): number {
  if (s >= 21) return 20;
  if (s >= 7) return 15;
  if (s >= 3) return 12;
  return 10;
}
export function streakMult(s: number): number {
  return streakMultTenths(s) / 10;
}

/**
 * 通用打卡积分 = round(BASE[d] × streakMult(s))
 * s 取“本次打卡计入后的连胜天数”（US-02：首次打卡连胜 1 得 +10；US-03：连胜 6 → 第 7 天得 +15）。
 */
export function checkInPoints(d: Difficulty, streakAfter: number): number {
  return divRound(BASE[d] * streakMultTenths(streakAfter), 10);
}

/** 补卡积分 = round(BASE[d] × 0.5)，不吃连胜倍率 */
export function retroPoints(d: Difficulty): number {
  return divRound(BASE[d], 2);
}

export type RetroCheck =
  | { ok: true }
  | { ok: false; reason: "future_or_today" | "too_old" | "weekly_limit" | "already_checked" };

/** 补卡资格：只能补 1..2 天前；本周（周一起）已补 < 2 次；当天未打卡 */
export function canRetro(
  target: DateKey,
  today: DateKey,
  retrosThisWeek: number,
  alreadyChecked: boolean,
): RetroCheck {
  const back = diffDays(target, today);
  if (back < 1) return { ok: false, reason: "future_or_today" };
  if (back > RETRO_MAX_DAYS_BACK) return { ok: false, reason: "too_old" };
  if (alreadyChecked) return { ok: false, reason: "already_checked" };
  if (retrosThisWeek >= RETRO_MAX_PER_WEEK) return { ok: false, reason: "weekly_limit" };
  return { ok: true };
}

// ---------- 减重 ----------
export const WEIGH_IN_POINTS = 5;
export const MEAL_ON_TIME_POINTS = 5;
export const LIGHT_MEAL_BONUS = 3;
export const DIET_DAY_BONUS = 15;
export const LIGHT_TAG = "清淡";

/** "HH:mm" → 当天分钟数 */
export function hhmmToMin(t: string): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec(t);
  if (!m) throw new RangeError(`非法时间 ${t}`);
  const h = Number(m[1]),
    mi = Number(m[2]);
  if (h > 23 || mi > 59) throw new RangeError(`非法时间 ${t}`);
  return h * 60 + mi;
}

/** 按时：打卡时刻在 [设定时间 − window, 设定时间 + window] 内（含边界），单位分钟 */
export function isMealOnTime(planned: string, actualMinOfDay: number, windowMin = 30): boolean {
  return Math.abs(actualMinOfDay - hhmmToMin(planned)) <= windowMin;
}

export interface MealScoreInput {
  onTime: boolean;
  tags: string[];
  violationTags: string[];
}
/** 按时 +5；标签含“清淡”且无违规标签 +3（两者独立，Q-P4 已定） */
export function mealPoints(i: MealScoreInput): number {
  const hasViolation = i.tags.some((t) => i.violationTags.includes(t));
  let p = i.onTime ? MEAL_ON_TIME_POINTS : 0;
  if (i.tags.includes(LIGHT_TAG) && !hasViolation) p += LIGHT_MEAL_BONUS;
  return p;
}

/** 饮食达标日：所有“启用”餐次都已打卡、都按时、且全天无违规 → +15 */
export function dietDayPoints(
  enabledMeals: string[],
  logs: { meal: string; onTime: boolean; hasViolation: boolean }[],
): number {
  if (enabledMeals.length === 0) return 0;
  const ok =
    enabledMeals.every((m) => logs.some((l) => l.meal === m && l.onTime)) &&
    logs.every((l) => !l.hasViolation);
  return ok ? DIET_DAY_BONUS : 0;
}

/** 减重连胜“当天完成” = 已称重 且 饮食达标 */
export function weightLossDayComplete(weighed: boolean, dietOk: boolean): boolean {
  return weighed && dietOk;
}

// ---------- 存钱 ----------
/**
 * 按计划完成当期存款 = round(BASE[d] × streakMult(s))；存入 ≥ 计划 120% 再 +5；信封抽取并存入再 +2。
 * 存入 < 当期计划额 → 0 分（Q-P5 已定）。
 */
export function depositPoints(
  d: Difficulty,
  streakAfter: number,
  depositFen: number,
  plannedFen: number,
  fromEnvelope = false,
): number {
  if (plannedFen <= 0 || depositFen < plannedFen) return 0;
  let p = checkInPoints(d, streakAfter);
  if (depositFen * 100 >= plannedFen * 120) p += 5;
  if (fromEnvelope) p += 2;
  return p;
}

// ---------- 等级 ----------
/** 从 L 级升到 L+1 级需要的经验 = 100 + 50 × (L − 1) */
export function xpToNext(level: number): number {
  return 100 + 50 * (level - 1);
}
/** 累计经验 → 当前等级与进度（1 级起步） */
export function levelFromXp(totalXp: number): { level: number; intoLevel: number; needed: number } {
  let level = 1,
    rest = Math.max(0, totalXp);
  while (rest >= xpToNext(level)) {
    rest -= xpToNext(level);
    level++;
  }
  return { level, intoLevel: rest, needed: xpToNext(level) };
}

// ---------- 经验（Q-P3 已定 2026-11-21） ----------
/**
 * 经验只增不减：只有“挣得”的正向积分产生等额经验；
 * 扣分（violation）、退款与补偿奖励（refund）、兑换（redeem）、撤销（undo）、买冻结卡（freezeBuy）都不影响经验。
 */
export const XP_EARNING_REASONS = [
  "checkin",
  "streak",
  "allclear",
  "milestone",
  "meal",
  "weighIn",
  "deposit",
  "box",
] as const;

export function xpFor(reason: string, pointsDelta: number): number {
  return (XP_EARNING_REASONS as readonly string[]).includes(reason) && pointsDelta > 0
    ? pointsDelta
    : 0;
}

/**
 * 防刷：经验只增不减，撤销后再打卡不能重复拿经验。
 * 每个“挣分来源”用 xpKey（如 `checkin:${goalId}:${date}`）去重，同一 key 只发一次（取首次金额）。
 */
export function xpOnce(
  grantedKeys: ReadonlySet<string>,
  xpKey: string,
  reason: string,
  pointsDelta: number,
): number {
  if (grantedKeys.has(xpKey)) return 0;
  return xpFor(reason, pointsDelta);
}
