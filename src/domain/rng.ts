/** 随机数：生产用 crypto.getRandomValues（拒绝采样，无取模偏差）；测试注入可复现的种子 RNG */
export interface Rng {
  int(maxExclusive: number): number;
}

export const cryptoRng: Rng = {
  int(max: number): number {
    if (!Number.isInteger(max) || max <= 0 || max > 2 ** 32)
      throw new RangeError("max 必须是 1..2^32 的整数");
    const limit = Math.floor(2 ** 32 / max) * max;
    const buf = new Uint32Array(1);
    for (;;) {
      globalThis.crypto.getRandomValues(buf);
      if (buf[0]! < limit) return buf[0]! % max;
    }
  },
};

/** mulberry32 种子 RNG，仅用于测试/模拟 */
export function seededRng(seed: number): Rng {
  let a = seed >>> 0;
  return {
    int(max: number): number {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      const r = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      return Math.floor(r * max);
    },
  };
}
