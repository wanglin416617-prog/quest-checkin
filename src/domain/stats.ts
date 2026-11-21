/**
 * 统计聚合（2026-11-21 已定：“月”= 自然月；热力图 = 近 16 周；周 = 自然周，周一起）。
 * 输入都是按 DateKey 汇总好的纯数据，Dexie 查询在 services 层完成。
 */
import { addDays, dateKeyOf, diffDays, weekStart, type DateKey } from "./dates.ts";
import { divRound } from "./int.ts";
import { XP_EARNING_REASONS } from "./points.ts";
import type { LedgerEntry } from "./ledger.ts";
import { type DaySummary } from "./streak.ts";

export const HEATMAP_WEEKS = 16;
export const SHANGHAI_OFFSET_MIN = 480;

export function monthStart(k: DateKey): DateKey {
  return k.slice(0, 8) + "01";
}
export function nextMonthStart(k: DateKey): DateKey {
  const y = Number(k.slice(0, 4)),
    m = Number(k.slice(5, 7));
  return m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
}
export function prevMonthStart(k: DateKey): DateKey {
  const y = Number(k.slice(0, 4)),
    m = Number(k.slice(5, 7));
  return m === 1 ? `${y - 1}-12-01` : `${y}-${String(m - 1).padStart(2, "0")}-01`;
}
export function daysInMonth(k: DateKey): number {
  return diffDays(monthStart(k), nextMonthStart(k));
}
export function sameMonth(a: DateKey, b: DateKey): boolean {
  return a.slice(0, 7) === b.slice(0, 7);
}

// ---------- 热力图 ----------
export interface HeatCell {
  date: DateKey;
  level: 0 | 1 | 2 | 3 | 4;
  imperfect: boolean;
  future: boolean;
  neutral: boolean;
}

/** 强度：0 未完成；1 ≤1/3；2 ≤2/3；3 <全部；4 到期目标全部完成（无到期但有完成也算 4）。整数比较，无浮点。 */
export function heatLevel(d: DaySummary | undefined): 0 | 1 | 2 | 3 | 4 {
  if (!d || d.completed <= 0) return 0;
  if (d.due <= 0 || d.completed >= d.due) return 4;
  if (d.completed * 3 <= d.due) return 1;
  if (d.completed * 3 <= d.due * 2) return 2;
  return 3;
}

/**
 * 近 16 周热力图：16 列 × 7 行（周一..周日），最后一列为本周；今天之后的格子 future=true。
 * imperfect：当天有违规（琥珀小点，连胜照常）；neutral：当天没有到期目标。
 */
export function heatmap(
  history: ReadonlyMap<DateKey, DaySummary & { imperfect?: boolean }>,
  today: DateKey,
  weeks = HEATMAP_WEEKS,
): HeatCell[][] {
  const firstMonday = addDays(weekStart(today), -7 * (weeks - 1));
  const cols: HeatCell[][] = [];
  for (let w = 0; w < weeks; w++) {
    const col: HeatCell[] = [];
    for (let d = 0; d < 7; d++) {
      const date = addDays(firstMonday, w * 7 + d);
      const s = history.get(date);
      const future = diffDays(today, date) > 0;
      col.push({
        date,
        level: future ? 0 : heatLevel(s),
        imperfect: !future && !!s?.imperfect,
        future,
        neutral: !future && (!s || s.due === 0),
      });
    }
    cols.push(col);
  }
  return cols;
}

/** “本周 6/6 天达成”：本周已过天数（含今天）中至少完成 1 个的天数 / 已过天数中有到期目标的天数 */
export function thisWeekProgress(
  history: ReadonlyMap<DateKey, DaySummary>,
  today: DateKey,
): { achieved: number; dueDays: number } {
  let achieved = 0,
    dueDays = 0;
  for (let k = weekStart(today); diffDays(k, today) >= 0; k = addDays(k, 1)) {
    const s = history.get(k);
    if (s && s.due > 0) dueDays++;
    if (s && s.completed > 0) achieved++;
  }
  return { achieved, dueDays };
}

// ---------- 月摘要 ----------
export interface MonthSummary {
  month: string; // 'YYYY-MM'
  checkIns: number; // 本月打卡次数（完成次数合计）
  completionPct: number | null; // Σ完成到期 / Σ到期（截至今天），整数百分比；无到期 → null
  prevCompletionPct: number | null;
  deltaPct: number | null; // 较上月（百分点）
  longestStreak: number; // 本月内最长总连胜（中性日不断）
}

function monthCompletion(
  history: ReadonlyMap<DateKey, DaySummary>,
  anyDayInMonth: DateKey,
  upTo: DateKey,
): { done: number; due: number; checkIns: number } {
  let done = 0,
    due = 0,
    checkIns = 0;
  for (
    let k = monthStart(anyDayInMonth);
    sameMonth(k, anyDayInMonth) && diffDays(k, upTo) >= 0;
    k = addDays(k, 1)
  ) {
    const s = history.get(k);
    if (!s) continue;
    checkIns += s.completed;
    due += s.due;
    done += Math.min(s.completed, s.due); // 只计到期目标的完成，避免 >100%
  }
  return { done, due, checkIns };
}

export function monthSummary(
  history: ReadonlyMap<DateKey, DaySummary>,
  today: DateKey,
): MonthSummary {
  const cur = monthCompletion(history, today, today);
  const prevStart = prevMonthStart(today);
  const prev = monthCompletion(history, prevStart, addDays(monthStart(today), -1));
  const pct = (x: { done: number; due: number }) =>
    x.due > 0 ? divRound(x.done * 100, x.due) : null;
  const c = pct(cur),
    p = pct(prev);
  // 本月最长连胜：逐日扫描本月（截至今天）
  let longest = 0,
    run = 0;
  for (let k = monthStart(today); diffDays(k, today) >= 0; k = addDays(k, 1)) {
    const s = history.get(k);
    if (s && s.completed > 0) {
      run++;
      longest = Math.max(longest, run);
    } else if (k === today) {
      /* 今天未结算 */
    } else if (!s || s.due === 0 || (s.frozen ?? 0) >= s.due) {
      /* 中性日 */
    } else run = 0;
  }
  return {
    month: today.slice(0, 7),
    checkIns: cur.checkIns,
    completionPct: c,
    prevCompletionPct: p,
    deltaPct: c !== null && p !== null ? c - p : null,
    longestStreak: longest,
  };
}

/** 单目标本月完成率：分母 = 截至今天的到期天数（周期型目标传入按周/期统计的数据） */
export function goalCompletion(
  dueDates: readonly DateKey[],
  doneDates: ReadonlySet<DateKey>,
  today: DateKey,
): { done: number; due: number; pct: number | null } {
  const inMonth = dueDates.filter((d) => sameMonth(d, today) && diffDays(d, today) >= 0);
  const done = inMonth.filter((d) => doneDates.has(d)).length;
  return {
    done,
    due: inMonth.length,
    pct: inMonth.length ? divRound(done * 100, inMonth.length) : null,
  };
}

// ---------- 积分收支 ----------
export interface PointsFlow {
  earned: number; // 只含挣分来源（与经验口径一致）
  redeemed: number; // 兑换（正数表示支出）
  deducted: number; // 违规扣分（正数）
  refunded: number; // 补偿退还 + 奖励（单列，不计入“获得”）
  undone: number; // 撤销收回（正数）
  sources: { reason: string; points: number; pct: number }[]; // “获得来源”，不含退还
  weeks: { weekStart: DateKey; earned: number; redeemed: number; deducted: number }[]; // 自然周，截断在本月内
}

export function pointsFlow(
  entries: readonly LedgerEntry[],
  anyDayInMonth: DateKey,
  tzOffsetMin = SHANGHAI_OFFSET_MIN,
): PointsFlow {
  const earning = XP_EARNING_REASONS as readonly string[];
  let earned = 0,
    redeemed = 0,
    deducted = 0,
    refunded = 0,
    undone = 0;
  const bySource = new Map<string, number>();
  const weeks = new Map<DateKey, { earned: number; redeemed: number; deducted: number }>();
  for (const e of entries) {
    if (e.kind !== "points") continue;
    const d = dateKeyOf(e.at, tzOffsetMin);
    if (!sameMonth(d, anyDayInMonth)) continue;
    const wk = weekStart(d) < monthStart(d) ? monthStart(d) : weekStart(d);
    const w = weeks.get(wk) ?? { earned: 0, redeemed: 0, deducted: 0 };
    if (earning.includes(e.reason) && e.delta > 0) {
      earned += e.delta;
      w.earned += e.delta;
      bySource.set(e.reason, (bySource.get(e.reason) ?? 0) + e.delta);
    } else if (e.reason === "redeem") {
      redeemed += -e.delta;
      w.redeemed += -e.delta;
    } else if (e.reason === "violation") {
      deducted += -e.delta;
      w.deducted += -e.delta;
    } else if (e.reason === "refund") refunded += e.delta;
    else if (e.reason === "undo") undone += -e.delta;
    weeks.set(wk, w);
  }
  const sources = [...bySource.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([reason, points]) => ({
      reason,
      points,
      pct: earned ? divRound(points * 100, earned) : 0,
    }));
  return {
    earned,
    redeemed,
    deducted,
    refunded,
    undone,
    sources,
    weeks: [...weeks.entries()].sort().map(([weekStart, v]) => ({ weekStart, ...v })),
  };
}

// ---------- 趋势 ----------
/** 本月体重变化 = 本月最后一次称重 − 上月最后一次称重（没有则用本月第一次）；不足两点 → null */
export function monthlyWeightChange(
  weighIns: readonly { date: DateKey; g: number }[],
  today: DateKey,
): { latestG: number; deltaG: number } | null {
  const sorted = [...weighIns].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const inMonth = sorted.filter((w) => sameMonth(w.date, today) && w.date <= today);
  if (!inMonth.length) return null;
  const before = sorted.filter((w) => w.date < monthStart(today));
  const base = before.length ? before[before.length - 1]! : inMonth[0]!;
  const latest = inMonth[inMonth.length - 1]!;
  if (base === latest) return null;
  return { latestG: latest.g, deltaG: latest.g - base.g };
}

/** 本月存款增量 = 本月存入合计（分） */
export function monthlyDeposits(
  deposits: readonly { date: DateKey; amountFen: number }[],
  today: DateKey,
): number {
  return deposits
    .filter((d) => sameMonth(d.date, today) && d.date <= today)
    .reduce((a, d) => a + d.amountFen, 0);
}
