/**
 * 里程碑盲盒：稀有度权重 60/25/12/3（可在 Settings.rarityWeights 调整），
 * 奖池中没有可用物品的稀有度不参与，剩余权重重新归一化；同稀有度内均匀抽取。
 * 奖池整体为空 → +30 积分。结果在开箱时写入 LootBox.resultItemId（刷新不变由持久化保证）。
 */
import type { Rng } from "./rng.ts";

export type Rarity = "common" | "rare" | "epic" | "legendary";
export const RARITIES: Rarity[] = ["common", "rare", "epic", "legendary"];
export const DEFAULT_WEIGHTS: Record<Rarity, number> = {
  common: 60,
  rare: 25,
  epic: 12,
  legendary: 3,
};
export const EMPTY_POOL_POINTS = 30;

export interface PoolItem {
  id: string;
  name: string;
  rarity: Rarity;
  kind: "real" | "points" | "freeze";
  amount?: number;
  oneTime: boolean;
  active: boolean;
}

export type LootResult =
  { kind: "item"; item: PoolItem; rarity: Rarity } | { kind: "fallbackPoints"; points: number };

/** 归一化后的有效权重（整数），用于展示概率和抽取 */
export function effectiveWeights(
  pool: PoolItem[],
  weights: Record<Rarity, number> = DEFAULT_WEIGHTS,
): Partial<Record<Rarity, number>> {
  const out: Partial<Record<Rarity, number>> = {};
  for (const r of RARITIES) {
    const w = Math.max(0, Math.round(weights[r] ?? 0));
    if (w > 0 && pool.some((p) => p.active && p.rarity === r)) out[r] = w;
  }
  return out;
}

export function openLootBox(
  pool: PoolItem[],
  rng: Rng,
  weights: Record<Rarity, number> = DEFAULT_WEIGHTS,
): LootResult {
  const eff = effectiveWeights(pool, weights);
  const entries = RARITIES.filter((r) => eff[r] !== undefined).map((r) => [r, eff[r]!] as const);
  const total = entries.reduce((a, [, w]) => a + w, 0);
  if (total === 0) return { kind: "fallbackPoints", points: EMPTY_POOL_POINTS };
  let roll = rng.int(total);
  let rarity: Rarity = entries[0]![0];
  for (const [r, w] of entries) {
    if (roll < w) {
      rarity = r;
      break;
    }
    roll -= w;
  }
  const candidates = pool.filter((p) => p.active && p.rarity === rarity);
  const item = candidates[rng.int(candidates.length)]!;
  return { kind: "item", item, rarity };
}

/** 开箱后处理一次性物品：oneTime → active=false */
export function consumePoolItem(pool: PoolItem[], itemId: string): PoolItem[] {
  return pool.map((p) => (p.id === itemId && p.oneTime ? { ...p, active: false } : p));
}

/**
 * 保底（核心版已定）：连续 9 次未出史诗或传说后，第 10 抽必出史诗。
 * 出史诗或传说后 pity 归零。奖池没有可用史诗时不强制，计数停在门槛上。
 * 奖池全空仍 +30，且不改变 pity。计数由调用方写入 Wallet.pity。
 */
export const PITY_AT = 10;

const EPIC_ONLY: Record<Rarity, number> = { common: 0, rare: 0, epic: 1, legendary: 0 };

export function openLootBoxWithPity(
  pool: PoolItem[],
  rng: Rng,
  pity: number,
  weights: Record<Rarity, number> = DEFAULT_WEIGHTS,
): { result: LootResult; pity: number; guaranteed: boolean } {
  const hasEpic = pool.some((p) => p.active && p.rarity === "epic");
  const guaranteed = pity >= PITY_AT - 1 && hasEpic;
  const result = openLootBox(pool, rng, guaranteed ? EPIC_ONLY : weights);
  if (result.kind === "fallbackPoints") return { result, pity, guaranteed: false };
  if (result.kind === "item" && (result.rarity === "epic" || result.rarity === "legendary")) {
    return { result, pity: 0, guaranteed };
  }
  if (pity >= PITY_AT - 1 && !hasEpic) return { result, pity, guaranteed: false };
  return { result, pity: pity + 1, guaranteed: false };
}
