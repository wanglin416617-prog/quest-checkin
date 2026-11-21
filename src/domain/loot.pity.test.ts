import { describe, expect, it } from "vitest";
import {
  EMPTY_POOL_POINTS,
  PITY_AT,
  openLootBoxWithPity,
  type PoolItem,
  type Rarity,
} from "./loot.ts";
import type { Rng } from "./rng.ts";

const zero: Rng = { int: () => 0 };

function item(id: string, rarity: Rarity): PoolItem {
  return { id, name: id, rarity, kind: "real", oneTime: false, active: true };
}

const pool = [item("c", "common"), item("r", "rare"), item("e", "epic"), item("l", "legendary")];

describe("盲盒保底 N=10 第 10 抽必出史诗", () => {
  it("前 9 抽按权重，未出史诗或传说则 pity +1", () => {
    const opened = openLootBoxWithPity(pool, zero, 0);
    expect(opened.guaranteed).toBe(false);
    expect(opened.result).toMatchObject({ kind: "item", rarity: "common" });
    expect(opened.pity).toBe(1);
  });

  it("pity 为 9 时第 10 抽必出史诗并归零", () => {
    const opened = openLootBoxWithPity(pool, zero, PITY_AT - 1);
    expect(opened.guaranteed).toBe(true);
    expect(opened.result).toMatchObject({ kind: "item", rarity: "epic", item: { id: "e" } });
    expect(opened.pity).toBe(0);
  });

  it("中途出传说即归零，不消耗保底", () => {
    const onlyLegendary = [item("l", "legendary"), item("c", "common")];
    const opened = openLootBoxWithPity(onlyLegendary, { int: (max) => max - 1 }, 4);
    expect(opened.guaranteed).toBe(false);
    expect(opened.result).toMatchObject({ kind: "item", rarity: "legendary" });
    expect(opened.pity).toBe(0);
  });

  it("中途出史诗即归零", () => {
    const opened = openLootBoxWithPity([item("e", "epic")], zero, 2);
    expect(opened.result).toMatchObject({ kind: "item", rarity: "epic" });
    expect(opened.pity).toBe(0);
    expect(opened.guaranteed).toBe(false);
  });

  it("没有史诗物品时不强制，pity 停在 9", () => {
    const opened = openLootBoxWithPity([item("c", "common"), item("l", "legendary")], zero, 9);
    expect(opened.guaranteed).toBe(false);
    expect(opened.pity).toBe(9);
  });

  it("奖池为空发 30 分且不改变 pity", () => {
    const opened = openLootBoxWithPity([], zero, 3);
    expect(opened.result).toEqual({ kind: "fallbackPoints", points: EMPTY_POOL_POINTS });
    expect(opened.pity).toBe(3);
    expect(opened.guaranteed).toBe(false);
  });
});
