import { afterEach, describe, expect, it } from "vitest";
import { db } from "@/db/dexie";
import { balanceOf, type LedgerEntry } from "@/domain/ledger";
import { addDays } from "@/domain/dates";
import { week52Cumulative } from "@/domain/savingsPlan";
import { todayKey } from "@/lib/clock";
import {
  archiveGoal,
  createSavingsGoal,
  createWeightGoal,
  deposit,
  periodOf,
  readSnapshot,
  undoGoalToday,
  updateGoal,
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

  it("周六创建的 52 周挑战按自然周计次，同一周重打不重复发分", async () => {
    await resetDb();
    const saturday = Date.parse("2026-11-21T04:00:00.000Z");
    const monday = Date.parse("2026-11-23T04:00:00.000Z");
    const nextSaturday = Date.parse("2026-11-28T04:00:00.000Z");
    const followingMonday = Date.parse("2026-11-30T04:00:00.000Z");
    const id = await createSavingsGoal(
      {
        name: "52 周",
        targetFen: week52Cumulative(52, 1_000),
        startFen: 0,
        kind: "week52",
        period: "week",
        amountFen: 0,
        baseFen: 1_000,
        deadline: "2027-11-20",
      },
      saturday,
    );
    expect(
      periodOf(
        { targetFen: 1, startFen: 0, kind: "week52", period: "week", amountFen: 0, baseFen: 1_000 },
        "2026-11-21",
        "2026-11-21",
      ),
    ).toMatchObject({
      key: "w52:2026-11-16",
      planned: 1_000,
      label: "第 1 周应存",
    });
    await deposit(id, 1_000, saturday);
    const week2 = await readSnapshot(monday);
    expect(week2.goals[0]?.periodLabel).toBe("第 2 周应存");
    expect(week2.goals[0]?.periodFen).toBe(2_000);
    await deposit(id, 2_000, monday);
    await deposit(id, 1, nextSaturday);
    await deposit(id, 3_000, followingMonday);
    const ledger = (await db.table("ledger").toArray()) as LedgerEntry[];
    const awards = ledger
      .filter((entry) => entry.kind === "points" && entry.reason === "deposit")
      .sort((a, b) => (a.awardKey ?? "").localeCompare(b.awardKey ?? ""));
    expect(awards.map((entry) => entry.awardKey)).toEqual([
      `deposit:${id}:w52:2026-11-16`,
      `deposit:${id}:w52:2026-11-23`,
      `deposit:${id}:w52:2026-11-30`,
    ]);
    expect(awards.map((entry) => entry.delta)).toEqual([10, 10, 12]);
    expect((await readSnapshot(followingMonday)).goals[0]?.streak).toBe(3);
  });

  it("按周存钱的连胜按连续完成的周数算，第三周倍率是 1.2", async () => {
    await resetDb();
    const id = await createSavingsGoal(
      {
        name: "每周旅行",
        targetFen: 2_000_000,
        startFen: 0,
        kind: "fixed",
        period: "week",
        amountFen: 1_000,
        baseFen: 0,
        deadline: "2027-05-01",
      },
      Date.parse("2026-11-21T04:00:00.000Z"),
    );
    await deposit(id, 1_000, Date.parse("2026-11-21T04:00:00.000Z"));
    await deposit(id, 1_000, Date.parse("2026-11-23T04:00:00.000Z"));
    const third = await deposit(id, 1_000, Date.parse("2026-11-30T04:00:00.000Z"));
    expect(third.points).toBe(12);
    expect(third.streak).toBe(3);
  });

  it("编辑从今天重画计划线，删除只归档并留下流水", async () => {
    await resetDb();
    const id = await createWeightGoal(
      { name: "减重", heightCm: 165, startG: 70_000, targetG: 55_000, days: 90 },
      now,
    );
    await weighIn(id, 68_000, now);
    const before = (await db.table("ledger").toArray()) as LedgerEntry[];
    await updateGoal(
      id,
      { name: "减重计划", deadline: addDays(todayKey(now), 30), targetG: 60_000 },
      now,
    );
    const edited = await readSnapshot(now);
    expect(edited.goals[0]?.name).toBe("减重计划");
    expect(edited.goals[0]?.leadG).toBe(0);
    expect(edited.points).toBe(balanceOf(before));
    await archiveGoal(id);
    const gone = await readSnapshot(now);
    expect(gone.goals).toHaveLength(0);
    expect(gone.points).toBe(balanceOf(before));
    expect(gone.goalNames[id]).toBe("减重计划");
  });
});
