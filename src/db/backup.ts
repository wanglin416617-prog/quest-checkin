import type Dexie from "dexie";
import { exportDB, importDB } from "dexie-export-import";
import { db, type QuestDatabase } from "@/db/dexie";
import { SCHEMA_VERSION } from "@/db/migrations";

export async function exportBackup(database: QuestDatabase = db): Promise<Blob> {
  const blob = await exportDB(database, { prettyJson: true });
  return blob;
}

export async function importBackup(file: Blob): Promise<Dexie> {
  return importDB(file);
}

export function backupMeta(): { schemaVersion: number } {
  return { schemaVersion: SCHEMA_VERSION };
}
