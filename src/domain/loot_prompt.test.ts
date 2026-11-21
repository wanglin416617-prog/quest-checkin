import { describe, it, expect } from "vitest";
import {
  openLootBox,
  effectiveWeights,
  consumePoolItem,
  seededRng,
  cryptoRng,
  renderPrompt,
  BUILTIN_TEMPLATES,
  wastedDaysTenths,
  stepsFor,
  type PoolItem,
} from "./index.ts";

const item = (
  id: string,
  rarity: PoolItem["rarity"],
  active = true,
  oneTime = false,
): PoolItem => ({ id, name: id, rarity, kind: "real", oneTime, active });

describe("盲盒", () => {
  it("T-L-01 奖池为空 → +30 积分", () => {
    expect(openLootBox([], seededRng(1))).toEqual({ kind: "fallbackPoints", points: 30 });
    expect(openLootBox([item("a", "rare", false)], seededRng(1))).toEqual({
      kind: "fallbackPoints",
      points: 30,
    });
  });
  it("T-L-02 四档齐全：10 万次分布接近 60/25/12/3（±1%）", () => {
    const pool = [
      item("c", "common"),
      item("r", "rare"),
      item("e", "epic"),
      item("l", "legendary"),
    ];
    const rng = seededRng(2026);
    const N = 100000;
    const c: Record<string, number> = {};
    for (let i = 0; i < N; i++) {
      const r = openLootBox(pool, rng);
      if (r.kind === "item") c[r.rarity] = (c[r.rarity] ?? 0) + 1;
    }
    expect(Math.abs(c.common! / N - 0.6)).toBeLessThan(0.01);
    expect(Math.abs(c.rare! / N - 0.25)).toBeLessThan(0.01);
    expect(Math.abs(c.epic! / N - 0.12)).toBeLessThan(0.01);
    expect(Math.abs(c.legendary! / N - 0.03)).toBeLessThan(0.005);
  });
  it("T-L-03 空档重新归一化：只有 common+legendary → 60:3 = 95.2% : 4.8%", () => {
    const pool = [item("c", "common"), item("l", "legendary")];
    expect(effectiveWeights(pool)).toEqual({ common: 60, legendary: 3 });
    const rng = seededRng(5);
    const N = 100000;
    let leg = 0;
    for (let i = 0; i < N; i++) {
      const r = openLootBox(pool, rng);
      if (r.kind === "item" && r.rarity === "legendary") leg++;
    }
    expect(Math.abs(leg / N - 3 / 63)).toBeLessThan(0.005);
  });
  it("T-L-04 自定义权重（Settings.rarityWeights），权重 0 的档不出", () => {
    const pool = [item("c", "common"), item("r", "rare")];
    const w = { common: 0, rare: 1, epic: 1, legendary: 1 };
    for (let i = 0; i < 200; i++) {
      const r = openLootBox(pool, seededRng(i), w);
      expect(r.kind === "item" && r.rarity).toBe("rare");
    }
  });
  it("T-L-05 一次性物品开出后下架；非一次性保留", () => {
    const pool = [item("a", "common", true, true), item("b", "common")];
    const next = consumePoolItem(consumePoolItem(pool, "a"), "b");
    expect(next.find((p) => p.id === "a")!.active).toBe(false);
    expect(next.find((p) => p.id === "b")!.active).toBe(true);
  });
  it("T-L-06 cryptoRng 范围正确、非法参数抛错", () => {
    for (let i = 0; i < 1000; i++) {
      const v = cryptoRng.int(7);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(7);
    }
    expect(() => cryptoRng.int(0)).toThrow();
  });
});

describe("提示语模板", () => {
  it("T-T-01 US-22 温柔模板：含 400 kcal、0.8 天、任务", () => {
    const { text, unknown } = renderPrompt(BUILTIN_TEMPLATES.gentle, {
      食物: "奶茶",
      热量: 400,
      天数: wastedDaysTenths(400) / 10,
      任务: "快走 10000 步",
    });
    expect(text).toBe(
      "奶茶好吃吧～大约 400 kcal，相当于 0.8 天的小努力。今天快走 10000 步就补回来啦",
    );
    expect(unknown).toEqual([]);
  });
  it("T-T-02 毒舌模板：步数 10000", () => {
    expect(
      renderPrompt(BUILTIN_TEMPLATES.savage, { 食物: "奶茶", 天数: 0.8, 步数: stepsFor(400) }).text,
    ).toBe("一杯奶茶，0.8 天白干。10000 步，走起来，别找借口。");
  });
  it("T-T-03 存钱模板：金额出现两次都替换", () => {
    expect(
      renderPrompt(BUILTIN_TEMPLATES.savings, { 金额: "350", 目标名: "日本旅行基金", 天数: 3.5 })
        .text,
    ).toBe("这笔 350 元让「日本旅行基金」又远了 3.5 天。48 小时内多存 350 元追回来。");
  });
  it("T-T-04 缺值 → “—”（undefined/null/空串/NaN）", () => {
    expect(
      renderPrompt("{食物}|{热量}|{天数}|{任务}", { 食物: "", 热量: null, 天数: NaN }).text,
    ).toBe("—|—|—|—");
  });
  it("T-T-05 未知占位符原样保留并返回", () => {
    const r = renderPrompt("{食物}和{饮料}{饮料}", { 食物: "炸鸡" });
    expect(r.text).toBe("炸鸡和{饮料}{饮料}");
    expect(r.unknown).toEqual(["饮料"]);
  });
  it("T-T-06 数值 1 位小数：0.75→0.8，1.04→1，2→2，0.05→0.1", () => {
    expect(renderPrompt("{天数}", { 天数: 0.75 }).text).toBe("0.8");
    expect(renderPrompt("{天数}", { 天数: 1.04 }).text).toBe("1");
    expect(renderPrompt("{天数}", { 天数: 2 }).text).toBe("2");
    expect(renderPrompt("{天数}", { 天数: 0.05 }).text).toBe("0.1");
  });
  it("T-T-07 超长文本与表情符号不受影响", () => {
    const long = "🍰".repeat(500);
    expect(renderPrompt("{食物}😋", { 食物: long }).text).toBe(long + "😋");
    expect(renderPrompt("没有占位符", {}).text).toBe("没有占位符");
  });
});
