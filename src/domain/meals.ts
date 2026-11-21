/**
 * 餐次记录与补记（2026-11-21 已定）：
 *  - 按时范围由用户在设置里选 ±15/±30/±60 分钟（Settings.mealOnTimeWindowMin，默认 ±30），实际时间落在范围内（含边界）给按时分；
 *  - 补弹超过 30 分钟后允许“补记”并填实际吃饭时间；补记的实际时间仍按同一范围判定按时；
 *  - 同一餐（goalId+date+meal）只给一次分：已有有效记录时拒绝新增；撤销后可重记，重记按 ledger.recheckAward 只补差额，不重复发分；
 *  - 补记实际时间默认 = 计划餐时，须 ≤ 当前时间且 ≥ 上一餐已记录的实际时间（design v1.2 interaction-rules §2）。
 * 时间一律用 { date: DateKey, hhmm } 表示的本地时间，跨午夜用日期差 × 1440 计算，不依赖时区换算。
 */
import { diffDays, type DateKey } from "./dates.ts";
import { hhmmToMin } from "./points.ts";

export const MEAL_WINDOW_OPTIONS = [15, 30, 60] as const;
export type MealWindowMin = (typeof MEAL_WINDOW_OPTIONS)[number];
export const DEFAULT_MEAL_WINDOW_MIN: MealWindowMin = 30;
/** 补弹后多久允许“补记”（固定 30 分钟，与按时范围设置无关，见 §13 N-4） */
export const BACKFILL_AFTER_MIN = 30;
/** 实际吃饭时间与计划时间最多相差 12 小时，否则视为填错（不是这一餐） */
export const MAX_ACTUAL_OFFSET_MIN = 12 * 60;

export interface LocalTime {
  date: DateKey;
  hhmm: string;
}

/** 相对 base 日期 00:00 的分钟数 */
export function minutesFrom(base: DateKey, t: LocalTime): number {
  return diffDays(base, t.date) * 1440 + hhmmToMin(t.hhmm);
}

export function isValidWindow(n: number): n is MealWindowMin {
  return (MEAL_WINDOW_OPTIONS as readonly number[]).includes(n);
}

export type MealRecordReject =
  | "invalid_window"
  | "future"
  | "duplicate"
  | "backfill_too_early"
  | "too_far_from_plan"
  | "meal_date_out_of_range"
  | "before_previous_meal";

export interface MealRecordInput {
  mealDate: DateKey; // 这顿饭属于哪一天（计划日）
  planned: string; // 计划时间 'HH:mm'
  now: LocalTime; // 当前本地时间
  actual?: LocalTime; // 补记时填写的实际时间；不填 = 现在
  windowMin: number; // 设置里的按时范围
  alreadyLogged: boolean; // 该餐已有有效（未撤销）记录；撤销后可重记（design interaction-rules §2）
  prevMealActual?: LocalTime; // 上一餐已记录的实际时间：补记时间不得早于它（design v1.2 interaction-rules §2）
}
export type MealRecordResult =
  | { ok: true; onTime: boolean; isBackfill: boolean; diffMin: number }
  | { ok: false; reason: MealRecordReject };

export function evaluateMealRecord(i: MealRecordInput): MealRecordResult {
  if (!isValidWindow(i.windowMin)) return { ok: false, reason: "invalid_window" };
  if (i.alreadyLogged) return { ok: false, reason: "duplicate" };
  // 只能记“今天”或“昨天”的餐（昨天晚餐/夜宵跨午夜补记）
  const back = diffDays(i.mealDate, i.now.date);
  if (back < 0 || back > 1) return { ok: false, reason: "meal_date_out_of_range" };
  const base = i.mealDate;
  const plannedMin = hhmmToMin(i.planned);
  const nowMin = minutesFrom(base, i.now);
  const isBackfill = i.actual !== undefined;
  const actualMin = isBackfill ? minutesFrom(base, i.actual!) : nowMin;
  if (actualMin > nowMin) return { ok: false, reason: "future" };
  if (i.prevMealActual && actualMin < minutesFrom(base, i.prevMealActual))
    return { ok: false, reason: "before_previous_meal" };
  if (isBackfill && nowMin - plannedMin <= BACKFILL_AFTER_MIN)
    return { ok: false, reason: "backfill_too_early" };
  const diffMin = actualMin - plannedMin;
  if (Math.abs(diffMin) > MAX_ACTUAL_OFFSET_MIN) return { ok: false, reason: "too_far_from_plan" };
  return { ok: true, onTime: Math.abs(diffMin) <= i.windowMin, isBackfill, diffMin };
}

/** 按时范围展示文案：“11:30–12:30”（跨午夜自动回绕） */
export function windowLabel(planned: string, windowMin: number): string {
  const p = hhmmToMin(planned);
  const fmt = (m: number) => {
    const x = ((m % 1440) + 1440) % 1440;
    return `${String(Math.floor(x / 60)).padStart(2, "0")}:${String(x % 60).padStart(2, "0")}`;
  };
  return `${fmt(p - windowMin)}–${fmt(p + windowMin)}`;
}

export function mealAwardKey(goalId: string, mealDate: DateKey, meal: string): string {
  return `meal:${goalId}:${mealDate}:${meal}`;
}
