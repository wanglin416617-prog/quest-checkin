import { describe, it, expect } from "vitest";
import Dexie from "dexie";
import {
  QuestDB,
  QuestDBv2Demo,
  STORES_V1,
  defaultSettings,
  withSettingsDefaults,
  DB_NAME,
} from "@/db/dexie";
import {
  exportBackup,
  validateBackup,
  importReplace,
  migrateBackupData,
  stableStringify,
  backupFileName,
  APP_ID,
} from "@/db/backup";

async function seed(db: QuestDB) {
  await db.t("goals").bulkPut([
    {
      id: "g1",
      type: "weightLoss",
      status: "active",
      order: 1,
      name: "90 天减 30 斤",
      typeConfig: { startG: 70000, targetG: 55000, unitDisplay: "jin" },
      typeConfigVersion: 1,
    },
  ]);
  await db.t("weighIns").bulkPut(
    Array.from({ length: 30 }, (_, i) => ({
      id: "w" + i,
      goalId: "g1",
      date: `2026-12-${String(i + 1).padStart(2, "0")}`,
      g: 70000 - i * 100,
    })),
  );
  await db.t("ledger").bulkPut([
    { id: "l1", at: 1, kind: "points", delta: 15, reason: "checkin" },
    { id: "l2", at: 2, kind: "points", delta: -10, reason: "violation" },
  ]);
  await db.t("deposits").put({ id: "d1", goalId: "g2", date: "2026-12-01", amountFen: 70000 });
}

describe("Dexie schema v1 / 迁移 / 备份", () => {
  it("T-D-01 v1 建库：全部 25 张表，复合索引可查询", async () => {
    const db = new QuestDB("t1");
    await db.open();
    expect(db.tables.map((t) => t.name).sort()).toEqual(Object.keys(STORES_V1).sort());
    await seed(db);
    const n = await db
      .t("weighIns")
      .where("[goalId+date]")
      .between(["g1", "2026-12-01"], ["g1", "2026-12-10"], true, true)
      .count();
    expect(n).toBe(10);
    const w = await db.t("weighIns").get("w29");
    expect(w!.g).toBe(67100);
    expect(Number.isInteger(w!.g)).toBe(true); // Q-U1：体重整数克
    db.close();
  });
  it("T-D-02 刷新（关闭再打开）数据不丢", async () => {
    const a = new QuestDB("t2");
    await seed(a);
    a.close();
    const b = new QuestDB("t2");
    expect(await b.t("weighIns").count()).toBe(30);
    b.close();
  });
  it("T-D-03 升级 v1 → v2：数据全在、新字段补默认值、记录迁移日志", async () => {
    const a = new QuestDB("t3");
    await seed(a);
    a.close();
    const b = new QuestDBv2Demo("t3");
    await b.open();
    expect(b.verno).toBe(2);
    expect(await b.table("weighIns").count()).toBe(30);
    expect((await b.table("goals").get("g1")).archivedAt).toBe(0);
    expect(await b.table("meta").get("migration:2")).toBeTruthy();
    b.close();
  });
  it("T-D-04 升级失败整体回滚：旧版本数据与版本号不变", async () => {
    const a = new QuestDB("t4");
    await seed(a);
    a.close();
    class Broken extends Dexie {
      constructor() {
        super("t4");
        this.version(1).stores(STORES_V1);
        this.version(2)
          .stores(STORES_V1)
          .upgrade(async (tx) => {
            await tx.table("goals").clear();
            throw new Error("boom");
          });
      }
    }
    const bad = new Broken();
    await expect(bad.open()).rejects.toThrow();
    bad.close();
    const c = new QuestDB("t4");
    await c.open();
    expect(c.verno).toBe(1);
    expect(await c.t("goals").count()).toBe(1);
    c.close();
  });
  it("T-D-05 US-13：导出 → 清除 → 导入 逐条一致；余额 = 流水之和", async () => {
    const db = new QuestDB("t5");
    await seed(db);
    const before = await exportBackup(db, "0.0.1");
    const raw = JSON.stringify(before);
    await Promise.all(db.tables.map((t) => t.clear()));
    const v = await validateBackup(raw, 1);
    expect(v.ok).toBe(true);
    if (v.ok) await importReplace(db, v.file.data);
    const after = await exportBackup(db, "0.0.1");
    expect(stableStringify(after.data)).toBe(stableStringify(before.data));
    expect(after.checksum).toBe(before.checksum);
    const ledger = await db.t("ledger").toArray();
    expect(ledger.reduce((a, e) => a + (e.delta as number), 0)).toBe(5);
    db.close();
  });
  it("T-D-06 校验失败：非 JSON / 其他 App / 新格式 / 新 schema / 篡改 checksum", async () => {
    const db = new QuestDB("t6");
    await seed(db);
    const f = await exportBackup(db, "0.0.1");
    expect(await validateBackup("{oops", 1)).toEqual({ ok: false, error: "not_json" });
    expect(await validateBackup(JSON.stringify({ ...f, app: "other" }), 1)).toEqual({
      ok: false,
      error: "wrong_app",
    });
    expect(await validateBackup(JSON.stringify({ ...f, format: 2 }), 1)).toEqual({
      ok: false,
      error: "format_too_new",
    });
    expect(await validateBackup(JSON.stringify({ ...f, schemaVersion: 9 }), 1)).toEqual({
      ok: false,
      error: "schema_too_new",
    });
    const tampered = JSON.parse(JSON.stringify(f));
    tampered.data.deposits[0].amountFen = 1;
    expect(await validateBackup(JSON.stringify(tampered), 1)).toEqual({
      ok: false,
      error: "checksum_mismatch",
    });
    db.close();
  });
  it("T-D-07 导入中途出错 → 整体回滚，原数据完好", async () => {
    const db = new QuestDB("t7");
    await seed(db);
    const bad = { goals: [{ id: "x" }], weighIns: [{ id: "bad" }] };
    await expect(
      importReplace(db, bad, (_t, r) => {
        if ((r as { id: string }).id === "bad") throw new Error("invalid row");
      }),
    ).rejects.toThrow();
    expect(await db.t("weighIns").count()).toBe(30);
    expect(await db.t("goals").get("g1")).toBeTruthy();
    db.close();
  });
  it("T-D-08 旧备份（schema 1）导入到新版本：逐级执行备份迁移", () => {
    const migrated = migrateBackupData({ goals: [{ id: "g" }] }, 1, 2, {
      2: (d) => ({ ...d, goals: d.goals!.map((g) => ({ ...(g as object), archivedAt: 0 })) }),
    });
    expect(migrated.goals![0]).toEqual({ id: "g", archivedAt: 0 });
  });
  it("T-D-09 Settings 默认值：按时范围 ±30、显示斤；旧行缺字段/非法值自动补齐为 30；库名 questcheckin", async () => {
    expect(DB_NAME).toBe("questcheckin");
    const db = new QuestDB("t9");
    await db.open();
    await db.t("settings").put(defaultSettings() as never);
    const row = await db.t("settings").get("me");
    expect(row).toMatchObject({ mealOnTimeWindowMin: 30, weightUnit: "jin", reduceMotion: false });
    expect(withSettingsDefaults({ mealOnTimeWindowMin: 45 as never }).mealOnTimeWindowMin).toBe(30);
    expect(withSettingsDefaults({ mealOnTimeWindowMin: 60 }).mealOnTimeWindowMin).toBe(60);
    expect(withSettingsDefaults(undefined).id).toBe("me");
    db.close();
  });
  it("T-D-10 同一餐查重索引 [goalId+date+meal] 与 ledger.awardKey 索引可查询", async () => {
    const db = new QuestDB("t10");
    await db.open();
    await db.t("mealLogs").bulkPut([
      { id: "m1", goalId: "g1", date: "2026-12-10", meal: "lunch" },
      { id: "m2", goalId: "g1", date: "2026-12-10", meal: "dinner" },
    ]);
    expect(
      await db
        .t("mealLogs")
        .where("[goalId+date+meal]")
        .equals(["g1", "2026-12-10", "lunch"])
        .count(),
    ).toBe(1);
    await db.t("ledger").bulkPut([
      {
        id: "l1",
        at: 1,
        kind: "points",
        delta: 15,
        reason: "checkin",
        awardKey: "checkin:g1:2026-12-10",
      },
      {
        id: "l2",
        at: 2,
        kind: "points",
        delta: -15,
        reason: "undo",
        awardKey: "checkin:g1:2026-12-10",
      },
    ]);
    const rows = await db.t("ledger").where("awardKey").equals("checkin:g1:2026-12-10").toArray();
    expect(rows.reduce((a, r) => a + (r.delta as number), 0)).toBe(0);
    db.close();
  });
  it("T-D-11 改名“共同的努力”：备份 app 标识 questcheckin；导出文件名按北京时间、ASCII", () => {
    expect(APP_ID).toBe("questcheckin");
    expect(backupFileName(Date.UTC(2026, 10, 30, 16, 5))).toBe(
      "gongtong-de-nuli-backup-20261201-0005.json",
    );
  });
});
