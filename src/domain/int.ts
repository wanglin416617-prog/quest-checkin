/**
 * 整数运算工具：业务规则里所有金额（分）、体重（克）都以整数参与计算，
 * 只在需要“比例”时使用以下带明确取整方式的整数除法，杜绝浮点误差。
 */
export function assertInt(n: number, name = "value"): void {
  if (!Number.isSafeInteger(n)) throw new RangeError(`${name} 必须是安全整数，收到 ${n}`);
}

/** 向下取整除法（支持负数，数学意义上的 floor） */
export function divFloor(a: number, b: number): number {
  assertInt(a, "a");
  assertInt(b, "b");
  if (b === 0) throw new RangeError("除数不能为 0");
  const q = Math.trunc(a / b);
  return a % b !== 0 && a < 0 !== b < 0 ? q - 1 : q;
}

/** 向上取整除法 */
export function divCeil(a: number, b: number): number {
  return -divFloor(-a, b);
}

/** 四舍五入（半数远离 0）除法 */
export function divRound(a: number, b: number): number {
  assertInt(a, "a");
  assertInt(b, "b");
  if (b === 0) throw new RangeError("除数不能为 0");
  const sign = a < 0 !== b < 0 ? -1 : 1;
  const A = Math.abs(a),
    B = Math.abs(b);
  return sign * Math.floor((2 * A + B) / (2 * B));
}

export function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}
