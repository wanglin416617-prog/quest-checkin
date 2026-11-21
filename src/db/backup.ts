/**
 * 备份 JSON：{ app, format:1, schemaVersion, appVersion, exportedAt, checksum, data:{表名: 行[]} }
 * checksum = SHA-256(稳定序列化(data))，hex。导入：校验 → 迁移 → 自动快照 → 单事务全量替换（失败整体回滚）。
 * 照片 Blob 以 base64 dataURL 内联（M1 再评估是否拆成 zip，见 Q-B1）。
 */
import type Dexie from "dexie";

export const APP_ID = "questcheckin"; // 与 appId com.wanglin.questcheckin 对应；显示名“共同的努力”
export const BACKUP_FORMAT = 1;

export interface BackupFile {
  app: typeof APP_ID;
  format: number;
  schemaVersion: number;
  appVersion: string;
  exportedAt: string;
  checksum: string;
  data: Record<string, unknown[]>;
}

/** 键排序后的稳定 JSON，保证同样的数据得到同样的 checksum */
export function stableStringify(v: unknown): string {
  if (v === null || typeof v !== "object") return JSON.stringify(v);
  if (Array.isArray(v)) return "[" + v.map(stableStringify).join(",") + "]";
  const o = v as Record<string, unknown>;
  return (
    "{" +
    Object.keys(o)
      .filter((k) => o[k] !== undefined)
      .sort()
      .map((k) => JSON.stringify(k) + ":" + stableStringify(o[k]))
      .join(",") +
    "}"
  );
}

export async function sha256Hex(s: string): Promise<string> {
  const buf = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function exportBackup(
  db: Dexie,
  appVersion: string,
  now = new Date(),
): Promise<BackupFile> {
  const data: Record<string, unknown[]> = {};
  await db.transaction("r", db.tables, async () => {
    for (const t of db.tables) data[t.name] = await t.toArray();
  });
  return {
    app: APP_ID,
    format: BACKUP_FORMAT,
    schemaVersion: db.verno,
    appVersion,
    exportedAt: now.toISOString(),
    checksum: await sha256Hex(stableStringify(data)),
    data,
  };
}

export type ValidateError =
  | "not_json"
  | "wrong_app"
  | "format_too_new"
  | "schema_too_new"
  | "checksum_mismatch"
  | "bad_shape";

export async function validateBackup(
  raw: string,
  currentSchema: number,
): Promise<{ ok: true; file: BackupFile } | { ok: false; error: ValidateError }> {
  let f: BackupFile;
  try {
    f = JSON.parse(raw);
  } catch {
    return { ok: false, error: "not_json" };
  }
  if (!f || typeof f !== "object" || typeof f.data !== "object" || f.data === null)
    return { ok: false, error: "bad_shape" };
  if (f.app !== APP_ID) return { ok: false, error: "wrong_app" };
  if (f.format > BACKUP_FORMAT) return { ok: false, error: "format_too_new" };
  if (f.schemaVersion > currentSchema) return { ok: false, error: "schema_too_new" };
  if (Object.values(f.data).some((rows) => !Array.isArray(rows)))
    return { ok: false, error: "bad_shape" };
  if ((await sha256Hex(stableStringify(f.data))) !== f.checksum)
    return { ok: false, error: "checksum_mismatch" };
  return { ok: true, file: f };
}

/** 备份数据迁移：schemaVersion n → current，逐级执行；各目标类型 typeConfig 的 migrateConfig 在此之后执行 */
export type BackupMigration = (data: Record<string, unknown[]>) => Record<string, unknown[]>;
export function migrateBackupData(
  data: Record<string, unknown[]>,
  from: number,
  to: number,
  steps: Record<number, BackupMigration>,
): Record<string, unknown[]> {
  let d = data;
  for (let v = from + 1; v <= to; v++) {
    const step = steps[v];
    if (step) d = step(d);
  }
  return d;
}

/**
 * 全量替换导入：单个 rw 事务内 clear + bulkPut；任一步抛错 → Dexie 回滚，库保持导入前状态。
 * 调用前由上层先 exportBackup() 写入“导入前快照”（meta 表或下载文件）。
 */
export async function importReplace(
  db: Dexie,
  data: Record<string, unknown[]>,
  validateRow?: (table: string, row: unknown) => void,
): Promise<void> {
  await db.transaction("rw", db.tables, async () => {
    for (const t of db.tables) {
      await t.clear();
      const rows = data[t.name] ?? [];
      if (validateRow) rows.forEach((r) => validateRow(t.name, r));
      if (rows.length) await t.bulkPut(rows as never[]);
    }
  });
}

/** 导出文件名（ASCII，北京时间）：gongtong-de-nuli-backup-YYYYMMDD-HHmm.json —— App 显示名“共同的努力” */
export function backupFileName(at: number, tzOffsetMin = 480): string {
  const d = new Date(at + tzOffsetMin * 60_000);
  const p = (n: number) => String(n).padStart(2, "0");
  return `gongtong-de-nuli-backup-${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}-${p(d.getUTCHours())}${p(d.getUTCMinutes())}.json`;
}
