/**
 * 连胜 + 冻结卡（按“天”周期；周/月频率的目标在 M1 用 periodKey 泛化，接口不变）。
 * 规则：违规永远不清零连胜；漏打一天时若冻结卡足够则自动消耗，否则连胜归 0（积分不变）。
 */
import { addDays, diffDays, weekStart, type DateKey } from "./dates.ts";

export interface StreakState {
  goalId: string;
  current: number;
  best: number;
  lastCountedPeriod: string; /* DateKey 或 '' */
}
export interface WalletLite {
  freezeCards: number;
  lastFreezeGrant: DateKey;
}

export const FREEZE_MAX = 3;

export interface ReconcileResult {
  streak: StreakState;
  freezeCardsUsed: number;
  frozenDays: DateKey[];
  broken: boolean; // true → UI 显示“新的开始”
  missedDays: number; // 本次结算发现的漏打天数
  keptFreezeCards: number; // 卡不够时为用户保留（未扣）的冻结卡张数
  notice?: string; // 需要展示给用户的提示文案
}

export function freezeNotEnoughNotice(kept: number): string {
  return `卡不够，已为你保留 ${kept} 张`;
}

/**
 * 打开 App / 跨天时调用：处理“上次计入日”到“昨天”之间漏掉的天数。
 * Q-S1 已定（2026-11-21）：冻结卡不足以覆盖全部漏打天数时一张不扣、连胜归 0，
 * 并返回提示“卡不够，已为你保留 N 张”（N = 当前持有张数；N=0 时不出此提示，只显示“新的开始”）。
 */
export function reconcileStreak(
  s: StreakState,
  today: DateKey,
  freezeCards: number,
): ReconcileResult {
  const none = { freezeCardsUsed: 0, frozenDays: [] as DateKey[], keptFreezeCards: freezeCards };
  if (!s.lastCountedPeriod || s.current === 0)
    return { ...none, streak: { ...s, current: 0 }, broken: false, missedDays: 0 };
  const yesterday = addDays(today, -1);
  const missed = diffDays(s.lastCountedPeriod, yesterday); // 漏打天数（lastCounted=昨天 → 0）
  if (missed <= 0) return { ...none, streak: s, broken: false, missedDays: 0 };
  if (missed <= freezeCards) {
    const frozenDays = Array.from({ length: missed }, (_, i) =>
      addDays(s.lastCountedPeriod, i + 1),
    );
    // 冻结日不增加连胜天数，只“桥接”；lastCountedPeriod 推进到昨天，避免重复消耗
    return {
      streak: { ...s, lastCountedPeriod: yesterday },
      freezeCardsUsed: missed,
      frozenDays,
      broken: false,
      missedDays: missed,
      keptFreezeCards: freezeCards - missed,
    };
  }
  return {
    ...none,
    streak: { ...s, current: 0 },
    broken: true,
    missedDays: missed,
    ...(freezeCards > 0 ? { notice: freezeNotEnoughNotice(freezeCards) } : {}),
  };
}

/**
 * 补卡（Q-S2 已定）：只补记录与进度（热力图、计数、存钱进度等），不改连胜、不给连胜倍率/连胜奖励。
 * 积分 = retroPoints(d)（BASE×0.5），由 points.ts 计算；本函数显式返回“连胜不变”。
 */
export function applyRetroToStreak(s: StreakState): StreakState {
  return s;
}

/** 当天完成打卡（或减重“称重+饮食达标”）时调用；同一天重复调用幂等 */
export function applyCheckIn(s: StreakState, day: DateKey): StreakState {
  if (s.lastCountedPeriod === day) return s;
  const continues =
    s.lastCountedPeriod !== "" && s.current > 0 && diffDays(s.lastCountedPeriod, day) === 1;
  const current = continues ? s.current + 1 : 1;
  return { ...s, current, best: Math.max(s.best, current), lastCountedPeriod: day };
}

/** 撤销当天打卡：回到打卡前的状态（由调用方保存快照，这里只做一致性校验） */
export function undoCheckIn(before: StreakState, after: StreakState, day: DateKey): StreakState {
  if (after.lastCountedPeriod !== day) return after;
  return before;
}

/** 违规：连胜不变，仅返回“不完美日”标记 */
export function applyViolationToStreak(s: StreakState): { streak: StreakState; imperfect: true } {
  return { streak: s, imperfect: true };
}

/**
 * 冻结卡每周 +1，最多持有 3 张。按自然周（周一起，Q-S3 已定）补发离线期间累计的周数。
 */
export function grantWeeklyFreeze(w: WalletLite, today: DateKey): WalletLite {
  const thisWeek = weekStart(today);
  if (!w.lastFreezeGrant)
    return { freezeCards: Math.min(FREEZE_MAX, w.freezeCards + 1), lastFreezeGrant: thisWeek };
  const weeks = Math.floor(diffDays(weekStart(w.lastFreezeGrant), thisWeek) / 7);
  if (weeks <= 0) return w;
  return { freezeCards: Math.min(FREEZE_MAX, w.freezeCards + weeks), lastFreezeGrant: thisWeek };
}

// ---------- 总连胜（首页） ----------
/**
 * Q-S4 已定（2026-11-21）：总连胜 = 连续“当天至少完成 1 个到期目标”的天数（宽松定义）。
 * 假设（写入 DEV_PLAN §13）：
 *  A. 当天没有任何到期目标（due=0）→ 中性日：不加 1、也不中断；
 *  B. 当天有到期目标但都没完成，而每个到期目标都被冻结卡保住（frozen ≥ due）→ 也按中性日处理；
 *  C. 今天还没完成任何到期目标 → 今天“未结算”，从昨天往回数（不会因为今天还没打卡就显示 0）；
 *  D. 总连胜不单独消耗冻结卡。
 */
export interface DaySummary {
  due: number;
  completed: number;
  frozen?: number;
}

export function overallStreak(
  history: ReadonlyMap<DateKey, DaySummary> | Record<DateKey, DaySummary>,
  today: DateKey,
): number {
  const map = history instanceof Map ? history : new Map(Object.entries(history));
  if (map.size === 0) return 0;
  const earliest = [...map.keys()].sort()[0]!; // 最早有记录的日子之前不再回溯
  let n = 0;
  for (let day = today; diffDays(earliest, day) >= 0; day = addDays(day, -1)) {
    const d = map.get(day) ?? { due: 0, completed: 0 };
    if (d.completed > 0) {
      n++;
      continue;
    } // 至少完成 1 个
    if (day === today) continue; // C：今天未结算
    if (d.due === 0) continue; // A：中性日
    if ((d.frozen ?? 0) >= d.due) continue; // B：全部被冻结卡保住
    break; // 有到期目标却一个没完成 → 中断
  }
  return n;
}

export type FrequencyLite =
  | { kind: "daily" }
  | { kind: "weekdays"; days: number[] } // 0=周日..6=周六
  | { kind: "timesPerWeek"; n: number };

/**
 * 目标在某天是否“到期”：daily 每天；weekdays 指定星期；
 * timesPerWeek：本自然周完成次数 < n 时每天都算到期，达标后本周余下天数不再到期（假设，见 §13 Q-S4）。
 * 目标需在 startDate..deadline 内且 status=active（由调用方过滤）。
 */
export function isGoalDue(f: FrequencyLite, day: DateKey, doneThisWeekBeforeDay = 0): boolean {
  switch (f.kind) {
    case "daily":
      return true;
    case "weekdays": {
      const dow = new Date(day + "T00:00:00Z").getUTCDay();
      return f.days.includes(dow);
    }
    case "timesPerWeek":
      return doneThisWeekBeforeDay < f.n;
  }
}
