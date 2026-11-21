import { bmiCategory, bmiTenths, BMI_LABEL, computePace } from "@/domain/pace";
import { formatFen, formatWeight, type WeightUnit } from "@/domain/units";

export function weightLabel(grams: number, unit: WeightUnit): string {
  if (grams <= 0) return "0.0";
  return formatWeight(grams, unit);
}

export function yuanLabel(fen: number): string {
  const sign = fen < 0 ? "-" : "";
  return sign + formatFen(Math.abs(fen), { thousands: true, trimZeros: true });
}

export function bmiOf(grams: number, heightCm: number): { text: string; category: string } {
  const tenths = bmiTenths(grams, heightCm);
  const whole = Math.trunc(tenths / 10);
  const frac = Math.abs(tenths % 10);
  return { text: `${whole}.${frac}`, category: BMI_LABEL[bmiCategory(tenths)] };
}

export function paceOf(startG: number, targetG: number, days: number) {
  return computePace(startG, targetG, days);
}

const REASON: Record<string, string> = {
  checkin: "打卡",
  streak: "连胜",
  allclear: "今日全清",
  milestone: "里程碑",
  redeem: "兑换",
  undo: "撤销",
  box: "盲盒",
  freezeBuy: "冻结卡",
  meal: "餐次",
  weighIn: "称重",
  deposit: "存入",
  violation: "扣分",
  refund: "退还",
};

export function reasonLabel(reason: string): string {
  return REASON[reason] ?? reason;
}

/** 流水给用户看的中文，不露出 awardKey 和 UUID。 */
export function ledgerTitle(
  reason: string,
  awardKey: string | undefined,
  names: Readonly<Record<string, string>>,
): string {
  if (reason === "undo") return "撤销收回";
  if (reason === "allclear") return "今日全清奖励";
  const goalId = awardKey?.split(":")[1];
  const name = goalId ? names[goalId] : undefined;
  if (reason === "weighIn") return name ? `${name} · 称重` : "称重";
  if (reason === "deposit") return name ? `${name} · 打卡` : "打卡";
  if (reason === "milestone") return name ? `${name} · 过关` : "过关奖励";
  if (reason === "box") return "盲盒";
  return reasonLabel(reason);
}

export const RARITY_LABEL: Record<string, string> = {
  common: "普通",
  rare: "稀有",
  epic: "史诗",
  legendary: "传说",
};
