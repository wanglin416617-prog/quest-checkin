import Dexie, { type Table } from "dexie";
import { db, defaultSettings, withSettingsDefaults, type SettingsRow } from "@/db/dexie";
import { addDays, diffDays, weekStart, type DateKey } from "@/domain/dates";
import { divRound } from "@/domain/int";
import {
  ALL_CLEAR_BONUS,
  MILESTONE_BONUS,
  WEIGH_IN_POINTS,
  depositPoints,
  levelFromXp,
  xpOnce,
  type Difficulty,
} from "@/domain/points";
import {
  balanceOf,
  netAwarded,
  recheckAward,
  undoReclaim,
  type LedgerEntry,
  type LedgerReason,
} from "@/domain/ledger";
import {
  fixedCumulative,
  leadBehindFen,
  savingsMilestones,
  week52Amount,
  week52Cumulative,
} from "@/domain/savingsPlan";
import { leadVsPlanG as weightLead, milestonesReached } from "@/domain/pace";
import { applyCheckIn, overallStreak, type StreakState } from "@/domain/streak";
import { cryptoRng } from "@/domain/rng";
import { openLootBoxWithPity, type PoolItem, type Rarity } from "@/domain/loot";
import { assertWeightG } from "@/domain/units";
import {
  goalCompletion,
  heatmap,
  monthSummary,
  pointsFlow,
  thisWeekProgress,
  type HeatCell,
  type MonthSummary,
  type PointsFlow,
} from "@/domain/stats";
import { scanBanned } from "@/lib/banned";
import { SHANGHAI_OFFSET_MIN, eachDay, formatDayLabel, todayKey } from "@/lib/clock";

type Rec = Record<string, unknown>;
const database = db as unknown as Dexie;

function T(name: string): Table<Rec, string> {
  return database.table(name);
}

export interface WeightCfg {
  heightCm: number;
  startG: number;
  targetG: number;
  days: number;
}

export interface SaveCfg {
  targetFen: number;
  startFen: number;
  kind: "fixed" | "week52";
  period: "day" | "week" | "month";
  amountFen: number;
  baseFen: number;
}

export interface GoalRow {
  id: string;
  name: string;
  icon: string;
  type: "weightLoss" | "savings";
  typeConfig: WeightCfg | SaveCfg;
  typeConfigVersion: number;
  difficulty: Difficulty;
  status: "active" | "paused" | "done" | "archived";
  startDate: DateKey;
  deadline?: DateKey;
  createdAt: number;
  order: number;
}

interface WeighRow {
  id: string;
  goalId: string;
  date: DateKey;
  g: number;
  createdAt: number;
  undoneAt?: number;
  streakBefore?: StreakState;
}

interface DepositRow {
  id: string;
  goalId: string;
  date: DateKey;
  amountFen: number;
  createdAt: number;
  undoneAt?: number;
  streakBefore?: StreakState;
}

interface BoxRow {
  id: string;
  source: string;
  sourceRef?: string;
  createdAt: number;
  openedAt?: number;
  resultItemId?: string;
  resultName?: string;
  resultRarity?: string;
  guaranteed?: boolean;
}

export interface GoalCard {
  id: string;
  name: string;
  type: "weightLoss" | "savings";
  doneToday: boolean;
  dueToday: boolean;
  streak: number;
  ratio: number;
  currentG?: number;
  startG?: number;
  targetG?: number;
  leadG?: number;
  heightCm?: number;
  savedFen?: number;
  targetFen?: number;
  leadFen?: number;
  periodFen?: number;
  periodLabel?: string;
  weighs: { date: DateKey; g: number }[];
}

export interface BoxView {
  id: string;
  opened: boolean;
  resultName?: string;
  resultRarity?: string;
  guaranteed?: boolean;
  createdAt: number;
}

export interface GoalRate {
  id: string;
  name: string;
  type: "weightLoss" | "savings";
  done: number;
  due: number;
  pct: number | null;
}

export interface Snapshot {
  today: DateKey;
  todayLabel: string;
  points: number;
  xp: number;
  level: number;
  intoLevel: number;
  needed: number;
  streak: number;
  dueToday: number;
  remain: number;
  allClear: boolean;
  goals: GoalCard[];
  pendingBoxes: number;
  recent: { name: string; rarity: string } | null;
  ledger: LedgerEntry[];
  pool: PoolItem[];
  boxes: BoxView[];
  pity: number;
  theme: SettingsRow["theme"];
  unit: SettingsRow["weightUnit"];
  reduceMotion: boolean;
  month: MonthSummary;
  heat: HeatCell[][];
  weekLine: { achieved: number; dueDays: number };
  goalRates: GoalRate[];
  flow: PointsFlow;
}

export interface CheckResult {
  goalId: string;
  points: number;
  allClear: number;
  streak: number;
  leveled: boolean;
  box: boolean;
}

const POOL: PoolItem[] = [
  ["c1", "一杯美式", "common"],
  ["c2", "午睡二十分钟", "common"],
  ["c3", "听一首歌", "common"],
  ["c4", "散步一刻钟", "common"],
  ["r1", "下午茶", "rare"],
  ["r2", "看一集剧", "rare"],
  ["r3", "一本新书", "rare"],
  ["e1", "一顿好饭", "epic"],
  ["e2", "一件小物", "epic"],
  ["l1", "周末小旅行", "legendary"],
].map(([id, name, rarity]) => ({
  id: id!,
  name: name!,
  rarity: rarity as Rarity,
  kind: "real" as const,
  oneTime: false,
  active: true,
}));

function uid(): string {
  return crypto.randomUUID();
}

function asLedger(rows: Rec[]): LedgerEntry[] {
  return rows as unknown as LedgerEntry[];
}

async function ledgerRows(): Promise<LedgerEntry[]> {
  return asLedger(await T("ledger").toArray());
}

async function goals(): Promise<GoalRow[]> {
  return (await T("goals").toArray()) as unknown as GoalRow[];
}

async function weighs(): Promise<WeighRow[]> {
  return (await T("weighIns").toArray()) as unknown as WeighRow[];
}

async function deposits(): Promise<DepositRow[]> {
  return (await T("deposits").toArray()) as unknown as DepositRow[];
}

function aliveWeighs(rows: WeighRow[], goalId: string): WeighRow[] {
  return rows.filter((row) => row.goalId === goalId && !row.undoneAt);
}

function aliveDeposits(rows: DepositRow[], goalId: string): DepositRow[] {
  return rows.filter((row) => row.goalId === goalId && !row.undoneAt);
}

function inRange(goal: GoalRow, day: DateKey): boolean {
  if (goal.status !== "active") return false;
  if (day < goal.startDate) return false;
  if (goal.deadline && day > goal.deadline) return false;
  return true;
}

function saveCfg(goal: GoalRow): SaveCfg {
  return goal.typeConfig as SaveCfg;
}

function weightCfg(goal: GoalRow): WeightCfg {
  return goal.typeConfig as WeightCfg;
}

export function periodOf(
  cfg: SaveCfg,
  start: DateKey,
  day: DateKey,
): { key: string; planned: number; label: string; anchor: DateKey } {
  if (cfg.kind === "week52") {
    const week = Math.floor(diffDays(start, day) / 7) + 1;
    const planned = week >= 1 && week <= 52 ? week52Amount(week, cfg.baseFen) : 0;
    return {
      key: `w52:${weekStart(day)}`,
      planned,
      label: `第 ${week} 周应存`,
      anchor: weekStart(day),
    };
  }
  if (cfg.period === "day")
    return { key: `d:${day}`, planned: cfg.amountFen, label: "今天应存", anchor: day };
  if (cfg.period === "month") {
    return {
      key: `m:${day.slice(0, 7)}`,
      planned: cfg.amountFen,
      label: "本月应存",
      anchor: `${day.slice(0, 8)}01`,
    };
  }
  return {
    key: `w:${weekStart(day)}`,
    planned: cfg.amountFen,
    label: "本周应存",
    anchor: weekStart(day),
  };
}

function depositSum(
  rows: DepositRow[],
  goalId: string,
  key: string,
  start: DateKey,
  cfg: SaveCfg,
  before?: DateKey,
): number {
  return aliveDeposits(rows, goalId)
    .filter(
      (row) =>
        periodOf(cfg, start, row.date).key === key && (before === undefined || row.date < before),
    )
    .reduce((sum, row) => sum + row.amountFen, 0);
}

function savingsState(
  goal: GoalRow,
  rows: DepositRow[],
  day: DateKey,
): { due: boolean; done: boolean; periodFen: number; label: string } {
  const cfg = saveCfg(goal);
  const period = periodOf(cfg, goal.startDate, day);
  if (!inRange(goal, day) || period.planned <= 0)
    return { due: false, done: false, periodFen: period.planned, label: period.label };
  const before = depositSum(rows, goal.id, period.key, goal.startDate, cfg, day);
  if (before >= period.planned)
    return { due: false, done: true, periodFen: period.planned, label: period.label };
  const today = depositSum(rows, goal.id, period.key, goal.startDate, cfg) - before;
  return {
    due: true,
    done: before + today >= period.planned,
    periodFen: period.planned,
    label: period.label,
  };
}

function weightDone(goal: GoalRow, rows: WeighRow[], day: DateKey): boolean {
  return aliveWeighs(rows, goal.id).some((row) => row.date === day);
}

function goalDay(
  goal: GoalRow,
  w: WeighRow[],
  d: DepositRow[],
  day: DateKey,
): { due: boolean; done: boolean } {
  if (!inRange(goal, day)) return { due: false, done: false };
  if (goal.type === "weightLoss") return { due: true, done: weightDone(goal, w, day) };
  const state = savingsState(goal, d, day);
  return { due: state.due, done: state.done };
}

function historyOf(
  list: GoalRow[],
  w: WeighRow[],
  d: DepositRow[],
  today: DateKey,
): Map<DateKey, { due: number; completed: number }> {
  const history = new Map<DateKey, { due: number; completed: number }>();
  const starts = list.map((goal) => goal.startDate).sort();
  if (!starts.length || starts[0]! > today) return history;
  for (const day of eachDay(starts[0]!, today)) {
    let due = 0;
    let completed = 0;
    for (const goal of list) {
      const cell = goalDay(goal, w, d, day);
      if (!cell.due) continue;
      due += 1;
      if (cell.done) completed += 1;
    }
    history.set(day, { due, completed });
  }
  return history;
}

function weighStreak(rows: WeighRow[], goalId: string, today: DateKey): number {
  const done = new Set(aliveWeighs(rows, goalId).map((row) => row.date));
  let day = done.has(today) ? today : addDays(today, -1);
  if (!done.has(day)) return 0;
  let count = 0;
  while (done.has(day)) {
    count += 1;
    day = addDays(day, -1);
  }
  return count;
}

function plannedCumulative(cfg: SaveCfg, start: DateKey, day: DateKey): number {
  const span = Math.max(0, diffDays(start, day));
  if (cfg.kind === "week52")
    return week52Cumulative(Math.min(52, Math.floor(span / 7) + 1), cfg.baseFen);
  const periods =
    cfg.period === "week"
      ? Math.floor(span / 7) + 1
      : cfg.period === "month"
        ? Math.floor(span / 30) + 1
        : span + 1;
  return fixedCumulative(periods, cfg.amountFen);
}

function goalRates(list: GoalRow[], w: WeighRow[], d: DepositRow[], today: DateKey): GoalRate[] {
  return list
    .filter((goal) => goal.status === "active")
    .map((goal) => {
      if (goal.type === "weightLoss") {
        const end = goal.deadline && goal.deadline < today ? goal.deadline : today;
        const dates = goal.startDate <= end ? eachDay(goal.startDate, end) : [];
        const done = new Set(aliveWeighs(w, goal.id).map((row) => row.date));
        const rate = goalCompletion(dates, done, today);
        return { id: goal.id, name: goal.name, type: goal.type, ...rate };
      }
      const anchors = new Set<DateKey>();
      const done = new Set<DateKey>();
      if (goal.startDate <= today) {
        for (const day of eachDay(goal.startDate, today)) {
          const period = periodOf(saveCfg(goal), goal.startDate, day);
          if (
            period.planned <= 0 ||
            period.anchor.slice(0, 7) !== today.slice(0, 7) ||
            period.anchor > today
          )
            continue;
          anchors.add(period.anchor);
          const sum = depositSum(d, goal.id, period.key, goal.startDate, saveCfg(goal));
          if (sum >= period.planned) done.add(period.anchor);
        }
      }
      const rate = goalCompletion([...anchors], done, today);
      return { id: goal.id, name: goal.name, type: goal.type, ...rate };
    });
}

function cards(list: GoalRow[], w: WeighRow[], d: DepositRow[], today: DateKey): GoalCard[] {
  return [...list]
    .filter((goal) => goal.status !== "archived")
    .sort((a, b) => a.order - b.order)
    .map((goal) => {
      const cell = goalDay(goal, w, d, today);
      if (goal.type === "weightLoss") {
        const cfg = weightCfg(goal);
        const series = aliveWeighs(w, goal.id).sort((a, b) => (a.date < b.date ? -1 : 1));
        const current = series.length ? series[series.length - 1]!.g : cfg.startG;
        const span = Math.max(1, cfg.startG - cfg.targetG);
        const lost = Math.max(0, cfg.startG - current);
        const dayIndex = Math.max(0, diffDays(goal.startDate, today));
        return {
          id: goal.id,
          name: goal.name,
          type: goal.type,
          doneToday: cell.done,
          dueToday: cell.due,
          streak: weighStreak(w, goal.id, today),
          ratio: Math.min(1, lost / span),
          currentG: current,
          startG: cfg.startG,
          targetG: cfg.targetG,
          leadG: weightLead(cfg.startG, cfg.targetG, cfg.days, dayIndex, current),
          heightCm: cfg.heightCm,
          weighs: series.map((row) => ({ date: row.date, g: row.g })),
        };
      }
      const cfg = saveCfg(goal);
      const saved = aliveDeposits(d, goal.id).reduce((sum, row) => sum + row.amountFen, 0);
      const total = cfg.startFen + saved;
      const period = savingsState(goal, d, today);
      return {
        id: goal.id,
        name: goal.name,
        type: goal.type,
        doneToday: cell.done,
        dueToday: cell.due,
        streak: 0,
        ratio: cfg.targetFen > 0 ? Math.min(1, total / cfg.targetFen) : 0,
        savedFen: total,
        targetFen: cfg.targetFen,
        leadFen: leadBehindFen(saved, plannedCumulative(cfg, goal.startDate, today)),
        periodFen: period.periodFen,
        periodLabel: period.label,
        weighs: [],
      };
    });
}

export async function ensureBasics(): Promise<void> {
  const settings = await T("settings").get("me");
  if (!settings) await T("settings").put(defaultSettings() as unknown as Rec);
  const wallet = await T("wallet").get("me");
  if (!wallet) await T("wallet").put({ id: "me", freezeCards: 0, lastFreezeGrant: "", pity: 0 });
  if ((await T("pool").count()) === 0) await T("pool").bulkPut(POOL as unknown as Rec[]);
}

export async function readSnapshot(now = Date.now()): Promise<Snapshot> {
  const today = todayKey(now);
  const [list, w, d, ledger, pool, boxes, wallet, settings] = await Promise.all([
    goals(),
    weighs(),
    deposits(),
    ledgerRows(),
    T("pool").toArray(),
    T("lootBoxes").toArray(),
    T("wallet").get("me"),
    T("settings").get("me"),
  ]);
  const history = historyOf(list, w, d, today);
  const level = levelFromXp(balanceOf(ledger, "xp"));
  const goalCards = cards(list, w, d, today);
  const dueToday = goalCards.filter((goal) => goal.dueToday).length;
  const remain = goalCards.filter((goal) => goal.dueToday && !goal.doneToday).length;
  const boxRows = boxes as unknown as BoxRow[];
  const boxViews = boxRows
    .map((box) => ({
      id: box.id,
      opened: Boolean(box.openedAt),
      resultName: box.resultName,
      resultRarity: box.resultRarity,
      guaranteed: box.guaranteed,
      createdAt: box.createdAt,
    }))
    .sort((a, b) => b.createdAt - a.createdAt);
  const opened = boxRows
    .filter((box) => box.openedAt)
    .sort((a, b) => (b.openedAt ?? 0) - (a.openedAt ?? 0));
  const prefs = withSettingsDefaults(settings as Partial<SettingsRow> | undefined);
  return {
    today,
    todayLabel: formatDayLabel(today),
    points: balanceOf(ledger),
    xp: balanceOf(ledger, "xp"),
    level: level.level,
    intoLevel: level.intoLevel,
    needed: level.needed,
    streak: overallStreak(history, today),
    dueToday,
    remain,
    allClear: dueToday > 0 && remain === 0,
    goals: goalCards,
    pendingBoxes: boxViews.filter((box) => !box.opened).length,
    recent: opened[0]?.resultName
      ? { name: opened[0].resultName, rarity: opened[0].resultRarity ?? "common" }
      : null,
    ledger: [...ledger].sort((a, b) => b.at - a.at),
    pool: pool as unknown as PoolItem[],
    boxes: boxViews,
    pity: Number(wallet?.pity ?? 0),
    theme: prefs.theme,
    unit: prefs.weightUnit,
    reduceMotion: prefs.reduceMotion,
    month: monthSummary(history, today),
    heat: heatmap(history, today),
    weekLine: thisWeekProgress(history, today),
    goalRates: goalRates(list, w, d, today),
    flow: pointsFlow(ledger, today, SHANGHAI_OFFSET_MIN),
  };
}

function assertName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("先起个名字");
  if (scanBanned(trimmed).blocks.length)
    throw new Error("这类词容易让人不舒服，换个说法才能保存哦");
  return trimmed;
}

async function nextOrder(): Promise<number> {
  const list = await goals();
  return list.reduce((max, goal) => Math.max(max, goal.order), -1) + 1;
}

export async function createWeightGoal(
  input: WeightCfg & { name: string },
  now = Date.now(),
): Promise<string> {
  assertWeightG(input.startG);
  assertWeightG(input.targetG);
  if (input.targetG >= input.startG) throw new Error("目标体重要小于当前体重");
  if (input.days <= 0 || input.heightCm <= 0) throw new Error("天数和身高要大于 0");
  const today = todayKey(now);
  const id = uid();
  const goal: GoalRow = {
    id,
    name: assertName(input.name),
    icon: "weight",
    type: "weightLoss",
    typeConfig: {
      heightCm: input.heightCm,
      startG: input.startG,
      targetG: input.targetG,
      days: input.days,
    },
    typeConfigVersion: 1,
    difficulty: "normal",
    status: "active",
    startDate: today,
    deadline: addDays(today, input.days),
    createdAt: now,
    order: await nextOrder(),
  };
  await database.transaction("rw", database.tables, async () => {
    await ensureBasics();
    await T("goals").put(goal as unknown as Rec);
    await T("bodyProfile").put({ id: "me", heightCm: input.heightCm, updatedAt: now });
  });
  return id;
}

export async function createSavingsGoal(
  input: SaveCfg & { name: string; deadline: DateKey },
  now = Date.now(),
): Promise<string> {
  if (input.targetFen <= input.startFen) throw new Error("目标金额要大于起始余额");
  if (input.kind === "fixed" && input.amountFen <= 0) throw new Error("每期金额要大于 0");
  if (input.kind === "week52" && input.baseFen <= 0) throw new Error("52 周基数要大于 0");
  const today = todayKey(now);
  if (input.deadline < today) throw new Error("截止日期不能早于今天");
  const cfg: SaveCfg =
    input.kind === "week52"
      ? {
          ...input,
          period: "week",
          amountFen: 0,
          targetFen: input.targetFen,
          baseFen: input.baseFen,
        }
      : input;
  const id = uid();
  const goal: GoalRow = {
    id,
    name: assertName(input.name),
    icon: "savings",
    type: "savings",
    typeConfig: cfg,
    typeConfigVersion: 1,
    difficulty: "normal",
    status: "active",
    startDate: today,
    deadline: input.deadline,
    createdAt: now,
    order: await nextOrder(),
  };
  await database.transaction("rw", database.tables, async () => {
    await ensureBasics();
    await T("goals").put(goal as unknown as Rec);
    await T("savingPlans").put({
      id: uid(),
      goalId: id,
      kind: cfg.kind,
      period: cfg.period,
      amountFen: cfg.amountFen,
      baseFen: cfg.baseFen,
      targetFen: cfg.targetFen,
      startFen: cfg.startFen,
      drawnEnvelopes: [],
    });
  });
  return id;
}

async function streakOf(goalId: string): Promise<StreakState> {
  const row = (await T("streaks").get(goalId)) as unknown as StreakState | undefined;
  return row ?? { goalId, current: 0, best: 0, lastCountedPeriod: "" };
}

function pushEntry(ledger: LedgerEntry[], entry: LedgerEntry): void {
  ledger.push(entry);
}

function grantPoints(
  ledger: LedgerEntry[],
  awardKey: string,
  reason: LedgerReason,
  target: number,
  now: number,
): number {
  const award = recheckAward(target, netAwarded(ledger, awardKey));
  if (award <= 0) return 0;
  const entry: LedgerEntry = { id: uid(), at: now, kind: "points", delta: award, reason, awardKey };
  pushEntry(ledger, entry);
  return award;
}

function grantXp(
  ledger: LedgerEntry[],
  awardKey: string,
  reason: LedgerReason,
  points: number,
  now: number,
): number {
  if (points <= 0) return 0;
  const granted = new Set(
    ledger.filter((entry) => entry.kind === "xp" && entry.awardKey).map((entry) => entry.awardKey!),
  );
  const xp = xpOnce(granted, awardKey, reason, points);
  if (xp <= 0) return 0;
  pushEntry(ledger, { id: uid(), at: now, kind: "xp", delta: xp, reason, awardKey });
  return xp;
}

async function flush(entries: LedgerEntry[], from: number): Promise<void> {
  if (entries.length > from) await T("ledger").bulkPut(entries.slice(from) as unknown as Rec[]);
}

function reclaim(ledger: LedgerEntry[], awardKey: string, now: number): number {
  const amount = undoReclaim(netAwarded(ledger, awardKey), balanceOf(ledger)).reclaim;
  if (amount <= 0) return 0;
  pushEntry(ledger, {
    id: uid(),
    at: now,
    kind: "points",
    delta: -amount,
    reason: "undo",
    awardKey,
  });
  return amount;
}

async function syncAllClear(ledger: LedgerEntry[], today: DateKey, now: number): Promise<number> {
  const [list, w, d] = await Promise.all([goals(), weighs(), deposits()]);
  const cell = historyOf(list, w, d, today).get(today) ?? { due: 0, completed: 0 };
  const key = `allclear:${today}`;
  if (cell.due > 0 && cell.completed >= cell.due) {
    const award = grantPoints(ledger, key, "allclear", ALL_CLEAR_BONUS, now);
    grantXp(ledger, key, "allclear", award, now);
    return award;
  }
  reclaim(ledger, key, now);
  return 0;
}

async function grantMilestones(
  goal: GoalRow,
  ledger: LedgerEntry[],
  w: WeighRow[],
  d: DepositRow[],
  now: number,
): Promise<boolean> {
  const boxes = (await T("lootBoxes").toArray()) as unknown as BoxRow[];
  const keys: string[] = [];
  if (goal.type === "weightLoss") {
    const cfg = weightCfg(goal);
    const series = aliveWeighs(w, goal.id);
    const current = series.length
      ? series.sort((a, b) => (a.date < b.date ? -1 : 1))[series.length - 1]!.g
      : cfg.startG;
    const { reached } = milestonesReached(cfg.startG, current, cfg.targetG);
    for (let step = 1; step <= reached; step += 1) keys.push(`w${step}`);
  } else {
    const cfg = saveCfg(goal);
    const saved =
      cfg.startFen + aliveDeposits(d, goal.id).reduce((sum, row) => sum + row.amountFen, 0);
    for (const mark of savingsMilestones(saved, cfg.targetFen)) keys.push(`s${mark}`);
  }
  let created = false;
  for (const key of keys) {
    const awardKey = `milestone:${goal.id}:${key}`;
    const award = grantPoints(ledger, awardKey, "milestone", MILESTONE_BONUS, now);
    grantXp(ledger, awardKey, "milestone", award, now);
    const sourceRef = `box:${awardKey}`;
    if (!boxes.some((box) => box.sourceRef === sourceRef)) {
      await T("lootBoxes").put({
        id: uid(),
        source: "milestone",
        sourceRef,
        createdAt: now,
      } as unknown as Rec);
      created = true;
    }
  }
  return created;
}

export async function weighIn(
  goalId: string,
  grams: number,
  now = Date.now(),
): Promise<CheckResult> {
  assertWeightG(grams);
  const today = todayKey(now);
  return database.transaction("rw", database.tables, async () => {
    const goal = (await T("goals").get(goalId)) as unknown as GoalRow | undefined;
    if (!goal || goal.type !== "weightLoss") throw new Error("找不到减重目标");
    const xpBefore = levelFromXp(balanceOf(await ledgerRows(), "xp")).level;
    const ledger = await ledgerRows();
    const mark = ledger.length;
    const existing = (await weighs()).find(
      (row) => row.goalId === goalId && row.date === today && !row.undoneAt,
    );
    if (existing) await T("weighIns").update(existing.id, { g: grams });
    else {
      const before = await streakOf(goalId);
      await T("weighIns").put({
        id: uid(),
        goalId,
        date: today,
        g: grams,
        createdAt: now,
        streakBefore: before,
      } as unknown as Rec);
      const after = applyCheckIn(before, today);
      await T("streaks").put(after as unknown as Rec);
    }
    const key = `weighIn:${goalId}:${today}`;
    const points = grantPoints(ledger, key, "weighIn", WEIGH_IN_POINTS, now);
    grantXp(ledger, key, "weighIn", points, now);
    const box = await grantMilestones(goal, ledger, await weighs(), await deposits(), now);
    const allClear = await syncAllClear(ledger, today, now);
    await flush(ledger, mark);
    const streak = weighStreak(await weighs(), goalId, today);
    const level = levelFromXp(balanceOf(ledger, "xp")).level;
    return { goalId, points, allClear, streak, leveled: level > xpBefore, box };
  });
}

export async function deposit(
  goalId: string,
  amountFen: number,
  now = Date.now(),
): Promise<CheckResult> {
  if (!Number.isSafeInteger(amountFen) || amountFen <= 0) throw new Error("存入金额要大于 0");
  const today = todayKey(now);
  return database.transaction("rw", database.tables, async () => {
    const goal = (await T("goals").get(goalId)) as unknown as GoalRow | undefined;
    if (!goal || goal.type !== "savings") throw new Error("找不到存钱目标");
    const xpBefore = levelFromXp(balanceOf(await ledgerRows(), "xp")).level;
    const ledger = await ledgerRows();
    const mark = ledger.length;
    const cfg = saveCfg(goal);
    const period = periodOf(cfg, goal.startDate, today);
    const beforeSum = depositSum(await deposits(), goalId, period.key, goal.startDate, cfg);
    const willComplete =
      period.planned > 0 && beforeSum < period.planned && beforeSum + amountFen >= period.planned;
    const streakBefore = await streakOf(goalId);
    await T("deposits").put({
      id: uid(),
      goalId,
      date: today,
      amountFen,
      createdAt: now,
      ...(willComplete ? { streakBefore } : {}),
    } as unknown as Rec);
    let streakAfter = streakBefore;
    if (willComplete && streakBefore.lastCountedPeriod !== today) {
      streakAfter = applyCheckIn(streakBefore, today);
      await T("streaks").put(streakAfter as unknown as Rec);
    }
    const sumAfter = beforeSum + amountFen;
    const target =
      period.planned > 0
        ? depositPoints(
            goal.difficulty,
            Math.max(1, streakAfter.current),
            sumAfter,
            period.planned,
            false,
          )
        : 0;
    const points = grantPoints(ledger, `deposit:${goalId}:${period.key}`, "deposit", target, now);
    grantXp(ledger, `deposit:${goalId}:${period.key}`, "deposit", points, now);
    const box = await grantMilestones(goal, ledger, await weighs(), await deposits(), now);
    const allClear = await syncAllClear(ledger, today, now);
    await flush(ledger, mark);
    const level = levelFromXp(balanceOf(ledger, "xp")).level;
    return {
      goalId,
      points,
      allClear,
      streak: streakAfter.current,
      leveled: level > xpBefore,
      box,
    };
  });
}

export async function undoGoalToday(goalId: string, now = Date.now()): Promise<void> {
  const today = todayKey(now);
  await database.transaction("rw", database.tables, async () => {
    const goal = (await T("goals").get(goalId)) as unknown as GoalRow | undefined;
    if (!goal) throw new Error("找不到目标");
    const ledger = await ledgerRows();
    const mark = ledger.length;
    if (goal.type === "weightLoss") {
      const row = (await weighs()).find(
        (item) => item.goalId === goalId && item.date === today && !item.undoneAt,
      );
      if (!row) return;
      await T("weighIns").update(row.id, { undoneAt: now });
      reclaim(ledger, `weighIn:${goalId}:${today}`, now);
      if (row.streakBefore) await T("streaks").put(row.streakBefore as unknown as Rec);
    } else {
      const rows = aliveDeposits(await deposits(), goalId)
        .filter((item) => item.date === today)
        .sort((a, b) => b.createdAt - a.createdAt);
      const row = rows[0];
      if (!row) return;
      await T("deposits").update(row.id, { undoneAt: now });
      const cfg = saveCfg(goal);
      const period = periodOf(cfg, goal.startDate, today);
      const sumAfter = depositSum(await deposits(), goalId, period.key, goal.startDate, cfg);
      const still = period.planned > 0 && sumAfter >= period.planned;
      if (!still) {
        reclaim(ledger, `deposit:${goalId}:${period.key}`, now);
        if (row.streakBefore) await T("streaks").put(row.streakBefore as unknown as Rec);
      } else {
        const streak = await streakOf(goalId);
        const target = depositPoints(
          goal.difficulty,
          Math.max(1, streak.current),
          sumAfter,
          period.planned,
          false,
        );
        const net = netAwarded(ledger, `deposit:${goalId}:${period.key}`);
        if (net > target) {
          const back = undoReclaim(net - target, balanceOf(ledger)).reclaim;
          if (back > 0) {
            pushEntry(ledger, {
              id: uid(),
              at: now,
              kind: "points",
              delta: -back,
              reason: "undo",
              awardKey: `deposit:${goalId}:${period.key}`,
            });
          }
        }
      }
    }
    await syncAllClear(ledger, today, now);
    await flush(ledger, mark);
  });
}

export async function openBox(boxId: string, now = Date.now()): Promise<BoxRow> {
  return database.transaction("rw", database.tables, async () => {
    const box = (await T("lootBoxes").get(boxId)) as unknown as BoxRow | undefined;
    if (!box) throw new Error("找不到盲盒");
    if (box.openedAt) return box;
    const pool = (await T("pool")
      .filter((item) => item.active !== false)
      .toArray()) as unknown as PoolItem[];
    const wallet = (await T("wallet").get("me")) as Rec;
    const pity = Number(wallet.pity ?? 0);
    const weights = withSettingsDefaults((await T("settings").get("me")) as Partial<SettingsRow>)
      .rarityWeights as Record<Rarity, number>;
    const opened = openLootBoxWithPity(pool, cryptoRng, pity, weights);
    await T("wallet").put({ ...wallet, pity: opened.pity });
    const ledger = await ledgerRows();
    const mark = ledger.length;
    let resultName = `${opened.result.kind === "fallbackPoints" ? opened.result.points : 0} 积分`;
    let resultRarity = "common";
    let resultItemId: string | undefined;
    let points = 0;
    if (opened.result.kind === "item") {
      resultItemId = opened.result.item.id;
      resultName = opened.result.item.name;
      resultRarity = opened.result.rarity;
      if (opened.result.item.oneTime)
        await T("pool").update(opened.result.item.id, { active: false });
      if (opened.result.item.kind === "points" && opened.result.item.amount)
        points = opened.result.item.amount;
    } else points = opened.result.points;
    if (points > 0) {
      const award = grantPoints(ledger, `box:${boxId}`, "box", points, now);
      grantXp(ledger, `box:${boxId}`, "box", award, now);
    }
    await flush(ledger, mark);
    const next: BoxRow = {
      ...box,
      openedAt: now,
      resultItemId,
      resultName,
      resultRarity,
      guaranteed: opened.guaranteed,
    };
    await T("lootBoxes").put(next as unknown as Rec);
    return next;
  });
}

export async function addPoolItem(name: string, rarity: Rarity): Promise<void> {
  const cleaned = assertName(name);
  await T("pool").put({
    id: uid(),
    name: cleaned,
    rarity,
    kind: "real",
    oneTime: false,
    active: true,
  });
}

export async function setPity(pity: number): Promise<void> {
  const next = Math.max(0, Math.min(9, Math.trunc(pity)));
  const wallet = (await T("wallet").get("me")) ?? {
    id: "me",
    freezeCards: 0,
    lastFreezeGrant: "",
    pity: 0,
  };
  await T("wallet").put({ ...wallet, pity: next });
}

export async function patchSettings(patch: Partial<SettingsRow>): Promise<void> {
  const current = withSettingsDefaults(
    (await T("settings").get("me")) as Partial<SettingsRow> | undefined,
  );
  await T("settings").put({ ...current, ...patch, id: "me" } as unknown as Rec);
}

export function completionLabel(done: number, due: number): string {
  if (due <= 0) return "—";
  return `${divRound(done * 100, due)}%`;
}
