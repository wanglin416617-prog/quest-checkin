/**
 * 单位处理：
 *  - 体重：领域层与 Dexie 一律存“整数克”（g，Q-U1 已定 2026-11-21）。
 *    1 斤 = 500 g，1 kg = 1000 g，因此斤↔kg 互换在整数克上永远精确；显示斤默认保留 1 位小数。
 *  - 金额：一律整数“分”（fen）。1 元 = 100 分。
 *  - 用户输入一律按字符串解析为整数，不经过浮点乘法。
 */
import { assertInt, divRound } from "./int.ts";

export const G_PER_JIN = 500;
export const G_PER_KG = 1000;
export const FEN_PER_YUAN = 100;

export type WeightUnit = "jin" | "kg";

/**
 * 把十进制字符串解析成“放大 10^scale 倍的整数”。
 * 小数位超过 scale 时按四舍五入（半数远离 0）处理；非法输入抛错。
 *   parseScaled('136.2', 1) === 1362
 *   parseScaled('12.345', 2) === 1235
 */
export function parseScaled(input: string, scale: number): number {
  const s = input.trim().replace(/，/g, ".").replace(/。/g, ".");
  const m = /^([+-]?)(\d+)(?:\.(\d*))?$|^([+-]?)\.(\d+)$/.exec(s);
  if (!m) throw new RangeError(`无法解析数字: "${input}"`);
  const sign = (m[1] ?? m[4]) === "-" ? -1 : 1;
  const intPart = m[2] ?? "0";
  const frac = m[3] ?? m[5] ?? "";
  const kept = (frac + "0".repeat(scale)).slice(0, scale);
  const nextDigit = frac.length > scale ? Number(frac[scale]) : 0;
  let v = Number(intPart) * 10 ** scale + (kept ? Number(kept) : 0);
  if (nextDigit >= 5) v += 1;
  const out = sign * v;
  assertInt(out, "parsed");
  return out === 0 ? 0 : out; // 去掉 -0
}

/** 把整数按 scale 位小数格式化，例如 formatScaled(1362, 1) === '136.2' */
export function formatScaled(v: number, scale: number, opts: { trimZeros?: boolean } = {}): string {
  assertInt(v, "v");
  const neg = v < 0;
  const abs = Math.abs(v);
  const p = 10 ** scale;
  const ip = Math.floor(abs / p);
  let fp = scale > 0 ? String(abs % p).padStart(scale, "0") : "";
  if (opts.trimZeros) fp = fp.replace(/0+$/, "");
  return (neg ? "-" : "") + ip + (fp ? "." + fp : "");
}

// ---------- 体重 ----------

/** 用户输入（字符串，单位 jin/kg）→ 整数克。斤最多保留 2 位小数，kg 最多 3 位 */
export function parseWeightToGrams(input: string, unit: WeightUnit): number {
  if (unit === "jin") return parseScaled(input, 2) * 5; // 0.01 斤 = 5 g
  return parseScaled(input, 3); // 0.001 kg = 1 g
}

/** 体重克数校验：必须是正的安全整数（写库前调用） */
export function assertWeightG(g: number): void {
  assertInt(g, "g");
  if (g <= 0) throw new RangeError(`体重必须 > 0 g，收到 ${g}`);
}

/** 整数克 → 显示字符串，默认 1 位小数，四舍五入 */
export function formatWeight(g: number, unit: WeightUnit, decimals = 1): string {
  assertInt(g, "g");
  const per = unit === "jin" ? G_PER_JIN : G_PER_KG;
  const scaled = divRound(g * 10 ** decimals, per);
  return formatScaled(scaled, decimals);
}

export function unitLabel(unit: WeightUnit): string {
  return unit === "jin" ? "斤" : "kg";
}

// ---------- 金额 ----------

/** “12.34” / “12.3” / “12” → 分；超过 2 位小数直接拒绝（金额不允许静默舍入） */
export function parseYuanToFen(input: string): number {
  const s = input
    .trim()
    .replace(/^¥|元$/g, "")
    .replace(/,/g, "");
  if (/\.\d{3,}$/.test(s)) throw new RangeError(`金额最多 2 位小数: "${input}"`);
  return parseScaled(s, 2);
}

/** 分 → “1,234.50” 或 “1234.50” */
export function formatFen(
  fen: number,
  opts: { thousands?: boolean; trimZeros?: boolean } = {},
): string {
  const raw = formatScaled(fen, 2, { trimZeros: opts.trimZeros });
  if (!opts.thousands) return raw;
  const [i, f] = raw.split(".");
  const neg = i!.startsWith("-");
  const digits = neg ? i!.slice(1) : i!;
  const withSep = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return (neg ? "-" : "") + withSep + (f !== undefined ? "." + f : "");
}

export function yuanIntToFen(yuan: number): number {
  assertInt(yuan, "yuan");
  return yuan * FEN_PER_YUAN;
}
