/**
 * 只追加积分流水：余额 = Σdelta；撤销 = 追加反向流水，不删除原记录。
 * awardKey：同一个“挣分来源”的稳定键（如 `checkin:${goalId}:${date}`、`meal:${goalId}:${date}:${meal}`），
 * 用来保证“撤销收回当次积分、重打不重复发积分”（2026-11-21 已定）。
 */
export type LedgerReason =
  | "checkin"
  | "streak"
  | "allclear"
  | "milestone"
  | "redeem"
  | "undo"
  | "box"
  | "freezeBuy"
  | "meal"
  | "weighIn"
  | "deposit"
  | "violation"
  | "refund";
export interface LedgerEntry {
  id: string;
  at: number;
  kind: "points" | "xp";
  delta: number;
  reason: LedgerReason;
  refId?: string;
  awardKey?: string; // 挣分来源键；撤销流水沿用被撤销来源的 awardKey
}

export function balanceOf(
  entries: readonly LedgerEntry[],
  kind: "points" | "xp" = "points",
): number {
  return entries.reduce((a, e) => (e.kind === kind ? a + e.delta : a), 0);
}

export function reverseEntry(e: LedgerEntry, id: string, at: number): LedgerEntry {
  return {
    id,
    at,
    kind: e.kind,
    delta: -e.delta,
    reason: "undo",
    refId: e.id,
    ...(e.awardKey ? { awardKey: e.awardKey } : {}),
  };
}

/** 兑换：余额不足拒绝 */
export function canRedeem(balance: number, cost: number): boolean {
  return cost > 0 && balance >= cost;
}

/** 某挣分来源当前“净发放”积分（发放 − 已收回），≥ 0 */
export function netAwarded(entries: readonly LedgerEntry[], awardKey: string): number {
  return Math.max(
    0,
    entries.reduce((a, e) => (e.kind === "points" && e.awardKey === awardKey ? a + e.delta : a), 0),
  );
}

export interface UndoReclaim {
  reclaim: number;
  shortfall: number;
}
/**
 * 撤销打卡收回当次积分：收回 = min(该来源净发放, 当前余额)，余额永不为负。
 * 假设（§13 N-3）：余额不足（积分已被兑换花掉）时只收回余额部分，差额 shortfall 不追讨、不记负债；
 * 因为该来源的净发放仍 > 0，之后“重打”只补发差额（见 recheckAward），不会重复发分。
 */
export function undoReclaim(net: number, balance: number): UndoReclaim {
  const n = Math.max(0, net);
  const reclaim = Math.min(n, Math.max(0, balance));
  return { reclaim, shortfall: n - reclaim };
}

/** 重打 / 再次记录：本次应发 = max(0, 本次计算出的积分 − 该来源净发放) —— 同一来源净发放永远不超过一次的额度 */
export function recheckAward(target: number, net: number): number {
  return Math.max(0, target - Math.max(0, net));
}
