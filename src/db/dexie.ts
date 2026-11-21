/**
 * Dexie schema v1 小样（与计划书一致，并补充了几个查询需要的索引，见 DEV_PLAN §3）。
 * 规则：
 *  1. 已发布的 version(n).stores(...) 永不修改、永不删除；结构变化只能新增 version(n+1) + upgrade()。
 *  2. upgrade() 只做“加字段默认值 / 拆表 / 重建索引”，不得删除用户数据；失败事务自动回滚，旧库保持原样。
 *  3. 主键一律字符串 id（crypto.randomUUID），避免自增主键在导入合并时冲突。
 */
import Dexie, { type Table } from "dexie";

export const SCHEMA_VERSION = 1;
/** IndexedDB 库名与 appId 绑定（App 显示名“共同的努力”可改，库名不随之变化） */
export const DB_NAME = "questcheckin";

/** Settings 单例（id='me'）—— v1 字段；新增字段必须给默认值，读取时用 withSettingsDefaults 补齐 */
export interface SettingsRow {
  id: "me";
  theme: "system" | "light" | "dark";
  sound: boolean;
  haptics: boolean;
  reduceMotion: boolean; // 设计稿 15a“减少动效”（与 prefers-reduced-motion 任一开启即降级）
  weightUnit: "jin" | "kg"; // 显示单位；存储一律整数克
  mealOnTimeWindowMin: 15 | 30 | 60; // 餐次按时范围（2026-11-21 已定，默认 ±30；04d 向导与设置页共用此字段）
  rarityWeights: Record<string, number>;
  lastBackupAt?: number;
  schemaVersion: number;
}

export function defaultSettings(): SettingsRow {
  return {
    id: "me",
    theme: "system",
    sound: false,
    haptics: true,
    reduceMotion: false,
    weightUnit: "jin",
    mealOnTimeWindowMin: 30,
    rarityWeights: { common: 60, rare: 25, epic: 12, legendary: 3 },
    schemaVersion: SCHEMA_VERSION,
  };
}

export function withSettingsDefaults(row: Partial<SettingsRow> | undefined): SettingsRow {
  const d = defaultSettings();
  const merged = { ...d, ...(row ?? {}), id: "me" as const };
  if (![15, 30, 60].includes(merged.mealOnTimeWindowMin)) merged.mealOnTimeWindowMin = 30;
  return merged;
}

export const STORES_V1: Record<string, string> = {
  goals: "id, type, status, order",
  checkIns: "id, [goalId+date], date",
  ledger: "id, at, kind, reason, refId, awardKey", // + awardKey：撤销收回 / 重打去重（按挣分来源求净额）
  streaks: "goalId",
  wallet: "id",
  rewards: "id",
  redemptions: "id, status, at",
  pool: "id, rarity, active",
  lootBoxes: "id, openedAt",
  achievements: "key",
  photos: "id",
  settings: "id",
  bodyProfile: "id",
  weighIns: "id, [goalId+date]", // 行字段 g：整数克（Q-U1 已定）
  mealPlans: "id, goalId",
  mealLogs: "id, [goalId+date], date, [goalId+date+meal]", // + [goalId+date+meal]：同一餐只给一次分（补记查重）
  violationRules: "id, scope, goalId",
  violationEvents: "id, [goalId+date], ruleId, date", // + date：全局每日扣分上限查询
  compensationTasks: "id, status, dueAt, violationId, [goalId+doneDate]", // + violationId；+ [goalId+doneDate] 查“本周该目标是否已领补偿奖励”
  savingPlans: "id, goalId",
  deposits: "id, [goalId+date]",
  impulseSpends: "id, [goalId+date]",
  promptTemplates: "id, scope, tone",
  reminders: "id, kind, enabled, goalId", // + goalId
  meta: "key", // 新增：迁移日志、上次快照时间等
};

export interface Row {
  id?: string;
  key?: string;
  [k: string]: unknown;
}

export class QuestDB extends Dexie {
  [table: string]: unknown;
  constructor(name = DB_NAME) {
    super(name);
    this.version(1).stores(STORES_V1);
  }
  t(name: string): Table<Row, string> {
    return this.table(name);
  }
}

/** 演示用的 v2：给 goals 增加 archivedAt 索引，并为旧数据补默认值（真实 v2 由 M2+ 决定） */
export class QuestDBv2Demo extends Dexie {
  constructor(name = DB_NAME) {
    super(name);
    this.version(1).stores(STORES_V1);
    this.version(2)
      .stores({ ...STORES_V1, goals: "id, type, status, order, archivedAt" })
      .upgrade(async (tx) => {
        await tx
          .table("goals")
          .toCollection()
          .modify((g: Row) => {
            if (g.archivedAt === undefined) g.archivedAt = 0;
          });
        await tx.table("meta").put({ key: "migration:2", at: Date.now() });
      });
  }
}

export type GoalType = "habit" | "count" | "weightLoss" | "savings";

/** 应用单例。单测各自 new QuestDB(name)。 */
export const db = new QuestDB(DB_NAME);
