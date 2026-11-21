import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { QuestDatabase, type Goal } from "@/db/dexie";
import { createGoalRepo } from "@/db/repo/goals";
import { backupMeta, exportBackup } from "@/db/backup";

function sampleGoal(overrides: Partial<Goal> = {}): Goal {
  return {
    id: "goal-walk",
    name: "步行 8000 步",
    icon: "walk",
    color: "#f97316",
    type: "habit",
    typeConfig: { perDay: 1 },
    typeConfigVersion: 1,
    difficulty: "normal",
    status: "active",
    startDate: "2026-11-21",
    createdAt: 1_732_147_200_000,
    order: 0,
    ...overrides,
  };
}

describe("QuestDatabase", () => {
  let database: QuestDatabase;

  beforeEach(async () => {
    database = new QuestDatabase("quest-checkin-test");
    await database.open();
    await database.goals.clear();
  });

  afterEach(async () => {
    await database.close();
    await database.delete();
  });

  it("stores and lists active goals", async () => {
    const repo = createGoalRepo(database);
    await repo.add(sampleGoal());
    await repo.add(
      sampleGoal({ id: "goal-paused", name: "暂停的目标", status: "paused", order: 1 }),
    );

    const active = await repo.listActive();
    expect(active).toHaveLength(1);
    expect(active[0]?.name).toBe("步行 8000 步");

    const loaded = await repo.getById("goal-walk");
    expect(loaded?.type).toBe("habit");
    expect(loaded?.difficulty).toBe("normal");
  });

  it("updates goal status", async () => {
    const repo = createGoalRepo(database);
    await repo.add(sampleGoal());
    await repo.update("goal-walk", { status: "done" });
    const loaded = await repo.getById("goal-walk");
    expect(loaded?.status).toBe("done");
    expect(await repo.listActive()).toHaveLength(0);
  });

  it("exposes a versioned backup metadata marker", () => {
    expect(backupMeta().schemaVersion).toBe(1);
  });

  it("exports a JSON backup blob", async () => {
    const repo = createGoalRepo(database);
    await repo.add(sampleGoal());
    const blob = await exportBackup(database);
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.size).toBeGreaterThan(0);
    const text = await blob.text();
    expect(text).toContain("goal-walk");
    expect(text).toContain("步行 8000 步");
  });
});
