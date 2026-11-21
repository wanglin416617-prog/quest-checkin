import { afterEach, describe, expect, it } from "vitest";
import { db } from "@/db/dexie";
import { balanceOf, type LedgerEntry } from "@/domain/ledger";
import { addDays } from "@/domain/dates";
import { week52Cumulative } from "@/domain/savingsPlan";
import { todayKey } from "@/lib/clock";
import {
  createSavingsGoal,
  createWeightGoal,
  deposit,
  readSnapshot,
  undoGoalToday,
  weighIn,
} from "@/services/game";

const now = Date.UTC(2026, 10, 21, 2, 0);

async function resetDb(): Promise<void> {
  await db.delete();
  await db.open();
}

describe("打卡、撤销与今日全清", () => {
  afterEach(async () => {
    await db.delete();
  });

  it("称重 +5，只有一个目标时今日全清只 +20，经验不随撤销收回", async () => {
    await resetDb();
    const id = await createWeightGoal(
      { name: "九十天减重", heightCm: 165, startG: 70_000, targetG: 55_000, days: 90 },
      now,
    );
    const first = await weighIn(id, 70_000, now);
    expect(first.points).toBe(5);
    expect(first.allClear).toBe(20);
    expect(first.streak).toBe(1);

    const snap = await readSnapshot(now);
    expect(snap.points).toBe(25);
    expect(snap.xp).toBe(25);
    expect(snap.level).toBe(1);
    expect(snap.intoLevel).toBe(25);
    expect(snap.needed).toBe(100);
    expect(snap.allClear).toBe(true);
    expect(snap.streak).toBe(1);

    await undoGoalToday(id, now);
    const undone = await readSnapshot(now);
    expect(undone.points).toBe(0);
    expect(undone.xp).toBe(25);
    expect(undone.allClear).toBe(false);
    expect(undone.streak).toBe(0);

    const again = await weighIn(id, 69_000, now);
    expect(again.points).toBe(5);
    expect(again.allClear).toBe(20);
    const redone = await readSnapshot(now);
    expect(redone.points).toBe(25);
    expect(redone.xp).toBe(25);
  });

  it("同一天重复称重不重复发分", async () => {
    await resetDb();
    const id = await createWeightGoal(
      { name: "减重", heightCm: 165, startG: 70_000, targetG: 55_000, days: 90 },
      now,
    );
    await weighIn(id, 70_000, now);
    await weighIn(id, 69_500, now);
    expect((await readSnapshot(now)).points).toBe(25);
  });

  it("两个目标时，只完成一个不会发今日全清", async () => {
    await resetDb();
    const today = todayKey(now);
    const weight = await createWeightGoal(
      { name: "减重", heightCm: 165, startG: 70_000, targetG: 55_000, days: 90 },
      now,
    );
    const save = await createSavingsGoal(
      {
        name: "旅行基金",
        targetFen: 2_000_000,
        startFen: 0,
        kind: "fixed",
        period: "day",
        amountFen: 100,
        baseFen: 0,
        deadline: addDays(today, 30),
      },
      now,
    );
    const weighed = await weighIn(weight, 70_000, now);
    expect(weighed.allClear).toBe(0);
    expect((await readSnapshot(now)).points).toBe(5);

    const saved = await deposit(save, 100, now);
    expect(saved.points).toBe(10);
    expect(saved.allClear).toBe(20);
    expect((await readSnapshot(now)).points).toBe(35);

    await undoGoalToday(weight, now);
    const ledger = (await db.table("ledger").toArray()) as LedgerEntry[];
    expect(balanceOf(ledger)).toBe(10);
    expect(balanceOf(ledger, "xp")).toBe(35);
  });

  it("52 周基数 10 元的累计是 13780 元", () => {
    expect(week52Cumulative(52, 1_000)).toBe(1_378_000);
  });
});
